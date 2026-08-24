import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const notifications = require('../src/notifications.js');

function manifest() {
  return {
    project_id: 'lame-in-tech',
    notification_recipients: { email: ['owner@example.com'], whatsapp: ['+256700000000'] },
    gate_log: [],
    stages: [
      { id: 'discover', name: 'Discover', status: 'in_progress' },
      { id: 'build-prove', name: 'Build & Prove', status: 'not_started' },
      { id: 'ship-learn', name: 'Ship & Learn', status: 'not_started' }
    ]
  };
}

describe('Code Glass Phase 9 notifications', () => {
  it('validates and normalizes email and WhatsApp recipients', () => {
    expect(notifications.normalizeRecipients({ email: ['OWNER@example.com'], whatsapp: ['+256 700-000-000'] })).toEqual({ email: ['owner@example.com'], whatsapp: ['+256700000000'] });
    expect(() => notifications.normalizeEmail('not-an-email')).toThrow('Invalid email');
    expect(() => notifications.normalizePhone('0700000000')).toThrow('international format');
  });

  it('builds a structured failure notification with evidence and deduplication', () => {
    const event = notifications.failureEvent(manifest(), { process_id: 'build-prove', code: 'TEST_FAILURE', message: 'Tests failed', evidence: ['test.log'], dedupe_key: 'failure-1' });
    expect(event.kind).toBe('failure');
    expect(event.severity).toBe('error');
    expect(event.text).toContain('TEST_FAILURE');
    expect(event.recipients.email).toEqual(['owner@example.com']);
    expect(event.recipients.whatsapp).toEqual(['+256700000000']);
    expect(event.evidence).toEqual(['test.log']);
    expect(event.dedupe_key).toBe('failure-1');
  });

  it('delivers through injected transports without exposing secrets', async () => {
    const event = notifications.progressEvent(manifest(), { process_id: 'discover', progress: 40, message: 'Discovery is moving' });
    const calls = [];
    const result = await notifications.deliverNotification(event, { email: { enabled: true, endpoint: 'https://email.invalid', token: 'SECRET' }, whatsapp: { enabled: true, endpoint: 'https://whatsapp.invalid', token: 'SECRET' } }, async (channel, provider, payload ) => {
      calls.push({ channel, provider, payload });
      return { authorization: 'Bearer SECRET', ok: true };
    });
    expect(calls).toHaveLength(2);
    expect(result.results.every(x => x.status === 'sent')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  it('records delivery safely and keeps channels disabled by default', async () => {
    const event = notifications.failureEvent(manifest(), { process_id: 'build-prove', code: 'BUILD_FAILURE', message: 'Build failed' });
    const delivery = await notifications.deliverNotification(event, { email: { enabled: false }, whatsapp: { enabled: false } }, async () => ({ ok: true }));
    expect(delivery.results.map(x => x.status)).toEqual(['disabled', 'disabled']);
    const updated = notifications.appendNotificationRecord(manifest(), { ...delivery, process_id: 'build-prove' });
    expect(updated.gate_log[0].detail).toContain('delivery recorded');
  });

  it('exposes only non-secret provider configuration', () => {
    const publicConfig = notifications.publicProviderConfig({ email: { enabled: true, endpoint: 'https://email.invalid', token: 'SECRET' }, whatsapp: { enabled: false, endpoint: '', token: 'SECRET' } } );
    expect(publicConfig.email.token_configured).toBe(true);
    expect(JSON.stringify(publicConfig)).not.toContain('SECRET');
    expect(publicConfig.whatsapp.enabled).toBe(false);
  });
});
