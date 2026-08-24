export function processToStageId(processId, checkpointId, stages) {
  const byProcess={discover:0,"build-prove":1,"ship-learn":3};
  if (checkpointId) { const i=stages.findIndex(s=>s.id===checkpointId); if(i>=0)return i; }
  if (!(processId in byProcess)) throw new Error("Unknown process");
  return Math.min(byProcess[processId], Math.max(0,stages.length-1));
}
export function bridgeProposal(manifest, proposal) { const index=processToStageId(proposal.process_id,proposal.checkpoint_id,manifest.stages); return {...proposal,target_stage_id:manifest.stages[index].id,bridge_index:index}; }
