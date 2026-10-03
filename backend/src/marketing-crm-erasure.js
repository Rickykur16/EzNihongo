const r=type=>({type,notNull:true}),n=type=>({type,notNull:false});
const fk=(column,target,onDelete='n')=>({column,target,targetColumn:'id',onDelete});
export const crmErasureContracts={
  marketing_leads:{columns:{id:r('uuid'),course_id:n('uuid'),full_name:r('text'),phone:r('text'),email:r('text'),source:r('text'),source_detail:r('text'),goal:r('text'),stage:r('text'),offered_price:n('bigint'),lost_reason:r('text'),assigned_to:n('uuid'),created_by:n('uuid'),next_follow_up:n('timestamp with time zone'),version:r('integer'),created_at:r('timestamp with time zone'),updated_at:r('timestamp with time zone'),referrer_name:r('text'),background:r('text'),category_interest:r('text'),primary_problem:r('text'),target_timeline:r('text'),qualification_note:r('text'),alternative:r('text'),offer_angle:r('text'),price_reaction:r('text'),willingness_to_pay:n('bigint'),objection:r('text'),customer_words:r('text'),decision_reason:r('text'),next_action:r('text'),interviewed_at:n('timestamp with time zone')},foreignKeys:[fk('course_id','courses','r'),fk('assigned_to','users'),fk('created_by','users')]},
  marketing_lead_events:{columns:{id:r('uuid'),lead_id:r('uuid'),actor_user_id:n('uuid'),event_key:r('text'),stage:r('text'),note:r('text'),lead_version:r('integer'),occurred_at:r('timestamp with time zone')},foreignKeys:[fk('lead_id','marketing_leads','c'),fk('actor_user_id','users')]},
  marketing_growth_reviews:{columns:{id:r('uuid'),course_id:n('uuid'),week_start:r('date'),segment_decision:r('text'),buyer_language:r('text'),top_objection:r('text'),decision:r('text'),experiment_variable:r('text'),experiment_angle:r('text'),experiment_hypothesis:r('text'),success_metric:r('text'),experiment_owner:n('uuid'),experiment_result:r('text'),status:r('text'),version:r('integer'),created_by:n('uuid'),created_at:r('timestamp with time zone'),updated_at:r('timestamp with time zone')},foreignKeys:[fk('course_id','courses','r'),fk('experiment_owner','users'),fk('created_by','users')]},
  marketing_channel_spend:{columns:{id:r('uuid'),course_id:n('uuid'),week_start:r('date'),source:r('text'),amount_idr:r('bigint'),note:r('text'),version:r('integer'),created_by:n('uuid'),created_at:r('timestamp with time zone'),updated_at:r('timestamp with time zone')},foreignKeys:[fk('course_id','courses','r'),fk('created_by','users')]},
};
export async function eraseCrmData(client,userId,tables,qualified){
  if(!tables.has('marketing_leads'))return {};
  const leads=qualified(tables.get('marketing_leads'));
  // An exact account email match removes its prospect records and cascading notes.
  // Phone-only prospects remain independently erasable by the owner in CRM.
  const result=await client.query(`DELETE FROM ${leads} WHERE email<>'' AND email=(SELECT lower(email) FROM users WHERE id=$1)`,[userId]);
  await client.query(`UPDATE ${leads} SET assigned_to=CASE WHEN assigned_to=$1 THEN NULL ELSE assigned_to END,created_by=CASE WHEN created_by=$1 THEN NULL ELSE created_by END,version=version+1,updated_at=NOW() WHERE assigned_to=$1 OR created_by=$1`,[userId]);
  if(tables.has('marketing_lead_events'))await client.query(`UPDATE ${qualified(tables.get('marketing_lead_events'))} SET actor_user_id=NULL,note='' WHERE actor_user_id=$1`,[userId]);
  if(tables.has('marketing_growth_reviews'))await client.query(`UPDATE ${qualified(tables.get('marketing_growth_reviews'))} SET experiment_owner=CASE WHEN experiment_owner=$1 THEN NULL ELSE experiment_owner END,created_by=CASE WHEN created_by=$1 THEN NULL ELSE created_by END,version=version+1,updated_at=NOW() WHERE experiment_owner=$1 OR created_by=$1`,[userId]);
  if(tables.has('marketing_channel_spend'))await client.query(`UPDATE ${qualified(tables.get('marketing_channel_spend'))} SET created_by=NULL,version=version+1,updated_at=NOW() WHERE created_by=$1`,[userId]);
  return {marketing_leads_erased:result.rowCount};
}
