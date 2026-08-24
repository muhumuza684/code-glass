export const SAFE_COMMANDS=["STATUS","HELP","RETRY","PAUSE","FIX","APPROVE"];
export function parseRemoteCommand(text){const raw=String(text||"").trim();const cmd=raw.split(/\s+/)[0].toUpperCase();if(!SAFE_COMMANDS.includes(cmd))return {ok:false,reason:"Unknown or unsafe command"};return {ok:true,command:cmd,args:raw.slice(cmd.length).trim()};}
export function notificationPayload(project,event){return {message_id:crypto.randomUUID(),project_id:project.id,process_id:event.process_id||null,severity:event.severity||"info",summary:event.summary||"Project update",required:event.required||[],expires_at:new Date(Date.now()+86400000).toISOString()};}
export function auditRemoteAction(action){return {...action,recorded_at:new Date().toISOString(),execution:"requires-server-policy"};}
// No provider token belongs in this package or in the Electron renderer. Add a verified server adapter separately.
