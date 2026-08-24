'use strict';

const crypto = require('node:crypto');

function id(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function clean(value) {
  return String(value || '').trim();
}

function redact(value) {
  if (value === undefined || value === null) return value;
  return String(value).replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]').replace(/(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]');
}

function normalizeEmail(value) {
  const email = clean(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Invalid email recipient: ${email}`);
  return email;
}

function normalizePhone(value) {
  const phone = clean(value).replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('WhatsApp recipient must be in international format, for example +256700000000.');
  return phone;
}

function normalizeRecipients(input) {
  const source = input || {};
  return {
    email: Array.from(new Set((Array.isArray(source.email) ? source.email : source.email ? [source.email] : []).map(normalizeEmail))),
    whatsapp: Array.from(new Set((Array.isArray(source.whatsapp) ? source.whatsapp : source.whatsapp ? [source.whatsapp] : []).map(normalizePhone)))
  };
}

function runtimeProviderConfig(env = process.env) {
  return {
    email: {
      enabled: String(env.CODEGLASS_EMAIL_ENABLED || '').toLowerCase() === 'true',
      endpoint: clean(env.CODEGLASS_EMAIL_ENDPOINT),
      token_env: 'CODEGLASS_EMAIL_TOKEN'
    },
    whatsapp: {
      enabled: String(env.CODEGLASS_WHATSAPP_ENABLED || '').toLowerCase() === 'true',
      endpoint: clean(env.CODEGLASS_WHATSAPP_ENDPOINT),
      token_env: 'CODEGLASS_WHATSAPP_TOKEN'
    }
  };
}

function publicProviderConfig(config) {
  const value = config || runtimeProviderConfig();
  return {
    email: { enabled: Boolean(value.email?.enabled), endpoint: clean(value.email?.endpoint), token_configured: Boolean(value.email?.token || value.email?.token_env) },
    whatsapp: { enabled: Boolean(value.whatsapp?.enabled), endpoint: clean(value.whatsapp?.endpoint), token_configured: Boolean(value.whatsapp?.token || value.whatsapp?.token_env) }
  };
}

function notificationText(event) {
  const processName = clean(event.process_name || event.process_id || 'project');
  if (event.kind === 'failure') return `[Code Glass] FAILURE in ${processName}: ${clean(event.code || 'BUILD_FAILURE')} — ${clean(event.message || 'Inspect the build evidence.')}`;
  if (event.kind === 'resolved') return `[Code Glass] RESOLVED in ${processName}: ${clean(event.message || 'The failure was resolved.')}`;
  return `[Code Glass] PROGRESS ${event.progress ?? 0}% — ${processName}: ${clean(event.message || 'Build is continuing.')}`;
}

function buildNotification(event, recipients) {
  const normalized = normalizeRecipients(recipients);
  const text = notificationText(event);
  const created = new Date().toISOString();
  return {
    notification_id: id('notification'),
    kind: event.kind === 'failure' ? 'failure' : event.kind === 'resolved' ? 'resolved' : 'progress',
    severity: event.kind === 'failure' ? 'error' : event.kind === 'resolved' ? 'success' : 'info',
    project_id: clean(event.project_id || 'unknown-project'),
    process_id: clean(event.process_id || 'unknown-process'),
    subject: event.kind === 'failure' ? 'Code Glass build failure' : 'Code Glass build update',
    text,
    recipients: normalized,
    dedupe_key: clean(event.dedupe_key || `${event.kind}:${event.project_id || 'project'}:${event.process_id || 'process'}:${event.code || event.progress || created.slice(0,16)}`),
    created_at: created,
    evidence: Array.isArray(event.evidence) ? event.evidence.map(String) : []
  };
}

async function deliverNotification(notification, config, transport) {
  const providerConfig = config || runtimeProviderConfig();
  if (typeof transport !== 'function') throw new Error('A transport function is required; real delivery is opt-in at the application boundary.');
  const results = [];
  for (const address of notification.recipients.email) {
    if (!providerConfig.email?.enabled) { results.push({ channel: 'email', address, status: 'disabled' }); continue; }
    const result = await transport('email', providerConfig.email, { to: address, subject: notification.subject, text: notification.text, notification_id: notification.notification_id });
    results.push({ channel: 'email', address, status: 'sent', provider_result: redact(result) });
  }
  for (const address of notification.recipients.whatsapp) {
    if (!providerConfig.whatsapp?.enabled) { results.push({ channel: 'whatsapp', address, status: 'disabled' }); continue; }
    const result = await transport('whatsapp', providerConfig.whatsapp, { to: address, body: notification.text, notification_id: notification.notification_id });
    results.push({ channel: 'whatsapp', address, status: 'sent', provider_result: redact(result) });
  }
  return { notification_id: notification.notification_id, dedupe_key: notification.dedupe_key, results, delivered_at: new Date().toISOString() };
}

function appendNotificationRecord(manifest, record) {
  const next = JSON.parse(JSON.stringify(manifest));
  next.gate_log = [...(next.gate_log || []), {
    id: id('notification-event'),
    created_at: record.delivered_at || new Date().toISOString(),
    result: record.results.some(x => x.status === 'sent') ? 'pass' : 'warning',
    process_id: record.process_id || null,
    detail: `Notification ${record.notification_id} delivery recorded.`,
    notification_id: record.notification_id,
    delivery: record.results.map(x => ({ channel: x.channel, address: x.address, status: x.status }))
  }];
  next.updated_at = new Date().toISOString();
  return next;
}

function failureEvent(manifest, failure) {
  return buildNotification({
    kind: 'failure',
    project_id: manifest.project_id,
    process_id: failure.process_id || failure.processId,
    process_name: failure.process_name,
    code: failure.code,
    message: failure.message,
    evidence: failure.evidence,
    dedupe_key: failure.dedupe_key
  }, manifest.notification_recipients || {});
}

function progressEvent(manifest, progress) {
  return buildNotification({
    kind: 'progress',
    project_id: manifest.project_id,
    process_id: progress.process_id || progress.processId,
    process_name: progress.process_name,
    progress: progress.progress,
    message: progress.message,
    dedupe_key: progress.dedupe_key
  }, manifest.notification_recipients || {});
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeRecipients,
  runtimeProviderConfig,
  publicProviderConfig,
  notificationText,
  buildNotification,
  deliverNotification,
  appendNotificationRecord,
  failureEvent,
  progressEvent
};
