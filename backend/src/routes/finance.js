import { Router } from 'express';
import multer from 'multer';
import { db, withTransaction } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { requestAccess, allowed, accessFor } from '../company-policy.js';
import { fail, uuid } from '../finance-validation.js';
import * as finance from '../finance-service.js';

const router=Router();
const enabled=()=>process.env.FINANCE_ENABLED==='true';
function canRead(a){return a.isAdmin||allowed(a,'legacy.finance');}
router.use(asyncHandler(async(req,res,next)=>{
  if(!enabled())return res.status(404).json({error:'finance_disabled'});
  const access=await requestAccess(req);
  if(!canRead(access))throw fail(403,'finance_access_denied');
  req.financeAccess=access;res.set('Cache-Control','private, no-store');next();
}));
router.get('/access',asyncHandler(async(req,res)=>{
  const ready=(await db.query("SELECT to_regclass('finance_settings') IS NOT NULL AS ready")).rows[0].ready;
  res.json({version:1,enabled:true,ready,canManage:req.financeAccess.isAdmin,canDraft:true,
    settings:ready?await finance.settings(db):null});
}));
router.use(asyncHandler(async(req,res,next)=>{
  if(!(await db.query("SELECT to_regclass('finance_settings') IS NOT NULL AS ready")).rows[0].ready)throw fail(503,'finance_schema_required');
  next();
}));
async function mutate(req,action,fn,{draft=false}={}){
  return withTransaction(async c=>{
    await c.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s'");
    // Same user-first lock order as erasure; re-check grants inside the write transaction.
    const user=(await c.query('SELECT id,email FROM users WHERE id=$1 FOR SHARE',[req.financeAccess.user.id])).rows[0];
    if(!user||user.email!==req.financeAccess.user.email||user.email.endsWith('@dihapus.invalid'))throw fail(401,'invalid_staff_principal');
    await c.query("SELECT pg_advisory_xact_lock(hashtext('eznihongo-finance-write'))");
    const access=await accessFor(user,c);
    if(!canRead(access)||(!draft&&!access.isAdmin))throw fail(403,'finance_owner_required');
    const result=await fn(c);
    await c.query('INSERT INTO finance_audit(actor_user_id,action,entity_id) VALUES($1,$2,$3)',[user.id,action,typeof result?.id==='string'?result.id:result?.eventId||null]);
    return result;
  });
}
router.get('/accounts',asyncHandler(async(req,res)=>res.json({accounts:await finance.rows(db,'SELECT to_jsonb(a) AS data FROM finance_accounts a ORDER BY code')})));
router.get('/transactions',asyncHandler(async(req,res)=>res.json(await finance.list(db,req.query))));
router.get('/match-candidates',asyncHandler(async(req,res)=>res.json({entries:await finance.matchCandidates(db,req.query.bankLineId)})));
router.get('/ledger-export',asyncHandler(async(req,res)=>res.json(await finance.exportLedger(db,req.query))));
router.get('/report',asyncHandler(async(req,res)=>{
  // All totals for a report share one MVCC snapshot.
  res.json(await withTransaction(async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return finance.report(c,req.query);}));
}));
router.get('/audit',asyncHandler(async(req,res)=>{
  if(!req.financeAccess.isAdmin)throw fail(403,'finance_owner_required');
  res.json({events:await finance.rows(db,'SELECT to_jsonb(a) AS data FROM finance_audit a ORDER BY occurred_at DESC,id LIMIT 100')});
}));
router.post('/setup',asyncHandler(async(req,res)=>res.json(await mutate(req,'setup',c=>finance.setup(c,req.body)))));
router.post('/accounts',asyncHandler(async(req,res)=>res.status(201).json(await mutate(req,'account.create',c=>finance.createAccount(c,req.body)))));
router.post('/sync-courses',asyncHandler(async(req,res)=>res.json(await mutate(req,'course.sync',c=>finance.syncCourses(c)))));
router.post('/receipts',asyncHandler(async(req,res)=>res.status(201).json(await mutate(req,'course.receive',c=>finance.receiveCourse(c,req.body)))));
router.post('/recognitions',asyncHandler(async(req,res)=>res.status(201).json(await mutate(req,'course.recognize',c=>finance.recognize(c,req.body)))));
router.post('/bills',asyncHandler(async(req,res)=>res.status(201).json(await mutate(req,'bill.create',c=>finance.createBill(c,req.body),{draft:true}))));
router.post('/bills/:id/approve',asyncHandler(async(req,res)=>res.json(await mutate(req,'bill.approve',c=>finance.approveBill(c,req.params.id)))));
router.post('/bills/:id/pay',asyncHandler(async(req,res)=>res.json(await mutate(req,'bill.pay',c=>finance.payBill(c,req.params.id,req.body)))));
router.post('/bills/:id/void',asyncHandler(async(req,res)=>res.json(await mutate(req,'bill.void',c=>finance.voidBill(c,req.params.id,req.body)))));
router.post('/transfers',asyncHandler(async(req,res)=>res.status(201).json(await mutate(req,'bank.transfer',c=>finance.transfer(c,req.body)))));
router.post('/entries/:id/reverse',asyncHandler(async(req,res)=>res.json(await mutate(req,'entry.reverse',c=>finance.reverse(c,req.params.id,req.body)))));
router.post('/bank-imports',asyncHandler(async(req,res)=>res.status(201).json(await mutate(req,'bank.import',c=>finance.importBank(c,req.body)))));
router.post('/bank-imports/:id/void',asyncHandler(async(req,res)=>res.json(await mutate(req,'bank.import.void',c=>finance.voidImport(c,req.params.id)))));
router.post('/matches',asyncHandler(async(req,res)=>res.json(await mutate(req,'bank.match',c=>finance.matchBank(c,req.body)))));
router.delete('/matches/:id',asyncHandler(async(req,res)=>res.json(await mutate(req,'bank.unmatch',c=>finance.unmatch(c,req.params.id)))));
router.post('/close-period',asyncHandler(async(req,res)=>res.json(await mutate(req,'period.close',c=>finance.closePeriod(c,req.body)))));
router.post('/reopen-period',asyncHandler(async(req,res)=>res.json(await mutate(req,'period.reopen',c=>finance.reopenPeriod(c,req.body)))));

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0}});
router.post('/bills/:id/attachment',upload.single('file'),asyncHandler(async(req,res)=>{
  const f=req.file,buffer=f?.buffer;
  const mime=buffer?.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':
    buffer?.[0]===255&&buffer?.[1]===216&&buffer?.[2]===255?'image/jpeg':
    buffer?.subarray(0,5).toString()==='%PDF-'?'application/pdf':null;
  if(!mime)throw fail(400,'finance_attachment_type');
  res.status(201).json(await mutate(req,'bill.attach',async c=>{
    const bill=(await c.query('SELECT status FROM finance_bills WHERE id=$1',[uuid(req.params.id)])).rows[0];
    if(!bill)throw fail(404,'finance_bill_not_found');
    if(bill.status!=='draft')throw fail(409,'finance_attachment_requires_draft');
    return(await c.query(`INSERT INTO finance_attachments(bill_id,mime,content) VALUES($1,$2,$3)
      ON CONFLICT(bill_id) DO UPDATE SET mime=EXCLUDED.mime,content=EXCLUDED.content RETURNING id`,[req.params.id,mime,buffer])).rows[0];
  },{draft:true}));
}));
router.get('/bills/:id/attachment',asyncHandler(async(req,res)=>{
  const row=(await db.query('SELECT mime,content FROM finance_attachments WHERE bill_id=$1',[uuid(req.params.id)])).rows[0];
  if(!row)throw fail(404,'finance_attachment_not_found');
  res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'none'; sandbox");
  res.set('Content-Disposition',`inline; filename="bukti.${row.mime==='application/pdf'?'pdf':row.mime==='image/png'?'png':'jpg'}"`);
  res.type(row.mime).send(row.content);
}));
router.get('/orders/:id/document',asyncHandler(async(req,res)=>{
  const row=(await db.query(`SELECT order_number,course_title_snapshot,amount_idr,status,currency,
    created_at,approved_at FROM orders WHERE id=$1`,[uuid(req.params.id)])).rows[0];
  if(!row)throw fail(404,'order_not_found');
  res.json({document:row});
}));
router.use((error,req,res,next)=>{
  if(error.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'finance_attachment_max_5mb'});
  if(error instanceof multer.MulterError)return res.status(400).json({error:'finance_attachment_invalid'});
  if(error.status)return res.status(error.status).json({error:error.message});
  if(error.code==='23505')return res.status(409).json({error:'finance_duplicate_reference'});
  if(['23503','23514','22P02'].includes(error.code))return res.status(400).json({error:'finance_invalid_data'});
  if(error.code==='55P03'||error.code==='57014')return res.status(503).json({error:'finance_busy_retry'});
  next(error);
});
export default router;
