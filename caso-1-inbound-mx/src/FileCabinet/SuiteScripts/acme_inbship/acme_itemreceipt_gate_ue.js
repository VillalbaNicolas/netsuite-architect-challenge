/**
 * acme_itemreceipt_gate_ue.js — Receipt gate: blocks Item Receipts created from an Inbound Shipment
 * when the shipment is not ready to be received.
 *
 * beforeSubmit (create; edit only when the shipment links or customs segments change):
 *   R1  every linked shipment has at least one landed-cost row
 *   R2  every linked shipment's Landed Cost Status is Confirmed
 *   R3  every linked shipment has a customs clearance number; every received line has the customs
 *       segment, matching the customs number of the shipment it belongs to; when the header is linked to
 *       a shipment, the header segment must match it too
 * Receipts not linked to an inbound shipment are ignored.
 * Each rule can be set to warn-only via script parameter (logs instead of throwing).
 * Fail-closed: missing configuration for an enforced rule, or a linked shipment that cannot be read,
 * blocks the receipt.
 *
 * The deployment has no execution-context whitelist on purpose: receipts created by the bulk
 * "Receive Inbound Shipment" process skipped the gate because their context was not in the list.
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/query', 'N/runtime', 'N/error', 'N/log'], (query, runtime, error, log) => {

    const P = {
        enforceLc: 'custscript_acme_gate_enforce_lc',
        enforceLcStatus: 'custscript_acme_gate_enforce_lcstatus',
        enforceCustoms: 'custscript_acme_gate_enforce_customs',
        confirmedId: 'custscript_acme_gate_lc_confirmed_id'
    };
    const CUSTOMS_SEGMENT = 'cseg_acme_customs';
    const CUSTOMS_SEGMENT_TABLE = 'customrecord_cseg_acme_customs';

    const param = (id) => runtime.getCurrentScript().getParameter({ name: id });
    // Checkbox parameters may come back as boolean or 'T'/'F'; anything but an explicit "off" enforces.
    const enforced = (id) => { const v = param(id); return !(v === false || v === 'F'); };

    const inList = (ids) => ids.map(() => '?').join(', ');

    const shipmentFacts = (shipIds) => query.runSuiteQL({
        query: `SELECT s.id, s.shipmentnumber, s.custrecord_acme_inb_lc_status AS lcstatus,
                       s.custrecord_acme_inb_customs_no AS customsno,
                       (SELECT COUNT(*) FROM inboundshipmentlandedcost l WHERE l.landedcostinboundshipment = s.id) AS lcrows
                FROM inboundshipment s WHERE s.id IN (${inList(shipIds)})`,
        params: shipIds
    }).asMappedResults();

    // Segment values are stored as ids; the customs number is their name.
    const segmentNames = (segIds) => {
        const names = {};
        if (!segIds.length) return names;
        query.runSuiteQL({
            query: `SELECT id, name FROM ${CUSTOMS_SEGMENT_TABLE} WHERE id IN (${inList(segIds)})`,
            params: segIds
        }).asMappedResults().forEach((r) => { names[String(r.id)] = String(r.name || ''); });
        return names;
    };

    const stop = (code, msg) => { throw error.create({ name: code, message: msg, notifyOff: true }); };
    const check = (isEnforced, code, msg) => { if (isEnforced) stop(code, msg); else log.audit('gate warn-only', msg); };

    const normalize = (v) => String(v || '').replace(/\s/g, '');

    // Received lines with the shipment they belong to. The header link can be empty and a receipt
    // can mix lines from several shipments, so each line falls back to the header link.
    const receivedLines = (rec) => {
        const headerShip = rec.getValue('inboundshipment');
        const out = [];
        const n = rec.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < n; i++) {
            const get = (fieldId) => rec.getSublistValue({ sublistId: 'item', line: i, fieldId });
            if (get('itemreceive') === false || get('itemreceive') === 'F') continue;
            out.push({ line: i + 1, shipId: get('inboundshipment') || headerShip || null, segment: get(CUSTOMS_SEGMENT) });
        }
        return { headerShip, lines: out };
    };

    const signature = (rec) => {
        if (!rec) return '';
        const { headerShip, lines } = receivedLines(rec);
        return [headerShip, rec.getValue(CUSTOMS_SEGMENT), ...lines.map((l) => [l.line, l.shipId, l.segment].join(':'))].join('|');
    };

    const beforeSubmit = (ctx) => {
        if (ctx.type !== ctx.UserEventType.CREATE && ctx.type !== ctx.UserEventType.EDIT) return;
        const rec = ctx.newRecord;
        const { headerShip, lines } = receivedLines(rec);
        const shipIds = [...new Set([headerShip, ...lines.map((l) => l.shipId)].filter(Boolean).map(String))];
        if (!shipIds.length) return;
        // Editing a historical receipt (memo, etc.) must not fail: re-validate only if links or segments changed.
        if (ctx.type === ctx.UserEventType.EDIT && signature(rec) === signature(ctx.oldRecord)) return;

        const confirmedId = String(param(P.confirmedId) || '');
        if (!confirmedId && enforced(P.enforceLcStatus)) stop('ACME_GATE_MISCONFIGURED', 'parameter ' + P.confirmedId + ' is not set; receipts from inbound shipments are blocked until it is.');

        const facts = {};
        shipmentFacts(shipIds).forEach((f) => { facts[String(f.id)] = f; });
        const missing = shipIds.filter((id) => !facts[id]);
        if (missing.length) stop('ACME_GATE_SHIPMENT_NOT_FOUND', 'inbound shipment ' + missing.join(', ') + ' could not be read; the receipt cannot be validated.');

        const enforceCustoms = enforced(P.enforceCustoms);
        const headerSegment = rec.getValue(CUSTOMS_SEGMENT);
        const names = segmentNames([...new Set([headerSegment, ...lines.map((l) => l.segment)].filter(Boolean).map(String))]);

        shipIds.forEach((id) => {
            const f = facts[id];
            const tag = (f.shipmentnumber || ('shipment ' + id)) + ': ';
            if (Number(f.lcrows || 0) === 0) {
                check(enforced(P.enforceLc), 'ACME_GATE_NO_LANDED_COST',
                    tag + 'landed cost is not loaded on the shipment. Costs must load it before receiving.');
            }
            if (confirmedId && String(f.lcstatus || '') !== confirmedId) {
                check(enforced(P.enforceLcStatus), 'ACME_GATE_LC_NOT_CONFIRMED',
                    tag + 'Landed Cost Status is not Confirmed. Costs must confirm the landed cost before receiving.');
            }
            if (!f.customsno) {
                check(enforceCustoms, 'ACME_GATE_NO_CUSTOMS', tag + 'customs clearance number is missing on the shipment.');
                return;
            }
            const expected = normalize(f.customsno);
            if (id === String(headerShip || '')) {
                if (!headerSegment) {
                    check(enforceCustoms, 'ACME_GATE_NO_CUSTOMS', tag + 'customs segment is not set on the receipt.');
                } else if (normalize(names[String(headerSegment)]) !== expected) {
                    check(enforceCustoms, 'ACME_GATE_CUSTOMS_MISMATCH', tag + 'customs segment on the receipt does not match the shipment customs number.');
                }
            }
            lines.filter((l) => l.shipId && String(l.shipId) === id).forEach((l) => {
                if (!l.segment) {
                    check(enforceCustoms, 'ACME_GATE_NO_CUSTOMS', tag + 'customs segment is not set on line ' + l.line + '.');
                } else if (normalize(names[String(l.segment)]) !== expected) {
                    check(enforceCustoms, 'ACME_GATE_CUSTOMS_MISMATCH', tag + 'customs segment on line ' + l.line + ' does not match the shipment customs number.');
                }
            });
        });

        // Received lines that cannot be attributed to a shipment still need the customs segment.
        lines.filter((l) => !l.shipId && !l.segment).forEach((l) => {
            check(enforceCustoms, 'ACME_GATE_NO_CUSTOMS', 'customs segment is not set on line ' + l.line + ' (line not linked to an inbound shipment).');
        });
    };

    return { beforeSubmit };
});
