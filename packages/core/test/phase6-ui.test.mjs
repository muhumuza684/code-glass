import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

const renderer = path.resolve('electron/src/index.html');

describe('Code Glass Phase 6 responsive observatory UI', () => {
  it('contains layered glass material and no horizontal overflow', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain('CODEGLASS_PHASE06_LAYERED_GLASS');
    expect(html).toContain('cg-glass-layers');
    expect(html).toContain('rear');
    expect(html).toContain('liquid');
    expect(html).toContain('front');
    expect(html).toContain('edge');
    expect(html).toContain('fracture');
    expect(html).toContain('overflow-x:hidden');
  });

  it('contains responsive desktop, tablet, and mobile rules', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain('@media(max-width:1150px)');
    expect(html).toContain('@media(max-width:760px)');
    expect(html).toContain('grid-template-columns:1fr');
  });

  it('binds structured failure state to whole-project impact and accessibility alerts', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain('cg-impact');
    expect(html).toContain('PROJECT AFFECTED BY FAILURE');
    expect(html).toContain("setAttribute('role','alert')");
    expect(html).toContain("setAttribute('aria-live','assertive')");
  });

  it('supports keyboard focus and reduced-motion accessibility', async () => {
    const html = await fs.readFile(renderer, 'utf8');
    expect(html).toContain('focus-visible');
    expect(html).toContain('prefers-reduced-motion:reduce');
    expect(html).toContain('min-height:42px');
  });
});
