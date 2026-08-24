const fs = require('node:fs/promises');
const path = require('node:path');
const { z } = require('zod');

const iso = z.string().datetime({ offset: true });
const stageSchema = z.object({ id: z.string().min(1), name: z.string().min(1), status: z.enum(['not_started', 'in_progress', 'complete']) }).strict();
const gateConfigSchema = z.object({ layers_active: z.array(z.enum(['build_tests', 'dependency_conflicts', 'schema_validation'])), confirmation_granularity: z.enum(['stage_completion', 'every_change']) }).strict();
const pendingSchema = z.object({ id: z.string(), proposed_at: iso, requested_by: z.string(), target_stage_id: z.string(), target_status: z.enum(['not_started', 'in_progress', 'complete']), summary: z.string(), gate_result_id: z.string().nullable() }).strict();
const manifestSchema = z.object({
  schema_version: z.literal('1.1'), project_id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/), display_name: z.string().min(1), project_path: z.string().min(1),
  created_at: iso, updated_at: iso, interaction_mode: z.enum(['cli', 'mcp']), workflow_mode: z.enum(['manual', 'auto']), stages: z.array(stageSchema).min(1), current_stage_index: z.number().int().min(0),
  overall_completion_pct: z.number().int().min(0).max(100), gate_config: gateConfigSchema, pending_confirmation: pendingSchema.nullable(),
  status_dots: z.array(z.unknown()), gate_log: z.array(z.unknown()), snapshots: z.array(z.unknown())
}).strict();
const appConfigSchema = z.object({
  schema_version: z.literal('1.1'), default_interaction_mode: z.enum(['cli', 'mcp']),
  mcp_server: z.object({ enabled: z.boolean(), port: z.number().int().min(1).max(65535), autostart: z.boolean() }).strict(),
  snapshot_retention: z.object({ keep_last_n_per_project: z.number().int().nonnegative(), max_age_days: z.number().int().nonnegative() }).strict(),
  project_registry: z.array(z.object({ project_id: z.string(), manifest_path: z.string() }).strict())
}).strict();

