import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const impact = require('../src/failure-impact.js');

function manifest() {
  return {
    schema_version: '1.1',
    project_id: 'phase-five-test',
    display_name: 'Phase Five Test',
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

describe('Code Glass Phase 5 failure impact', () => {
  it('records a structured failure with process and evidence', () => {
    const next = impact.recordFailure(manifest(), {
      processId: 'build-prove',
      code: 'TEST_FAILURE',
      message: 'Unit test failed',
      severity: 'error',
      evidence: ['test-output.log']
    });
    expect(next.status_dots).toHaveLength(1);
    expect(next.status_dots[0].process_id).toBe('build-prove');
    expect(next.status_dots[0].code).toBe('TEST_FAILURE');
    expect(next.status_dots[0].resolved).toBe(false);
    expect(next.gate_log[0].result).toBe('fail');
  });

  it('propagates the first unresolved error to whole-project impact', () => {
    let next = impact.recordFailure(manifest(), { processId: 'build-prove', code: 'BUILD_FAILURE', message: 'Build failed' });
    next = impact.recordFailure(next, { processId: 'ship-learn', code: 'BLOCKED', message: 'Ship blocked', severity: 'warning' });
    const result = impact.deriveProjectImpact(next);
    expect(result.status).toBe('failed');
    expect(result.project_affected).toBe(true);
    expect(result.error_count).toBe(1);
    expect(result.warning_count).toBe(1);
    expect(result.impacted_process_ids).toEqual(['build-prove', 'ship-learn']);
    expect(result.first_failure_message).toBe('Build failed');
  });

  it('resolves a failure and clears project impact when no signals remain', () => {
    let next = impact.recordFailure(manifest(), { processId: 'discover', code: 'INPUT_ERROR', message: 'Missing input' });
    const failureId = next.status_dots[0].id;
    next = impact.resolveFailure(next, failureId, 'Input supplied');
    expect(next.status_dots[0].resolved).toBe(true);
    expect(impact.deriveProjectImpact(next).status).toBe('clear');
    expect(next.gate_log.at(-1).result).toBe('pass');
  });

  it('returns chronological activity history and process-specific impact', () => {
    let next = impact.recordFailure(manifest(), { processId: 'discover', code: 'WARN', message: 'Needs review', severity: 'warning' });
    const history = impact.activityHistory(next);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].process_id).toBe('discover');
    expect(impact.processImpact(next, 'discover').status).toBe('warning');
    expect(impact.processImpact(next, 'build-prove').status).toBe('clear');
  });
});
