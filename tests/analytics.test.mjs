import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignProperties, createTracker, withReference } from '../src/lib/analytics.mjs';

function fixture(overrides = {}) {
  const requests = [];
  const tracker = createTracker({
    key: 'phc_test_only',
    host: 'https://eu.i.posthog.com',
    environment: 'production',
    hostname: 'www.nexostock.benai.com.ar',
    reference: 'NS-12AB34CD',
    campaign: { source: 'instagram', medium: 'paid_social', campaign: 'local_online' },
    device: 'mobile',
    fetchImpl: async (url, options) => {
      requests.push({ url, options, payload: JSON.parse(options.body) });
      return new Response('{}');
    },
    ...overrides,
  });
  return { tracker, requests };
}

test('no traffic until accepted; revocation stops collection', () => {
  const { tracker, requests } = fixture();
  assert.equal(tracker.track('landing_view'), false);
  tracker.setConsent(true);
  assert.equal(tracker.track('landing_view', {}, true), true);
  tracker.setConsent(false);
  assert.equal(tracker.track('whatsapp_click', { placement: 'hero' }), false);
  assert.equal(requests.length, 1);
});

test('previews, demo, pilot, localhost, invalid hosts and absent keys never send', () => {
  for (const overrides of [
    { environment: 'preview' },
    { environment: 'pilot' },
    { environment: 'demo' },
    { hostname: 'localhost' },
    { hostname: 'demo.nexostock.benai.com.ar' },
    { hostname: 'preview.vercel.app' },
    { key: '' },
    { key: 'phx_personal_secret' },
    { host: 'https://attacker.example' },
  ]) {
    const { tracker, requests } = fixture(overrides);
    tracker.setConsent(true);
    assert.equal(tracker.enabled, false);
    tracker.track('landing_view');
    assert.equal(requests.length, 0);
  }
});

test('internal opt-out is stronger than a later opt-in', () => {
  const { tracker, requests } = fixture();
  tracker.exclude();
  tracker.setConsent(true);
  tracker.track('landing_view');
  assert.equal(requests.length, 0);
});

test('single view events deduplicate, real subsequent CTA clicks remain measurable', () => {
  const { tracker, requests } = fixture();
  tracker.setConsent(true);
  tracker.track('pricing_view', { placement: 'pricing' }, true);
  tracker.track('pricing_view', { placement: 'pricing' }, true);
  tracker.track('demo_step_view', { step: 'stock' }, true);
  tracker.track('demo_step_view', { step: 'stock' }, true);
  tracker.track('whatsapp_click', { placement: 'hero' });
  tracker.track('whatsapp_click', { placement: 'pricing' });
  assert.deepEqual(
    requests.map((r) => r.payload.event),
    ['pricing_view', 'demo_step_view', 'whatsapp_click', 'whatsapp_click'],
  );
});

test('payload allowlist drops PII, URLs and arbitrary DOM metadata', () => {
  const { tracker, requests } = fixture();
  tracker.setConsent(true);
  tracker.track('whatsapp_click', {
    placement: 'hero',
    email: 'private@example.com',
    url: 'https://example.com/?token=secret',
    customer_name: 'Private',
    amount: 123,
    product: 'Sensitive',
  });
  tracker.track('customer_email', {});
  assert.equal(requests.length, 1);
  const { options, payload } = requests[0];
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(payload.properties.$process_person_profile, false);
  assert.equal(payload.properties.$geoip_disable, true);
  assert.deepEqual(
    Object.keys(payload.properties).sort(),
    [
      '$geoip_disable',
      '$ip',
      '$process_person_profile',
      'campaign',
      'device',
      'environment',
      'medium',
      'placement',
      'reference',
      'source',
      'surface',
    ].sort(),
  );
  assert.doesNotMatch(JSON.stringify(payload), /private|secret|Sensitive|123/);
});

test('unknown UTM values are never passed through', () => {
  const props = campaignProperties(
    new URLSearchParams(
      'utm_source=private@example.com&utm_medium=secret&utm_campaign=private_token&utm_content=customer',
    ),
    ['local_online'],
  );
  assert.deepEqual(props, { source: 'other', medium: 'other', campaign: 'unassigned' });
  assert.equal(
    campaignProperties(new URLSearchParams('utm_campaign=local_online'), ['local_online']).campaign,
    'local_online',
  );
});

test('organic attribution keeps only a category and explicit UTMs take priority', () => {
  const empty = new URLSearchParams();
  assert.deepEqual(campaignProperties(empty, [], 'https://www.google.com.ar/search?q=private'), {
    source: 'google',
    medium: 'organic',
    campaign: 'unassigned',
  });
  assert.equal(
    campaignProperties(empty, [], 'https://l.instagram.com/?secret=private').source,
    'instagram',
  );
  assert.deepEqual(campaignProperties(empty, [], 'https://example.com/private?email=private'), {
    source: 'referral',
    medium: 'referral',
    campaign: 'unassigned',
  });
  assert.equal(
    campaignProperties(empty, [], 'https://www.google.com.attacker.example/').source,
    'referral',
  );
  for (const referrer of [
    '',
    'invalid',
    'javascript:private',
    'https://www.nexostock.benai.com.ar/privacidad',
  ]) {
    assert.equal(campaignProperties(empty, [], referrer).source, 'direct');
  }
  assert.deepEqual(
    campaignProperties(
      new URLSearchParams('utm_source=instagram&utm_medium=paid_social&utm_campaign=local_online'),
      ['local_online'],
      'https://www.google.com/',
    ),
    {
      source: 'instagram',
      medium: 'paid_social',
      campaign: 'local_online',
    },
  );
});

test('opening the walkthrough and selecting steps count a single demo opening', () => {
  const { tracker, requests } = fixture();
  tracker.setConsent(true);
  tracker.track('demo_open', { placement: 'hero' }, true);
  tracker.track('demo_open', { placement: 'navigation' }, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].payload.properties.placement, 'hero');
});

test('WhatsApp reference is idempotent, editable, and works without analytics', () => {
  const base = 'https://wa.me/5491144132706?text=Hola%2C%20quiero%20una%20demo';
  const link = withReference(base, 'NS-12AB34CD');
  assert.equal(withReference(link, 'NS-12AB34CD'), link);
  const url = new URL(link);
  assert.equal(url.pathname, '/5491144132706');
  assert.equal(url.searchParams.get('text'), 'Hola, quiero una demo\n[Ref: NS-12AB34CD]');
  assert.equal(withReference(base, 'private@example.com'), base);
});

test('blocked or failing collection does not break navigation', async () => {
  const { tracker } = fixture({
    fetchImpl: () => {
      throw new Error('blocked');
    },
  });
  tracker.setConsent(true);
  assert.doesNotThrow(() => tracker.track('whatsapp_click', { placement: 'hero' }));
  const { tracker: asyncTracker } = fixture({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  asyncTracker.setConsent(true);
  assert.doesNotThrow(() => asyncTracker.track('whatsapp_click', { placement: 'hero' }));
  await new Promise((resolve) => setImmediate(resolve));
});
