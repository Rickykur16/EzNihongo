import { createHash } from 'node:crypto';
import { amount, date, uuid, text, fail, range } from './finance-validation.js';

const one = async (c, sql, args = []) => (await c.query(sql, args)).rows[0];
export const rows = async (c, sql, args = []) => (await c.query(sql, args)).rows.map(r => r.data);
export async function settings(c) {
  const row = await one(c, 'SELECT to_jsonb(s) AS data FROM finance_settings s');
  return row?.data || null;
}
async function openDate(c, value) {
  const day = date(value), cfg = await settings(c);
  if (!cfg) throw fail(409, 'finance_setup_required');
  if (day < cfg.start_date || (cfg.closed_through && day <= cfg.closed_through)) throw fail(409, 'finance_period_closed');
  return day;
}
async function account(c, id, kind) {
  const row = await one(c, 'SELECT * FROM finance_accounts WHERE id=$1', [uuid(id)]);
  if (!row || (kind === 'bank' ? !row.is_bank : kind && row.kind !== kind)) throw fail(400, 'finance_invalid_account');
  return row;
}
async function code(c, value) { return (await one(c, 'SELECT id FROM finance_accounts WHERE code=$1', [value])).id; }
async function entry(c, e) {
  const existing = await one(c, 'SELECT to_jsonb(e) AS data FROM finance_entries e WHERE request_key=$1', [e.key]);
  if (existing) {
    const old = existing.data;
    if (old.kind !== e.kind || old.entry_date !== e.day || old.description !== e.description || old.amount !== e.amount ||
        old.debit_account !== e.debit || old.credit_account !== e.credit || old.order_id !== (e.order || null) || old.bill_id !== (e.bill || null)) throw fail(409, 'finance_request_key_reused');
    return old;
  }
  await openDate(c, e.day);
  if (e.debit === e.credit) throw fail(400, 'finance_same_account');
  return (await one(c, `INSERT INTO finance_entries(request_key,kind,entry_date,description,debit_account,credit_account,amount,order_id,bill_id,reversal_of)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING to_jsonb(finance_entries) AS data`,
  [e.key,e.kind,e.day,e.description,e.debit,e.credit,e.amount,e.order||null,e.bill||null,e.reversal||null])).data;
}
async function prior(c, key) { return (await one(c, 'SELECT to_jsonb(e) AS data FROM finance_entries e WHERE request_key=$1', [key]))?.data; }
async function allocationDate(c,kind,sourceId,day){
  const latest=await one(c,`SELECT max(e.entry_date)::text AS day FROM finance_entries e
    LEFT JOIN finance_entries original ON original.id=e.reversal_of
    WHERE (e.order_id=$1 OR e.bill_id=$1) AND (e.kind=$2 OR (e.kind='reversal' AND original.kind=$2))`,[sourceId,kind]);
  if(latest.day&&day<latest.day)throw fail(409,'finance_allocation_before_latest_change');
}

