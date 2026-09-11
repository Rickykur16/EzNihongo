import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { eraseUserAccount } from './user-erasure.js';

const contract = await readFile(new URL('../contracts/staff-schema-v1.sql', import.meta.url), 'utf8');
const wipeTables = ['sessions', 'user_marketing_profile', 'user_enrollments', 'user_progress', 'user_learning_state',
  'user_stats', 'user_practice_state', 'user_practice_legacy_imports', 'practice_attempts', 'quiz_question_results',
  'quiz_attempts', 'grammar_attempts', 'smart_review_sessions'];
const quote = value => '"' + value.replaceAll('"', '""') + '"';

test('staff schema remains a test contract outside the automatic migration directory', async () => {
  const migrations = await readdir(new URL('../migrations/', import.meta.url));
  assert.ok(!migrations.some(name => /staff|audit/.test(name)));
  assert.doesNotMatch(contract, /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT)\b/im);
});

test('account erasure compatibility on PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL for isolated PostgreSQL erasure tests', timeout: 90000,
}, async t => {
  // Never read DATABASE_URL. All fixtures live in unique schemas, with no
  // public-schema fallback and no production/provider credentials.
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i, 'Use an explicitly named disposable test database');
  async function fixture(t, { staff = true } = {}) {
    const schema = 'erasure_test_' + randomUUID().replaceAll('-', '');
    const client = new pg.Client({ connectionString: url.href, statement_timeout: 10000 });
    await client.connect();
    const extraSchemas = [];
    t.after(async () => {
      await client.query('ROLLBACK');
      for (const name of [...extraSchemas, schema]) {
        assert.match(name, /^erasure_test_[a-f0-9]{32}(?:_decoy)?$/);
        await client.query(`DROP SCHEMA IF EXISTS ${quote(name)} CASCADE`);
      }
      await client.end();
    });
    await client.query(`CREATE SCHEMA ${quote(schema)}; SET search_path TO ${quote(schema)}`);
    await client.query(`
      CREATE TABLE users (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, google_id text UNIQUE NOT NULL,
        full_name text, google_name text, avatar_url text, updated_at timestamptz DEFAULT NOW());
      CREATE TABLE courses (id uuid PRIMARY KEY);
      CREATE TABLE orders (id uuid PRIMARY KEY, user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        status text, amount_idr integer);
      CREATE TABLE order_payments (id uuid PRIMARY KEY, order_id uuid REFERENCES orders(id),
        submitted_by uuid REFERENCES users(id), reviewed_by uuid REFERENCES users(id),
        proof_image bytea, proof_mime text, proof_filename text, claimed_sender_name text, raw_payload jsonb);
      CREATE TABLE discussions (id uuid PRIMARY KEY, user_id uuid REFERENCES users(id),
        parent_id uuid REFERENCES discussions(id) ON DELETE CASCADE, content text,
        is_deleted boolean DEFAULT FALSE, updated_at timestamptz DEFAULT NOW());
    `);
    for (const table of wipeTables) {
      await client.query(`CREATE TABLE ${table} (id uuid PRIMARY KEY, user_id uuid REFERENCES users(id) ON DELETE CASCADE, payload text)`);
    }
    const erased = randomUUID(), other = randomUUID(), third = randomUUID(), course = randomUUID();
    for (const [id, name] of [[erased, 'erased'], [other, 'other'], [third, 'third']]) {
      await client.query('INSERT INTO users (id,email,google_id,full_name,google_name,avatar_url) VALUES ($1,$2,$3,$3,$3,$3)', [id, `${name}@example.invalid`, name]);
    }
    await client.query('INSERT INTO courses VALUES ($1)', [course]);
    for (const table of wipeTables) {
      await client.query(`INSERT INTO ${table} VALUES ($1,$2,'owned'),($3,$4,'keep-other')`, [randomUUID(), erased, randomUUID(), other]);
    }
    const paid = randomUUID(), otherOrder = randomUUID(), proof = randomUUID(), otherProof = randomUUID();
    await client.query("INSERT INTO orders VALUES ($1,$2,'approved',120000),($3,$4,'approved',99000)", [paid, erased, otherOrder, other]);
    for (const [id, order, owner] of [[proof, paid, erased], [otherProof, otherOrder, other]]) {
      await client.query("INSERT INTO order_payments VALUES ($1,$2,$3,$4,$5,'image/png','slip.png','Private name','{\"test\":true}')", [id, order, owner, erased, Buffer.from('test-proof')]);
    }
    const parent = randomUUID(), reply = randomUUID();
    await client.query("INSERT INTO discussions(id,user_id,content) VALUES ($1,$2,'private parent')", [parent, erased]);
    await client.query("INSERT INTO discussions(id,user_id,parent_id,content) VALUES ($1,$2,$3,'keep reply')", [reply, other, parent]);
    const targetMembership = randomUUID(), otherMembership = randomUUID(), revokedMembership = randomUUID();
    if (staff) {
      await client.query(contract);
      await client.query("INSERT INTO staff_roles VALUES ('ops','operations','Operations')");
      await client.query("INSERT INTO staff_permissions VALUES ('students.read','Read only fixture')");
      await client.query("INSERT INTO staff_role_permissions VALUES ('ops','students.read')");
      await client.query(`INSERT INTO staff_memberships(id,user_id,role_key,granted_by) VALUES ($1,$2,'ops',$3),($4,$3,'ops',$2)`, [targetMembership, erased, other, otherMembership]);
      await client.query(`INSERT INTO staff_memberships(id,user_id,role_key,status,revoked_by,revoked_at) VALUES ($1,$2,'ops','revoked',$3,NOW())`, [revokedMembership, third, erased]);
      await client.query(`INSERT INTO staff_membership_scopes(membership_id,scope_type,course_id) VALUES ($1,'course',$2),($3,'global',NULL),($4,'course',$2)`, [targetMembership, course, otherMembership, revokedMembership]);
      await client.query(`INSERT INTO staff_audit_events(event_key,outcome,actor_user_id,subject_user_id) VALUES
        ('membership.granted','success',$1,$2), ('membership.revoked','success',$2,$1),
        ('access.denied','denied',$1,$1), ('scope.changed','success',$2,$3)`, [erased, other, third]);
    }
    const tx = async fn => {
      await client.query('BEGIN');
      try { const result = await fn(); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
    };
    const rows = async table => (await client.query(`SELECT * FROM ${quote(schema)}.${quote(table)} ORDER BY 1`)).rows;
    const snapshot = async () => {
      const names = ['users', 'courses', 'orders', 'order_payments', 'discussions', ...wipeTables,
        ...(staff ? ['staff_roles', 'staff_permissions', 'staff_role_permissions', 'staff_memberships', 'staff_membership_scopes', 'staff_audit_events'] : [])];
      const result = {};
      for (const table of names) result[table] = await rows(table);
      return result;
    };
    return { client, schema, extraSchemas, erased, other, third, targetMembership, otherMembership, revokedMembership,
      paid, proof, otherProof, parent, reply, rows, snapshot, tx,
      erase: () => tx(() => eraseUserAccount(client, erased)) };
  }

  async function assertLegacyPreserved(f, before) {
    const after = await f.snapshot();
    assert.deepEqual(after.orders, before.orders, 'Financial records must not disappear');
    assert.deepEqual(after.courses, before.courses);
    assert.deepEqual(after.users.filter(row => row.id !== f.erased), before.users.filter(row => row.id !== f.erased));
    assert.equal(after.users.find(row => row.id === f.erased).email, `dihapus-${f.erased}@dihapus.invalid`);
    for (const table of wipeTables) assert.deepEqual(after[table], before[table].filter(row => row.user_id !== f.erased));
    assert.deepEqual(after.order_payments.find(row => row.id === f.otherProof), before.order_payments.find(row => row.id === f.otherProof));
    assert.equal(after.order_payments.find(row => row.id === f.proof).proof_image, null);
    assert.equal(after.order_payments.length, before.order_payments.length);
    assert.equal(after.discussions.find(row => row.id === f.parent).is_deleted, true);
    assert.deepEqual(after.discussions.find(row => row.id === f.reply), before.discussions.find(row => row.id === f.reply));
  }

  await t.test('old schema needs no staff tables and retains the old summary shape', async t => {
    const f = await fixture(t, { staff: false }); const before = await f.snapshot();
    const summary = await f.erase();
    assert.ok(Object.keys(summary).every(key => !key.startsWith('staff_')));
    await assertLegacyPreserved(f, before);
    assert.ok(Object.values(await f.erase()).every(count => count === 0));
  });

  await t.test('creating the isolated contract neither backfills staff nor changes existing rows', async t => {
    const f = await fixture(t, { staff: false }); const before = await f.snapshot();
    await f.client.query(contract);
    assert.deepEqual(await f.snapshot(), before);
    for (const table of ['staff_roles', 'staff_permissions', 'staff_role_permissions', 'staff_memberships', 'staff_membership_scopes', 'staff_audit_events']) {
      assert.equal((await f.rows(table)).length, 0);
    }
  });

  await t.test('new schema removes only owned memberships/scopes and scrubs audit links idempotently', async t => {
    const f = await fixture(t); const before = await f.snapshot();
    const summary = await f.erase();
    assert.equal(summary.staff_memberships, 1);
    assert.equal(summary.staff_membership_authors_scrubbed, 2);
    assert.equal(summary.staff_audit_events_scrubbed, 3);
    await assertLegacyPreserved(f, before);
    const memberships = await f.rows('staff_memberships');
    assert.equal(memberships.length, 2);
    const other = memberships.find(row => row.id === f.otherMembership);
    assert.equal(other.status, 'active'); assert.equal(other.granted_by, null);
    const revoked = memberships.find(row => row.id === f.revokedMembership);
    assert.equal(revoked.status, 'revoked'); assert.equal(revoked.revoked_by, null);
    assert.deepEqual(await f.rows('staff_membership_scopes'), before.staff_membership_scopes.filter(row => row.membership_id !== f.targetMembership));
    for (const table of ['staff_roles', 'staff_permissions', 'staff_role_permissions']) assert.deepEqual(await f.rows(table), before[table]);
    const audit = await f.rows('staff_audit_events');
    assert.equal(audit.length, before.staff_audit_events.length);
    for (const previous of before.staff_audit_events) {
      const row = audit.find(row => row.id === previous.id);
      assert.equal(row.event_key, previous.event_key);
      assert.equal(row.outcome, previous.outcome);
      assert.equal(row.actor_user_id, previous.actor_user_id === f.erased ? null : previous.actor_user_id);
      assert.equal(row.subject_user_id, previous.subject_user_id === f.erased ? null : previous.subject_user_id);
      if (previous.actor_user_id === f.erased) assert.ok(row.actor_erased_at);
      if (previous.subject_user_id === f.erased) assert.ok(row.subject_erased_at);
    }
    const after = await f.snapshot();
    assert.ok(Object.values(await f.erase()).every(count => count === 0));
    assert.deepEqual(await f.snapshot(), after);
  });

  await t.test('unknown direct user table still fails before any cleanup', async t => {
    const f = await fixture(t); const before = await f.snapshot();
    await f.client.query('CREATE TABLE unhandled_data (user_id uuid REFERENCES users(id))');
    await assert.rejects(f.erase(), /user_erasure_incomplete.*unhandled_data/);
    assert.deepEqual(await f.snapshot(), before);
  });

  const drift = [
    ['unexpected audit payload', 'ALTER TABLE staff_audit_events ADD COLUMN payload jsonb'],
    ['missing cleanup column', 'ALTER TABLE staff_audit_events DROP COLUMN actor_erased_at'],
    ['new user reference on known table', 'ALTER TABLE staff_memberships ADD COLUMN assistant_id uuid REFERENCES users(id)'],
    ['changed scope cascade', `ALTER TABLE staff_membership_scopes DROP CONSTRAINT staff_membership_scopes_membership_id_fkey;
      ALTER TABLE staff_membership_scopes ADD FOREIGN KEY(membership_id) REFERENCES staff_memberships(id) ON DELETE NO ACTION`],
    ['missing actor FK', 'ALTER TABLE staff_audit_events DROP CONSTRAINT staff_audit_events_actor_user_id_fkey'],
    ['unregistered indirect child', 'CREATE TABLE staff_notes (membership_id uuid REFERENCES staff_memberships(id) ON DELETE CASCADE, note text)'],
  ];
  for (const [name, ddl] of drift) await t.test(`${name} is rejected without changing data`, async t => {
    const f = await fixture(t); await f.client.query(ddl); const before = await f.snapshot();
    await assert.rejects(f.erase(), /user_erasure_staff_contract_mismatch/);
    assert.deepEqual(await f.snapshot(), before);
  });

  await t.test('failure after staff cleanup rolls the entire erase transaction back', async t => {
    const f = await fixture(t); const before = await f.snapshot();
    await f.client.query(`CREATE FUNCTION fail_anonymize() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced failure at final anonymization'; END $$;
      CREATE TRIGGER fail_anonymize BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fail_anonymize()`);
    await assert.rejects(f.erase(), /forced failure at final anonymization/);
    assert.deepEqual(await f.snapshot(), before);
  });

  await t.test('optional audit table can be absent while membership cleanup still works', async t => {
    const f = await fixture(t); await f.client.query('DROP TABLE staff_audit_events');
    const summary = await f.erase();
    assert.equal(summary.staff_memberships, 1);
    assert.ok(!Object.hasOwn(summary, 'staff_audit_events_scrubbed'));
    assert.equal((await f.rows('staff_memberships')).length, 2);
  });

  await t.test('scope constraints forbid ambiguous grants and course deletion never makes a scope global', async t => {
    const f = await fixture(t);
    const course = (await f.rows('courses'))[0].id;
    for (const [kind, courseId] of [['course', null], ['global', course]]) {
      await assert.rejects(f.client.query('INSERT INTO staff_membership_scopes(membership_id,scope_type,course_id) VALUES ($1,$2,$3)',
        [f.targetMembership, kind, courseId]), error => error.code === '23514');
    }
    await assert.rejects(f.client.query("INSERT INTO staff_membership_scopes(membership_id,scope_type) VALUES ($1,'global')", [f.otherMembership]), error => error.code === '23505');
    await f.client.query('DELETE FROM courses WHERE id=$1', [course]);
    const scopes = await f.rows('staff_membership_scopes');
    assert.equal(scopes.length, 1);
    assert.equal(scopes[0].membership_id, f.otherMembership);
    assert.equal(scopes[0].scope_type, 'global');
    assert.equal((await f.rows('staff_memberships')).length, 3);
  });

  await t.test('a shadow table from another search-path schema is never modified', async t => {
    const f = await fixture(t); const decoy = f.schema + '_decoy'; f.extraSchemas.push(decoy);
    await f.client.query(`CREATE SCHEMA ${quote(decoy)};
      CREATE TABLE ${quote(decoy)}.staff_memberships (user_id uuid, payload text);
      SET search_path TO ${quote(decoy)}, ${quote(f.schema)}`);
    await f.client.query(`INSERT INTO ${quote(decoy)}.staff_memberships VALUES ($1,'keep decoy')`, [f.erased]);
    await f.erase();
    assert.equal((await f.client.query(`SELECT payload FROM ${quote(decoy)}.staff_memberships`)).rows[0].payload, 'keep decoy');
    assert.equal((await f.rows('staff_memberships')).length, 2);
  });

  await t.test('erasure holds the user lock until commit for compatible future staff writers', async t => {
    const f = await fixture(t); const peer = new pg.Client({ connectionString: url.href });
    await peer.connect(); t.after(() => peer.end());
    await f.client.query('BEGIN');
    await eraseUserAccount(f.client, f.erased);
    await assert.rejects(peer.query(`SELECT id FROM ${quote(f.schema)}.users WHERE id=$1 FOR UPDATE NOWAIT`, [f.erased]), error => error.code === '55P03');
    await f.client.query('COMMIT');
    const result = await peer.query(`SELECT email FROM ${quote(f.schema)}.users WHERE id=$1 FOR UPDATE NOWAIT`, [f.erased]);
    assert.equal(result.rows[0].email, `dihapus-${f.erased}@dihapus.invalid`);
  });
});