const now = () => new Date().toISOString();
const computeOverallCompletion = (manifest) => Math.round((manifest.stages.filter(s => s.status === 'complete').length / manifest.stages.length) * 100);
function validateManifest(data) {
  const parsed = manifestSchema.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid manifest: ${parsed.error.issues.map(i => `${i.path.join('.') || '<root>'} ${i.message}`).join('; ')}`);
  if (data.stages.filter(s => s.status === 'in_progress').length > 1) throw new Error('Invalid manifest: at most one stage may be in_progress');
  if (data.current_stage_index >= data.stages.length) throw new Error('Invalid manifest: current_stage_index is outside stages');
  if (data.overall_completion_pct !== computeOverallCompletion(data)) throw new Error('Invalid manifest: overall_completion_pct is derived and incorrect');
  return true;
}
function createManifest(projectId, displayName, projectPath, stages, interactionMode = 'cli', workflowMode = 'manual') {
  const stamp = now(); const normalized = stages.map(s => ({ id: s.id, name: s.name, status: s.status || 'not_started' }));
  const firstOpen = normalized.findIndex(s => s.status !== 'complete');
  const manifest = { schema_version: '1.1', project_id: projectId, display_name: displayName, project_path: projectPath, created_at: stamp, updated_at: stamp, interaction_mode: interactionMode, workflow_mode: workflowMode, stages: normalized, current_stage_index: firstOpen < 0 ? 0 : firstOpen, overall_completion_pct: 0, gate_config: { layers_active: ['build_tests'], confirmation_granularity: 'stage_completion' }, pending_confirmation: null, status_dots: [], gate_log: [], snapshots: [] };
  manifest.overall_completion_pct = computeOverallCompletion(manifest); validateManifest(manifest); return manifest;
}
async function loadManifest(filePath) { const data = JSON.parse(await fs.readFile(filePath, 'utf8')); if (data.workflow_mode === undefined) data.workflow_mode = 'manual'; validateManifest(data); return data; }
async function saveManifest(filePath, manifest) { const next = { ...manifest, updated_at: now() }; validateManifest(next); await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`); return next; }
async function loadAppConfig(filePath) { const data = JSON.parse(await fs.readFile(filePath, 'utf8')); appConfigSchema.parse(data); return data; }
async function saveAppConfig(filePath, config) { appConfigSchema.parse(config); await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`); return config; }
function getCurrentStage(manifest) { return manifest.stages[manifest.current_stage_index] || null; }
const integration = require('./integration');
module.exports = { ...integration, manifestSchema, appConfigSchema, createManifest, loadManifest, saveManifest, validateManifest, computeOverallCompletion, getCurrentStage, loadAppConfig, saveAppConfig };

/* CODEGLASS_PHASE03_CANONICAL_MIGRATION */
const phase03Migration = require('./state-migration');
module.exports.migrateLegacyStages = phase03Migration.migrateLegacyStages;
module.exports.migrateManifest = phase03Migration.migrateManifest;
module.exports.loadCanonicalManifest = (filePath) => phase03Migration.loadCanonicalManifest(filePath, module.exports.validateManifest);
module.exports.saveCanonicalManifest = (filePath, manifest) => phase03Migration.saveCanonicalManifest(filePath, manifest, module.exports.validateManifest);
module.exports.loadManifest = async (filePath) => {
  const raw = JSON.parse(await require('node:fs/promises').readFile(filePath, 'utf8'));
  const migrated = phase03Migration.migrateManifest(raw);
  module.exports.validateManifest(migrated);
  return migrated;
};

/* CODEGLASS_PHASE04_PROCESS_WORKFLOW */
const phase04Workflow = require('./process-workflow');
module.exports.validateProcessState = phase04Workflow.validateProcessState;
module.exports.recordGateResult = phase04Workflow.recordGateResult;
module.exports.proposeChange = phase04Workflow.proposeChange;
module.exports.confirmChange = phase04Workflow.confirmChange;
module.exports.rejectChange = phase04Workflow.rejectChange;
module.exports.createSnapshot = phase04Workflow.createSnapshot;
module.exports.restoreSnapshot = phase04Workflow.restoreSnapshot;

/* CODEGLASS_PHASE05_FAILURE_IMPACT */
const phase05Impact = require('./failure-impact');
module.exports.recordFailure = phase05Impact.recordFailure;
module.exports.resolveFailure = phase05Impact.resolveFailure;
module.exports.deriveProjectImpact = phase05Impact.deriveProjectImpact;
module.exports.activityHistory = phase05Impact.activityHistory;
module.exports.processImpact = phase05Impact.processImpact;

/* CODEGLASS_PHASE09_NOTIFICATIONS */
const phase09Notifications = require('./notifications');
module.exports.normalizeEmail = phase09Notifications.normalizeEmail;
module.exports.normalizePhone = phase09Notifications.normalizePhone;
module.exports.normalizeRecipients = phase09Notifications.normalizeRecipients;
module.exports.runtimeProviderConfig = phase09Notifications.runtimeProviderConfig;
module.exports.publicProviderConfig = phase09Notifications.publicProviderConfig;
module.exports.notificationText = phase09Notifications.notificationText;
module.exports.buildNotification = phase09Notifications.buildNotification;
module.exports.deliverNotification = phase09Notifications.deliverNotification;
module.exports.appendNotificationRecord = phase09Notifications.appendNotificationRecord;
module.exports.failureEvent = phase09Notifications.failureEvent;
module.exports.progressEvent = phase09Notifications.progressEvent;

/* CODEGLASS_PHASE10_REMOTE_REPLIES */
const phase10Remote = require('./remote-replies');
module.exports.signReply = phase10Remote.signReply;
module.exports.verifyReply = phase10Remote.verifyReply;
module.exports.parseCommand = phase10Remote.parseCommand;
module.exports.acceptReply = phase10Remote.acceptReply;
module.exports.executeSafeReply = phase10Remote.executeSafeReply;
module.exports.releaseReadiness = phase10Remote.releaseReadiness;
module.exports.finalAcceptance = phase10Remote.finalAcceptance;

/* CODEGLASS_PHASE11_QUALITY_HARDENING */
const phase11Quality = require('./quality-hardening');
module.exports.escapeHtml = phase11Quality.escapeHtml;
module.exports.redactText = phase11Quality.redactText;
module.exports.redact = phase11Quality.redact;
module.exports.validateManifestShape = phase11Quality.validateManifestShape;
module.exports.validateJsonExport = phase11Quality.validateJsonExport;
module.exports.validateHtmlExport = phase11Quality.validateHtmlExport;
module.exports.auditRenderer = phase11Quality.auditRenderer;
module.exports.auditSecretSafety = phase11Quality.auditSecretSafety;

/* CODEGLASS_PHASE14_ARCHITECTURE_HARDENING */
const phase14Architecture = require('./architecture-hardening');
module.exports.eventId = phase14Architecture.eventId;
module.exports.atomicWriteJson = phase14Architecture.atomicWriteJson;
module.exports.withRetry = phase14Architecture.withRetry;
module.exports.validateTransition = phase14Architecture.validateTransition;
module.exports.idempotencyKey = phase14Architecture.idempotencyKey;
module.exports.acceptOnce = phase14Architecture.acceptOnce;
module.exports.buildAuditSummary = phase14Architecture.buildAuditSummary;

/* CODEGLASS_PHASE15_GUIDANCE_SIGNALS */
const phase15Guidance = require('./guidance-signals');
module.exports.SIGNALS = phase15Guidance.SIGNALS;
module.exports.resolveGuidanceSignal = phase15Guidance.resolveGuidanceSignal;
module.exports.getGuidanceAnnouncement = phase15Guidance.getGuidanceAnnouncement;
module.exports.getGuidanceAudioCue = phase15Guidance.getGuidanceAudioCue;
module.exports.getGuidanceHapticCue = phase15Guidance.getGuidanceHapticCue;
module.exports.normalizeGuidanceMode = phase15Guidance.normalizeGuidanceMode;
module.exports.setGuidanceMode = phase15Guidance.setGuidanceMode;
