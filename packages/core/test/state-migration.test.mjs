import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const migration = require('../src/state-migration.js');
const core = require('../src/index.js');

describe('Code Glass Phase 3 canonical state migration', () => {
  it('migrates legacy stages into the strict canonical schema', async () => {
    const legacy = {
      name: 'Legacy accessibility project',
      project_path: 'C:/Projects/legacy-accessibility',
      stages: [
        { id: 'discover', name: 'Old discovery', status: 'complete', progress: 100 },
        { id: 'build-prove', name: 'Old build', status: 'active', progress: 42 }
      ],
      current_stage_index: 1
    };

    const migrated = migration.migrateManifest(legacy);
    expect(migrated.schema_version).toBe('1.1');
    expect(migrated.project_id).toBe('legacy-accessibility-project');
    expect(migrated.stages).toEqual([
      { id: 'discover', name: 'Discover', status: 'complete' },
      { id: 'build-prove', name: 'Build & Prove', status: 'in_progress' },
      { id: 'ship-learn', name: 'Ship & Learn', status: 'not_started' }
    ]);
    expect(migrated.overall_completion_pct).toBe(33);
    expect(Object.prototype.hasOwnProperty.call(migrated, 'migration')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(migrated.stages[0], 'progress')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(migrated.stages[0], 'checkpoints')).toBe(false);
  });

  it('migrates the process-shaped state used by the renderer', () => {
    const migrated = migration.migrateManifest({
      display_name: 'Process shape',
      project_path: '/tmp/process-shape',
      processes: [
        { id: 'discover', status: 'passed', progress: 100 },
        { id: 'build-prove', status: 'in_progress', progress: 20 },
        { id: 'ship-learn', status: 'not_started', progress: 0 }
      ]
    });
    expect(migrated.stages.map(stage => stage.status)).toEqual([
      'complete', 'in_progress', 'not_started'
    ]);
  });

  it('loads legacy JSON through the integrated core API and validates it', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'codeglass-phase03-'));
    const file = path.join(temp, 'project.codeglass.json');
    await fs.writeFile(file, JSON.stringify({
      name: 'Persisted legacy project',
      project_path: temp,
      stages: [
        { id: 'discover', status: 'complete', progress: 100 },
        { id: 'build-prove', status: 'active', progress: 42 }
      ],
      current_stage_index: 1
    }));

    const loaded = await core.loadManifest(file);
    expect(loaded.stages).toHaveLength(3);
    expect(loaded.workflow_mode).toBe('manual');
    expect(loaded.stages[1].status).toBe('in_progress');
    expect(loaded.overall_completion_pct).toBe(33);
  });
});
