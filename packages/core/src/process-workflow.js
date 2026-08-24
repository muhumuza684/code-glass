'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function id(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function processIndex(manifest, processId) {
  return (manifest.stages || []).findIndex(stage => stage.id === processId);
}

function validateProcessState(manifest) {
  if (!manifest || !Array.isArray(manifest.stages) || manifest.stages.length === 0) {
    throw new Error('Manifest must contain stages.');
  }
  const active = manifest.stages.filter(stage => stage.status === 'in_progress');
  if (active.length > 1) throw new Error('Only one process may be in_progress.');
  const firstOpen = manifest.stages.findIndex(stage => stage.status !== 'complete');
  const current = Number(manifest.current_stage_index ?? 0);
  if (current < 0 || current >= manifest.stages.length) throw new Error('Current process index is invalid.');
  if (firstOpen >= 0 && current > firstOpen) throw new Error('A later process cannot be current before an earlier process is complete.');
  return true;
}

function completion(manifest) {
  const total = manifest.stages.length;
  return Math.round((manifest.stages.filter(stage => stage.status === 'complete').length / total) * 100);
}

function recordGateResult(manifest, result) {
  const next = clone(manifest);
  validateProcessState(next);
  const entry = {
    id: id('gate'),
    created_at: now(),
    result: result.result === 'pass' ? 'pass' : result.result === 'fail' ? 'fail' : 'warning',
    process_id: result.process_id || next.stages[next.current_stage_index]?.id || null,
    detail: String(result.detail || 'Gate completed.'),
    evidence: Array.isArray(result.evidence) ? result.evidence : []
  };
  next.gate_log = [...(next.gate_log || []), entry];
  next.updated_at = entry.created_at;
  return next;
}

function proposeChange(manifest, input) {
  const next = clone(manifest);
  validateProcessState(next);
  const target = processIndex(next, input.targetStageId || input.targetProcessId);
  if (target < 0) throw new Error('Proposal target process was not found.');
  if (!['not_started', 'in_progress', 'complete'].includes(input.targetStatus)) throw new Error('Invalid proposal status.');
  if (input.targetStatus === 'complete' && input.gateResultId) {
    const gate = (next.gate_log || []).find(entry => entry.id === input.gateResultId);
    if (!gate || gate.result !== 'pass') throw new Error('Completion requires a passing gate result.');
  }
  if (next.pending_confirmation) throw new Error('A confirmation is already pending.');
  next.pending_confirmation = {
    id: id('proposal'),
    proposed_at: now(),
    requested_by: String(input.requestedBy || 'system'),
    target_stage_id: next.stages[target].id,
    target_status: input.targetStatus,
    summary: String(input.summary || 'Review proposed process change.'),
    gate_result_id: input.gateResultId || null
  };
  next.updated_at = next.pending_confirmation.proposed_at;
  return next;
}

function confirmChange(manifest) {
  const next = clone(manifest);
  validateProcessState(next);
  const proposal = next.pending_confirmation;
  if (!proposal) throw new Error('No pending confirmation exists.');
  const target = processIndex(next, proposal.target_stage_id);
  if (target < 0) throw new Error('Pending proposal target no longer exists.');

  next.stages = next.stages.map((stage, index) => {
    if (index === target) return { ...stage, status: proposal.target_status };
    if (proposal.target_status === 'in_progress' && stage.status === 'in_progress') {
      return { ...stage, status: 'not_started' };
    }
    return stage;
  });

  // Completing a process automatically opens the next incomplete process.
  if (proposal.target_status === 'complete') {
    const nextOpen = next.stages.findIndex((stage, index) => index > target && stage.status !== 'complete');
    if (nextOpen >= 0) next.stages[nextOpen] = { ...next.stages[nextOpen], status: 'in_progress' };
  }

  next.current_stage_index = next.stages.findIndex(stage => stage.status === 'in_progress');
  if (next.current_stage_index < 0) {
    const open = next.stages.findIndex(stage => stage.status !== 'complete');
    next.current_stage_index = open < 0 ? next.stages.length - 1 : open;
  }
  next.overall_completion_pct = completion(next);
  next.pending_confirmation = null;
  next.updated_at = now();
  validateProcessState(next);
  return next;
}
function rejectChange(manifest, reason) {
  const next = clone(manifest);
  if (!next.pending_confirmation) throw new Error('No pending confirmation exists.');
  next.status_dots = [...(next.status_dots || []), {
    id: id('rejection'),
    type: 'warning',
    process_id: next.pending_confirmation.target_stage_id,
    message: String(reason || 'Human rejected the proposal.'),
    resolved: false,
    created_at: now()
  }];
  next.pending_confirmation = null;
  next.updated_at = now();
  return next;
}

async function createSnapshot(projectPath, trigger, snapshotRoot) {
  const snapshotPath = path.join(snapshotRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(trigger || 'manual')}`);
  await fs.mkdir(snapshotPath, { recursive: true });
  await fs.cp(projectPath, snapshotPath, { recursive: true, force: true, filter: source => !source.includes('node_modules') && !source.includes('.git') });
  return { id: id('snapshot'), trigger: trigger || 'manual', created_at: now(), archive_path: snapshotPath };
}

async function restoreSnapshot(snapshot, projectPath, confirmation) {
  if (!confirmation) throw new Error('Restore requires explicit confirmation.');
  if (!snapshot || !snapshot.archive_path) throw new Error('Snapshot path is missing.');
  await fs.access(snapshot.archive_path);
  await fs.cp(snapshot.archive_path, projectPath, { recursive: true, force: true, filter: source => !source.includes('node_modules') && !source.includes('.git') });
  return true;
}

module.exports = {
  validateProcessState,
  recordGateResult,
  proposeChange,
  confirmChange,
  rejectChange,
  createSnapshot,
  restoreSnapshot
};
