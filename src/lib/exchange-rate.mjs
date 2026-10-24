export const RATE_URL = 'https://dolarapi.com/v1/dolares/oficial';
export const MAX_QUOTE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_TTL_MS = 60 * 60 * 1000;
export const RATE_CACHE_KEY = 'ns-official-rate-v1';

/** @param {unknown} value @param {number} [now] */
export function validateQuote(value, now = Date.now()) {
  if (!value || typeof value !== 'object') return null;
  const quote = /** @type {Record<string, unknown>} */ (value);
  if (quote.moneda !== 'USD' || quote.casa !== 'oficial') return null;
  if (typeof quote.venta !== 'number' || !Number.isFinite(quote.venta) || quote.venta <= 0)
    return null;
  if (
    typeof quote.fechaActualizacion !== 'string' ||
    !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(quote.fechaActualizacion)
  )
    return null;
  const time = Date.parse(quote.fechaActualizacion);
  if (!Number.isFinite(time) || time > now + 5 * 60 * 1000 || now - time > MAX_QUOTE_AGE_MS)
    return null;
  return {
    moneda: 'USD',
    casa: 'oficial',
    venta: quote.venta,
    fechaActualizacion: new Date(time).toISOString(),
  };
}

/** @param {number} usd @param {number} rate */
export function formatArs(usd, rate) {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0)
    throw new Error('Invalid price or rate');
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(
    Math.round(usd * rate),
  );
}

/** @param {string} timestamp */
export function formatQuoteDate(timestamp) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
}

/** @param {{fallback?: unknown, fetchImpl?: typeof fetch, now?: number, timeoutMs?: number}} [options] */
export async function loadQuote({
  fallback = null,
  fetchImpl = fetch,
  now = Date.now(),
  timeoutMs = 3500,
} = {}) {
  const backup = validateQuote(fallback, now);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(RATE_URL, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { quote: backup, live: false };
    const quote = validateQuote(await response.json(), now);
    // A replica must never replace a newer available quote with an older one.
    if (
      !quote ||
      (backup && Date.parse(quote.fechaActualizacion) < Date.parse(backup.fechaActualizacion))
    )
      return { quote: backup, live: false };
    return { quote, live: true };
  } catch {
    return { quote: backup, live: false };
  } finally {
    clearTimeout(timeout);
  }
}
