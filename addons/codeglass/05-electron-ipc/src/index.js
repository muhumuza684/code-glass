// Main-process contract. Wire these handlers in main.js and expose only these methods in preload.js.
export const IPC_CHANNELS={createProject:"project:create",saveManifest:"manifest:save",confirm:"proposal:confirm",reject:"proposal:reject",snapshot:"snapshot:create",restore:"snapshot:restore",export:"project:export"};
export function validateExportRequest(request){if(!request||typeof request.projectId!=="string")throw new Error("Invalid export request");return {projectId:request.projectId,format:request.format==="html"?"html":"json"};}
