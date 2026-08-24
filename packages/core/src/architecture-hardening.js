'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function eventId(prefix = 'event') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

async function atomicWriteJson(filePath, value, options = {}) {
  const target = path.resolve(filePath);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  const backup = `${target}.previous`;
  const text = JSON.stringify(value, null, 2) + '\n';
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.writeFile(temporary, text, { encoding: 'utf8', mode: options.mode || 0o600 });
    try { await fs.copyFile(target, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rm(target, { force: true });
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  return { file_path: target, backup_path: backup, bytes: Buffer.byteLength(text), written_at: new Date().toISOString() };
}

async function withRetry(operation, options = {}) {
  const attempts = Math.max(1, Math.min(5, Number(options.attempts || 3)));
  const delayMs = Math.max(0, Math.min(2000, Number(options.delayMs || 25)));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(attempt); }
    catch (error) { lastError = error; if (attempt < attempts && delayMs) await new Promise(resolve => setTimeout(resolve, delayMs * attempt)); }
  }
  throw lastError;
}

function validateTransition(manifest, targetId, targetStatus) {
  const stages = Array.isArray(manifest?.stages) ? manifest.stages : [];
  const index = stages.findIndex(stage => stage.id === targetId);
  if (index < 0) throw new Error('Unknown process transition target.');
  if (!['not_started', 'in_progress', 'complete'].includes(targetStatus)) throw new Error('Invalid target status.');
  if (targetStatus === 'complete' && stages.slice(0, index).some(stage => stage.status !== 'complete')) throw new Error('Cannot complete a later process before earlier processes.');
  if (targetStatus === 'in_progress' && stages.slice(0, index).some(stage => stage.status !== 'complete')) throw new Error('Cannot activate a later process before earlier processes.');
  return true;
}

function idempotencyKey(parts) {
  return crypto.createHash('sha256').update((Array.isArray(parts) ? parts : [parts]).map(String).join('|')).digest('hex');
}

function acceptOnce(store, key, value) {
  const seen = store instanceof Set ? store : new Set(Array.isArray(store) ? store : []);
  const normalized = String(key);
  if (seen.has(normalized)) return { accepted: false, duplicate: true, store: seen };
  seen.add(normalized);
  return { accepted: true, duplicate: false, store: seen, value };
}

function buildAuditSummary(input = {}) {
  const safe = value => String(value ?? '').replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]').replace(/(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]').replace(/(?<!\d)\+\d{8,15}(?!\d)/g, '[PHONE REDACTED]');
  return { audit_id: eventId('audit'), created_at: new Date().toISOString(), status: input.status === 'pass' ? 'pass' : input.status === 'fail' ? 'fail' : 'info', phase: safe(input.phase || 'unknown'), tests: Number(input.tests || 0), findings: Array.isArray(input.findings) ? input.findings.map(safe) : [], secret_safe: true };
}

module.exports = { eventId, atomicWriteJson, withRetry, validateTransition, idempotencyKey, acceptOnce, buildAuditSummary };
