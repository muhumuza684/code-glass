import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';

const require=createRequire(import.meta.url);
const guidance=require('../src/guidance-signals.js');

function manifest(){return {stages:[{id:'discover',name:'Discover',status:'in_progress'},{id:'build-prove',name:'Build & Prove',status:'not_started'},{id:'ship-learn',name:'Ship & Learn',status:'not_started'}],status_dots:[]};}

describe('Code Glass Phase 15 and 16 guidance modes',()=>{
  it('maps a blocking failure to STOP with redundant cues',()=>{
    const state=manifest();state.status_dots=[{id:'f1',type:'error',process_id:'build-prove',message:'Test failed',resolved:false}];const s=guidance.resolveGuidanceSignal(state);
    expect(s.project_signal).toBe('stop');expect(s.signal_shape).toBe('octagon');expect(s.signal_label).toContain('STOP');expect(s.audio_cue).toBe('error');expect(s.haptic_cue).toBe('long-pulse');expect(s.color_independent).toBe(true);expect(guidance.getGuidanceAnnouncement(s)).toContain('Test failed');
  });
  it('maps confirmation and listening to WAIT and LISTENING',()=>{
    const state=manifest();state.pending_confirmation={id:'p1'};expect(guidance.resolveGuidanceSignal(state).project_signal).toBe('wait');expect(guidance.resolveGuidanceSignal(state,{voiceListening:true}).project_signal).toBe('listening');
  });
  it('maps healthy active, complete, and empty states',()=>{
    expect(guidance.resolveGuidanceSignal(manifest()).project_signal).toBe('go');const complete=manifest();complete.stages.forEach(x=>x.status='complete');expect(guidance.resolveGuidanceSignal(complete).project_signal).toBe('go');expect(guidance.resolveGuidanceSignal(null).project_signal).toBe('ready');
  });
  it('normalizes and persists the two modes',()=>{expect(guidance.normalizeGuidanceMode('bad')).toBe('guided');expect(guidance.normalizeGuidanceMode('observatory')).toBe('observatory');expect(guidance.setGuidanceMode({},'observatory').guidance_mode).toBe('observatory');});
  it('contains both modes, voice switching, redundant cues, and accessibility markup',async()=>{const html=await fs.readFile('electron/src/index.html','utf8');expect(html).toContain('CODEGLASS_PHASE15_GUIDANCE_SIGNALS');expect(html).toContain('CODEGLASS_PHASE16_GUIDED_OBSERVATORY');expect(html).toContain('Guided signals');expect(html).toContain('Full observatory');expect(html).toContain('voiceListening');expect(html).toContain('aria-live');expect(html).toContain('signal_shape');});
});
