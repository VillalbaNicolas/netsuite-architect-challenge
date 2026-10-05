/**
 * acme_inbship_gate_ue.js — On the Inbound Shipment (view mode), disable the Receive button and show why
 * when the shipment is not ready to be received (same rules as acme_itemreceipt_gate_ue).
 * Never throws: a failure only means the button stays enabled.
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/query', 'N/runtime', 'N/ui/serverWidget', 'N/log'], (query, runtime, serverWidget, log) => {

    const P = { confirmedId: 'custscript_acme_gate2_lc_confirmed_id' };
    const RECEIVABLE = ['inTransit', 'toBeShipped', 'partiallyReceived'];

    const facts = (shipId) => {
        const rows = query.runSuiteQL({
            query: `SELECT s.custrecord_acme_inb_lc_status AS lcstatus, s.custrecord_acme_inb_customs_no AS customsno,
                           (SELECT COUNT(*) FROM inboundshipmentlandedcost l WHERE l.landedcostinboundshipment = s.id) AS lcrows
                    FROM inboundshipment s WHERE s.id = ?`, params: [shipId] }).asMappedResults();
        return rows.length ? rows[0] : null;
    };

    const beforeLoad = (ctx) => {
        try {
            if (ctx.type !== ctx.UserEventType.VIEW) return;
            const rec = ctx.newRecord;
            if (!RECEIVABLE.includes(String(rec.getValue('shipmentstatus') || ''))) return;
            const f = facts(rec.id);
            if (!f) return;
            const confirmedId = String(runtime.getCurrentScript().getParameter({ name: P.confirmedId }) || '3');
            const problems = [];
            if (Number(f.lcrows || 0) === 0) problems.push('landed cost not loaded');
            if (String(f.lcstatus || '') !== confirmedId) problems.push('Landed Cost Status is not Confirmed');
            if (!f.customsno) problems.push('customs clearance number missing');
            if (!problems.length) return;

            const b = ctx.form.getButton('receive');
            if (b) b.isDisabled = true;
            const msg = ctx.form.addField({ id: 'custpage_acme_gate_msg', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
            msg.defaultValue = '<div style="background:#fde8e8;border:1px solid #d33;color:#900;padding:8px 12px">'
                + '<b>Receiving blocked:</b> ' + problems.join(' · ') + '.</div>';
            msg.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE });
        } catch (e) {
            log.error('acme_inbship_gate_ue beforeLoad', e.message);
        }
    };

    return { beforeLoad };
});
