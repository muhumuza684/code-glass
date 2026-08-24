export const PROCESS_IDS = ["discover", "build-prove", "ship-learn"];
export const PROCESS_NAMES = { discover:"Discover", "build-prove":"Build & Prove", "ship-learn":"Ship & Learn" };
export function normalizeManifest(input) {
  const legacy = Array.isArray(input.stages) ? input.stages : [];
  const processes = Array.isArray(input.processes) && input.processes.length === 3 ? input.processes : [
    { id:"discover", name:"Discover", status:legacy[0]?.status === "complete" ? "passed" : "active", progress:legacy[0]?.status === "complete" ? 100 : 0, checkpoints:legacy.slice(0,1) },
    { id:"build-prove", name:"Build & Prove", status:legacy.slice(1,3).every(x=>x?.status === "complete") ? "passed" : "queued", progress:legacy.length ? Math.round(legacy.slice(1,3).filter(x=>x?.status === "complete").length/Math.max(2,legacy.slice(1,3).length)*100) : 0, checkpoints:legacy.slice(1,3) },
    { id:"ship-learn", name:"Ship & Learn", status:legacy.slice(3).every(x=>x?.status === "complete") && legacy.length >= 5 ? "passed" : "queued", progress:legacy.length >= 5 ? Math.round(legacy.slice(3,5).filter(x=>x?.status === "complete").length/2*100) : 0, checkpoints:legacy.slice(3,5) }
  ];
  return { ...input, processes, normalized_at:new Date().toISOString() };
}
export function projectHealth(manifest) {
  const open=(manifest.status_dots||[]).filter(x=>!x.resolved);
  if(open.some(x=>x.type==="error")) return "failed";
  if(open.some(x=>x.type==="warning") || manifest.pending_confirmation) return "warning";
  return "healthy";
}
