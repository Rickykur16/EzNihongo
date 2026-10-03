import {readFileSync,statSync,openSync,writeFileSync,fsyncSync,closeSync,chownSync,chmodSync,renameSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const FLAGS=['COMPANY_WORKSPACE_ENABLED','MARKETING_CRM_ENABLED'];

export function enabledEnv(source){
  let output=source;
  for(const key of FLAGS){
    const line=new RegExp(`^${key}=[^\\r\\n]*\\r?$`,'gm');
    const matches=[...output.matchAll(line)];
    if(matches.length>1)throw new Error(`duplicate_${key}`);
    if(matches.length===0&&new RegExp(`^(?:export\\s+)?${key}\\s*=`, 'm').test(output))throw new Error(`unsupported_${key}_syntax`);
    if(matches.length===1)output=output.replace(line,`${key}=true`);
    else output+=`${output.endsWith('\n')||!output?'':'\n'}${key}=true\n`;
  }
  return output;
}

function atomicReplace(target,contents){
  const metadata=statSync(target);
  if(!metadata.isFile())throw new Error('environment_file_not_regular');
  const temporary=`${target}.crm-${randomUUID()}.tmp`;
  let fd;
  try{
    fd=openSync(temporary,'wx',0o600);
    writeFileSync(fd,contents);
    fsyncSync(fd);
    closeSync(fd);fd=undefined;
    chownSync(temporary,metadata.uid,metadata.gid);
    chmodSync(temporary,metadata.mode&0o777);
    renameSync(temporary,target);
  }catch(error){
    if(fd!==undefined)closeSync(fd);
    try{unlinkSync(temporary);}catch{}
    throw error;
  }
}

function main(){
  const [mode,target,backup]=process.argv.slice(2);
  if(!['--enable','--restore'].includes(mode)||!target||(mode==='--restore'&&!backup))throw new Error('usage: --enable ENV_FILE | --restore ENV_FILE BACKUP_FILE');
  if(mode==='--restore')atomicReplace(target,readFileSync(backup));
  else atomicReplace(target,Buffer.from(enabledEnv(readFileSync(target,'utf8'))));
  console.log(mode==='--enable'?'CRM flags enabled in EnvironmentFile':'EnvironmentFile restored from backup');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{main();}catch(error){console.error(error.message);process.exitCode=1;}
}
