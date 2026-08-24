import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

const renderer = path.resolve('electron/src/index.html');

describe('Code Glass Phase 7 audio and export', () => {
  it('contains a continuous adaptive engine audio implementation', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain('CODEGLASS_PHASE07_AUDIO_EXPORT');
    expect(html).toContain('AudioContext');
    expect(html).toContain('setEngineState');
    expect(html).toContain('rpmFor');
    expect(html).toContain('sawtooth');
    expect(html).toContain('state===\'failed\'');
  });

  it('contains distinct success, warning, and error cues', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain("cue('error')");
    expect(html).toContain("cue(state==='failed'?'error':state==='warning'?'warning':'success')");
    expect(html).toContain("kind==='success'");
  });

  it('contains JSON and HTML report exports', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain('exportJSON');
    expect(html).toContain('exportHTML');
    expect(html).toContain('code-glass-report.json');
    expect(html).toContain('code-glass-report.html');
    expect(html).toContain('Blob');
  });

  it('contains accessible audio controls and reduced-volume safeguards', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain('aria-pressed');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('prefers-reduced-motion:reduce');
    expect(html).toContain('muted');
  });
});
