import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const architecture = require('../src/architecture-hardening.js');

describe('Code Glass Phase 14 architecture and reliability', () => {
  it('writes JSON through an atomic temporary-file path and preserves a previous copy', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(),'codeglass-phase14-'));
    const file = path.join(root,'state.json');
    await architecture.atomicWriteJson(file,{version:1});
    await architecture.atomicWriteJson(file,{version:2});
    expect(JSON.parse(await fs.readFile(file,'utf8')).version).toBe(2);
    expect(JSON.parse(await fs.readFile(`${file}.previous`,'utf8')).version).toBe(1);
  });

  it('retries through an injected operation with a bounded attempt count', async () => {
    let attempts=0;
    const value=await architecture.withRetry(async attempt=>{attempts=attempt;if(attempt<3)throw new Error('temporary');return 'ok';},{attempts:4,delayMs:0});
    expect(value).toBe('ok');expect(attempts).toBe(3);
    await expect(architecture.withRetry(async()=>{throw new Error('permanent');},{attempts:2,delayMs:0})).rejects.toThrow('permanent');
  });

  it('enforces ordered process transitions', () => {
    const state={stages:[{id:'discover',status:'complete'},{id:'build-prove',status:'in_progress'},{id:'ship-learn',status:'not_started'}]};
    expect(architecture.validateTransition(state,'build-prove','complete')).toBe(true);
    expect(()=>architecture.validateTransition(state,'ship-learn','in_progress')).toThrow('earlier processes');
  });

  it('prevents duplicate events and creates stable idempotency keys', () => {
    const first=architecture.idempotencyKey(['project','failure','one']);
    const second=architecture.idempotencyKey(['project','failure','one']);
    expect(first).toBe(second);
    const accepted=architecture.acceptOnce(new Set(),first,{ok:true});
    const duplicate=architecture.acceptOnce(accepted.store,first,{ok:true});
    expect(accepted.accepted).toBe(true);expect(duplicate.duplicate).toBe(true);
  });

  it('redacts audit findings and exposes a safe release summary', () => {
    const summary=architecture.buildAuditSummary({status:'pass',phase:'14',tests:5,findings:['token=SECRET','Call +256700000000']});
    expect(summary.status).toBe('pass');expect(summary.secret_safe).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('SECRET');
    expect(JSON.stringify(summary)).not.toContain('+256700000000');
  });
});
