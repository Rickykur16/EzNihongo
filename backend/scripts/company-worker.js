import 'dotenv/config';
import pg from 'pg';
import { setTimeout as delay } from 'node:timers/promises';
import { processCompanyJob } from '../src/company-outbox.js';

if(process.env.COMPANY_WORKSPACE_ENABLED!=='true' || process.env.COMPANY_WORKER_ENABLED!=='true')throw new Error('Company worker disabled');
if(!process.env.DATABASE_URL || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_CHAT_ID)throw new Error('Worker configuration incomplete');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:5000});
let stopping=false;
process.on('SIGTERM',()=>{stopping=true;}); process.on('SIGINT',()=>{stopping=true;});
async function send() {
  const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
    body:JSON.stringify({chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:'Ada konten EzNihongo yang siap dipublikasikan. Periksa ruang kerja Marketing: https://eznihongo.com/company.html'})});
  const body=await response.json();if(!response.ok || body.ok!==true)throw new Error('delivery_failed');
}
try { while(!stopping) { try { if(!await processCompanyJob(pool,send))await delay(2000); } catch { console.error('company_worker_cycle_failed');await delay(5000); } } }
finally { await pool.end(); }
