export function migrateLegacyManifest(m) {
  if (m.schema_version !== "1.1") throw new Error("Unsupported manifest version");
  if (m.processes?.length === 3) return {...m, migration_status:"already-normalized"};
  const stages=m.stages||[];
  return {...m, processes:[
    {id:"discover",name:"Discover",status:stages[0]?.status||"not_started",progress:stages[0]?.status==="complete"?100:0,checkpoints:stages.slice(0,1)},
    {id:"build-prove",name:"Build & Prove",status:"queued",progress:0,checkpoints:stages.slice(1,3)},
    {id:"ship-learn",name:"Ship & Learn",status:"queued",progress:0,checkpoints:stages.slice(3,5)}
  ],migration_status:"legacy-compatible"};
}
export function validateMigration(m) { if (!m.processes || m.processes.length !== 3) throw new Error("Migration did not produce three processes"); return true; }
