'use strict';

const SENSITIVE_KEY = /^(authorization|token|secret|password|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)$/i;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function redactText(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/(token|secret|password|api[_-]?key|authorization)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]')
    .replace(/(?<!\d)\+\d{8,15}(?!\d)/g, '[PHONE REDACTED]');
}

function redact(value, key = '') {
  if (SENSITIVE_KEY.test(String(key))) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  }
  return typeof value === 'string' ? redactText(value) : value;
}

function validateManifestShape(manifest) {
  if (!manifest || manifest.schema_version !== '1.1') throw new Error('Manifest schema_version must be 1.1.');
  if (!Array.isArray(manifest.stages) || manifest.stages.length !== 3) throw new Error('Manifest must contain exactly three stages.');
  const ids = manifest.stages.map(stage => stage.id);
  if (ids.join('|') !== 'discover|build-prove|ship-learn') throw new Error('Manifest process order is invalid.');
  if (manifest.stages.some(stage => !['not_started', 'in_progress', 'complete'].includes(stage.status))) throw new Error('Manifest contains an invalid stage status.');
  return true;
}

function validateJsonExport(text) {
  const parsed = JSON.parse(String(text));
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON export must contain an object.');
  return parsed;
}

function validateHtmlExport(text) {
  const html = String(text || '');
  if (!/^<!doctype html>/i.test(html.trim())) throw new Error('HTML export must begin with a doctype.');
  if (!/<meta[^>]+charset=/i.test(html)) throw new Error('HTML export must declare a charset.');
  if (!/<title>[^<]+<\/title>/i.test(html)) throw new Error('HTML export must contain a title.');
  return true;
}

function auditRenderer(html) {
  const source = String(html || '');
  const required = ['CODEGLASS_PHASE06_LAYERED_GLASS','CODEGLASS_PHASE07_AUDIO_EXPORT','CODEGLASS_PHASE08_VOICE_INTAKE','data-cg-audio-toggle','data-cg-json-export','data-cg-html-export','aria-live="polite"','focus-visible','prefers-reduced-motion:reduce'];
  return { passed: required.filter(marker => source.includes(marker)), missing: required.filter(marker => !source.includes(marker)) };
}

function auditSecretSafety(value) {
  const text = JSON.stringify(value);
  return !(/Bearer\s+(?!\[REDACTED\])[A-Za-z0-9._-]+|(?:token|secret|password|api[_-]?key|authorization)\s*[:=]\s*(?!\[REDACTED\])[^\],}]+|\+\d{8,15}/i.test(text));
}

module.exports = { escapeHtml, redactText, redact, validateManifestShape, validateJsonExport, validateHtmlExport, auditRenderer, auditSecretSafety };
