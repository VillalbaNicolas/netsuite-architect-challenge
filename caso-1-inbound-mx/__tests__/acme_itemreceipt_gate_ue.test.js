const query = require('N/query');
const runtime = require('N/runtime');
const gate = require('../src/FileCabinet/SuiteScripts/acme_inbship/acme_itemreceipt_gate_ue');
const { fakeRecord, ctx } = require('./helpers/fake');

const facts = (f) => jest.spyOn(query, 'runSuiteQL').mockReturnValue({ asMappedResults: () => (f ? [f] : []) });
const ready = { shipmentnumber: 'INBSHIP-MX-0001', lcrows: 4, lcstatus: '3', customsno: '26471234 6001234' };
const receipt = (body = {}, lines = [{ item: '10', itemreceive: true, cseg_acme_customs: '7' }]) =>
  fakeRecord({ body: { inboundshipment: '5001', cseg_acme_customs: '7', ...body }, lines });

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

test('only acts on create', () => {
  const spy = facts({ ...ready, lcrows: 0 });
  expect(() => gate.beforeSubmit(ctx(receipt(), 'edit'))).not.toThrow();
  expect(spy).not.toHaveBeenCalled();
});

test('finds the shipment on the lines when the header link is empty', () => {
  facts({ ...ready, lcrows: 0 });
  const rec = fakeRecord({ body: { cseg_acme_customs: '7' }, lines: [{ item: '10', inboundshipment: '5001' }] });
  expect(() => gate.beforeSubmit(ctx(rec))).toThrow(expect.objectContaining({ name: 'ACME_GATE_NO_LANDED_COST' }));
});

test('blocks when the shipment has no landed cost rows', () => {
  facts({ ...ready, lcrows: 0 });
  expect(() => gate.beforeSubmit(ctx(receipt()))).toThrow(expect.objectContaining({ name: 'ACME_GATE_NO_LANDED_COST' }));
});

test('blocks when landed cost is not confirmed', () => {
  facts({ ...ready, lcstatus: '2' });
  expect(() => gate.beforeSubmit(ctx(receipt()))).toThrow(expect.objectContaining({ name: 'ACME_GATE_LC_NOT_CONFIRMED' }));
});

test('blocks when the shipment has no customs number', () => {
  facts({ ...ready, customsno: null });
  expect(() => gate.beforeSubmit(ctx(receipt()))).toThrow(expect.objectContaining({ name: 'ACME_GATE_NO_CUSTOMS' }));
});

test('blocks when the receipt has no customs segment', () => {
  facts(ready);
  expect(() => gate.beforeSubmit(ctx(receipt({ cseg_acme_customs: null })))).toThrow(expect.objectContaining({ name: 'ACME_GATE_NO_CUSTOMS' }));
});

test('warn-only mode logs instead of blocking', () => {
  runtime.__setParams({ custscript_acme_gate_lc_confirmed_id: '3', custscript_acme_gate_enforce_lc: false });
  facts({ ...ready, lcrows: 0 });
  expect(() => gate.beforeSubmit(ctx(receipt()))).not.toThrow();
});
