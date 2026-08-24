const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises'); const path = require('node:path'); const os = require('node:os');
const core = require('code-glass-core'); const gate = require('code-glass-gate'); const write = require('code-glass-write-path');
const configPath = path.join(os.homedir(), '.codeglass', 'codeglass.app.config.json');
async function ensureConfig() { try { return JSON.parse(await fs.readFile(configPath, 'utf8')); } catch { const c={schema_version:'1.1',default_interaction_mode:'cli',mcp_server:{enabled:false,port:8790,autostart:false},snapshot_retention:{keep_last_n_per_project:20,max_age_days:30},project_registry:[]}; await fs.mkdir(path.dirname(configPath),{recursive:true}); await fs.writeFile(configPath,JSON.stringify(c,null,2)); return c; } }
function startMcpServer() { /* TODO: spawn the separate MCP server module when integrated. */ }

// --- Auto-mode orchestrator ---------------------------------------------
// For any registered project with workflow_mode === 'auto' and no confirmation
// already pending, this runs the build/test gate on its own, and - if the gate
// passes - drafts the proposal itself (proposeChange) so the renderer's normal
// pending_confirmation UI lights up without the human having to invoke
// `codeglass validate` / `record` manually first. It NEVER calls confirmChange -
// that stays a one-click human action no matter what mode a project is in.
let autoTimer = null;
async function autoLoopTick() {
  let cfg; try { cfg = await ensureConfig(); } catch { return; }
  for (const entry of cfg.project_registry) {
    try {
      const manifest = await core.loadManifest(entry.manifest_path);
      if (manifest.workflow_mode !== 'auto') continue;
      if (manifest.pending_confirmation) continue;
      const current = core.getCurrentStage(manifest);
      if (!current || current.status === 'complete') continue;
      const gateResult = await gate.runBuildTestGate(manifest.project_path);
      const withLog = gate.recordGateResult(manifest, gateResult);
      if (gateResult.result !== 'pass') { await core.saveManifest(entry.manifest_path, withLog); continue; }
      const proposed = write.proposeChange(withLog, {
        targetStageId: current.id,
        targetStatus: 'complete',
        summary: `Automated check passed for "${current.name}" - ready to confirm completion?`,
        requestedBy: 'auto-orchestrator',
        gateResultId: withLog.gate_log.at(-1).id,
      });
      await core.saveManifest(entry.manifest_path, proposed);
    } catch (err) {
      console.error(`[auto-loop] ${entry.project_id}:`, err.message);
    }
  }
}
function startAutoLoop() { if (autoTimer) return; autoTimer = setInterval(autoLoopTick, 8000); autoLoopTick(); }
function stopAutoLoop() { if (autoTimer) clearInterval(autoTimer); autoTimer = null; }
// --------------------------------------------------------------------------

async function createWindow() { await ensureConfig(); startAutoLoop(); const win=new BrowserWindow({width:1280,height:860,backgroundColor:'#08111f',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}}); await win.loadFile(path.join(__dirname,'index.html')); }
ipcMain.handle('pick-folder', async () => { const r=await dialog.showOpenDialog({properties:['openDirectory']}); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('read-file', async (_e,p) => { try{return {ok:true,data:await fs.readFile(p,'utf8')}}catch(e){return {ok:false,error:e.message}} });
ipcMain.handle('write-file', async (_e,p,data) => { try{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,data);return {ok:true}}catch(e){return {ok:false,error:e.message}} });
ipcMain.handle('get-config', async()=>ensureConfig()); ipcMain.handle('save-config', async (_e, config)=>{await fs.mkdir(path.dirname(configPath),{recursive:true});await fs.writeFile(configPath,JSON.stringify(config,null,2));return true;}); ipcMain.handle('start-mcp',()=>{startMcpServer();return true;});

ipcMain.handle('project-export', async (_e, projectPath, format = 'json') => {
  const manifest = await core.loadManifest(projectPath);
  const normalized = core.normalizeProject(manifest);
  if (format === 'html') {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return { ok: true, format: 'html', data: '<!doctype html><meta charset="utf-8"><title>Code Glass Report</title><h1>' + esc(normalized.display_name) + '</h1><p>Status: ' + esc(normalized.project_status) + '</p><pre>' + esc(JSON.stringify(normalized, null, 2)) + '</pre>' };
  }
  return { ok: true, format: 'json', data: JSON.stringify(normalized, null, 2) };
});
app.whenReady().then(createWindow); app.on('window-all-closed',()=>{stopAutoLoop();if(process.platform!=='darwin')app.quit()});
