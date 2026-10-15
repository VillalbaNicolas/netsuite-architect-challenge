const fs = require('fs');
const path = require('path');
const query = require('N/query');
const runtime = require('N/runtime');
const log = require('N/log');
const gate = require('../src/FileCabinet/SuiteScripts/acme_inbship/acme_itemreceipt_gate_ue');
const { fakeRecord, ctx } = require('./helpers/fake');

const PEDIMENTO = '26471234 6001234';
// Segment value '7' is the customs number of the ready shipment; '8' belongs to another one.
const SEGMENTS = [{ id: 7, name: PEDIMENTO }, { id: 8, name: '26471234 6009999' }];

// runSuiteQL answers by table: shipments (only the ids asked for) or customs segment values.
const facts = (...ships) => jest.spyOn(query, 'runSuiteQL').mockImplementation(({ query: sql, params }) => ({
  asMappedResults: () => (sql.includes('customrecord_cseg_acme_customs')
    ? SEGMENTS
    : ships.filter((s) => s && params.map(String).includes(String(s.id)))),
}));
const ready = { id: 5001, shipmentnumber: 'INBSHIP-MX-0001', lcrows: 4, lcstatus: '3', customsno: PEDIMENTO };
const receipt = (body = {}, lines = [{ item: '10', itemreceive: true, cseg_acme_customs: '7' }]) =>
  fakeRecord({ body: { inboundshipment: '5001', cseg_acme_customs: '7', ...body }, lines });
const blocks = (rec, name, type) => expect(() => gate.beforeSubmit(ctx(rec, type))).toThrow(expect.objectContaining({ name }));

beforeEach(() => { jest.restoreAllMocks(); runtime.__setParams({ custscript_acme_gate_lc_confirmed_id: '3' }); });

test('lets a ready shipment be received', () => {
  facts(ready);
  expect(() => gate.beforeSubmit(ctx(receipt()))).not.toThrow();
});

test('ignores receipts that do not come from an inbound shipment', () => {
  const spy = facts(ready);
  gate.beforeSubmit(ctx(fakeRecord({ body: {}, lines: [{ item: '10' }] })));
  expect(spy).not.toHaveBeenCalled();
});

test('does not act on delete', () => {
  const spy = facts({ ...ready, lcrows: 0 });
  expect(() => gate.beforeSubmit(ctx(receipt(), 'delete'))).not.toThrow();
  expect(spy).not.toHaveBeenCalled();
});

test('finds the shipment on the lines when the header link is empty', () => {
  facts({ ...ready, lcrows: 0 });
  const rec = fakeRecord({ body: { cseg_acme_customs: '7' }, lines: [{ item: '10', inboundshipment: '5001', cseg_acme_customs: '7' }] });
  blocks(rec, 'ACME_GATE_NO_LANDED_COST');
});

test('blocks when the shipment has no landed cost rows', () => {
  facts({ ...ready, lcrows: 0 });
  blocks(receipt(), 'ACME_GATE_NO_LANDED_COST');
});

test('blocks when landed cost is not confirmed', () => {
  facts({ ...ready, lcstatus: '2' });
  blocks(receipt(), 'ACME_GATE_LC_NOT_CONFIRMED');
});

test('blocks when the shipment has no customs number', () => {
  facts({ ...ready, customsno: null });
  blocks(receipt(), 'ACME_GATE_NO_CUSTOMS');
});

test('blocks when the receipt has no customs segment', () => {
  facts(ready);
  blocks(receipt({ cseg_acme_customs: null }), 'ACME_GATE_NO_CUSTOMS');
});

test('warn-only mode logs instead of blocking', () => {
  runtime.__setParams({ custscript_acme_gate_lc_confirmed_id: '3', custscript_acme_gate_enforce_lc: false });
  facts({ ...ready, lcrows: 0 });
  const audit = jest.spyOn(log, 'audit');
  expect(() => gate.beforeSubmit(ctx(receipt()))).not.toThrow();
  expect(audit).toHaveBeenCalledWith('gate warn-only', expect.stringMatching(/landed cost is not loaded/));
});

// --- Regressions from the September close -------------------------------------------------------

describe('bulk Receive Inbound Shipment (shipments 5009, 5017, 5025, 5039 received without landed cost)', () => {
  test('the deployment has no execution-context whitelist (the bulk process was outside it)', () => {
    const xml = fs.readFileSync(path.join(__dirname, '../src/Objects/customscript_acme_itemreceipt_gate_ue.xml'), 'utf8');
    expect(xml).toMatch(/<recordtype>ITEMRECEIPT<\/recordtype>/);
    expect(xml).not.toMatch(/<executioncontext>/);
  });
});

