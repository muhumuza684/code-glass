'use strict';

const SIGNALS = Object.freeze({
  GO: { key: 'go', color: 'green', shape: 'circle', icon: '✓', label: 'GO — Continue', audio_cue: 'success', haptic_cue: 'short-pulse' },
  WAIT: { key: 'wait', color: 'amber', shape: 'triangle', icon: 'Ⅱ', label: 'WAIT — Input or confirmation needed', audio_cue: 'warning', haptic_cue: 'double-pulse' },
  STOP: { key: 'stop', color: 'red', shape: 'octagon', icon: '!', label: 'STOP — Action required', audio_cue: 'error', haptic_cue: 'long-pulse' },
  READY: { key: 'ready', color: 'gray', shape: 'circle', icon: '○', label: 'READY — Start an idea', audio_cue: 'idle', haptic_cue: 'none' },
  LISTENING: { key: 'listening', color: 'blue', shape: 'microphone', icon: '●', label: 'LISTENING — Speak now', audio_cue: 'listening', haptic_cue: 'pulse' }
});

function openSignals(manifest) {
  return (manifest?.status_dots || []).filter(signal => !signal.resolved);
}

function resolveGuidanceSignal(manifest, options = {}) {
  const signals = openSignals(manifest);
  const voiceListening = options.voiceListening === true;
  if (voiceListening) return makeSignal(SIGNALS.LISTENING, manifest, null, 'Speak your idea now.');
  const error = signals.find(signal => signal.type === 'error');
  if (error) return makeSignal(SIGNALS.STOP, manifest, error, `Stop. ${error.message || 'A blocking failure needs attention.'}`);
  const warning = signals.find(signal => signal.type === 'warning');
  if (manifest?.pending_confirmation || manifest?.clarification_required || warning) {
    return makeSignal(SIGNALS.WAIT, manifest, manifest.pending_confirmation || warning, 'Wait. The system needs your input or confirmation.');
  }
  if (!manifest || !Array.isArray(manifest.stages) || !manifest.stages.length) return makeSignal(SIGNALS.READY, manifest, null, 'Ready. Speak or choose an idea.');
  const active = manifest.stages.find(stage => stage.status === 'in_progress');
  const complete = manifest.stages.length > 0 && manifest.stages.every(stage => stage.status === 'complete');
  if (complete) return makeSignal(SIGNALS.GO, manifest, null, 'Go. All processes are complete.');
  if (active) return makeSignal(SIGNALS.GO, manifest, active, `Go. ${active.name} is progressing safely.`);
  return makeSignal(SIGNALS.READY, manifest, null, 'Ready. Start the next project action.');
}

function makeSignal(base, manifest, source, description) {
  return {
    guidance_mode: 'guided',
    project_signal: base.key,
    signal_label: base.label,
    signal_color: base.color,
    signal_shape: base.shape,
    icon: base.icon,
    affected_process_id: source?.process_id || source?.id || null,
    affected_process_name: source?.name || null,
    message: source?.message || description,
    recommended_action: base.key === 'stop' ? 'review_failure' : base.key === 'wait' ? 'answer_or_confirm' : base.key === 'listening' ? 'speak_or_stop' : base.key === 'ready' ? 'start_idea' : 'continue',
    audio_cue: base.audio_cue,
    haptic_cue: base.haptic_cue,
    requires_confirmation: Boolean(manifest?.pending_confirmation),
    accessible_description: description,
    color_independent: true
  };
}

function getGuidanceAnnouncement(signal) {
  return `${signal.signal_label}. ${signal.accessible_description}`;
}

function getGuidanceAudioCue(signal) { return signal.audio_cue; }
function getGuidanceHapticCue(signal) { return signal.haptic_cue; }

function normalizeGuidanceMode(value) { return value === 'observatory' ? 'observatory' : 'guided'; }
function setGuidanceMode(preferences, value) { return { ...(preferences || {}), guidance_mode: normalizeGuidanceMode(value) }; }

module.exports = { SIGNALS, resolveGuidanceSignal, getGuidanceAnnouncement, getGuidanceAudioCue, getGuidanceHapticCue, normalizeGuidanceMode, setGuidanceMode };
