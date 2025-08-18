// Mock for node-fetch
module.exports = jest.fn(() => Promise.resolve({
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  status: 200,
  ok: true
}));