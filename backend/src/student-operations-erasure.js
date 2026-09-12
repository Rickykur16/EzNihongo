const r=type=>({type,notNull:true}),n=type=>({type,notNull:false});
const fk=(column,target,onDelete='c')=>({column,target,targetColumn:'id',onDelete});
export const operationsErasureContracts={
  student_operation_profiles:{columns:{user_id:r('uuid'),course_id:r('uuid'),onboarding:r('text'),goal:r('text'),assigned_to:n('uuid'),next_follow_up:n('timestamp with time zone'),version:r('integer'),updated_at:r('timestamp with time zone')},foreignKeys:[fk('user_id','users'),fk('course_id','courses'),fk('assigned_to','users','n')]},
  student_operation_cases:{columns:{id:r('uuid'),user_id:r('uuid'),course_id:r('uuid'),title:r('text'),category:r('text'),status:r('text'),priority:r('text'),assigned_to:n('uuid'),escalated_to:r('text'),description:r('text'),resolution:r('text'),due_at:n('timestamp with time zone'),resolved_at:n('timestamp with time zone'),created_by:n('uuid'),created_at:r('timestamp with time zone'),updated_at:r('timestamp with time zone'),version:r('integer')},foreignKeys:[fk('user_id','users'),fk('course_id','courses'),fk('assigned_to','users','n'),fk('created_by','users','n')]},
  student_operation_events:{columns:{id:r('uuid'),case_id:r('uuid'),actor_user_id:n('uuid'),event_key:r('text'),note:r('text'),occurred_at:r('timestamp with time zone')},foreignKeys:[fk('case_id','student_operation_cases'),fk('actor_user_id','users','n')]},
  student_operation_attendance:{columns:{live_class_id:r('uuid'),user_id:r('uuid'),status:r('text'),note:r('text'),recorded_by:n('uuid'),updated_at:r('timestamp with time zone'),version:r('integer')},foreignKeys:[fk('live_class_id','live_classes'),fk('user_id','users'),fk('recorded_by','users','n')]},
};
export async function eraseOperationsData(client,userId,tables,qualified){
  const result={};
  for(const name of ['student_operation_profiles','student_operation_cases','student_operation_attendance']){
    if(!tables.has(name))continue;
    result[name]=(await client.query(`DELETE FROM ${qualified(tables.get(name))} WHERE user_id=$1`,[userId])).rowCount;
  }
  if(tables.has('student_operation_events'))await client.query(`UPDATE ${qualified(tables.get('student_operation_events'))} SET actor_user_id=NULL,note='' WHERE actor_user_id=$1`,[userId]);
  if(tables.has('student_operation_profiles'))await client.query(`UPDATE ${qualified(tables.get('student_operation_profiles'))} SET assigned_to=NULL WHERE assigned_to=$1`,[userId]);
  if(tables.has('student_operation_cases'))await client.query(`UPDATE ${qualified(tables.get('student_operation_cases'))} SET assigned_to=CASE WHEN assigned_to=$1 THEN NULL ELSE assigned_to END,created_by=CASE WHEN created_by=$1 THEN NULL ELSE created_by END WHERE assigned_to=$1 OR created_by=$1`,[userId]);
  if(tables.has('student_operation_attendance'))await client.query(`UPDATE ${qualified(tables.get('student_operation_attendance'))} SET recorded_by=NULL,note='' WHERE recorded_by=$1`,[userId]);
  return result;
}
