import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const quality = require('../src/quality-hardening.js');

describe('Code Glass Phase 11 quality hardening', () => {
  it('escapes HTML and redacts sensitive keys and phone numbers', () => {
    expect(quality.escapeHtml('<script>alert("x")</script>')).toContain('&lt;script&gt;');

    const unsafe = {
      authorization: 'Bearer SECRET',
      token: 'SECRET',
      secret: 'TOP_SECRET',
      password: 'PASSWORD_VALUE',
      api_key: 'ANOTHER_SECRET',
      phone: '+256700000000',
      nested: {
        client_secret: 'CLIENT_SECRET_VALUE',
        note: 'Contact +256700000001 for assistance.'
      }
    };

    const safe = quality.redact(unsafe);
    const serialized = JSON.stringify(safe);

    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('TOP_SECRET');
    expect(serialized).not.toContain('PASSWORD_VALUE');
    expect(serialized).not.toContain('ANOTHER_SECRET');
    expect(serialized).not.toContain('CLIENT_SECRET_VALUE');
    expect(serialized).not.toContain('+256700000000');
    expect(serialized).not.toContain('+256700000001');

    expect(safe.authorization).toBe('[REDACTED]');
    expect(safe.token).toBe('[REDACTED]');
    expect(safe.secret).toBe('[REDACTED]');
    expect(safe.password).toBe('[REDACTED]');
    expect(safe.api_key).toBe('[REDACTED]');
    expect(safe.nested.client_secret).toBe('[REDACTED]');
    expect(safe.phone).toBe('[PHONE REDACTED]');
    expect(safe.nested.note).toContain('[PHONE REDACTED]');
    expect(quality.auditSecretSafety(safe)).toBe(true);
  });

  it('redacts secret patterns inside plain text', () => {
    const text = 'Authorization: Bearer ABC123 token=XYZ789 secret=HIDDEN password=PASS';
    const safe = quality.redactText(text);

    expect(safe).not.toContain('ABC123');
    expect(safe).not.toContain('XYZ789');
    expect(safe).not.toContain('HIDDEN');
    expect(safe).not.toContain('PASS');
    expect(safe).toContain('[REDACTED]');
  });

  it('validates the canonical three-process manifest and rejects regressions', () => {
    const manifest = {
      schema_version: '1.1',
      stages: [
        { id: 'discover', name: 'Discover', status: 'complete' },
        { id: 'build-prove', name: 'Build & Prove', status: 'in_progress' },
        { id: 'ship-learn', name: 'Ship & Learn', status: 'not_started' }
      ]
    };

    expect(quality.validateManifestShape(manifest)).toBe(true);
    expect(() => quality.validateManifestShape({
      ...manifest,
      stages: manifest.stages.slice(0, 2)
    })).toThrow();
    expect(() => quality.validateManifestShape({
      ...manifest,
      stages: [
        ...manifest.stages.slice(0, 2),
        { id: 'ship-learn', name: 'Ship & Learn', status: 'broken' }
      ]
    })).toThrow();
  });

  it('validates non-empty JSON and complete HTML exports', () => {
    expect(quality.validateJsonExport(JSON.stringify({ projects: [] }))).toEqual({ projects: [] });
    expect(quality.validateJsonExport(JSON.stringify({ project_id: 'lame-in-tech' }))).toEqual({ project_id: 'lame-in-tech' });
    expect(quality.validateHtmlExport('<!doctype html><meta charset="utf-8"><title>Report</title>')).toBe(true);
    expect(() => quality.validateJsonExport('')).toThrow();
    expect(() => quality.validateJsonExport('not-json')).toThrow();
    expect(() => quality.validateHtmlExport('<div>bad</div>')).toThrow();
  });

  it('audits the renderer for earlier phase features and accessibility', async () => {
    const html = await fs.readFile('electron/src/index.html', 'utf8');
    const audit = quality.auditRenderer(html);
    expect(audit.missing).toEqual([]);
  });

  it('protects against duplicate markers and documentation drift', async () => {
    const html = await fs.readFile('electron/src/index.html', 'utf8');
    const readme = await fs.readFile('README.md', 'utf8');

    expect((html.match(/CODEGLASS_PHASE06_LAYERED_GLASS/g) || []).length).toBe(1);
    expect((html.match(/CODEGLASS_PHASE07_AUDIO_EXPORT/g) || []).length).toBe(1);
    expect((html.match(/CODEGLASS_PHASE08_VOICE_INTAKE/g) || []).length).toBe(1);
    expect(readme).toContain('CODEGLASS_PHASE11_HARDENING');
  });
});
