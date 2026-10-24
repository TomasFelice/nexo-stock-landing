import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuote, loadQuote, formatArs, formatQuoteDate } from '../src/lib/exchange-rate.mjs';

const now = Date.parse('2026-10-24T15:00:00Z');
const quote = {
  moneda: 'USD',
  casa: 'oficial',
  venta: 1550,
  fechaActualizacion: '2026-10-23T18:55:00.000Z',
};
const response =
  (value, ok = true) =>
  async () => ({ ok, json: async () => value });

test('accepts the previous business day and formats Argentine pesos and local date', () => {
  assert.deepEqual(validateQuote(quote, now), quote);
  assert.equal(formatArs(39, quote.venta), '60.450');
  assert.equal(formatArs(99, quote.venta), '153.450');
  assert.equal(formatQuoteDate('2026-10-24T01:00:00Z'), '23/10/2026');
});

test('rejects invalid, stale, future and unrelated quotes', () => {
  for (const value of [
    null,
    {},
    { ...quote, venta: 0 },
    { ...quote, venta: -1 },
    { ...quote, venta: Infinity },
    { ...quote, venta: '1550' },
    { ...quote, casa: 'blue' },
    { ...quote, moneda: 'EUR' },
    { ...quote, fechaActualizacion: '2026-10-01T00:00:00Z' },
    { ...quote, fechaActualizacion: '2026-10-25T00:00:00Z' },
    { ...quote, fechaActualizacion: '2026-10-23' },
  ]) {
    assert.equal(validateQuote(value, now), null);
  }
  assert.throws(() => formatArs(39, 0));
});

test('loads a public quote without cookies or referrer', async () => {
  let options;
  const result = await loadQuote({
    now,
    fetchImpl: async (url, init) => {
      options = init;
      assert.equal(url, 'https://dolarapi.com/v1/dolares/oficial');
      return { ok: true, json: async () => quote };
    },
  });
  assert.deepEqual(result, { quote, live: true });
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
});

test('network, HTTP, JSON and invalid payload failures retain a validated fallback', async () => {
  for (const fetchImpl of [
    async () => {
      throw new Error('offline');
    },
    response(null, false),
    response({ venta: 1550 }),
    async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad JSON');
      },
    }),
  ]) {
    assert.deepEqual(await loadQuote({ now, fallback: quote, fetchImpl }), { quote, live: false });
  }
});

test('timeout returns the fallback, and missing or expired fallback never invents a rate', async () => {
  const fetchImpl = (_, { signal }) =>
    new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('timeout'))),
    );
  assert.deepEqual(await loadQuote({ now, fallback: quote, fetchImpl, timeoutMs: 5 }), {
    quote,
    live: false,
  });
  assert.deepEqual(
    await loadQuote({
      now,
      fallback: { ...quote, fechaActualizacion: '2026-10-01T00:00:00Z' },
      fetchImpl: response(null, false),
    }),
    { quote: null, live: false },
  );
});

test('an older API replica cannot overwrite a newer known quote', async () => {
  const oldQuote = { ...quote, venta: 1500, fechaActualizacion: '2026-10-22T18:55:00Z' };
  assert.deepEqual(await loadQuote({ now, fallback: quote, fetchImpl: response(oldQuote) }), {
    quote,
    live: false,
  });
});
