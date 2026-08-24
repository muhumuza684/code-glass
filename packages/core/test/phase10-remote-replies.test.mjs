import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const remote = require('../src/remote-replies.js');

function payload(body, timestamp = Date.now(), nonce = 'nonce_1234567890') {
  const value = { body, timestamp, nonce };
  return { ...value, signature: remote.signReply(value, 'test-secret') };
}

describe('Code Glass Phase 10 authenticated remote replies', () => {
  it('accepts a correctly signed, fresh, allowlisted reply', () => {
    const result = remote.acceptReply(payload('resume'), 'test-secret', {}, { now: Date.now() });
    expect(result.ok).toBe(true);
    expect(result.command.command).toBe('resume');
    expect(result.state.audit[0].type).toBe('remote_reply_accepted');
  });

  it('rejects forged, expired, malformed, and duplicate replies', () => {
    const now = Date.now();
    expect(remote.verifyReply(payload('retry'), 'wrong-secret', { now })).toEqual({ ok: false, reason: 'invalid_signature' });
    expect(remote.verifyReply(payload('retry', now - 700000), 'test-secret', { now })).toEqual({ ok: false, reason: 'expired' });
    expect(remote.parseCommand('powershell Remove-Item -Recurse C:\\')).toEqual({ ok: false, reason: 'command_not_allowed' });
    const first = remote.acceptReply(payload('ack: received', now, 'nonce_duplicate_123'), 'test-secret', {}, { now });
    const second = remote.acceptReply(payload('ack: received', now, 'nonce_duplicate_123'), 'test-secret', first.state, { now });
    expect(first.ok).toBe(true);
    expect(second).toEqual(expect.objectContaining({ ok: false, reason: 'duplicate_nonce' }));
  });

  it('executes only injected allowlisted handlers', async () => {
    const accepted = remote.acceptReply(payload('answer: supplied missing requirement'), 'test-secret', {}, { now: Date.now() });
    const calls = [];
    const result = await remote.executeSafeReply(accepted, { answer: async argument => { calls.push(argument); return 'recorded'; } });
    expect(result.executed).toBe(true);
    expect(calls).toEqual(['supplied missing requirement']);
    await expect(remote.executeSafeReply({ ok: false }, {})).rejects.toThrow('accepted authenticated');
  });

  it('records rejection audit events without exposing secrets', () => {
    const result = remote.acceptReply(payload('shell: dir', Date.now(), 'nonce_audit_123'), 'test-secret', {}, { now: Date.now() });
    expect(result.ok).toBe(false);
    expect(result.state.audit[0].reason).toBe('command_not_allowed');
    expect(JSON.stringify(result)).not.toContain('test-secret');
  });

  it('blocks release until every phase and safety check passes', () => {
    const blocked = remote.finalAcceptance({ phase1: true, phase2: true, tests: true });
    expect(blocked.accepted).toBe(false);
    expect(blocked.readiness.missing).toContain('phase10');
    const checks = Object.fromEntries(['phase1','phase2','phase3','phase4','phase5','phase6','phase7','phase8','phase9','phase10','tests','secrets_safe','no_uncommitted_secrets'].map(key => [key, true]));
    const ready = remote.finalAcceptance(checks);
    expect(ready.accepted).toBe(true);
    expect(ready.status).toBe('release_ready');
  });
});