export async function setup(c, body) {
  const start = date(body.startDate);
  const cfg = await settings(c);
  if (cfg && cfg.start_date !== start) throw fail(409, 'finance_already_initialized');
  await c.query('INSERT INTO finance_settings(id,start_date) VALUES(true,$1) ON CONFLICT(id) DO NOTHING', [start]);
  return settings(c);
}
export async function createAccount(c, body) {
  const cfg = await settings(c); if (!cfg) throw fail(409, 'finance_setup_required');
  const name = text(body.name,100), accountCode = text(body.code,20);
  if (!/^[A-Z0-9_-]+$/i.test(accountCode)) throw fail(400, 'finance_invalid_account_code');
  if (!['bank','expense'].includes(body.kind)) throw fail(400, 'finance_invalid_account');
  const opening = [undefined,null,'',0,'0'].includes(body.openingAmount) ? 0 : amount(body.openingAmount);
  if (body.kind !== 'bank' && opening) throw fail(400, 'finance_invalid_opening');
  const row = (await one(c, `INSERT INTO finance_accounts(code,name,kind,is_bank) VALUES($1,$2,$3,$4) RETURNING to_jsonb(finance_accounts) AS data`,
    [accountCode,name,body.kind==='bank'?'asset':'expense',body.kind==='bank'])).data;
  if (opening) await entry(c,{key:'opening:'+row.id,kind:'opening',day:cfg.start_date,description:'Saldo awal '+name,
    debit:row.id,credit:await code(c,'3000'),amount:opening});
  return row;
}
export async function syncCourses(c) {
  const cfg = await settings(c); if (!cfg) throw fail(409,'finance_setup_required');
  const zone = process.env.FINANCE_TIMEZONE || 'Asia/Jayapura';
  const found = (await c.query(`SELECT o.id,o.order_number,o.amount_idr,(o.approved_at AT TIME ZONE $1)::date::text AS day
    FROM orders o WHERE o.status='approved' AND o.currency='IDR' AND o.amount_idr>0
    AND EXISTS(SELECT 1 FROM order_payments p WHERE p.order_id=o.id AND p.status='approved')
    AND (o.approved_at AT TIME ZONE $1)::date >= $2::date
    AND ($3::date IS NULL OR (o.approved_at AT TIME ZONE $1)::date > $3::date)
    AND NOT EXISTS(SELECT 1 FROM finance_entries e WHERE e.order_id=o.id AND e.kind='course')
    ORDER BY o.approved_at,o.id LIMIT 200`,[zone,cfg.start_date,cfg.closed_through])).rows;
  for (const o of found) await entry(c,{key:'course:'+o.id,kind:'course',day:o.day,description:'Pembayaran '+o.order_number,
    debit:await code(c,'1100'),credit:await code(c,'2100'),amount:amount(o.amount_idr),order:o.id});
  return { imported:found.length, batchLimit:200 };
}
export async function receiveCourse(c, body) {
  const key = 'receipt:'+uuid(body.requestKey), bank = await account(c,body.bankId,'bank');
  const value = amount(body.amount), day = date(body.date), orderId = uuid(body.orderId);
  const source = await one(c,"SELECT *,entry_date::text AS day FROM finance_entries WHERE kind='course' AND order_id=$1",[orderId]);
  if (!source) throw fail(409,'finance_course_not_imported');
  if(day<source.day)throw fail(400,'finance_receipt_before_source');
  const description = text(body.description || 'Alokasi penerimaan kursus');
  const e = {key,kind:'receipt',day,description,debit:bank.id,credit:await code(c,'1100'),amount:value,order:orderId};
  if (await prior(c,key)) return entry(c,e);
  await allocationDate(c,'receipt',orderId,day);
  const used = await one(c,`SELECT COALESCE(sum(e.amount),0)::text AS total FROM finance_entries e
    WHERE e.order_id=$1 AND e.kind='receipt' AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)`,[orderId]);
  if (Number(used.total)+value>Number(source.amount)) throw fail(409,'finance_receipt_exceeds_order');
  return entry(c,e);
}
export async function createBill(c, body) {
  await account(c,body.accountId,'expense');
  const day = await openDate(c,body.date), due = date(body.dueDate);
  if (due < day) throw fail(400,'finance_invalid_due_date');
  const values = [uuid(body.requestKey),text(body.vendor,120),text(body.description),amount(body.amount),uuid(body.accountId),day,due];
  const old = await one(c,'SELECT to_jsonb(b) AS data FROM finance_bills b WHERE request_key=$1',[values[0]]);
  if (old) {
    if (JSON.stringify([old.data.request_key,old.data.vendor,old.data.description,old.data.amount,old.data.account_id,old.data.bill_date,old.data.due_date]) !== JSON.stringify(values)) throw fail(409,'finance_request_key_reused');
    return old.data;
  }
  return (await one(c,`INSERT INTO finance_bills(request_key,vendor,description,amount,account_id,bill_date,due_date)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING to_jsonb(finance_bills) AS data`,values)).data;
}
export async function approveBill(c, id) {
  const bill = (await one(c,'SELECT to_jsonb(b) AS data FROM finance_bills b WHERE id=$1',[uuid(id)]))?.data;
  if (!bill) throw fail(404,'finance_bill_not_found');
  if (bill.status === 'void') throw fail(409,'finance_bill_void');
  if (bill.status !== 'draft') return bill;
  await entry(c,{key:'bill:'+id,kind:'bill',day:bill.bill_date,description:bill.description,debit:bill.account_id,
    credit:await code(c,'2000'),amount:bill.amount,bill:id});
  return (await one(c,"UPDATE finance_bills SET status='approved' WHERE id=$1 RETURNING to_jsonb(finance_bills) AS data",[id])).data;
}
export async function payBill(c, id, body) {
  const bill = (await one(c,'SELECT to_jsonb(b) AS data FROM finance_bills b WHERE id=$1',[uuid(id)]))?.data;
  if (!bill) throw fail(404,'finance_bill_not_found');
  const key = 'payment:'+uuid(body.requestKey), value = amount(body.amount), bank = await account(c,body.bankId,'bank');
  const e = {key,kind:'payment',day:date(body.date),description:text(body.description||'Pembayaran '+bill.vendor),
    debit:await code(c,'2000'),credit:bank.id,amount:value,bill:id};
  if (await prior(c,key)) return entry(c,e);
  await allocationDate(c,'payment',id,e.day);
  if (bill.status !== 'approved') throw fail(409,'finance_bill_not_payable');
  if (e.day < bill.bill_date) throw fail(400,'finance_payment_before_bill');
  const paid = await one(c,`SELECT COALESCE(sum(e.amount),0)::text AS total FROM finance_entries e WHERE e.bill_id=$1
    AND e.kind='payment' AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)`,[id]);
  if (Number(paid.total)+value>bill.amount) throw fail(409,'finance_payment_exceeds_bill');
  const result = await entry(c,e);
  if (Number(paid.total)+value===bill.amount) await c.query("UPDATE finance_bills SET status='paid' WHERE id=$1",[id]);
  return result;
}
export async function transfer(c, body) {
  const from = await account(c,body.fromBankId,'bank'), to = await account(c,body.toBankId,'bank');
  return entry(c,{key:'transfer:'+uuid(body.requestKey),kind:'transfer',day:date(body.date),description:text(body.description),
    debit:to.id,credit:from.id,amount:amount(body.amount)});
}
export async function reverse(c, id, body) {
  const e = (await one(c,'SELECT to_jsonb(e) AS data FROM finance_entries e WHERE id=$1',[uuid(id)]))?.data;
  if (!e || !['receipt','payment','transfer','recognition'].includes(e.kind)) throw fail(409,'finance_reversal_not_allowed');
  if (await one(c,'SELECT id FROM finance_matches WHERE entry_id=$1',[id])) throw fail(409,'finance_unmatch_before_reversal');
  const day=date(body.date); if(day<e.entry_date)throw fail(400,'finance_reversal_before_entry');
  const result = await entry(c,{key:'reverse:'+id,kind:'reversal',day,description:text(body.reason),debit:e.credit_account,
    credit:e.debit_account,amount:e.amount,order:e.order_id,bill:e.bill_id,reversal:id});
  if(e.kind==='payment')await c.query("UPDATE finance_bills SET status='approved' WHERE id=$1",[e.bill_id]);
  return result;
}
export async function voidBill(c,id,body) {
  const bill=(await one(c,'SELECT to_jsonb(b) AS data FROM finance_bills b WHERE id=$1',[uuid(id)]))?.data;
  if(!bill)throw fail(404,'finance_bill_not_found');
  if(bill.status==='void')return bill;
  const paid=await one(c,`SELECT e.id FROM finance_entries e WHERE e.bill_id=$1 AND e.kind='payment'
    AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)`,[id]);
  if(paid)throw fail(409,'finance_reverse_payments_first');
  if(bill.status==='approved'){
    const source=await one(c,"SELECT * FROM finance_entries WHERE bill_id=$1 AND kind='bill'",[id]);
    const day=date(body.date);if(day<bill.bill_date)throw fail(400,'finance_reversal_before_entry');
    await entry(c,{key:'void:'+id,kind:'reversal',day,description:text(body.reason),debit:source.credit_account,
      credit:source.debit_account,amount:Number(source.amount),bill:id,reversal:source.id});
  }
  return(await one(c,"UPDATE finance_bills SET status='void' WHERE id=$1 RETURNING to_jsonb(finance_bills) AS data",[id])).data;
}
export async function recognize(c,body){
  const orderId=uuid(body.orderId),value=amount(body.amount),key='recognition:'+uuid(body.requestKey);
  const source=await one(c,"SELECT *,entry_date::text AS day FROM finance_entries WHERE kind='course' AND order_id=$1",[orderId]);
  if(!source)throw fail(409,'finance_course_not_imported');
  const e={key,kind:'recognition',day:date(body.date),description:text(body.description),debit:await code(c,'2100'),
    credit:await code(c,'4000'),amount:value,order:orderId};
  if(e.day<source.day)throw fail(400,'finance_recognition_before_source');
  if(await prior(c,key))return entry(c,e);
  await allocationDate(c,'recognition',orderId,e.day);
  const used=await one(c,`SELECT COALESCE(sum(e.amount),0)::text AS total FROM finance_entries e WHERE order_id=$1
    AND kind='recognition' AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)`,[orderId]);
  if(Number(used.total)+value>Number(source.amount))throw fail(409,'finance_recognition_exceeds_order');
  return entry(c,e);
}
export async function importBank(c, body) {
  const bank=await account(c,body.bankId,'bank');
  if(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>500)throw fail(400,'finance_import_limit_500');
  const clean=body.rows.map(r=>({date:date(r.date),description:text(r.description),reference:r.reference?text(r.reference,120):null,
    amount:(String(r.amount).startsWith('-')?-1:1)*amount(String(r.amount).replace(/^-/,'') )}));
  const fingerprint=createHash('sha256').update(JSON.stringify(clean)).digest('hex');
  const existing=await one(c,'SELECT id,voided FROM finance_imports WHERE bank_id=$1 AND fingerprint=$2',[bank.id,fingerprint]);
  if(existing&&!existing.voided)return{id:existing.id,imported:0,duplicate:true};
  for(const r of clean)await openDate(c,r.date);
  if(existing){
    await c.query('UPDATE finance_bank_lines SET voided=false WHERE import_id=$1',[existing.id]);
    await c.query('UPDATE finance_imports SET voided=false WHERE id=$1',[existing.id]);
    return{id:existing.id,imported:clean.length,duplicate:false};
  }
  const batch=await one(c,'INSERT INTO finance_imports(bank_id,fingerprint) VALUES($1,$2) RETURNING id',[bank.id,fingerprint]);
  for(const [i,r]of clean.entries())await c.query(`INSERT INTO finance_bank_lines(import_id,bank_id,row_number,transaction_date,description,reference,amount)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[batch.id,bank.id,i+1,r.date,r.description,r.reference,r.amount]);
  return{id:batch.id,imported:clean.length,duplicate:false};
}
export async function voidImport(c,id){
  const batch=await one(c,'SELECT id,voided FROM finance_imports WHERE id=$1',[uuid(id)]);
  if(!batch)throw fail(404,'finance_import_not_found');if(batch.voided)return{id};
  const matched=await one(c,'SELECT m.id FROM finance_matches m JOIN finance_bank_lines b ON b.id=m.bank_line_id WHERE b.import_id=$1 LIMIT 1',[id]);
  if(matched)throw fail(409,'finance_unmatch_import_first');
  const days=(await c.query('SELECT DISTINCT transaction_date::text AS day FROM finance_bank_lines WHERE import_id=$1',[id])).rows;
  for(const row of days)await openDate(c,row.day);
  await c.query('UPDATE finance_bank_lines SET voided=true WHERE import_id=$1',[id]);
  await c.query('UPDATE finance_imports SET voided=true WHERE id=$1',[id]);return{id};
}
export async function matchBank(c,body){
  const line=(await one(c,'SELECT to_jsonb(b) AS data FROM finance_bank_lines b WHERE id=$1',[uuid(body.bankLineId)]))?.data;
  const e=(await one(c,'SELECT to_jsonb(e) AS data FROM finance_entries e WHERE id=$1',[uuid(body.entryId)]))?.data;
  if(!line||line.voided||!e)throw fail(404,'finance_match_not_found');
  await openDate(c,line.transaction_date);await openDate(c,e.entry_date);
  if(e.kind==='opening'||e.kind==='reversal'||await one(c,'SELECT id FROM finance_entries WHERE reversal_of=$1',[e.id]))throw fail(409,'finance_entry_not_matchable');
  const incoming=line.amount>0;
  if((incoming?e.debit_account:e.credit_account)!==line.bank_id)throw fail(400,'finance_match_account_or_direction');
  const value=amount(body.amount),old=await one(c,'SELECT * FROM finance_matches WHERE bank_line_id=$1 AND entry_id=$2',[line.id,e.id]);
  if(old){if(Number(old.amount)!==value)throw fail(409,'finance_match_exists');return{id:old.id};}
  const sums=await one(c,`SELECT
    (SELECT COALESCE(sum(amount),0)::text FROM finance_matches WHERE bank_line_id=$1) AS line,
    (SELECT COALESCE(sum(m.amount),0)::text FROM finance_matches m JOIN finance_bank_lines b ON b.id=m.bank_line_id
      WHERE entry_id=$2 AND b.bank_id=$3) AS entry`,[line.id,e.id,line.bank_id]);
  if(Number(sums.line)+value>Math.abs(line.amount)||Number(sums.entry)+value>e.amount)throw fail(409,'finance_match_exceeds_balance');
  return one(c,'INSERT INTO finance_matches(bank_line_id,entry_id,amount) VALUES($1,$2,$3) RETURNING id',[line.id,e.id,value]);
}
export async function unmatch(c,id){
  const row=await one(c,`SELECT b.transaction_date::text AS day,e.entry_date::text AS entry_day FROM finance_matches m
    JOIN finance_bank_lines b ON b.id=m.bank_line_id JOIN finance_entries e ON e.id=m.entry_id WHERE m.id=$1`,[uuid(id)]);
  if(!row)throw fail(404,'finance_match_not_found');
  await openDate(c,row.day);await openDate(c,row.entry_day);
  await c.query('DELETE FROM finance_matches WHERE id=$1',[id]);return{id};
}

export async function list(c, query) {
  const {from,to}=range(query); const limit=100, offset=Number(query.offset||0);
  if(!Number.isSafeInteger(offset)||offset<0)throw fail(400,'finance_invalid_offset');
  const args=[from,to,limit,offset];
  return {
    entries:await rows(c,`SELECT to_jsonb(e)||jsonb_build_object('debit_name',d.name,'credit_name',cr.name,
      'reversed',EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id),'order_number',o.order_number) AS data
      FROM finance_entries e JOIN finance_accounts d ON d.id=e.debit_account JOIN finance_accounts cr ON cr.id=e.credit_account
      LEFT JOIN orders o ON o.id=e.order_id WHERE entry_date BETWEEN $1 AND $2 AND ($5::uuid IS NULL OR $5 IN(e.debit_account,e.credit_account))
      ORDER BY e.entry_date DESC,e.created_at DESC,e.id LIMIT $3 OFFSET $4`,[...args,query.accountId?uuid(query.accountId):null]),
    bills:await rows(c,`SELECT to_jsonb(b)||jsonb_build_object('account_name',a.name,'has_attachment',EXISTS(SELECT 1 FROM finance_attachments x WHERE x.bill_id=b.id),
      'paid',COALESCE((SELECT sum(e.amount) FROM finance_entries e WHERE e.bill_id=b.id AND e.kind='payment'
      AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)),0)) AS data
      FROM finance_bills b JOIN finance_accounts a ON a.id=b.account_id WHERE b.bill_date BETWEEN $1 AND $2 ORDER BY b.bill_date DESC,b.id LIMIT $3 OFFSET $4`,args),
    bankLines:await rows(c,`SELECT to_jsonb(b)||jsonb_build_object('bank_name',a.name,'matched',COALESCE((SELECT sum(amount) FROM finance_matches WHERE bank_line_id=b.id),0),
      'matches',COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM finance_matches m WHERE bank_line_id=b.id),'[]'::jsonb)) AS data
      FROM finance_bank_lines b JOIN finance_accounts a ON a.id=b.bank_id WHERE NOT b.voided AND b.transaction_date BETWEEN $1 AND $2 ORDER BY b.transaction_date DESC,b.id LIMIT $3 OFFSET $4`,args),
    courses:await rows(c,`SELECT jsonb_build_object('id',o.id,'number',o.order_number,'title',o.course_title_snapshot,'amount',o.amount_idr,'status',o.status,
      'date',(COALESCE(o.approved_at,o.created_at) AT TIME ZONE $5)::date,'imported',EXISTS(SELECT 1 FROM finance_entries e WHERE e.order_id=o.id AND e.kind='course'),
      'allocated',COALESCE((SELECT sum(e.amount) FROM finance_entries e WHERE e.order_id=o.id AND e.kind='receipt' AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)),0),
      'recognized',COALESCE((SELECT sum(e.amount) FROM finance_entries e WHERE e.order_id=o.id AND e.kind='recognition' AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)),0)) AS data
      FROM orders o WHERE o.currency='IDR' AND (COALESCE(o.approved_at,o.created_at) AT TIME ZONE $5)::date BETWEEN $1 AND $2
      ORDER BY COALESCE(o.approved_at,o.created_at) DESC,o.id LIMIT $3 OFFSET $4`,[...args,process.env.FINANCE_TIMEZONE||'Asia/Jayapura']),
    limit,offset,
  };
}
export async function report(c,query){
  const {from,to}=range(query);
  const comparisonRange=query.compareFrom!==undefined||query.compareTo!==undefined?range({from:query.compareFrom,to:query.compareTo}):null;
  const cashFlow=await one(c,`SELECT
    COALESCE(sum(CASE WHEN e.kind='receipt' THEN e.amount WHEN e.kind='reversal' AND original.kind='receipt' THEN -e.amount ELSE 0 END),0)::text AS received,
    COALESCE(sum(CASE WHEN e.kind='payment' THEN e.amount WHEN e.kind='reversal' AND original.kind='payment' THEN -e.amount ELSE 0 END),0)::text AS payments
    FROM finance_entries e LEFT JOIN finance_entries original ON original.id=e.reversal_of WHERE e.entry_date BETWEEN $1 AND $2`,[from,to]);
  cashFlow.net=(BigInt(cashFlow.received)-BigInt(cashFlow.payments)).toString();
  const balances=await rows(c,`SELECT jsonb_build_object('id',a.id,'name',a.name,'code',a.code,'kind',a.kind,'is_bank',a.is_bank,
    'opening',COALESCE(sum(CASE WHEN e.entry_date<$1 THEN CASE WHEN e.debit_account=a.id THEN e.amount ELSE -e.amount END ELSE 0 END),0)::text,
    'debit',COALESCE(sum(CASE WHEN e.entry_date BETWEEN $1 AND $2 AND e.debit_account=a.id THEN e.amount ELSE 0 END),0)::text,
    'credit',COALESCE(sum(CASE WHEN e.entry_date BETWEEN $1 AND $2 AND e.credit_account=a.id THEN e.amount ELSE 0 END),0)::text,
    'balance',COALESCE(sum(CASE WHEN e.debit_account=a.id THEN e.amount ELSE -e.amount END),0)::text) AS data
    FROM finance_accounts a LEFT JOIN finance_entries e ON (e.debit_account=a.id OR e.credit_account=a.id) AND e.entry_date<=$2
    GROUP BY a.id ORDER BY a.code`,[from,to]);
  const pending=await one(c,`SELECT count(*)::int AS count FROM orders o WHERE o.status='approved' AND o.currency='IDR'
    AND (o.approved_at AT TIME ZONE $3)::date BETWEEN $1 AND $2
    AND NOT EXISTS(SELECT 1 FROM finance_entries e WHERE e.order_id=o.id AND e.kind='course')`,[from,to,process.env.FINANCE_TIMEZONE||'Asia/Jayapura']);
  const unmatched=await one(c,`SELECT count(*)::int AS count FROM finance_bank_lines b WHERE NOT b.voided AND transaction_date BETWEEN $1 AND $2
    AND abs(b.amount)>(SELECT COALESCE(sum(m.amount),0) FROM finance_matches m JOIN finance_entries e ON e.id=m.entry_id
      WHERE m.bank_line_id=b.id AND e.entry_date<=$2)`,[from,to]);
  const due=await one(c,`SELECT count(*)::int AS count,COALESCE(sum(balance),0)::text AS amount FROM (
    SELECT b.id,sum(CASE WHEN e.credit_account=p.id THEN e.amount WHEN e.debit_account=p.id THEN -e.amount ELSE 0 END) AS balance
    FROM finance_bills b JOIN finance_entries e ON e.bill_id=b.id AND e.entry_date<=$1
    CROSS JOIN finance_accounts p WHERE p.code='2000' AND b.due_date<=$1 GROUP BY b.id
    HAVING sum(CASE WHEN e.credit_account=p.id THEN e.amount WHEN e.debit_account=p.id THEN -e.amount ELSE 0 END)>0) due`,[to]);
  const sum=kind=>balances.filter(a=>a.kind===kind).reduce((total,a)=>total+(kind==='income'?BigInt(a.credit)-BigInt(a.debit):BigInt(a.debit)-BigInt(a.credit)),0n);
  const income=sum('income'),expenses=sum('expense'),cfg=await settings(c);
  const result={from,to,balances,cashFlow,unpostedCourses:pending.count,unmatchedBankLines:unmatched.count,dueBills:due,
    summary:{income:String(income),expenses:String(expenses),profit:String(income-expenses),...cashFlow},
    coverage:{startDate:cfg?.start_date||null,complete:!!cfg&&cfg.start_date<=from}};
  // The route keeps both periods in one repeatable-read snapshot. No recursive comparison.
  if(comparisonRange){const previous=await report(c,comparisonRange);result.comparison={from:previous.from,to:previous.to,summary:previous.summary,coverage:previous.coverage};}
  return result;
}
export async function closePeriod(c,body){
  const day=await openDate(c,body.date),cfg=await settings(c);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:process.env.FINANCE_TIMEZONE||'Asia/Jayapura',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(day>=today)throw fail(400,'finance_close_completed_days_only');
  const unposted=await one(c,`SELECT count(*)::int AS count FROM orders o WHERE o.status='approved' AND o.currency='IDR'
    AND (o.approved_at AT TIME ZONE $3)::date BETWEEN $1 AND $2
    AND NOT EXISTS(SELECT 1 FROM finance_entries e WHERE e.kind='course' AND e.order_id=o.id)`,[cfg.start_date,day,process.env.FINANCE_TIMEZONE||'Asia/Jayapura']);
  const unmatched=await one(c,`SELECT count(*)::int AS count FROM finance_bank_lines b WHERE NOT b.voided AND transaction_date<=$1
    AND abs(amount)>(SELECT COALESCE(sum(m.amount),0) FROM finance_matches m JOIN finance_entries e ON e.id=m.entry_id
      WHERE m.bank_line_id=b.id AND e.entry_date<=$1)`,[day]);
  if(unposted.count||unmatched.count)throw fail(409,'finance_close_has_pending_items');
  const drafts=await one(c,"SELECT count(*)::int AS count FROM finance_bills WHERE status='draft' AND bill_date<=$1",[day]);
  const missing=await one(c,`SELECT count(*)::int AS count FROM finance_entries e JOIN finance_accounts a
    ON a.id IN(e.debit_account,e.credit_account) AND a.is_bank WHERE e.entry_date<=$1 AND e.kind NOT IN('opening','reversal')
    AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id AND r.entry_date<=$1)
    AND e.amount>(SELECT COALESCE(sum(m.amount),0) FROM finance_matches m JOIN finance_bank_lines b ON b.id=m.bank_line_id
      WHERE m.entry_id=e.id AND b.bank_id=a.id AND b.transaction_date<=$1)`,[day]);
  if(drafts.count||missing.count)throw fail(409,'finance_close_has_pending_items');
  await c.query('UPDATE finance_settings SET closed_through=$1 WHERE id=true',[day]);
  const event=await one(c,'INSERT INTO finance_period_events(closed_before,closed_after,reason) VALUES($1,$2,$3) RETURNING id',[cfg.closed_through,day,'Tutup buku']);
  return{...await settings(c),eventId:event.id};
}
export async function reopenPeriod(c,body){
  const cfg=await settings(c),from=date(body.date),reason=text(body.reason);
  if(!cfg?.closed_through||from<cfg.start_date||from>cfg.closed_through)throw fail(400,'finance_invalid_reopen_date');
  const after=from===cfg.start_date?null:new Date(Date.parse(from)-86400000).toISOString().slice(0,10);
  await c.query('UPDATE finance_settings SET closed_through=$1 WHERE id=true',[after]);
  const event=await one(c,'INSERT INTO finance_period_events(closed_before,closed_after,reason) VALUES($1,$2,$3) RETURNING id',[cfg.closed_through,after,reason]);
  return{...await settings(c),eventId:event.id};
}

export async function matchCandidates(c,id){
  const line=(await one(c,'SELECT to_jsonb(b) AS data FROM finance_bank_lines b WHERE id=$1',[uuid(id)]))?.data;
  if(!line||line.voided)throw fail(404,'finance_match_not_found');
  return rows(c,`SELECT to_jsonb(e)||jsonb_build_object('remaining',e.amount-COALESCE((SELECT sum(m.amount)
    FROM finance_matches m JOIN finance_bank_lines b ON b.id=m.bank_line_id WHERE m.entry_id=e.id AND b.bank_id=$1),0)) AS data
    FROM finance_entries e WHERE (CASE WHEN $2::bigint>0 THEN e.debit_account ELSE e.credit_account END)=$1
    AND e.kind NOT IN('opening','reversal') AND NOT EXISTS(SELECT 1 FROM finance_entries r WHERE r.reversal_of=e.id)
    AND e.amount>COALESCE((SELECT sum(m.amount) FROM finance_matches m JOIN finance_bank_lines b ON b.id=m.bank_line_id
      WHERE m.entry_id=e.id AND b.bank_id=$1),0)
    ORDER BY abs(e.entry_date-$3::date),e.entry_date,e.id LIMIT 200`,[line.bank_id,line.amount,line.transaction_date]);
}
export async function exportLedger(c,query){
  const {from,to}=range(query);
  const entries=await rows(c,`SELECT to_jsonb(e)||jsonb_build_object('debit_name',d.name,'credit_name',cr.name) AS data
    FROM finance_entries e JOIN finance_accounts d ON d.id=e.debit_account JOIN finance_accounts cr ON cr.id=e.credit_account
    WHERE e.entry_date BETWEEN $1 AND $2 AND ($3::uuid IS NULL OR $3 IN(e.debit_account,e.credit_account))
    ORDER BY e.entry_date,e.created_at,e.id LIMIT 10001`,[from,to,query.accountId?uuid(query.accountId):null]);
  if(entries.length>10000)throw fail(413,'finance_export_narrow_period');
  return{entries};
}