describe('customs segment (9 received lines without segment in IR 9007, 9010, 9020, 9043)', () => {
  test('blocks when a received line has no customs segment', () => {
    facts(ready);
    const rec = receipt({}, [
      { item: '10', itemreceive: true, cseg_acme_customs: '7' },
      { item: '11', itemreceive: true, cseg_acme_customs: null },
    ]);
    blocks(rec, 'ACME_GATE_NO_CUSTOMS');
  });

  test('ignores lines that are not being received', () => {
    facts(ready);
    const rec = receipt({}, [
      { item: '10', itemreceive: true, cseg_acme_customs: '7' },
      { item: '11', itemreceive: false, cseg_acme_customs: null },
    ]);
    expect(() => gate.beforeSubmit(ctx(rec))).not.toThrow();
  });

  test('blocks when the header segment is not the shipment customs number', () => {
    facts(ready);
    blocks(receipt({ cseg_acme_customs: '8' }, [{ item: '10', itemreceive: true, cseg_acme_customs: '7' }]), 'ACME_GATE_CUSTOMS_MISMATCH');
  });

  test('blocks when a line segment is not the shipment customs number', () => {
    facts(ready);
    blocks(receipt({}, [{ item: '10', itemreceive: true, cseg_acme_customs: '8' }]), 'ACME_GATE_CUSTOMS_MISMATCH');
  });

  test('compares each line with the customs number of its own shipment', () => {
    facts(ready, { ...ready, id: 5002, shipmentnumber: 'INBSHIP-MX-0002', customsno: '26471234 6009999' });
    const rec = fakeRecord({
      body: {},
      lines: [
        { item: '10', itemreceive: true, inboundshipment: '5001', cseg_acme_customs: '7' },
        { item: '11', itemreceive: true, inboundshipment: '5002', cseg_acme_customs: '7' },
      ],
    });
    blocks(rec, 'ACME_GATE_CUSTOMS_MISMATCH');
  });

  test('accepts a mixed receipt when every line matches its own shipment', () => {
    facts(ready, { ...ready, id: 5002, shipmentnumber: 'INBSHIP-MX-0002', customsno: '26471234 6009999' });
    const rec = fakeRecord({
      body: {},
      lines: [
        { item: '10', itemreceive: true, inboundshipment: '5001', cseg_acme_customs: '7' },
        { item: '11', itemreceive: true, inboundshipment: '5002', cseg_acme_customs: '8' },
      ],
    });
    expect(() => gate.beforeSubmit(ctx(rec))).not.toThrow();
  });

  test('blocks a received line without shipment link and without segment on a receipt from a shipment', () => {
    facts(ready);
    const rec = fakeRecord({
      body: {},
      lines: [
        { item: '10', itemreceive: true, inboundshipment: '5001', cseg_acme_customs: '7' },
        { item: '11', itemreceive: true, cseg_acme_customs: null },
      ],
    });
    blocks(rec, 'ACME_GATE_NO_CUSTOMS');
  });
});

describe('fail-closed configuration', () => {
  test('blocks when the Confirmed status id parameter is empty instead of skipping R2', () => {
    runtime.__setParams({});
    facts({ ...ready, lcstatus: '1' });
    blocks(receipt(), 'ACME_GATE_MISCONFIGURED');
  });

  test('does not require the Confirmed id when R2 is warn-only', () => {
    runtime.__setParams({ custscript_acme_gate_enforce_lcstatus: false });
    facts(ready);
    expect(() => gate.beforeSubmit(ctx(receipt()))).not.toThrow();
  });

  test('blocks when a linked shipment cannot be read', () => {
    facts();
    blocks(receipt(), 'ACME_GATE_SHIPMENT_NOT_FOUND');
  });

  test.each([[false], ['F']])('checkbox %p turns a rule to warn-only', (off) => {
    runtime.__setParams({ custscript_acme_gate_lc_confirmed_id: '3', custscript_acme_gate_enforce_lc: off });
    facts({ ...ready, lcrows: 0 });
    expect(() => gate.beforeSubmit(ctx(receipt()))).not.toThrow();
  });

  test.each([[true], ['T'], [null]])('checkbox %p keeps a rule enforced', (on) => {
    runtime.__setParams({ custscript_acme_gate_lc_confirmed_id: '3', custscript_acme_gate_enforce_lc: on });
    facts({ ...ready, lcrows: 0 });
    blocks(receipt(), 'ACME_GATE_NO_LANDED_COST');
  });
});

describe('scope', () => {
  test('validates edits that change links or segments, so a receipt cannot be edited into a bad state', () => {
    facts(ready);
    const rec = receipt({ cseg_acme_customs: null });
    expect(() => gate.beforeSubmit(ctx(rec, 'edit', undefined, receipt()))).toThrow(expect.objectContaining({ name: 'ACME_GATE_NO_CUSTOMS' }));
  });

  test('lets a historical receipt be edited when links and segments did not change (e.g. memo)', () => {
    const spy = facts(ready);
    const old = receipt({ cseg_acme_customs: null });
    const rec = receipt({ cseg_acme_customs: null, memo: 'fixed typo' });
    expect(() => gate.beforeSubmit(ctx(rec, 'edit', undefined, old))).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  test('validates every shipment on a receipt that mixes several', () => {
    facts(ready, { ...ready, id: 5002, shipmentnumber: 'INBSHIP-MX-0002', lcrows: 0 });
    const rec = fakeRecord({
      body: { cseg_acme_customs: '7' },
      lines: [
        { item: '10', itemreceive: true, inboundshipment: '5001', cseg_acme_customs: '7' },
        { item: '11', itemreceive: true, inboundshipment: '5002', cseg_acme_customs: '7' },
      ],
    });
    blocks(rec, 'ACME_GATE_NO_LANDED_COST');
  });
});
