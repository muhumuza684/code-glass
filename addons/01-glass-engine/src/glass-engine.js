const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function glassStateForManifest(manifest){
  const pct=clamp((Number(manifest.overall_completion_pct)||0)/100);
  const open=(manifest.status_dots||[]).filter(x=>!x.resolved);
  const severity=open.some(x=>x.type==='error')?'error':open.some(x=>x.type==='warning')?'warning':open.length?'issues':'healthy';
  const opacity=severity==='error'?.78:severity==='warning'?.68:severity==='issues'?.72:.58;
  return {progress:pct,severity,glassOpacity:opacity,refraction:0.12+pct*.18,thickness:8+open.length*2,clarity:clamp(1-open.length*.12),liquidLevel:pct};
}
export function createGlassEngine({emit=()=>{}}={}){
  let seed=Date.now();
  return {state(manifest){return glassStateForManifest(manifest)},particle(kind,meta={}){const p={id:`glass-${seed++}`,kind,createdAt:new Date().toISOString(),...meta};emit({type:'glass-particle',payload:p});return p},layers(manifest){const s=glassStateForManifest(manifest);return [{id:'rear-structure',depth:-1,opacity:.34},{id:'liquid',depth:0,opacity:s.glassOpacity},{id:'front-glass',depth:1,opacity:.28},{id:'edge-light',depth:2,opacity:s.severity==='healthy'?.65:1}]}};
}
