/**
 * acme_pedimento_gate_ue.js — Last barrier before the CFDI: blocks an Andina MX item fulfillment or
 * invoice when an imported lot on it has no row in the localization bundle's pedimento master
 * (item + location + lot), or the row has no pedimento. Without that row the bundle stamps the CFDI
 * without the pedimento number.
 *
 * Deployed on ITEMFULFILLMENT (where the lot is assigned in the standard SO → fulfillment → invoice flow)
 * and on INVOICE (for invoices that carry their own inventory detail).
 *
 * beforeSubmit (create; edit only when the assigned lots change), only for the MX subsidiary:
 *   every assigned lot that carries a pedimento (15 digits, spaces ignored, optionally followed by
 *   "-<manufacturing lot>" for regulated items) must have a master row for the line's item and location
 *   with a pedimento. Lots that do not carry a pedimento (local purchases) are ignored.
 *
 * The master record belongs to the bundle; its record and field ids are script parameters so they can be
 * set to the bundle's real ids (to be confirmed with the vendor) without changing code.
 * Fail-closed when enforced: if the configuration is missing, documents with imported lots are blocked;
 * documents without imported lots are never affected. In warn-only mode (the initial rollout) every finding,
 * including missing configuration, is only logged.
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/query', 'N/runtime', 'N/error', 'N/log'], (query, runtime, error, log) => {

    const P = {
        subsidiary: 'custscript_acme_pedgate_mx_sub',
        enforce: 'custscript_acme_pedgate_enforce',
        masterType: 'custscript_acme_pedgate_mst_type',
        fItem: 'custscript_acme_pedgate_mst_item',
        fLocation: 'custscript_acme_pedgate_mst_loc',
        fLot: 'custscript_acme_pedgate_mst_lot',
        fPedimento: 'custscript_acme_pedgate_mst_ped'
    };
    const PEDIMENTO = /^\d{15}(-.+)?$/;
    const SQL_ID = /^[a-z][a-z0-9_]*$/i;

    const param = (id) => runtime.getCurrentScript().getParameter({ name: id });
    const isEnforced = () => { const v = param(P.enforce); return !(v === false || v === 'F'); };
    const normalize = (v) => String(v || '').replace(/\s/g, '');
    const inList = (ids) => ids.map(() => '?').join(', ');

    const stop = (code, msg) => { throw error.create({ name: code, message: msg, notifyOff: true }); };
    // Blocks when enforced; otherwise logs. Returns false so callers can stop validating.
    const fail = (code, msg) => { if (isEnforced()) stop(code, msg); log.audit('pedimento gate warn-only', code + ': ' + msg); return false; };

    // Lots assigned on each item line: [{ line, item, location, lotId }]
    const assignedLots = (rec) => {
        const out = [];
        if (!rec) return out;
        const headerLocation = rec.getValue('location');
        const n = rec.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < n; i++) {
            const get = (fieldId) => rec.getSublistValue({ sublistId: 'item', line: i, fieldId });
            if (!rec.hasSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i })) continue;
            const detail = rec.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: i });
            const m = detail.getLineCount({ sublistId: 'inventoryassignment' });
            for (let j = 0; j < m; j++) {
                const lotId = detail.getSublistValue({ sublistId: 'inventoryassignment', line: j, fieldId: 'issueinventorynumber' });
                if (lotId) out.push({ line: i + 1, item: String(get('item')), location: String(get('location') || headerLocation || ''), lotId: String(lotId) });
            }
        }
        return out;
    };

    const signature = (lots) => lots.map((a) => [a.item, a.location, a.lotId].join('|')).sort().join(';');

    const lotNames = (lotIds) => {
        const names = {};
        query.runSuiteQL({
            query: `SELECT id, inventorynumber FROM inventorynumber WHERE id IN (${inList(lotIds)})`,
            params: lotIds
        }).asMappedResults().forEach((r) => { names[String(r.id)] = String(r.inventorynumber || ''); });
        return names;
    };

    const masterConfig = () => {
        const cfg = {
            type: param(P.masterType), item: param(P.fItem), location: param(P.fLocation),
            lot: param(P.fLot), pedimento: param(P.fPedimento)
        };
        const bad = Object.keys(cfg).filter((k) => !cfg[k] || !SQL_ID.test(String(cfg[k])));
        if (bad.length) return fail('ACME_PEDGATE_MISCONFIGURED', 'pedimento master parameters are missing or invalid (' + bad.join(', ') + '); documents with imported lots are blocked until they are set.') || null;
        return cfg;
    };

    // Master rows keyed by item|location|lot -> pedimento
    const masterRows = (cfg, lots) => {
        const rows = {};
        query.runSuiteQL({
            query: `SELECT m.${cfg.item} AS item, m.${cfg.location} AS location, m.${cfg.lot} AS lot, m.${cfg.pedimento} AS pedimento
                    FROM ${cfg.type} m WHERE m.${cfg.lot} IN (${inList(lots)})`,
            params: lots
        }).asMappedResults().forEach((r) => {
            rows[[r.item, r.location, normalize(r.lot)].join('|')] = normalize(r.pedimento);
        });
        return rows;
    };

    const beforeSubmit = (ctx) => {
        if (ctx.type !== ctx.UserEventType.CREATE && ctx.type !== ctx.UserEventType.EDIT) return;
        const rec = ctx.newRecord;
        const mxSubsidiary = String(param(P.subsidiary) || '');
        if (mxSubsidiary && String(rec.getValue('subsidiary') || '') !== mxSubsidiary) return;

        const assigned = assignedLots(rec);
        if (!assigned.length) return;
        // Editing a historical document (memo, approval...) must not fail: re-validate only if the lots changed.
        if (ctx.type === ctx.UserEventType.EDIT && signature(assigned) === signature(assignedLots(ctx.oldRecord))) return;

        const names = lotNames([...new Set(assigned.map((a) => a.lotId))]);
        const imported = assigned
            .map((a) => ({ ...a, rawLot: names[a.lotId] || '', lot: normalize(names[a.lotId]) }))
            .filter((a) => PEDIMENTO.test(a.lot));
        if (!imported.length) return;

        if (!mxSubsidiary && !fail('ACME_PEDGATE_MISCONFIGURED', 'parameter ' + P.subsidiary + ' is not set; documents with imported lots are blocked until it is.')) return;
        const cfg = masterConfig();
        if (!cfg) return;
        // The master stores the lot as the bundle wrote it; look it up as is, compare without spaces.
        const rows = masterRows(cfg, [...new Set(imported.map((a) => a.rawLot))]);
        const problems = imported
            .filter((a) => !rows[[a.item, a.location, a.lot].join('|')])
            .map((a) => 'line ' + a.line + ' lot ' + a.lot);
        if (!problems.length) return;

        const msg = 'imported lots without pedimento in the pedimento master (the CFDI would be stamped without it): '
            + problems.join('; ') + '. Fiscal/Comex must complete the master before shipping or invoicing.';
        fail('ACME_PEDGATE_NO_PEDIMENTO', msg);
    };

    return { beforeSubmit };
});
