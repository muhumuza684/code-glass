const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const isWin = process.platform === 'win32';
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
function proposeChange(manifest, { targetStageId, targetStatus, summary, requestedBy, gateResultId = null }) {
  if (manifest.pending_confirmation !== null) throw new Error('A confirmation is already pending for this project');
  return { ...clone(manifest), pending_confirmation: { id: uid('pc'), proposed_at: new Date().toISOString(), requested_by: requestedBy, target_stage_id: targetStageId, target_status: targetStatus, summary, gate_result_id: gateResultId } };
}
function confirmChange(manifest) {
  if (!manifest.pending_confirmation) throw new Error('Nothing to confirm');
  const next = clone(manifest); const p = next.pending_confirmation; const index = next.stages.findIndex(s => s.id === p.target_stage_id);
  if (index < 0) throw new Error(`Target stage not found: ${p.target_stage_id}`);
  next.stages[index].status = p.target_status;
  if (p.target_status === 'complete' && index === next.current_stage_index) { const nextOpen = next.stages.findIndex(s => s.status !== 'complete'); next.current_stage_index = nextOpen < 0 ? next.stages.length - 1 : nextOpen; }
  next.overall_completion_pct = Math.round(next.stages.filter(s => s.status === 'complete').length / next.stages.length * 100); next.pending_confirmation = null; return next;
}
function rejectChange(manifest, reason) {
  if (!manifest.pending_confirmation) throw new Error('Nothing to reject');
  const next = clone(manifest); const p = next.pending_confirmation; next.status_dots = [...next.status_dots, { id: uid('dot'), type: 'error', message: reason || 'Change rejected', created_at: new Date().toISOString(), resolved: false, gate_result_id: p.gate_result_id }]; next.pending_confirmation = null; return next;
}
async function createSnapshot(projectPath, trigger = 'manual', snapshotsDir) {
  await fs.mkdir(snapshotsDir, { recursive: true }); const id = uid('snap'); const archivePath = path.join(snapshotsDir, `${id}.zip`);
  const parent = path.dirname(projectPath); const base = path.basename(projectPath);
  if (isWin) {
    const psCmd = `Compress-Archive -Path (Get-ChildItem -LiteralPath '${projectPath}' -Exclude node_modules,.git,dist,build,.next,out).FullName -DestinationPath '${archivePath}' -Force`;
    await run('powershell', ['-NoProfile', '-Command', psCmd]);
  } else {
    await run('zip', ['-r', archivePath, base, '-x', `${base}/node_modules/*`, `${base}/.git/*`, `${base}/dist/*`, `${base}/build/*`, `${base}/.next/*`, `${base}/out/*`], { cwd: parent });
  }
  const stat = await fs.stat(archivePath); return { id, created_at: new Date().toISOString(), trigger, archive_path: archivePath, size_bytes: stat.size };
}
async function restoreSnapshot(snapshotId, snapshots, projectPath, confirmed) {
  if (confirmed !== true) throw new Error('Restoring a snapshot requires confirmed === true');
  const snapshot = snapshots.find(s => s.id === snapshotId); if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);
  await fs.mkdir(projectPath, { recursive: true });
  if (isWin) {
    await run('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${snapshot.archive_path}' -DestinationPath '${projectPath}' -Force`]);
  } else {
    await run('unzip', ['-o', snapshot.archive_path, '-d', path.dirname(projectPath)]);
  }
  return undefined;
}
module.exports = { proposeChange, confirmChange, rejectChange, createSnapshot, restoreSnapshot };
