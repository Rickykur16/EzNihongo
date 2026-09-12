// Compatibility for the *specific* contract in contracts/staff-schema-v1.sql.
// Absent tables are allowed; an unexpected shape is not silently whitelisted.
// All calls use the erasure transaction's client, never the pool.
import { companyErasureContracts, eraseCompanyData } from './company-erasure-contract.js';
import { operationsErasureContracts, eraseOperationsData } from './student-operations-erasure.js';
const required = (type) => ({ type, notNull: true });
const nullable = (type) => ({ type, notNull: false });
const fk = (column, target, targetColumn, onDelete) => ({ column, target, targetColumn, onDelete });
const contracts = {
  finance_audit: {
    columns: { id: required('uuid'), actor_user_id: nullable('uuid'), occurred_at: required('timestamp with time zone'),
      action: required('text'), entity_id: nullable('uuid'), actor_erased_at: nullable('timestamp with time zone') },
    foreignKeys: [fk('actor_user_id', 'users', 'id', 'n')],
  },
  ...operationsErasureContracts,
  ...companyErasureContracts,
  staff_memberships: {
    columns: { id: required('uuid'), user_id: required('uuid'), role_key: required('text'), status: required('text'),
      granted_by: nullable('uuid'), revoked_by: nullable('uuid'), created_at: required('timestamp with time zone'),
      expires_at: nullable('timestamp with time zone'), revoked_at: nullable('timestamp with time zone') },
    foreignKeys: [fk('user_id', 'users', 'id', 'c'), fk('role_key', 'staff_roles', 'role_key', 'r'),
      fk('granted_by', 'users', 'id', 'n'), fk('revoked_by', 'users', 'id', 'n')],
  },
  staff_membership_scopes: {
    columns: { id: required('uuid'), membership_id: required('uuid'), scope_type: required('text'), course_id: nullable('uuid') },
    foreignKeys: [fk('membership_id', 'staff_memberships', 'id', 'c'), fk('course_id', 'courses', 'id', 'c')],
  },
  staff_audit_events: {
    columns: { id: required('uuid'), occurred_at: required('timestamp with time zone'), event_key: required('text'),
      outcome: required('text'), actor_user_id: nullable('uuid'), subject_user_id: nullable('uuid'),
      actor_erased_at: nullable('timestamp with time zone'), subject_erased_at: nullable('timestamp with time zone') },
    foreignKeys: [fk('actor_user_id', 'users', 'id', 'n'), fk('subject_user_id', 'users', 'id', 'n')],
  },
};
const tableNames = Object.keys(contracts);
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const qualified = table => `${quote(table.schema_name)}.${quote(table.table_name)}`;
function incompatible(detail) {
  throw new Error(`user_erasure_staff_contract_mismatch: ${detail}. Review staff-schema-v1 and cleanup before changing schema.`);
}

