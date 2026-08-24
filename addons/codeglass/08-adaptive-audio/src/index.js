export const AUDIO_STATES={idle:{rpm:.12,rough:.02},active:{rpm:.35,rough:.04},motion:{rpm:.55,rough:.03},warning:{rpm:.32,rough:.35},failed:{rpm:.14,rough:.85},blocked:{rpm:.10,rough:.65},passed:{rpm:.42,rough:.01},release:{rpm:.72,rough:.01}};
export function audioSignature(project){return [project.id,project.status,project.activity_id||project.updated_at].join(":");}
export function shouldCue(previous,current){return audioSignature(previous)!==audioSignature(current);}
// Renderer implementation should use Web Audio only after explicit user interaction.
