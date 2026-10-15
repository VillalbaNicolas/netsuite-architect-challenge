const fs = require('fs');
const path = require('path');
const query = require('N/query');
const runtime = require('N/runtime');
const log = require('N/log');
const gate = require('../src/FileCabinet/SuiteScripts/acme_inbship/acme_pedimento_gate_ue');
const { fakeRecord, ctx } = require('./helpers/fake');

// Lots from the September close: 269670678128727 came through the port flow and has a master row;
// 263649069321915 was received directly at MX-CD-QRO and has none (CFDI stamped without pedimento).
const LOTS = {
  301: '269670678128727', 302: '263649069321915', 303: 'L-LOCAL-0042',
  304: '263649069321915-L373483', // regulated: pedimento + manufacturing lot (case 3 design)
  305: '26  96  7067  8128727',   // pedimento written in the CFDI format, with spaces
};
const MASTER = [{ item: 10, location: 2, lot: '269670678128727', pedimento: '269670678128727' }];
const PARAMS = {
  custscript_acme_pedgate_mx_sub: '3',
  custscript_acme_pedgate_enforce: true,
  custscript_acme_pedgate_mst_type: 'customrecord_mx_pedimento_master',
  custscript_acme_pedgate_mst_item: 'custrecord_mxpm_item',
  custscript_acme_pedgate_mst_loc: 'custrecord_mxpm_location',
  custscript_acme_pedgate_mst_lot: 'custrecord_mxpm_lot',
  custscript_acme_pedgate_mst_ped: 'custrecord_mxpm_pedimento',
};

const data = (master = MASTER) => jest.spyOn(query, 'runSuiteQL').mockImplementation(({ query: sql, params }) => ({
  asMappedResults: () => (sql.includes('FROM inventorynumber')
    ? params.map((id) => ({ id, inventorynumber: LOTS[id] }))
    : master),
}));
// Works for item fulfillments and invoices alike: the lot is in each line's inventory detail.
const doc = (lots, body = {}) => fakeRecord({
  body: { subsidiary: '3', location: '2', ...body },
  lines: lots.map((lot) => ({ item: '10', inventorydetail: [{ issueinventorynumber: String(lot) }] })),
});
const blocks = (rec, name, type, old) => expect(() => gate.beforeSubmit(ctx(rec, type, undefined, old))).toThrow(expect.objectContaining({ name }));

beforeEach(() => { jest.restoreAllMocks(); runtime.__setParams({ ...PARAMS }); });

test('lets a document through when every imported lot has a pedimento in the master', () => {
  data();
  expect(() => gate.beforeSubmit(ctx(doc([301])))).not.toThrow();
});

test('blocks an imported lot received directly that has no master row (134 CFDI in jul-sep)', () => {
  data();
  blocks(doc([301, 302]), 'ACME_PEDGATE_NO_PEDIMENTO');
});

test('blocks when the master row exists but has no pedimento', () => {
  data([{ ...MASTER[0], pedimento: '' }]);
  blocks(doc([301]), 'ACME_PEDGATE_NO_PEDIMENTO');
});

test('blocks when the master row is for another location', () => {
  data([{ ...MASTER[0], location: 99 }]);
  blocks(doc([301]), 'ACME_PEDGATE_NO_PEDIMENTO');
});

test('uses the line location over the header location', () => {
  data();
  const rec = fakeRecord({
    body: { subsidiary: '3', location: '99' },
    lines: [{ item: '10', location: '2', inventorydetail: [{ issueinventorynumber: '301' }] }],
  });
  expect(() => gate.beforeSubmit(ctx(rec))).not.toThrow();
});

test('checks composite lots (pedimento + manufacturing lot) of regulated items', () => {
  data();
  blocks(doc([304]), 'ACME_PEDGATE_NO_PEDIMENTO');
});

test('accepts a composite lot that has its master row', () => {
  data([{ item: 10, location: 2, lot: '263649069321915-L373483', pedimento: '263649069321915' }]);
  expect(() => gate.beforeSubmit(ctx(doc([304])))).not.toThrow();
});

test('matches a lot written with spaces, looking it up as stored', () => {
  const spy = data([{ item: 10, location: 2, lot: '26  96  7067  8128727', pedimento: '26  96  7067  8128727' }]);
  expect(() => gate.beforeSubmit(ctx(doc([305])))).not.toThrow();
  expect(spy.mock.calls[1][0].params).toEqual(['26  96  7067  8128727']);
});

