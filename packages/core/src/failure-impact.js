'use strict';

const crypto = require('node:crypto');

function eventId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function timestamp() {
  return new Date().toISOString();
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function severityOf(value) {
  return value === 'error' || value === 'warning' || value === 'info' ? value : 'error';
}

function processExists(manifest, processId) {
  return (manifest.stages || []).some(stage => stage.id === processId);
}

function recordFailure(manifest, input) {
  const next = copy(manifest);
  const processId = String(input.processId || input.stageId || next.stages?.[next.current_stage_index || 0]?.id || 'unknown');
  if (!processExists(next, processId)) throw new Error(`Failure process was not found: ${processId}`);
  const created = timestamp();
  const failure = {
    id: eventId('failure'),
    type: severityOf(input.severity || 'error'),
    process_id: processId,
    code: String(input.code || 'BUILD_FAILURE'),
    message: String(input.message || 'An unknown failure occurred.'),
    evidence: Array.isArray(input.evidence) ? input.evidence.map(String) : [],
    resolved: false,
    created_at: created
  };
  next.status_dots = [...(next.status_dots || []), failure];
  next.gate_log = [...(next.gate_log || []), {
    id: eventId('event'),
    created_at: created,
    result: failure.type === 'error' ? 'fail' : failure.type === 'warning' ? 'warning' : 'info',
    process_id: processId,
    detail: `${failure.code}: ${failure.message}`,
    failure_id: failure.id,
    evidence: failure.evidence
  }];
  next.updated_at = created;
  return next;
}

function resolveFailure(manifest, failureId, resolution) {
  const next = copy(manifest);
  const index = (next.status_dots || []).findIndex(item => item.id === failureId && !item.resolved);
  if (index < 0) throw new Error(`Open failure was not found: ${failureId}`);
  const resolvedAt = timestamp();
  next.status_dots[index] = {
    ...next.status_dots[index],
    resolved: true,
    resolved_at: resolvedAt,
    resolution: String(resolution || 'Resolved by operator.')
  };
  next.gate_log = [...(next.gate_log || []), {
    id: eventId('event'),
    created_at: resolvedAt,
    result: 'pass',
    process_id: next.status_dots[index].process_id,
    detail: `Resolved ${next.status_dots[index].code}: ${next.status_dots[index].message}`,
    failure_id: failureId,
    resolution: String(resolution || 'Resolved by operator.')
  }];
  next.updated_at = resolvedAt;
  return next;
}

function deriveProjectImpact(manifest) {
  const open = (manifest.status_dots || []).filter(item => !item.resolved);
  const errors = open.filter(item => item.type === 'error');
  const warnings = open.filter(item => item.type === 'warning');
  const processIds = [...new Set(open.map(item => item.process_id).filter(Boolean))];
  const first = [...open].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0] || null;
  return {
    status: errors.length ? 'failed' : warnings.length ? 'warning' : 'clear',
    project_affected: errors.length > 0,
    open_signal_count: open.length,
    error_count: errors.length,
    warning_count: warnings.length,
    impacted_process_ids: processIds,
    first_failure_id: first?.id || null,
    first_failure_message: first?.message || null
  };
}

function activityHistory(manifest, limit = 100) {
  const gates = (manifest.gate_log || []).map(item => ({
    id: item.id,
    time: item.created_at || item.timestamp || null,
    type: item.result === 'fail' ? 'error' : item.result === 'warning' ? 'warning' : item.result === 'pass' ? 'pass' : 'info',
    process_id: item.process_id || null,
    title: item.result === 'fail' ? 'Failure gate' : item.result === 'pass' ? 'Passing gate' : 'Build activity',
    detail: item.detail || '',
    evidence: item.evidence || []
  }));
  const signals = (manifest.status_dots || []).map(item => ({
    id: item.id,
    time: item.resolved_at || item.created_at || null,
    type: item.type || 'info',
    process_id: item.process_id || null,
    title: item.resolved ? 'Signal resolved' : 'Open signal',
    detail: item.resolved ? `${item.message} — ${item.resolution || 'resolved'}` : item.message || '',
    evidence: item.evidence || []
  }));
  return [...gates, ...signals]
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, Math.max(1, Number(limit) || 100));
}

function processImpact(manifest, processId) {
  const signals = (manifest.status_dots || []).filter(item => !item.resolved && item.process_id === processId);
  return {
    process_id: processId,
    status: signals.some(item => item.type === 'error') ? 'failed' : signals.some(item => item.type === 'warning') ? 'warning' : 'clear',
    open_signal_count: signals.length,
    signals
  };
}

module.exports = {
  recordFailure,
  resolveFailure,
  deriveProjectImpact,
  activityHistory,
  processImpact
};
