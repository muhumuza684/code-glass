export function createRendererStore(readManifest) {
  let state={projects:[],events:[]};
  return { async refresh(registry){const projects=[];for(const e of registry){const m=await readManifest(e.manifest_path);if(m)projects.push({entry:e,manifest:m});}state={...state,projects};return state;}, get(){return state;} };
}
export function stageLabel(state){return {not_started:"Not started",queued:"Queued",active:"In motion",passed:"Passed",warning:"Warning",failed:"Failed",blocked:"Blocked",skipped:"Skipped"}[state]||"Unknown";}
