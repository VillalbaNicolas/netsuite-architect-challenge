/**
 * acme_itemreceipt_gate_ue.js — Receipt gate: blocks Item Receipts created from an Inbound Shipment
 * when the shipment is not ready to be received.
 *
 * beforeSubmit (create):
 *   R1  the shipment has at least one landed-cost row
 *   R2  the shipment's Landed Cost Status is Confirmed
 *   R3  the customs clearance number is set on the shipment and the customs segment on the receipt
 * Receipts not linked to an inbound shipment are ignored.
 * Each rule can be set to warn-only via script parameter (logs instead of throwing).
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

    const param = (id) => runtime.getCurrentScript().getParameter({ name: id });

    const shipmentFacts = (shipId) => {
        const rows = query.runSuiteQL({
            query: `SELECT s.shipmentnumber, s.custrecord_acme_inb_lc_status AS lcstatus,
                           s.custrecord_acme_inb_customs_no AS customsno,
                           (SELECT COUNT(*) FROM inboundshipmentlandedcost l WHERE l.landedcostinboundshipment = s.id) AS lcrows
                    FROM inboundshipment s WHERE s.id = ?`,
            params: [shipId]
        }).asMappedResults();
        return rows.length ? rows[0] : null;
    };

    const stop = (code, msg) => { throw error.create({ name: code, message: msg, notifyOff: true }); };
    const check = (enforced, code, msg) => { if (enforced) stop(code, msg); else log.audit('gate warn-only', msg); };

    // The header link can be empty; fall back to the line-level link.
    const findShipment = (rec) => {
        const shipId = rec.getValue('inboundshipment');
        if (shipId) return shipId;
        const n = rec.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < n; i++) {
            const v = rec.getSublistValue({ sublistId: 'item', line: i, fieldId: 'inboundshipment' });
            if (v) return v;
        }
        return null;
    };

    const beforeSubmit = (ctx) => {
        if (ctx.type !== ctx.UserEventType.CREATE) return;
        const rec = ctx.newRecord;
        const shipId = findShipment(rec);
        if (!shipId) return;

        const f = shipmentFacts(shipId);
        if (!f) { log.error('gate', 'shipment not found ' + shipId); return; }
        const tag = (f.shipmentnumber || ('shipment ' + shipId)) + ': ';
        const confirmedId = String(param(P.confirmedId) || '');

        if (Number(f.lcrows || 0) === 0) {
            check(param(P.enforceLc) !== false, 'ACME_GATE_NO_LANDED_COST',
                tag + 'landed cost is not loaded on the shipment. Costs must load it before receiving.');
        }
        if (!confirmedId) {
            log.error('gate', 'parameter ' + P.confirmedId + ' not set, R2 skipped');
        } else if (String(f.lcstatus || '') !== confirmedId) {
            check(param(P.enforceLcStatus) !== false, 'ACME_GATE_LC_NOT_CONFIRMED',
                tag + 'Landed Cost Status is not Confirmed. Costs must confirm the landed cost before receiving.');
        }
        const enforceCustoms = param(P.enforceCustoms) !== false;
        if (!f.customsno) {
            check(enforceCustoms, 'ACME_GATE_NO_CUSTOMS', tag + 'customs clearance number is missing on the shipment.');
        } else if (!rec.getValue(CUSTOMS_SEGMENT)) {
            check(enforceCustoms, 'ACME_GATE_NO_CUSTOMS', tag + 'customs segment is not set on the receipt.');
        }
    };

    return { beforeSubmit };
});
