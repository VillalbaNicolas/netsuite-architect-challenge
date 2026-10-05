module.exports = { create: ({ name, message }) => Object.assign(new Error(message), { name }) };
