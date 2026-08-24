export const PROCESS_STATES=["not_started","queued","active","passed","warning","failed","blocked","skipped"];
export function processFailureImpact(processes, signals=[]) {
  const errors=signals.filter(x=>!x.resolved && x.type==="error");
  return processes.map(p=>{const own=errors.filter(e=>e.process_id===p.id);const upstream=processes.findIndex(x=>x.id===p.id);const blocked=errors.some(e=>processes.findIndex(x=>x.id===e.process_id)<upstream);return {...p, state:own.length?"failed":blocked?"blocked":p.state||p.status||"queued", failures:own, downstream_blocked:blocked};});
}
export function deriveProjectStatus(processes) { if(processes.some(p=>p.state==="failed")) return "failed"; if(processes.some(p=>p.state==="blocked")) return "blocked"; if(processes.some(p=>p.state==="warning")) return "warning"; if(processes.every(p=>p.state==="passed")) return "finished"; return "active"; }
