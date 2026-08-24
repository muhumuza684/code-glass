'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const PROCESS_IDS = ['discover', 'build-prove', 'ship-learn'];
const PROCESS_NAMES = ['Discover', 'Build & Prove', 'Ship & Learn'];
const VALID_STATUS = new Set(['not_started', 'in_progress', 'complete']);

function safeIso(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function slug(value) {
  return String(value || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project';
}

function normalizeStatus(value, fallback) {
  if (value === 'passed') return 'complete';
  if (value === 'active') return 'in_progress';
  return VALID_STATUS.has(value) ? value : fallback;
}

function sourceStages(input) {
  if (Array.isArray(input.stages) && input.stages.length) return input.stages;
  if (Array.isArray(input.processes) && input.processes.length) return input.processes;
  if (Array.isArray(input.stage_list) && input.stage_list.length) return input.stage_list;
  if (Array.isArray(input.workflow_stages) && input.workflow_stages.length) return input.workflow_stages;
  return [];
}

function migrateLegacyStages(input) {
  const source = input && typeof input === 'object' ? input : {};
  const raw = sourceStages(source);
  const byId = new Map(raw.map((item, index) => {
    const id = String(item.id || item.stage_id || item.process_id || PROCESS_IDS[index] || '').toLowerCase();
    return [id, item];
  }));

  const stages = PROCESS_IDS.map((id, index) => {
    const old = byId.get(id) || raw[index] || {};
    const progress = Number(old.progress ?? old.completion_pct ?? 0) || 0;
    const fallback = progress >= 100 ? 'complete' : index === 0 ? 'in_progress' : 'not_started';
    return {
      id,
      name: PROCESS_NAMES[index],
      status: normalizeStatus(old.status, fallback)
    };
  });

  if (!stages.some(x => x.status === 'in_progress') && stages.some(x => x.status !== 'complete')) {
    const firstOpen = stages.find(x => x.status !== 'complete');
    firstOpen.status = 'in_progress';
  }

  const active = stages.findIndex(x => x.status === 'in_progress');
  const requested = Number(source.current_stage_index ?? source.current_process_index);
  const currentIndex = active >= 0 ? active : Number.isInteger(requested) && requested >= 0 && requested < 3 ? requested : 0;
  return { stages, currentIndex };
}

function migrateManifest(input) {
  const source = input && typeof input === 'object' ? input : {};
  const result = migrateLegacyStages(source);
  const now = new Date().toISOString();
  const completeCount = result.stages.filter(x => x.status === 'complete').length;

  return {
    schema_version: '1.1',
    project_id: slug(source.project_id || source.display_name || source.name),
    display_name: String(source.display_name || source.name || 'Untitled project'),
    project_path: String(source.project_path || source.path || '.'),
    created_at: safeIso(source.created_at || now),
    updated_at: safeIso(source.updated_at || now),
    interaction_mode: source.interaction_mode === 'mcp' ? 'mcp' : 'cli',
    workflow_mode: source.workflow_mode === 'auto' ? 'auto' : 'manual',
    stages: result.stages,
    current_stage_index: result.currentIndex,
    overall_completion_pct: Math.round((completeCount / result.stages.length) * 100),
    gate_config: {
      layers_active: Array.isArray(source.gate_config?.layers_active) && source.gate_config.layers_active.length ? source.gate_config.layers_active : ['build_tests'],
      confirmation_granularity: source.gate_config?.confirmation_granularity === 'every_change' ? 'every_change' : 'stage_completion'
    },
    pending_confirmation: source.pending_confirmation || null,
    status_dots: Array.isArray(source.status_dots) ? source.status_dots : [],
    gate_log: Array.isArray(source.gate_log) ? source.gate_log : [],
    snapshots: Array.isArray(source.snapshots) ? source.snapshots : []
  };
}

async function loadCanonicalManifest(filePath, validate) {
  const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const manifest = migrateManifest(raw);
  if (typeof validate === 'function') validate(manifest);
  return manifest;
}

async function saveCanonicalManifest(filePath, input, validate) {
  const manifest = migrateManifest(input);
  manifest.updated_at = new Date().toISOString();
  if (typeof validate === 'function') validate(manifest);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

module.exports = {
  PROCESS_IDS,
  PROCESS_NAMES,
  migrateLegacyStages,
  migrateManifest,
  loadCanonicalManifest,
  saveCanonicalManifest
};
