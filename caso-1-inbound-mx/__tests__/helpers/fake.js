const UserEventType = { CREATE: 'create', EDIT: 'edit', VIEW: 'view' };

const fakeRecord = ({ id = null, body = {}, lines = [] } = {}) => ({
  id,
  getValue: (f) => body[typeof f === 'string' ? f : f.fieldId] ?? null,
  getLineCount: ({ sublistId }) => (sublistId === 'item' ? lines.length : 0),
  getSublistValue: ({ sublistId, line, fieldId }) => (sublistId === 'item' ? lines[line]?.[fieldId] ?? null : null),
  // A line's subrecord is given as an array of assignment rows, e.g. inventorydetail: [{ issueinventorynumber: '301' }]
  hasSublistSubrecord: ({ sublistId, fieldId, line }) => sublistId === 'item' && Array.isArray(lines[line]?.[fieldId]),
  getSublistSubrecord: ({ sublistId, fieldId, line }) => {
    const rows = (sublistId === 'item' && lines[line]?.[fieldId]) || [];
    return {
      getLineCount: () => rows.length,
      getSublistValue: ({ line: j, fieldId: f }) => rows[j]?.[f] ?? null,
    };
  },
});

const fakeForm = () => {
  const buttons = { receive: { isDisabled: false } };
  const fields = [];
  return {
    buttons, fields,
    getButton: (id) => buttons[id] || null,
    removeButton: (id) => { delete buttons[id]; },
    addField: (f) => { const fld = { ...f, defaultValue: '', updateLayoutType: () => {} }; fields.push(fld); return fld; },
  };
};

const ctx = (newRecord, type = UserEventType.CREATE, form, oldRecord) => ({ newRecord, oldRecord, type, form, UserEventType });

module.exports = { fakeRecord, fakeForm, ctx };
