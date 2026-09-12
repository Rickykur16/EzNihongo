import { randomUUID } from 'node:crypto';

export async function claimCompanyJob(client) {
  const token=randomUUID();
  // One short statement/transaction. No network call while row locks are held.
  const r=await client.query(`WITH candidate AS (
    SELECT id FROM company_outbox WHERE (state='pending' AND available_at<=NOW())
      OR (state='leased' AND lease_until<NOW()) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE company_outbox j SET state='leased',lease_token=$1,lease_until=NOW()+INTERVAL '60 seconds',attempts=attempts+1
      FROM candidate c WHERE j.id=c.id RETURNING j.*`,[token]);
  return r.rows[0]||null;
}
export async function processCompanyJob(client, send) {
  const job=await claimCompanyJob(client); if(!job)return false;
  const item=(await client.query('SELECT id,status,version FROM company_work_items WHERE id=$1',[job.item_id])).rows[0];
  if(!item || item.status!=='scheduled' || item.version!==job.item_version) {
    await client.query("UPDATE company_outbox SET state='cancelled',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",[job.id,job.lease_token]); return true;
  }
  try {
    // Send generic internal reminder only: no student/payment/content payload.
    // This does not publish a social post or mark the item as published.
    await send({itemId:item.id});
    await client.query("UPDATE company_outbox SET state='sent',lease_token=NULL,lease_until=NULL,last_error=NULL WHERE id=$1 AND lease_token=$2",[job.id,job.lease_token]);
  } catch {
    // Provider timeouts can be ambiguous. No exactly-once claim; bounded retry.
    const terminal=job.attempts>=5;
    await client.query(`UPDATE company_outbox SET state=$3,lease_token=NULL,lease_until=NULL,last_error='delivery_failed',
      available_at=NOW()+make_interval(secs=>$4) WHERE id=$1 AND lease_token=$2`,[job.id,job.lease_token,terminal?'failed':'pending',Math.min(3600,30*2**job.attempts)]);
  }
  return true;
}
