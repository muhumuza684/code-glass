import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const workflow = require('../src/process-workflow.js');

function manifest() {
  return {
    schema_version: '1.1',
    project_id: 'phase-four-test',
    display_name: 'Phase Four Test',
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
    snapshots: []
  };
}

describe('Code Glass Phase 4 process workflow', () => {
  it('records a passing gate and creates a human confirmation proposal', () => {
    let state = workflow.recordGateResult(manifest(), { result: 'pass', process_id: 'discover', detail: 'Tests passed', evidence: ['test-log'] });
    expect(state.gate_log).toHaveLength(1);
    expect(state.gate_log[0].result).toBe('pass');
    state = workflow.proposeChange(state, { targetStageId: 'discover', targetStatus: 'complete', requestedBy: 'test', summary: 'Complete Discover', gateResultId: state.gate_log[0].id });
    expect(state.pending_confirmation.target_stage_id).toBe('discover');
    expect(state.pending_confirmation.target_status).toBe('complete');
  });

  it('requires human confirmation before applying a proposal', () => {
    let state = workflow.recordGateResult(manifest(), { result: 'pass', process_id: 'discover' });
    state = workflow.proposeChange(state, { targetStageId: 'discover', targetStatus: 'complete', gateResultId: state.gate_log[0].id });
    const confirmed = workflow.confirmChange(state);
    expect(confirmed.stages[0].status).toBe('complete');
    expect(confirmed.pending_confirmation).toBeNull();
    expect(confirmed.overall_completion_pct).toBe(33);
  });

  it('rejects a proposal without changing process status', () => {
    let state = workflow.recordGateResult(manifest(), { result: 'pass', process_id: 'discover' });
    state = workflow.proposeChange(state, { targetStageId: 'discover', targetStatus: 'complete', gateResultId: state.gate_log[0].id });
    const rejected = workflow.rejectChange(state, 'Needs accessibility review');
    expect(rejected.stages[0].status).toBe('in_progress');
    expect(rejected.pending_confirmation).toBeNull();
    expect(rejected.status_dots[0].type).toBe('warning');
  });

  it('creates and restores a snapshot only with explicit confirmation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codeglass-phase04-'));
    const project = path.join(root, 'project');
    const snapshots = path.join(root, 'snapshots');
    await fs.mkdir(project, { recursive: true });
    await fs.writeFile(path.join(project, 'sample.txt'), 'before');
    const snapshot = await workflow.createSnapshot(project, 'manual', snapshots);
    await fs.writeFile(path.join(project, 'sample.txt'), 'changed');
    await expect(workflow.restoreSnapshot(snapshot, project, false)).rejects.toThrow('explicit confirmation');
    await workflow.restoreSnapshot(snapshot, project, true);
    expect(await fs.readFile(path.join(project, 'sample.txt'), 'utf8')).toBe('before');
  });
});
