import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';

describe('Code Glass Phase 13 design and accessibility', () => {
  it('defines centralized visual tokens and layered hierarchy', async () => {
    const html = await fs.readFile('electron/src/index.html','utf8');
    expect(html).toContain('CODEGLASS_PHASE13_DESIGN_SYSTEM');
    expect(html).toContain('--cg13-space-');
    expect(html).toContain('--cg13-focus');
    expect(html).toContain('.project.failed');
    expect(html).toContain('backdrop-filter:blur');
  });

  it('defines responsive desktop, tablet, and mobile behavior', async () => {
    const html = await fs.readFile('electron/src/index.html','utf8');
    expect(html).toContain('@media(max-width:1100px)');
    expect(html).toContain('@media(max-width:760px)');
    expect(html).toContain('overflow-x:hidden');
    expect(html).toContain('min-height:48px');
  });

  it('defines keyboard, screen-reader, contrast, and reduced-motion support', async () => {
    const html = await fs.readFile('electron/src/index.html','utf8');
    expect(html).toContain('cg13-skip-link');
    expect(html).toContain('focus-visible');
    expect(html).toContain('prefers-contrast:more');
    expect(html).toContain('prefers-reduced-motion:reduce');
    expect(html).toContain('role','region');
  });

  it('preserves earlier glass, audio, export, and voice capabilities exactly once', async () => {
    const html = await fs.readFile('electron/src/index.html','utf8');
    expect((html.match(/CODEGLASS_PHASE06_LAYERED_GLASS/g)||[]).length).toBe(1);
    expect((html.match(/CODEGLASS_PHASE07_AUDIO_EXPORT/g)||[]).length).toBe(1);
    expect((html.match(/CODEGLASS_PHASE08_VOICE_INTAKE/g)||[]).length).toBe(1);
  });
});
