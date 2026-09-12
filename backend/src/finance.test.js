import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import express from 'express';
import pg from 'pg';
import { applyFinanceMigration } from '../finance-migrations/run.js';
import { amount,date } from './finance-validation.js';

test('finance validates money and calendar dates without coercing decimals',()=>{
  for(const invalid of [0,-1,1.5,'1e3','12.00','1,000',1e13,NaN])assert.throws(()=>amount(invalid));
  assert.equal(amount('300000'),300000);assert.equal(date('2024-02-29'),'2024-02-29');
  for(const invalid of ['2026-02-29','2026-02-30','2026-13-01','2026-9-1'])assert.throws(()=>date(invalid));
});
const ui=await readFile(new URL('../../src/finance.js',import.meta.url),'utf8');
const {parseCSV,bankDate,bankAmount,splitBankAmount,financialPeriod,calculateAmount,companyStatements}=await import('data:text/javascript;base64,'+Buffer.from(ui).toString('base64'));
test('amount calculator handles fractional units, discounts, rounding and invalid totals exactly',()=>{
  assert.deepEqual(calculateAmount('8','75000'),{subtotal:'600000',discount:'0',total:'600000'});
  assert.deepEqual(calculateAmount('2.50','75000','12500'),{subtotal:'187500',discount:'12500',total:'175000'});
  assert.equal(calculateAmount('1.01','50').total,'51');assert.equal(calculateAmount('1.01','49').total,'49');
  assert.equal(calculateAmount('1000000','1000000').total,'1000000000000');
  for(const args of [['','1'],['0','75000'],['1e2','1'],['1.001','1'],['1','0'],['1','1.5'],['1','100','100'],['1','100','101'],['1','100','-1'],['1000001','1'],['1000000','1000001'],['1','1','NaN']])assert.throws(()=>calculateAmount(...args));
});
test('financial report calendar boundaries include leap days and previous years',()=>{
  assert.deepEqual(financialPeriod('month',2024,2),{from:'2024-02-01',to:'2024-02-29',compareFrom:'2024-01-01',compareTo:'2024-01-31',label:'Februari 2024',previousLabel:'Januari 2024'});
  const january=financialPeriod('month',2026,1);assert.equal(january.compareFrom,'2025-12-01');assert.equal(january.compareTo,'2025-12-31');
  const q1=financialPeriod('quarter',2026,1);assert.equal(q1.to,'2026-03-31');assert.equal(q1.compareFrom,'2025-10-01');assert.equal(q1.previousLabel,'Q4 2025');
  for(let q=1;q<=4;q++){
    const quarter=financialPeriod('quarter',2026,q);
    assert.equal(quarter.from,financialPeriod('month',2026,(q-1)*3+1).from);assert.equal(quarter.to,financialPeriod('month',2026,q*3).to);
  }
  assert.deepEqual(financialPeriod('annual',2026),{from:'2026-01-01',to:'2026-12-31',compareFrom:'2025-01-01',compareTo:'2025-12-31',label:'2026',previousLabel:'2025'});
  for(const input of [['month',2026,13],['quarter',2026,0],['quarter',2026,1.5],['annual',2026,2],['week',2026,1],['month','bad',1]])assert.throws(()=>financialPeriod(...input));
});
test('bank CSV accepts real quoted fields, explicit Indonesian amounts and rejects ambiguous input',()=>{
  assert.deepEqual(parseCSV('\uFEFFTanggal;Uraian;Nominal\r\n01/09/2026;"Tagihan; server";"-100.000,00"'),[
    ['Tanggal','Uraian','Nominal'],['01/09/2026','Tagihan; server','-100.000,00']]);
  assert.equal(bankAmount('-100.000,00','id'),-100000);assert.equal(bankDate('1/9/2026','dmy'),'2026-09-01');
  assert.throws(()=>bankAmount('100.001,25','id'));assert.throws(()=>bankDate('31/02/2026','dmy'));
  assert.throws(()=>parseCSV('a,b\n"unfinished,b'));assert.throws(()=>parseCSV('a,b\nc'));
  assert.equal(splitBankAmount('100.000,00','0,00','id'),-100000);assert.equal(splitBankAmount('','500000','plain'),500000);
  assert.throws(()=>splitBankAmount('100','200','plain'));assert.throws(()=>splitBankAmount('0','0','plain'));
});

