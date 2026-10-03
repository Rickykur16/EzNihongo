import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {enabledEnv} from '../deploy/set-marketing-crm-flags.mjs';

const helper=fileURLToPath(new URL('../deploy/set-marketing-crm-flags.mjs',import.meta.url));

test('CRM activation edits only the two owner-facing flags and can restore the original EnvironmentFile',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'crm-flags-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'.env'),backup=path.join(dir,'before.env');
  const original='DATABASE_URL=postgresql://example.invalid/db\nCOMPANY_STAFF_ENABLED=false\nMARKETING_CRM_ENABLED=false\n';
  await writeFile(file,original,{mode:0o640});await writeFile(backup,original);
  execFileSync(process.execPath,[helper,'--enable',file]);
  const changed=await readFile(file,'utf8');
  assert.match(changed,/^COMPANY_WORKSPACE_ENABLED=true$/m);
  assert.match(changed,/^MARKETING_CRM_ENABLED=true$/m);
  assert.match(changed,/^COMPANY_STAFF_ENABLED=false$/m);
  assert.match(changed,/^DATABASE_URL=postgresql:\/\/example.invalid\/db$/m);
  assert.equal(enabledEnv(changed),changed);
  if(process.platform!=='win32')assert.equal((await stat(file)).mode&0o777,0o640);
  execFileSync(process.execPath,[helper,'--restore',file,backup]);
  assert.equal(await readFile(file,'utf8'),original);
});

test('CRM activation rejects ambiguous flag definitions',()=>{
  assert.throws(()=>enabledEnv('MARKETING_CRM_ENABLED=false\nMARKETING_CRM_ENABLED=true\n'),/duplicate_MARKETING_CRM_ENABLED/);
  assert.throws(()=>enabledEnv('export MARKETING_CRM_ENABLED=false\n'),/unsupported_MARKETING_CRM_ENABLED_syntax/);
  assert.equal(enabledEnv('COMPANY_WORKSPACE_ENABLED=false\r\nMARKETING_CRM_ENABLED=false\r\n').match(/MARKETING_CRM_ENABLED=true/g)?.length,1);
});

test('CRM activation shell script parses', {skip:process.platform==='win32'&&!process.env.DEPLOY_TEST_BASH},()=>{
  const script=fileURLToPath(new URL('../deploy/activate-marketing-crm.sh',import.meta.url));
  const result=spawnSync(process.env.DEPLOY_TEST_BASH||'bash',['-n',script],{encoding:'utf8'});
  assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
});
