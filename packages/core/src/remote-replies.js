'use strict';

const crypto = require('node:crypto');

const ALLOWED_COMMANDS = new Set(['resume', 'retry', 'pause', 'ack', 'answer']);

function clean(value, max = 2000) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function digest(secret, timestamp, nonce, body) {
  return crypto.createHmac('sha256', String(secret)).update(`${timestamp}.${nonce}.${body}`).digest('hex');
}

function signReply(payload, secret) {
  const timestamp = String(payload.timestamp);
  const nonce = String(payload.nonce);
  const body = clean(payload.body);
  return digest(secret, timestamp, nonce, body);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyReply(payload, secret, options = {}) {
  if (!payload || !secret) return { ok: false, reason: 'missing_authentication' };
  const now = Number(options.now ?? Date.now());
  const timestamp = Number(payload.timestamp);
  const maxAgeMs = Number(options.maxAgeMs ?? 10 * 60 * 1000);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > maxAgeMs) return { ok: false, reason: 'expired' };
  if (!/^[A-Za-z0-9_-]{12,160}$/.test(String(payload.nonce || ''))) return { ok: false, reason: 'invalid_nonce' };
  const expected = signReply(payload, secret);
  if (!safeEqual(expected, payload.signature)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true, timestamp, nonce: String(payload.nonce), body: clean(payload.body) };
}

function parseCommand(body) {
  const text = clean(body);
  const match = text.match(/^\s*(resume|retry|pause|ack|answer)\b(?:\s*[:\-]?\s*(.*))?$/i);
  if (!match) return { ok: false, reason: 'command_not_allowed' };
  const command = match[1].toLowerCase();
  const argument = clean(match[2] || '');
  if (!ALLOWED_COMMANDS.has(command)) return { ok: false, reason: 'command_not_allowed' };
  if ((command === 'answer' || command === 'ack') && !argument) return { ok: false, reason: 'argument_required' };
  return { ok: true, command, argument };
}

function acceptReply(payload, secret, state = {}, options = {}) {
  const verified = verifyReply(payload, secret, options);
  const audit = Array.isArray(state.audit) ? [...state.audit] : [];
  if (!verified.ok) {
    audit.push({ type: 'remote_reply_rejected', reason: verified.reason, created_at: new Date(options.now ?? Date.now()).toISOString() });
    return { ok: false, reason: verified.reason, state: { ...state, audit } };
  }
  const seen = new Set(Array.isArray(state.used_nonces) ? state.used_nonces : []);
  if (seen.has(verified.nonce)) {
    audit.push({ type: 'remote_reply_rejected', reason: 'duplicate_nonce', nonce: verified.nonce, created_at: new Date(options.now ?? Date.now()).toISOString() });
    return { ok: false, reason: 'duplicate_nonce', state: { ...state, audit } };
  }
  const command = parseCommand(verified.body);
  if (!command.ok) {
    audit.push({ type: 'remote_reply_rejected', reason: command.reason, nonce: verified.nonce, created_at: new Date(options.now ?? Date.now()).toISOString() });
    return { ok: false, reason: command.reason, state: { ...state, audit } };
  }
  seen.add(verified.nonce);
  const record = { type: 'remote_reply_accepted', command: command.command, argument: command.argument, nonce: verified.nonce, created_at: new Date(options.now ?? Date.now()).toISOString() };
  audit.push(record);
  return { ok: true, command, state: { ...state, used_nonces: [...seen].slice(-500), audit } };
}

async function executeSafeReply(accepted, handlers = {}) {
  if (!accepted?.ok) throw new Error('Only an accepted authenticated reply may execute.');
  const command = accepted.command.command;
  const handler = handlers[command];
  if (typeof handler !== 'function') return { executed: false, command, reason: 'handler_not_configured' };
  if (!ALLOWED_COMMANDS.has(command)) throw new Error('Unsafe command blocked.');
  const result = await handler(accepted.command.argument);
  return { executed: true, command, result };
}

function releaseReadiness(checks = {}) {
  const required = ['phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6', 'phase7', 'phase8', 'phase9', 'phase10', 'tests', 'secrets_safe', 'no_uncommitted_secrets'];
  const missing = required.filter(key => checks[key] !== true);
  return { ready: missing.length === 0, missing, checked_at: new Date().toISOString() };
}

function finalAcceptance(checks = {}) {
  const readiness = releaseReadiness(checks);
  return { accepted: readiness.ready, status: readiness.ready ? 'release_ready' : 'blocked', readiness };
}

module.exports = {
  ALLOWED_COMMANDS,
  signReply,
  verifyReply,
  parseCommand,
  acceptReply,
  executeSafeReply,
  releaseReadiness,
  finalAcceptance
};
