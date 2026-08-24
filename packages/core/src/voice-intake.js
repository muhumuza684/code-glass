'use strict';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeIdea(input) {
  const text = clean(typeof input === 'string' ? input : input?.transcript || input?.text || '');
  const title = clean((typeof input === 'object' && input?.title) || text.split(/[.!?]/)[0]).slice(0, 120) || 'Untitled idea';
  const lower = text.toLowerCase();
  const channels = [];
  if (/whatsapp|phone|message/.test(lower)) channels.push('whatsapp');
  if (/gmail|email|mail/.test(lower)) channels.push('gmail');
  if (!channels.length) channels.push('desktop');
  const clarificationQuestions = [];
  if (text.length < 20) clarificationQuestions.push('What problem should this idea solve?');
  if (!/(who|people|user|disabled|blind|deaf|mobility|community)/.test(lower)) clarificationQuestions.push('Who should benefit from this idea?');
  if (!/(build|create|make|help|allow|enable|send|track|connect)/.test(lower)) clarificationQuestions.push('What should the system do first?');
  return {
    intake_id: `idea-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    title,
    transcript: text,
    source_channels: channels,
    accessibility_priority: /disabled|blind|deaf|mobility|unable|needy|assist/.test(lower),
    clarification_questions: clarificationQuestions,
    status: clarificationQuestions.length ? 'needs_clarification' : 'ready_for_discover',
    created_at: new Date().toISOString()
  };
}

function audioFileMetadata(file) {
  if (!file) throw new Error('Audio file is required.');
  if (!String(file.type || '').startsWith('audio/')) throw new Error('Only audio files are accepted.');
  return { name: String(file.name || 'voice-note'), type: String(file.type), size: Number(file.size || 0), last_modified: Number(file.lastModified || 0) };
}

function clarificationPrompt(idea) {
  const questions = Array.isArray(idea?.clarification_questions) ? idea.clarification_questions : [];
  return questions.length ? `I understood: “${idea.title}”. Please answer: ${questions.join(' ')}` : `I understood “${idea.title}”. The idea is ready for Discover.`;
}

module.exports = { normalizeIdea, audioFileMetadata, clarificationPrompt };
