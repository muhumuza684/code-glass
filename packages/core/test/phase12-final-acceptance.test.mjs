import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const core = require('../src/index.js');
const intake = require('../src/voice-intake.js');
const workflow = require('../src/process-workflow.js');
const impact = require('../src/failure-impact.js');
const notifications = require('../src/notifications.js');
const remote = require('../src/remote-replies.js');
const quality = require('../src/quality-hardening.js');

function baseManifest() {
  return {
    schema_version: '1.1',
    project_id: 'lame-in-tech-final-acceptance',
    display_name: 'Lame in Tech Final Acceptance',
    project_path: '.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    interaction_mode: 'cli',
    workflow_mode: 'manual',
    stages: [
      { id: 'discover', name: 'Discover', status: 'in_progress' },
      { id: 'build-prove', name: 'Build & Prove', status: 'not_started' },
      { id: 'ship-learn', name: 'Ship & Learn', status: 'not_started' }
    ],
    current_stage_index: 0,
    overall_completion_pct: 0,
    gate_config: { layers_active: ['build_tests'], confirmation_granularity: 'stage_completion' },
    pending_confirmation: null,
    status_dots: [],
    gate_log: [],
    snapshots: [],
    notification_recipients: { email: ['owner@example.com'], whatsapp: ['+256700000000'] }
  };
}

describe('Code Glass Phase 12 final end-to-end acceptance', () => {
  it('completes voice idea intake into Discover', () => {
    const idea = intake.normalizeIdea('Help blind users speak ideas through WhatsApp voice notes and build useful tools.');
    expect(idea.accessibility_priority).toBe(true);
    expect(idea.source_channels).toContain('whatsapp');
    expect(idea.status).toBe('ready_for_discover');
  });

  it('enforces the ordered three-process gate journey', () => {
    let state = baseManifest();
    state = workflow.recordGateResult(state, { result: 'pass', process_id: 'discover', detail: 'Discover accepted' });
    state = workflow.proposeChange(state, { targetStageId: 'discover', targetStatus: 'complete', gateResultId: state.gate_log[0].id });
    state = workflow.confirmChange(state);
    expect(state.stages.map(x => x.status)).toEqual(['complete', 'in_progress', 'not_started']);
    state = workflow.recordGateResult(state, { result: 'pass', process_id: 'build-prove', detail: 'Build accepted' });
    state = workflow.proposeChange(state, { targetStageId: 'build-prove', targetStatus: 'complete', gateResultId: state.gate_log.at(-1).id });
    state = workflow.confirmChange(state);
    expect(state.stages.map(x => x.status)).toEqual(['complete', 'complete', 'in_progress']);
  });

  it('propagates a failure, records evidence, and resolves it', () => {
    let state = impact.recordFailure(baseManifest(), { processId: 'build-prove', code: 'TEST_FAILURE', message: 'Build test failed', evidence: ['test.log'] });
    const projectImpact = impact.deriveProjectImpact(state);
    expect(projectImpact.status).toBe('failed');
    expect(projectImpact.project_affected).toBe(true);
    const failureId = state.status_dots[0].id;
    state = impact.resolveFailure(state, failureId, 'Test corrected');
    expect(impact.deriveProjectImpact(state).status).toBe('clear');
  });

  it('creates notification payloads without sending real messages', async () => {
    const event = notifications.failureEvent(baseManifest(), { process_id: 'build-prove', code: 'TEST_FAILURE', message: 'Build failed', evidence: ['test.log'] });
    const calls = [];
    const delivery = await notifications.deliverNotification(event, { email: { enabled: true }, whatsapp: { enabled: true } }, async (channel, config, payload) => { calls.push({ channel, payload }); return { ok: true }; });
    expect(calls).toHaveLength(2);
    expect(delivery.results.every(x => x.status === 'sent')).toBe(true);
  });

  it('accepts only a fresh signed safe remote reply', async () => {
    const value = { body: 'resume', timestamp: Date.now(), nonce: 'final_acceptance_nonce_123' };
    const signed = { ...value, signature: remote.signReply(value, 'final-secret') };
    const accepted = remote.acceptReply(signed, 'final-secret', {}, { now: value.timestamp });
    expect(accepted.ok).toBe(true);
    const executed = await remote.executeSafeReply(accepted, { resume: async () => 'queued safely' });
    expect(executed.executed).toBe(true);
    expect(remote.parseCommand('powershell Remove-Item -Recurse C:\\')).toEqual({ ok: false, reason: 'command_not_allowed' });
  });

  it('validates exported artifacts and canonical state', async () => {
    const state = baseManifest();
    expect(quality.validateManifestShape(state)).toBe(true);
    expect(quality.validateJsonExport(JSON.stringify({ projects: [state] })).projects).toHaveLength(1);
    expect(quality.validateHtmlExport('<!doctype html><meta charset="utf-8"><title>Code Glass Report</title>')).toBe(true);
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'codeglass-final-'));
    const file = path.join(temp, 'project.codeglass.json');
    await fs.writeFile(file, JSON.stringify(state));
    const loaded = await core.loadManifest(file);
    expect(loaded.stages).toHaveLength(3);
  });

  it('requires every phase and safety condition for release', () => {
    const keys = ['phase1','phase2','phase3','phase4','phase5','phase6','phase7','phase8','phase9','phase10','phase11','phase12','tests','secrets_safe','no_uncommitted_secrets'];
    const blocked = core.finalAcceptance({ phase1: true, tests: true });
    expect(blocked.accepted).toBe(false);
    const ready = core.finalAcceptance(Object.fromEntries(keys.map(key => [key, true])));
    expect(ready.accepted).toBe(true);
    expect(ready.status).toBe('release_ready');
  });
});