test('Finance API and ledger on disposable PostgreSQL',{skip:!process.env.TEST_DATABASE_URL,timeout:120000},async t=>{
  const url=new URL(process.env.TEST_DATABASE_URL);assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));assert.match(url.pathname,/test/i);
  const schema='finance_test_'+randomUUID().replaceAll('-',''),control=new pg.Client({connectionString:url.href});await control.connect();
  await control.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`);
  url.searchParams.set('options',`-c search_path=${schema}`);
  process.env.DATABASE_URL=url.href;process.env.JWT_ACCESS_SECRET='finance-test-access';process.env.JWT_REFRESH_SECRET='finance-test-refresh';
  process.env.ADMIN_EMAILS='owner@example.invalid';process.env.FINANCE_ENABLED='true';process.env.COMPANY_WORKSPACE_ENABLED='false';
  await control.query(`CREATE TABLE users(id uuid PRIMARY KEY,email text,full_name text);CREATE TABLE admin_emails(email text);
    CREATE TABLE courses(id uuid PRIMARY KEY,title text,slug text);
    CREATE TABLE orders(id uuid PRIMARY KEY,order_number text,course_id uuid REFERENCES courses(id),user_id uuid REFERENCES users(id),
      course_title_snapshot text,amount_idr integer,currency text DEFAULT 'IDR',status text,created_at timestamptz DEFAULT now(),approved_at timestamptz);
    CREATE TABLE order_payments(id uuid PRIMARY KEY,order_id uuid REFERENCES orders(id),status text);`);
  const owner=randomUUID(),student=randomUUID(),course=randomUUID(),order=randomUUID();
  await control.query("INSERT INTO users VALUES($1,'owner@example.invalid','Owner'),($2,'student@example.invalid','Student');",[owner,student]);
  await control.query("INSERT INTO courses VALUES($1,'Kursus N5','n5')",[course]);
  await control.query("INSERT INTO orders(id,order_number,course_id,user_id,course_title_snapshot,amount_idr,status,approved_at) VALUES($1,'FIXTURE-N5',$2,$3,'Kursus N5',300000,'approved','2026-09-02T01:00:00Z')",[order,course,student]);
  await control.query("INSERT INTO order_payments VALUES($1,$2,'approved'),($3,$2,'rejected')",[randomUUID(),order,randomUUID()]);
  const original=JSON.stringify((await control.query('SELECT * FROM orders')).rows);
  const {db}=await import('./db.js'),{signAccessToken,signRefreshToken}=await import('./auth.js');
  const {default:router}=await import('./routes/finance.js');
  const app=express();app.use(express.json({limit:'1mb'}));app.use('/api/finance',router);app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/finance`;
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.end();await control.query('ROLLBACK');await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
  const ownerToken=await signAccessToken(owner,'owner@example.invalid'),studentToken=await signAccessToken(student,'student@example.invalid');
  async function request(path,body,method=body?'POST':'GET',token=ownerToken){const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,data:await res.json()};}
  async function ok(path,body,method){const r=await request(path,body,method);assert.ok(r.status<300,JSON.stringify(r));return r.data;}
  let bank,bank2,expense,bill,receipt,payment,transfer,bankLines,receiptBody,paymentBody;
  await t.test('disabled feature, wrong principals and missing schema fail before data writes',async()=>{
    process.env.FINANCE_ENABLED='false';assert.equal((await request('/access')).status,404);process.env.FINANCE_ENABLED='true';
    assert.equal((await request('/access',null,'GET',studentToken)).status,403);
    assert.equal((await request('/access',null,'GET','')).status,401);
    const refresh=await signRefreshToken(owner);assert.equal((await request('/access',null,'GET',refresh)).status,401);
    assert.equal((await ok('/access')).ready,false);assert.equal((await request('/accounts')).status,503);
  });
  await t.test('additive migration applies once and preserves original orders',async()=>{
    assert.equal(await applyFinanceMigration(control),true);assert.equal(await applyFinanceMigration(control),false);
    assert.equal(JSON.stringify((await control.query('SELECT * FROM orders')).rows),original);
    assert.equal((await ok('/access')).settings,null);assert.equal((await request('/sync-courses',{})).status,409);
    await ok('/setup',{startDate:'2026-09-01'});assert.equal((await request('/setup',{startDate:'2026-08-01'})).status,409);
  });
  await t.test('bank opening balances and expense categories are recorded once',async()=>{
    bank=await ok('/accounts',{code:'BCA',name:'Bank Uji',kind:'bank',openingAmount:'1000000'});
    bank2=await ok('/accounts',{code:'CASH',name:'Kas Uji',kind:'bank',openingAmount:'0'});
    assert.equal((await request('/accounts',{code:'BCA',name:'Bank Uji',kind:'bank',openingAmount:'1000000'})).status,409);
    expense=(await ok('/accounts')).accounts.find(a=>a.code==='5300');
    assert.equal((await control.query("SELECT count(*) FROM finance_entries WHERE kind='opening'")).rows[0].count,'1');
  });
  await t.test('approved course sync is idempotent and rejected proof never doubles receipts',async()=>{
    assert.equal((await ok('/sync-courses',{})).imported,1);assert.equal((await ok('/sync-courses',{})).imported,0);
    assert.equal((await control.query("SELECT sum(amount) FROM finance_entries WHERE kind='course'")).rows[0].sum,'300000');
    assert.equal(JSON.stringify((await control.query('SELECT * FROM orders')).rows),original);
  });
  await t.test('receipt allocation rejects excess and replayed keys with changed payload',async()=>{
    receiptBody={requestKey:randomUUID(),orderId:order,bankId:bank.id,amount:300000,date:'2026-09-02',description:'Penerimaan fixture'};
    receipt=await ok('/receipts',receiptBody);assert.equal((await ok('/receipts',receiptBody)).id,receipt.id);
    assert.equal((await request('/receipts',{...receiptBody,amount:1})).status,409);
    assert.equal((await request('/receipts',{...receiptBody,requestKey:randomUUID(),amount:1})).status,409);
  });
  await t.test('bill approval, attachments, partial payment and limits work without bank side effects',async()=>{
    const body={requestKey:randomUUID(),vendor:'Vendor Fixture',description:'Server September',amount:120000,accountId:expense.id,date:'2026-09-02',dueDate:'2026-09-04'};
    bill=await ok('/bills',body);assert.equal((await ok('/bills',body)).id,bill.id);
    assert.equal((await request('/bills/'+bill.id+'/pay',{requestKey:randomUUID(),bankId:bank.id,amount:60000,date:'2026-09-03'})).status,409);
    const file=new FormData();file.append('file',new Blob(['%PDF-1.4\nFixture proof'],{type:'application/pdf'}),'proof.pdf');
    const uploaded=await fetch(base+'/bills/'+bill.id+'/attachment',{method:'POST',headers:{Authorization:'Bearer '+ownerToken},body:file});assert.equal(uploaded.status,201);
    const proof=await fetch(base+'/bills/'+bill.id+'/attachment',{headers:{Authorization:'Bearer '+ownerToken}});assert.equal(proof.status,200);assert.equal(proof.headers.get('x-content-type-options'),'nosniff');
    assert.equal((await ok('/bills/'+bill.id+'/approve',{})).status,'approved');await ok('/bills/'+bill.id+'/approve',{});
    paymentBody={requestKey:randomUUID(),bankId:bank.id,amount:60000,date:'2026-09-03',description:'Bayar server separuh'};
    payment=await ok('/bills/'+bill.id+'/pay',paymentBody);assert.equal((await ok('/bills/'+bill.id+'/pay',paymentBody)).id,payment.id);
    assert.equal((await request('/bills/'+bill.id+'/pay',{...paymentBody,requestKey:randomUUID(),amount:60001})).status,409);
  });
  await t.test('internal transfer moves bank balances without changing revenue or expense',async()=>{
    transfer=await ok('/transfers',{requestKey:randomUUID(),fromBankId:bank.id,toBankId:bank2.id,amount:200000,date:'2026-09-03',description:'Isi kas'});
    const r=await ok('/report?from=2026-09-01&to=2026-09-05');
    assert.equal(r.balances.find(a=>a.id===bank.id).balance,'1040000');assert.equal(r.balances.find(a=>a.id===bank2.id).balance,'200000');
    assert.equal(r.balances.find(a=>a.code==='2100').balance,'-300000');assert.equal(r.balances.find(a=>a.code==='4000').balance,'0');
    assert.equal(r.balances.find(a=>a.code==='5300').balance,'120000');assert.equal(r.dueBills.amount,'60000');
    assert.deepEqual(r.cashFlow,{received:'300000',payments:'60000',net:'240000'});
    assert.equal(r.balances.reduce((s,a)=>s+BigInt(a.balance),0n),0n);
  });
  await t.test('CSV import is atomic, deduplicates whole files and rejects reused bank references',async()=>{
    const body={bankId:bank.id,rows:[{date:'2026-09-02',description:'Pembayaran kursus',amount:300000,reference:'REF-IN'},
      {date:'2026-09-03',description:'Server',amount:-60000,reference:'REF-SERVER'},{date:'2026-09-03',description:'Kas',amount:-200000,reference:'REF-CASH'}]};
    assert.equal((await ok('/bank-imports',body)).imported,3);assert.equal((await ok('/bank-imports',body)).duplicate,true);
    assert.equal((await request('/bank-imports',{bankId:bank.id,rows:[{date:'2026-09-02',description:'Different',amount:1,reference:'NEW-REF'},body.rows[0]]})).status,409);
    assert.equal((await control.query("SELECT count(*) FROM finance_bank_lines WHERE reference='NEW-REF'")).rows[0].count,'0');
    bankLines=(await ok('/transactions?from=2026-09-01&to=2026-09-05')).bankLines;
  });
  await t.test('matching respects bank direction, partial allocations, replay, and total limits',async()=>{
    const incoming=bankLines.find(l=>l.reference==='REF-IN');
    assert.equal((await request('/matches',{bankLineId:incoming.id,entryId:payment.id,amount:60000})).status,400);
    const match=await ok('/matches',{bankLineId:incoming.id,entryId:receipt.id,amount:300000});
    assert.equal((await ok('/matches',{bankLineId:incoming.id,entryId:receipt.id,amount:300000})).id,match.id);
    assert.equal((await request('/entries/'+receipt.id+'/reverse',{date:'2026-09-03',reason:'Test'})).status,409);
    for(const [ref,e]of [['REF-SERVER',payment],['REF-CASH',transfer]])await ok('/matches',{bankLineId:bankLines.find(l=>l.reference===ref).id,entryId:e.id,amount:e.amount});
    const cand=await ok('/match-candidates?bankLineId='+incoming.id);assert.equal(cand.entries.length,0);
    const cash=await ok('/bank-imports',{bankId:bank2.id,rows:[{date:'2026-09-03',description:'Terima kas',amount:200000,reference:'CASH-IN'}]});assert.equal(cash.imported,1);
    const cashLine=(await ok('/transactions?from=2026-09-01&to=2026-09-05')).bankLines.find(l=>l.reference==='CASH-IN');
    await ok('/matches',{bankLineId:cashLine.id,entryId:transfer.id,amount:200000});
    assert.equal((await ok('/report?from=2026-09-01&to=2026-09-05')).unmatchedBankLines,0);
  });
  await t.test('recognized revenue is explicit and bounded by the original course payment',async()=>{
    await ok('/recognitions',{requestKey:randomUUID(),orderId:order,amount:100000,date:'2026-09-04',description:'Layanan yang telah diberikan'});
    assert.equal((await request('/recognitions',{requestKey:randomUUID(),orderId:order,amount:200001,date:'2026-09-04',description:'Excess'})).status,409);
    const r=await ok('/report?from=2026-09-01&to=2026-09-05');assert.equal(r.balances.find(a=>a.code==='4000').balance,'-100000');
    const filtered=await ok('/transactions?from=2026-09-01&to=2026-09-05&accountId='+bank.id);
    assert.ok(filtered.entries.every(e=>e.debit_account===bank.id||e.credit_account===bank.id));
    assert.equal((await ok('/ledger-export?from=2026-09-01&to=2026-09-05&accountId='+bank.id)).entries.length,filtered.entries.length);
  });
  await t.test('monthly, quarterly and annual reports aggregate the same ledger with honest comparison coverage',async()=>{
    const expected={income:'100000',expenses:'120000',profit:'-20000',received:'300000',payments:'60000',net:'240000'};
    for(const [mode,part] of [['month',9],['quarter',3],['annual',1]]){
      const p=financialPeriod(mode,2026,part),r=await ok('/report?'+new URLSearchParams(p));
      assert.deepEqual(r.summary,expected);assert.equal(r.coverage.complete,mode==='month');assert.equal(r.comparison.coverage.complete,false);
      assert.equal(r.balances.reduce((total,a)=>total+BigInt(a.debit)-BigInt(a.credit),0n),0n);
    }
    const october=await ok('/report?'+new URLSearchParams(financialPeriod('month',2026,10)));
    assert.deepEqual(october.comparison.summary,expected);assert.equal(october.comparison.coverage.complete,true);
    assert.equal(october.summary.income,'0');assert.equal(october.summary.profit,'0');
    assert.equal(october.balances.find(a=>a.id===bank.id).opening,'1040000');
    const value=(sections,title,label)=>sections.find(section=>section.title.includes(title)).rows.find(row=>row.label===label).value;
    const september=companyStatements(await ok('/report?from=2026-09-01&to=2026-09-30')),next=companyStatements(october);
    assert.equal(value(september,'posisi','Total aset'),'1240000');assert.equal(value(september,'posisi','Total liabilitas'),'260000');
    assert.equal(value(september,'posisi','Total ekuitas'),'980000');assert.equal(value(september,'posisi','Selisih pemeriksaan neraca'),'0');
    assert.equal(value(september,'perubahan','Ekuitas awal periode'),'0');assert.equal(value(september,'perubahan','Ekuitas akhir periode'),'980000');assert.equal(value(september,'perubahan','Selisih pemeriksaan ekuitas'),'0');
    assert.equal(value(september,'arus kas','Penyesuaian saldo / mutasi di luar arus operasional'),'1000000');assert.equal(value(september,'arus kas','Saldo akhir periode'),'1240000');
    assert.equal(value(next,'posisi','Akumulasi hasil usaha'),'-20000');assert.equal(value(next,'perubahan','Ekuitas awal periode'),'980000');assert.equal(value(next,'perubahan','Ekuitas akhir periode'),'980000');
    assert.equal(value(next,'arus kas','Saldo awal periode'),'1240000');assert.equal(value(next,'arus kas','Arus kas bersih operasional'),'0');
    const before=await ok('/report?from=2026-09-01&to=2026-09-01');assert.equal(before.summary.received,'0');
    assert.equal((await ok('/report?from=2026-09-02&to=2026-09-02')).summary.received,'300000');
    for(const query of ['compareFrom=2026-02-30&compareTo=2026-03-31','compareFrom=2026-01-01','compareFrom=2026-09-02&compareTo=2026-09-01']){
      assert.equal((await request('/report?from=2026-09-01&to=2026-09-30&'+query)).status,400);
    }
  });
  await t.test('concurrent bill payments serialize; reversal restores payable and keeps historical reports stable',async()=>{
    const b=await ok('/bills',{requestKey:randomUUID(),vendor:'Race fixture',description:'Concurrent expense',amount:50,accountId:expense.id,date:'2026-09-03',dueDate:'2026-09-03'});
    await ok('/bills/'+b.id+'/approve',{});
    const attempts=await Promise.all([1,2].map(()=>request('/bills/'+b.id+'/pay',{requestKey:randomUUID(),bankId:bank.id,amount:50,date:'2026-09-03',description:'Race payment'})));
    assert.deepEqual(attempts.map(a=>a.status).sort(),[200,409]);
    const paid=attempts.find(a=>a.status===200).data;
    const correction=await ok('/entries/'+paid.id+'/reverse',{date:'2026-09-04',reason:'Wrong payment entered'});
    assert.equal((await ok('/entries/'+paid.id+'/reverse',{date:'2026-09-04',reason:'Wrong payment entered'})).id,correction.id);
    const historical=await ok('/report?from=2026-09-01&to=2026-09-03');assert.equal(historical.cashFlow.payments,'60050');
    const current=await ok('/report?from=2026-09-01&to=2026-09-04');assert.equal(current.cashFlow.payments,'60000');
    await ok('/bills/'+b.id+'/void',{date:'2026-09-04',reason:'Duplicate expense'});
    const final=await ok('/report?from=2026-09-01&to=2026-09-04');assert.equal(final.dueBills.amount,'60000');
  });
  await t.test('partial matching prevents allocating the same receipt to a second bank line',async()=>{
    const b=await ok('/bills',{requestKey:randomUUID(),vendor:'Partial fixture',description:'Partial match fixture',amount:20,accountId:expense.id,date:'2026-09-03',dueDate:'2026-09-03'});
    await ok('/bills/'+b.id+'/approve',{});
    const paid=await ok('/bills/'+b.id+'/pay',{requestKey:randomUUID(),bankId:bank.id,amount:20,date:'2026-09-03',description:'Partial fixture'});
    await ok('/bank-imports',{bankId:bank.id,rows:[{date:'2026-09-03',description:'Partial 1',amount:-10,reference:'PART1'},{date:'2026-09-03',description:'Partial 2',amount:-10,reference:'PART2'}]});
    const lines=(await ok('/transactions?from=2026-09-01&to=2026-09-04')).bankLines;
    const part1=lines.find(l=>l.reference==='PART1'),part2=lines.find(l=>l.reference==='PART2');
    assert.equal((await request('/matches',{bankLineId:part1.id,entryId:paid.id,amount:11})).status,409);
    await ok('/matches',{bankLineId:part1.id,entryId:paid.id,amount:10});await ok('/matches',{bankLineId:part2.id,entryId:paid.id,amount:10});
    assert.equal((await ok('/match-candidates?bankLineId='+part1.id)).entries.length,0);
  });
  await t.test('journal cannot be edited or deleted and invalid date never creates partial transactions',async()=>{
    await assert.rejects(control.query('UPDATE finance_entries SET amount=1 WHERE id=$1',[receipt.id]),/immutable/);
    const before=(await control.query('SELECT count(*) FROM finance_entries')).rows[0].count;
    assert.equal((await request('/transfers',{requestKey:randomUUID(),fromBankId:bank.id,toBankId:bank2.id,amount:100,date:'2026-02-30',description:'Bad date'})).status,400);
    assert.equal((await control.query('SELECT count(*) FROM finance_entries')).rows[0].count,before);
  });
  await t.test('closing prevents backdated postings and unmatched bank transactions block closing',async()=>{
    const closed=await ok('/close-period',{date:'2026-09-04'});assert.equal(closed.closed_through,'2026-09-04');
    assert.equal((await request('/transfers',{requestKey:randomUUID(),fromBankId:bank.id,toBankId:bank2.id,amount:1,date:'2026-09-04',description:'Backdated'})).status,409);
    const batch=await ok('/bank-imports',{bankId:bank.id,rows:[{date:'2026-09-05',description:'Needs review',amount:100,reference:'PENDING'}]});assert.equal(batch.imported,1);
    assert.equal((await request('/close-period',{date:'2026-09-05'})).status,409);
  });
  await t.test('personal audit references use the existing erasure contract and financial records survive',async()=>{
    const {inspectStaffErasureTables,eraseStaffUserData}=await import('./staff-erasure.js');
    await control.query('BEGIN');const tables=await inspectStaffErasureTables(control);assert.ok(tables.has('finance_audit'));
    const scrub=await eraseStaffUserData(control,owner,tables);assert.ok(scrub.finance_audit_scrubbed>0);
    assert.equal((await control.query('SELECT count(*) FROM finance_audit WHERE actor_user_id=$1',[owner])).rows[0].count,'0');
    assert.equal(JSON.stringify((await control.query('SELECT * FROM orders')).rows),original);await control.query('ROLLBACK');
  });
  await t.test('owner can reopen a period with an audit reason and cancel erroneous unmatched imports',async()=>{
    assert.equal((await request('/reopen-period',{date:'2026-09-02',reason:''})).status,400);
    const reopened=await ok('/reopen-period',{date:'2026-09-04',reason:'Periksa kembali mutasi September'});
    assert.equal(reopened.closed_through,'2026-09-03');
    const history=(await control.query('SELECT reason FROM finance_period_events WHERE id=$1',[reopened.eventId])).rows[0];
    assert.equal(history.reason,'Periksa kembali mutasi September');
    const pending=(await ok('/transactions?from=2026-09-01&to=2026-09-05')).bankLines.find(l=>l.reference==='PENDING');
    await ok('/bank-imports/'+pending.import_id+'/void',{});
    assert.ok(!(await ok('/transactions?from=2026-09-01&to=2026-09-05')).bankLines.some(l=>l.id===pending.id));
    assert.equal((await request('/matches',{bankLineId:pending.id,entryId:receipt.id,amount:100})).status,404);
    await ok('/close-period',{date:'2026-09-04'});
  });
  await t.test('global Finance staff can draft/read; scoped, revoked and expired grants cannot access ledgers',async()=>{
    await control.query(await readFile(new URL('../contracts/staff-schema-v1.sql',import.meta.url),'utf8'));
    await control.query("INSERT INTO staff_roles VALUES('finance','finance','Finance');INSERT INTO staff_permissions VALUES('legacy.finance','Finance');INSERT INTO staff_role_permissions VALUES('finance','legacy.finance')");
    const membership=randomUUID();await control.query("INSERT INTO staff_memberships(id,user_id,role_key) VALUES($1,$2,'finance')",[membership,student]);
    await control.query("INSERT INTO staff_membership_scopes(membership_id,scope_type,course_id) VALUES($1,'course',$2)",[membership,course]);
    process.env.COMPANY_WORKSPACE_ENABLED='true';process.env.COMPANY_STAFF_ENABLED='true';
    assert.equal((await request('/report?from=2026-09-01&to=2026-09-05',null,'GET',studentToken)).status,403);
    await control.query("UPDATE staff_membership_scopes SET scope_type='global',course_id=NULL WHERE membership_id=$1",[membership]);
    const access=await request('/access',null,'GET',studentToken);assert.equal(access.status,200);assert.equal(access.data.canManage,false);
    const draft={requestKey:randomUUID(),vendor:'Staff fixture',description:'Draft expense',amount:5,accountId:expense.id,date:'2026-09-05',dueDate:'2026-09-05'};
    const made=await request('/bills',draft,'POST',studentToken);assert.equal(made.status,201);
    assert.equal((await request('/bills/'+made.data.id+'/approve',{},'POST',studentToken)).status,403);
    assert.equal((await request('/accounts',{code:'DENY',name:'Denied',kind:'bank'},'POST',studentToken)).status,403);
    await control.query("UPDATE staff_memberships SET expires_at=now()-interval '1 minute' WHERE id=$1",[membership]);
    assert.equal((await request('/accounts',null,'GET',studentToken)).status,403);
    await control.query("UPDATE staff_memberships SET expires_at=NULL,status='revoked',revoked_at=now() WHERE id=$1",[membership]);
    assert.equal((await request('/accounts',null,'GET',studentToken)).status,403);
  });
});
