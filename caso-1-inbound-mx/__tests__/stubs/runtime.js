const params = {};
module.exports = {
  getCurrentScript: () => ({ getParameter: ({ name }) => (name in params ? params[name] : null) }),
  __setParams: (p) => { Object.keys(params).forEach((k) => delete params[k]); Object.assign(params, p); },
};
