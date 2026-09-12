const r = type => ({ type, notNull: true });
const n = type => ({ type, notNull: false });
const fk = (column, target, targetColumn, onDelete) => ({ column, target, targetColumn, onDelete });
export const companyErasureContracts = {
  company_work_items: {
    columns: { id:r('uuid'),division_key:r('text'),kind:r('text'),title:r('text'),description:r('text'),status:r('text'),priority:r('text'),
      created_by:n('uuid'),assigned_to:n('uuid'),course_id:n('uuid'),source_order_id:n('uuid'),source_discussion_id:n('uuid'),
      link_url:r('text'),published_url:r('text'),release_sha:r('text'),scheduled_at:n('timestamp with time zone'),version:r('integer'),
      created_at:r('timestamp with time zone'),updated_at:r('timestamp with time zone') },
    foreignKeys: [fk('created_by','users','id','n'),fk('assigned_to','users','id','n'),fk('course_id','courses','id','n'),
      fk('source_order_id','orders','id','n'),fk('source_discussion_id','discussions','id','n')],
  },
  company_work_events: {
    columns: {id:r('uuid'),item_id:r('uuid'),actor_user_id:n('uuid'),event_key:r('text'),item_version:r('integer'),occurred_at:r('timestamp with time zone')},
    foreignKeys: [fk('item_id','company_work_items','id','c'),fk('actor_user_id','users','id','n')],
  },
  company_outbox: {
    columns: { id:r('uuid'),item_id:r('uuid'),item_version:r('integer'),event_key:r('text'),state:r('text'),attempts:r('integer'),
      available_at:r('timestamp with time zone'),lease_token:n('uuid'),lease_until:n('timestamp with time zone'),last_error:n('text'),created_at:r('timestamp with time zone') },
    foreignKeys: [fk('item_id','company_work_items','id','c')],
  },
};

export async function eraseCompanyData(client, userId, tables, qualified) {
  if (!tables.has('company_work_items')) return {};
  const work = qualified(tables.get('company_work_items'));
  // No history snapshots of free text are stored. Remove narrative owned by
  // the target or attached to their source case; preserve other business work.
  const result = await client.query(`UPDATE ${work} SET title = '[data pengguna dihapus]', description = '',
    link_url = '', published_url = '', release_sha = '', created_by = NULL, assigned_to = NULL,
    source_order_id = NULL, source_discussion_id = NULL, status = 'archived', scheduled_at = NULL,
    version = version + 1, updated_at = NOW()
    WHERE created_by = $1 OR source_order_id IN (SELECT id FROM orders WHERE user_id = $1)
      OR source_discussion_id IN (SELECT id FROM discussions WHERE user_id = $1) RETURNING id`, [userId]);
  await client.query(`UPDATE ${work} SET assigned_to = NULL WHERE assigned_to = $1`, [userId]);
  if (tables.has('company_work_events')) await client.query(`UPDATE ${qualified(tables.get('company_work_events'))} SET actor_user_id = NULL WHERE actor_user_id = $1`, [userId]);
  if (tables.has('company_outbox') && result.rows.length) await client.query(`UPDATE ${qualified(tables.get('company_outbox'))}
    SET state = 'cancelled', lease_token = NULL, lease_until = NULL WHERE item_id = ANY($1::uuid[]) AND state IN ('pending','leased','failed')`, [result.rows.map(r=>r.id)]);
  return { company_work_scrubbed: result.rowCount };
}
