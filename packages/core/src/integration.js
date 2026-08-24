const PROCESS_IDS = ['discover', 'build-prove', 'ship-learn'];
const PROCESS_NAMES = { discover: 'Discover', 'build-prove': 'Build & Prove', 'ship-learn': 'Ship & Learn' };
function normalizeProject(manifest) {
  const legacy = Array.isArray(manifest.stages) ? manifest.stages : [];
  const existing = Array.isArray(manifest.processes) && manifest.processes.length === 3 ? manifest.processes : null;
  const processes = existing || [
    { id: 'discover', name: 'Discover', status: legacy[0]?.status === 'complete' ? 'passed' : 'active', progress: legacy[0]?.status === 'complete' ? 100 : 0, checkpoints: legacy.slice(0, 1) },
    { id: 'build-prove', name: 'Build & Prove', status: legacy.slice(1, 3).every(s => s.status === 'complete') && legacy.length >= 3 ? 'passed' : 'queued', progress: legacy.length >= 3 ? Math.round(legacy.slice(1, 3).filter(s => s.status === 'complete').length / 2 * 100) : 0, checkpoints: legacy.slice(1, 3) },
    { id: 'ship-learn', name: 'Ship & Learn', status: legacy.length >= 5 && legacy.slice(3, 5).every(s => s.status === 'complete') ? 'passed' : 'queued', progress: legacy.length >= 5 ? Math.round(legacy.slice(3, 5).filter(s => s.status === 'complete').length / 2 * 100) : 0, checkpoints: legacy.slice(3, 5) }
  ];
  const open = (manifest.status_dots || []).filter(x => !x.resolved);
  const processesWithImpact = processes.map(p => {
    const own = open.filter(x => x.type === 'error' && (x.process_id === p.id || x.stage_id === p.id));
    const pIndex = processes.findIndex(x => x.id === p.id);
    const blocked = open.some(x => x.type === 'error' && processes.findIndex(y => y.id === x.process_id) >= 0 && processes.findIndex(y => y.id === x.process_id) < pIndex);
    return { ...p, state: own.length ? 'failed' : blocked ? 'blocked' : (p.state || p.status || 'queued'), failures: own, downstream_blocked: blocked };
  });
  const status = processesWithImpact.some(p => p.state === 'failed') ? 'failed' : processesWithImpact.some(p => p.state === 'blocked') ? 'blocked' : processesWithImpact.some(p => p.state === 'warning') ? 'warning' : processesWithImpact.every(p => p.state === 'passed') ? 'finished' : 'active';
  return { ...manifest, processes: processesWithImpact, project_status: status, normalized_at: new Date().toISOString() };
}
function firstFailure(manifest) { return (manifest.status_dots || []).find(x => !x.resolved && x.type === 'error') || null; }
module.exports = { PROCESS_IDS, PROCESS_NAMES, normalizeProject, firstFailure };
