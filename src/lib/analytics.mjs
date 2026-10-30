// Direct Capture API: no SDK, automatic collection, cookies, recordings or remote code.
export const POSTHOG_HOSTS = ['https://eu.i.posthog.com', 'https://us.i.posthog.com'];
export const EVENTS = [
  'landing_view',
  'pricing_view',
  'demo_open',
  'demo_step_view',
  'whatsapp_click',
];
export const PLACEMENTS = [
  'header',
  'hero',
  'pricing',
  'contact',
  'footer',
  'mobile',
  'navigation',
];
export const CONSENT_KEY = 'ns-measurement-v1';
export const SESSION_KEY = 'ns-reference-v1';

/** Reduce the referrer locally to a category; never transmit its URL or hostname. */
function referrerCategory(referrer) {
  try {
    const url = new URL(referrer);
    if (!['https:', 'http:'].includes(url.protocol)) return { source: 'direct', medium: 'none' };
    const host = url.hostname;
    const belongsTo = (domain) => host === domain || host.endsWith(`.${domain}`);
    if (belongsTo('nexostock.benai.com.ar')) return { source: 'direct', medium: 'none' };
    if (['google.com', 'google.com.ar', 'google.es'].some(belongsTo))
      return { source: 'google', medium: 'organic' };
    if (belongsTo('instagram.com')) return { source: 'instagram', medium: 'organic' };
    if (belongsTo('facebook.com') || belongsTo('fb.com'))
      return { source: 'facebook', medium: 'organic' };
    return { source: 'referral', medium: 'referral' };
  } catch {
    return { source: 'direct', medium: 'none' };
  }
}

/** @param {URLSearchParams} params @param {string[]} campaigns @param {string} referrer */
export function campaignProperties(params, campaigns = [], referrer = '') {
  const inferred = referrerCategory(referrer);
  const hasAttribution = params.has('utm_source') || params.has('utm_medium');
  const source = params.get('utm_source') || (hasAttribution ? 'direct' : inferred.source);
  const medium = params.get('utm_medium') || (hasAttribution ? 'none' : inferred.medium);
  const campaign = params.get('utm_campaign');
  return {
    source: ['direct', 'instagram', 'facebook', 'google', 'referral'].includes(source)
      ? source
      : 'other',
    medium: ['none', 'cpc', 'paid_social', 'organic', 'referral'].includes(medium)
      ? medium
      : 'other',
    campaign:
      campaign && campaigns.includes(campaign) && /^[a-z0-9_-]{1,48}$/.test(campaign)
        ? campaign
        : 'unassigned',
  };
}

/** @param {string} baseUrl @param {string} reference */
export function withReference(baseUrl, reference) {
  const url = new URL(baseUrl);
  if (url.origin !== 'https://wa.me' || !/^\d+$/.test(url.pathname.slice(1))) return baseUrl;
  const message = (url.searchParams.get('text') || '').replace(/\s*\[Ref: NS-[A-F0-9]{8}\]$/, '');
  if (/^NS-[A-F0-9]{8}$/.test(reference))
    url.searchParams.set('text', `${message}\n[Ref: ${reference}]`);
  return url.href;
}

/**
 * @param {{key: string, host: string, environment: string, hostname: string, reference: string, campaign: {source: string, medium: string, campaign: string}, device: string, fetchImpl?: typeof fetch}} config
 */
export function createTracker(config) {
  let consent = false;
  let excluded = false;
  const seen = new Set();
  const enabled =
    /^phc_[a-zA-Z0-9_-]+$/.test(config.key) &&
    POSTHOG_HOSTS.includes(config.host) &&
    config.environment === 'production' &&
    ['nexostock.benai.com.ar', 'www.nexostock.benai.com.ar'].includes(config.hostname) &&
    /^NS-[A-F0-9]{8}$/.test(config.reference);
  const transport = config.fetchImpl || fetch;
  /** @param {string} event @param {{placement?: string, step?: string}} [details] @param {boolean} [once] */
  function track(event, details = {}, once = false) {
    if (!enabled || !consent || excluded || !EVENTS.includes(event)) return false;
    const placement = PLACEMENTS.includes(details.placement || '') ? details.placement : undefined;
    const step = ['sale', 'stock', 'web'].includes(details.step || '') ? details.step : undefined;
    const dedupKey = event === 'demo_open' ? event : `${event}:${placement || ''}:${step || ''}`;
    if (once && seen.has(dedupKey)) return false;
    const properties = {
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: '0.0.0.0',
      surface: 'landing',
      environment: 'production',
      reference: config.reference,
      ...campaignProperties(
        new URLSearchParams({
          utm_source: config.campaign.source,
          utm_medium: config.campaign.medium,
          utm_campaign: config.campaign.campaign,
        }),
        [config.campaign.campaign],
      ),
      device: ['mobile', 'tablet', 'desktop'].includes(config.device) ? config.device : 'other',
      ...(placement ? { placement } : {}),
      ...(step ? { step } : {}),
    };
    const payload = { api_key: config.key, event, distinct_id: config.reference, properties };
    if (once) seen.add(dedupKey);
    // Never block a commercial action, retry, or log a payload on transport failure.
    try {
      Promise.resolve(
        transport(`${config.host}/i/v0/e/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          keepalive: true,
        }),
      ).catch(() => {});
    } catch {
      /* Analytics is optional. */
    }
    return true;
  }
  return {
    enabled,
    track,
    setConsent(value) {
      consent = value === true;
    },
    exclude() {
      excluded = true;
      consent = false;
    },
  };
}
