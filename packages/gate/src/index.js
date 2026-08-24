const fs = require('node:fs/promises');
const path = require('node:path');
const { exec } = require('node:child_process');
const { promisify } = require('node:util');
const execAsync = promisify(exec);
const id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
async function runBuildTestGate(projectPath) {
  let config;
  try { config = JSON.parse(await fs.readFile(path.join(projectPath, 'codeglass.config.json'), 'utf8')); } catch { return { layer: 'build_tests', result: 'fail', detail: 'Missing or unreadable codeglass.config.json' }; }
  if (!config.testCommand || typeof config.testCommand !== 'string') return { layer: 'build_tests', result: 'fail', detail: 'codeglass.config.json has no testCommand' };
  try { const { stdout, stderr } = await execAsync(config.testCommand, { cwd: projectPath, timeout: 120000, maxBuffer: 1024 * 1024 }); return { layer: 'build_tests', result: 'pass', detail: (stdout || stderr).trim().slice(-500) || 'All tests passed' }; }
  catch (error) { const output = `${error.stdout || ''}\n${error.stderr || ''}`.trim(); return { layer: 'build_tests', result: 'fail', detail: output.slice(-500) || error.message.slice(-500) }; }
}
function recordGateResult(manifest, gateResult, triggeredSnapshotId = null) {
  const entry = { id: id('gr'), ran_at: new Date().toISOString(), layer: gateResult.layer, result: gateResult.result, detail: gateResult.detail, triggered_snapshot_id: gateResult.triggered_snapshot_id ?? triggeredSnapshotId };
  return { ...manifest, gate_log: [...manifest.gate_log, entry] };
}
module.exports = { runBuildTestGate, recordGateResult };