export async function inspectStaffErasureTables(client) {
  // Resolve against users' actual schema, never a similarly named table from
  // another search_path entry. Parameter values are a fixed code-owned list.
  const metadataSql = `
    SELECT n.nspname AS schema_name, t.relname AS table_name, t.relkind,
           a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS column_type,
           a.attnotnull AS not_null
      FROM pg_class u
      JOIN pg_namespace n ON n.oid = u.relnamespace
      JOIN pg_class t ON t.relnamespace = u.relnamespace AND t.relname = ANY($1::text[])
      LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
     WHERE u.oid = 'users'::regclass`;
  let { rows } = await client.query(metadataSql, [tableNames]);
  if (!rows.length) return new Map();
  const present = new Map(rows.map(row => [row.table_name, row]));
  // Caller must be in a transaction. Prevent DDL/FK drift between inspection
  // and cleanup. Locks do not grant any new staff capability.
  for (const name of [...present.keys()].sort()) {
    if (present.get(name).relkind !== 'r') incompatible(`${name} is not an ordinary table`);
    await client.query(`LOCK TABLE ${qualified(present.get(name))} IN ROW EXCLUSIVE MODE`);
  }
  ({ rows } = await client.query(metadataSql, [tableNames]));
  const currentNames = new Set(rows.map(row => row.table_name));
  if (currentNames.size !== present.size || [...currentNames].some(name => !present.has(name))) {
    incompatible('staff tables changed during inspection');
  }
  for (const [name] of present) {
    const actual = rows.filter(row => row.table_name === name);
    const expected = contracts[name].columns;
    if (actual.length !== Object.keys(expected).length || actual.some(row =>
      !Object.hasOwn(expected, row.column_name) || expected[row.column_name].type !== row.column_type ||
      expected[row.column_name].notNull !== row.not_null)) incompatible(`${name} columns`);
  }
  const { rows: foreignKeys } = await client.query(`
    SELECT child.relname AS table_name, parent.relname AS target_table,
           parent.relnamespace = u.relnamespace AS same_schema, c.confdeltype AS on_delete, c.convalidated,
           ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num ORDER BY k.ord) AS columns,
           ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num, ord)
                 JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num ORDER BY k.ord) AS target_columns
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_class u ON u.oid = 'users'::regclass
     WHERE c.contype = 'f' AND child.relnamespace = u.relnamespace AND child.relname = ANY($1::text[])`, [tableNames]);
  for (const [name] of present) {
    const actual = foreignKeys.filter(row => row.table_name === name);
    const expected = contracts[name].foreignKeys;
    if (actual.length !== expected.length || expected.some(rule => !actual.some(row =>
      row.same_schema && row.convalidated && row.columns.length === 1 && row.columns[0] === rule.column &&
      row.target_table === rule.target && row.target_columns.length === 1 && row.target_columns[0] === rule.targetColumn &&
      row.on_delete === rule.onDelete))) incompatible(`${name} foreign keys`);
  }
  // Also protect indirect personal data hanging off membership/scope/audit IDs.
  // A new dependent table needs an explicit cleanup review, even without a users FK.
  const { rows: dependents } = await client.query(`
    SELECT child.relname AS child_table, child.relnamespace = u.relnamespace AS same_schema,
           parent.relname AS parent_table
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_class u ON u.oid = 'users'::regclass
     WHERE c.contype = 'f' AND parent.relnamespace = u.relnamespace AND parent.relname = ANY($1::text[])`, [tableNames]);
  const dependentPairs = new Set(['staff_membership_scopes:staff_memberships',
    'student_operation_events:student_operation_cases',
    'company_work_events:company_work_items', 'company_outbox:company_work_items']);
  if (dependents.some(row => !row.same_schema || !dependentPairs.has(`${row.child_table}:${row.parent_table}`))) incompatible('unknown dependent staff table');
  return present;
}

export async function eraseStaffUserData(client, userId, tables) {
  const result = await eraseCompanyData(client, userId, tables, qualified);
  if (tables.has('finance_audit')) {
    result.finance_audit_scrubbed = (await client.query(`UPDATE ${qualified(tables.get('finance_audit'))}
      SET actor_user_id=NULL,actor_erased_at=COALESCE(actor_erased_at,NOW()) WHERE actor_user_id=$1`,[userId])).rowCount;
  }
  Object.assign(result,await eraseOperationsData(client,userId,tables,qualified));
  if (tables.has('staff_memberships')) {
    const table = qualified(tables.get('staff_memberships'));
    // Only the erased user's memberships/scopes disappear. A grant by this
    // person to another employee remains; its author link is cleared instead.
    result.staff_memberships = (await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId])).rowCount;
    result.staff_membership_authors_scrubbed = (await client.query(`
      UPDATE ${table}
         SET granted_by = CASE WHEN granted_by = $1 THEN NULL ELSE granted_by END,
             revoked_by = CASE WHEN revoked_by = $1 THEN NULL ELSE revoked_by END
       WHERE granted_by = $1 OR revoked_by = $1`, [userId])).rowCount;
  }
  if (tables.has('staff_audit_events')) {
    result.staff_audit_events_scrubbed = (await client.query(`
      UPDATE ${qualified(tables.get('staff_audit_events'))}
         SET actor_erased_at = CASE WHEN actor_user_id = $1 THEN COALESCE(actor_erased_at, NOW()) ELSE actor_erased_at END,
             subject_erased_at = CASE WHEN subject_user_id = $1 THEN COALESCE(subject_erased_at, NOW()) ELSE subject_erased_at END,
             actor_user_id = CASE WHEN actor_user_id = $1 THEN NULL ELSE actor_user_id END,
             subject_user_id = CASE WHEN subject_user_id = $1 THEN NULL ELSE subject_user_id END
       WHERE actor_user_id = $1 OR subject_user_id = $1`, [userId])).rowCount;
  }
  return result;
}
