import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const intake = require('../src/voice-intake.js');

describe('Code Glass Phase 8 voice-first idea intake', () => {
  it('normalizes an accessibility-focused voice transcript', () => {
    const idea = intake.normalizeIdea('Help blind users send ideas by WhatsApp voice notes and build useful tools.');
    expect(idea.title).toBe('Help blind users send ideas by WhatsApp voice notes and build useful tools');
    expect(idea.source_channels).toContain('whatsapp');
    expect(idea.accessibility_priority).toBe(true);
    expect(idea.status).toBe('ready_for_discover');
  });

  it('creates clarification questions for incomplete input', () => {
    const idea = intake.normalizeIdea('Build it');
    expect(idea.status).toBe('needs_clarification');
    expect(idea.clarification_questions.length).toBeGreaterThan(0);
    expect(intake.clarificationPrompt(idea)).toContain('Please answer');
  });

  it('accepts supported audio metadata and rejects non-audio files', () => {
    expect(intake.audioFileMetadata({name:'note.ogg',type:'audio/ogg',size:1200,lastModified:1}).type).toBe('audio/ogg');
    expect(() => intake.audioFileMetadata({name:'note.txt',type:'text/plain'})).toThrow('Only audio files');
  });

  it('contains renderer voice, file, transcript, and accessible status controls', async () => {
    const fs = await import('node:fs/promises');
    const html = await fs.readFile('electron/src/index.html','utf8');
    expect(html).toContain('CODEGLASS_PHASE08_VOICE_INTAKE');
    expect(html).toContain('SpeechRecognition');
    expect(html).toContain('accept="audio/*"');
    expect(html).toContain('data-cg-voice-text');
    expect(html).toContain('aria-live="polite"');
  });
});