test('ignores lots that are not pedimentos (local purchases)', () => {
  const spy = data([]);
  expect(() => gate.beforeSubmit(ctx(doc([303])))).not.toThrow();
  expect(spy).toHaveBeenCalledTimes(1); // only the lot-name lookup, no master query
});

test('ignores other subsidiaries without querying', () => {
  const spy = data([]);
  expect(() => gate.beforeSubmit(ctx(doc([302], { subsidiary: '1' })))).not.toThrow();
  expect(spy).not.toHaveBeenCalled();
});

test('ignores lines without inventory detail', () => {
  const spy = data([]);
  const rec = fakeRecord({ body: { subsidiary: '3' }, lines: [{ item: '50' }] });
  expect(() => gate.beforeSubmit(ctx(rec))).not.toThrow();
  expect(spy).not.toHaveBeenCalled();
});

describe('edits', () => {
  test('validates an edit that changes the assigned lots', () => {
    data();
    blocks(doc([302]), 'ACME_PEDGATE_NO_PEDIMENTO', 'edit', doc([301]));
  });

  test('lets a historical document be edited when the lots did not change (e.g. memo on a stamped invoice)', () => {
    const spy = data();
    expect(() => gate.beforeSubmit(ctx(doc([302], { memo: 'x' }), 'edit', undefined, doc([302])))).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('warn-only (initial rollout)', () => {
  test('logs a missing pedimento instead of blocking', () => {
    runtime.__setParams({ ...PARAMS, custscript_acme_pedgate_enforce: 'F' });
    data();
    const audit = jest.spyOn(log, 'audit');
    expect(() => gate.beforeSubmit(ctx(doc([302])))).not.toThrow();
    expect(audit).toHaveBeenCalledWith('pedimento gate warn-only', expect.stringMatching(/ACME_PEDGATE_NO_PEDIMENTO.*263649069321915/));
  });

  test('logs missing configuration instead of blocking', () => {
    runtime.__setParams({ custscript_acme_pedgate_enforce: false });
    data();
    const audit = jest.spyOn(log, 'audit');
    expect(() => gate.beforeSubmit(ctx(doc([301])))).not.toThrow();
    expect(audit).toHaveBeenCalledWith('pedimento gate warn-only', expect.stringMatching(/MISCONFIGURED/));
  });
});

describe('fail-closed configuration when enforced', () => {
  test('blocks documents with imported lots when the master ids are not configured', () => {
    runtime.__setParams({ custscript_acme_pedgate_mx_sub: '3', custscript_acme_pedgate_enforce: true });
    data();
    blocks(doc([301]), 'ACME_PEDGATE_MISCONFIGURED');
  });

  test('rejects master ids that are not plain identifiers', () => {
    runtime.__setParams({ ...PARAMS, custscript_acme_pedgate_mst_type: 'customrecord_x; DROP' });
    data();
    blocks(doc([301]), 'ACME_PEDGATE_MISCONFIGURED');
  });

  test('without the subsidiary parameter, blocks only documents with imported lots', () => {
    runtime.__setParams({ ...PARAMS, custscript_acme_pedgate_mx_sub: '' });
    data();
    blocks(doc([301]), 'ACME_PEDGATE_MISCONFIGURED');
    expect(() => gate.beforeSubmit(ctx(doc([303])))).not.toThrow();
    expect(() => gate.beforeSubmit(ctx(fakeRecord({ body: { subsidiary: '1' }, lines: [{ item: '50' }] })))).not.toThrow();
  });
});

test('deployed on item fulfillments and invoices, every context, released in warn-only mode', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../src/Objects/customscript_acme_pedimento_gate_ue.xml'), 'utf8');
  expect(xml).toMatch(/<recordtype>ITEMFULFILLMENT<\/recordtype>/);
  expect(xml).toMatch(/<recordtype>INVOICE<\/recordtype>/);
  expect(xml).not.toMatch(/<executioncontext>/);
  expect(xml.match(/<custscript_acme_pedgate_enforce>F<\/custscript_acme_pedgate_enforce>/g)).toHaveLength(2);
  // SDF script ids must stay within 40 characters
  (xml.match(/scriptid="([^"]+)"/g) || []).forEach((m) => expect(m.slice(10, -1).length).toBeLessThanOrEqual(40));
});
