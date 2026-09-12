-- Explicitly applied; never part of the automatic student migration runner.
CREATE TABLE finance_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id), start_date date NOT NULL,
  closed_through date, CHECK (closed_through IS NULL OR closed_through >= start_date)
);
CREATE TABLE finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  name text NOT NULL, kind text NOT NULL CHECK (kind IN ('asset','liability','equity','income','expense')),
  is_bank boolean NOT NULL DEFAULT false, system boolean NOT NULL DEFAULT false,
  CHECK (NOT is_bank OR kind = 'asset')
);
INSERT INTO finance_accounts(code,name,kind,system) VALUES
  ('1100','Penerimaan kursus belum dialokasikan','asset',true),
  ('2000','Utang usaha','liability',true),
  ('2100','Pembayaran kursus diterima di muka','liability',true),
  ('3000','Saldo awal / modal','equity',true),
  ('4000','Pendapatan kursus','income',true),
  ('5100','Honor pengajar','expense',false),('5200','Marketing dan iklan','expense',false),
  ('5300','Server, AI dan perangkat lunak','expense',false),
  ('5400','Operasional','expense',false),('5500','Biaya bank','expense',false);
CREATE TABLE finance_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_key uuid NOT NULL UNIQUE,
  vendor text NOT NULL, description text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 1000000000000),
  account_id uuid NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  bill_date date NOT NULL, due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(due_date >= bill_date)
);
CREATE TABLE finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK(kind IN ('opening','course','receipt','bill','payment','transfer','recognition','reversal')),
  entry_date date NOT NULL, description text NOT NULL,
  debit_account uuid NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  credit_account uuid NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 1000000000000),
  order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
  bill_id uuid REFERENCES finance_bills(id) ON DELETE RESTRICT,
  reversal_of uuid UNIQUE REFERENCES finance_entries(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(debit_account <> credit_account)
);
CREATE UNIQUE INDEX finance_one_course ON finance_entries(order_id) WHERE kind = 'course';
CREATE UNIQUE INDEX finance_one_bill ON finance_entries(bill_id) WHERE kind = 'bill';
CREATE INDEX finance_entries_date ON finance_entries(entry_date,id);
CREATE TABLE finance_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bank_id uuid NOT NULL REFERENCES finance_accounts(id),
  fingerprint text NOT NULL, voided boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bank_id,fingerprint)
);
CREATE TABLE finance_bank_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_id uuid NOT NULL REFERENCES finance_imports(id),
  bank_id uuid NOT NULL REFERENCES finance_accounts(id), row_number integer NOT NULL,
  transaction_date date NOT NULL, description text NOT NULL, reference text,
  voided boolean NOT NULL DEFAULT false,
  amount bigint NOT NULL CHECK(amount <> 0 AND abs(amount) <= 1000000000000),
  UNIQUE(import_id,row_number)
);
CREATE UNIQUE INDEX finance_bank_reference ON finance_bank_lines(bank_id,reference) WHERE reference IS NOT NULL AND NOT voided;
CREATE TABLE finance_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bank_line_id uuid NOT NULL REFERENCES finance_bank_lines(id),
  entry_id uuid NOT NULL REFERENCES finance_entries(id),
  amount bigint NOT NULL CHECK(amount > 0 AND amount <= 1000000000000),
  UNIQUE(bank_line_id,entry_id)
);
CREATE TABLE finance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bill_id uuid NOT NULL UNIQUE REFERENCES finance_bills(id),
  mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','application/pdf')),
  content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 5242880)
);
-- Single personal reference; scrubbed by the existing account-erasure workflow.
CREATE TABLE finance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(), action text NOT NULL, entity_id uuid,
  actor_erased_at timestamptz
);
CREATE TABLE finance_period_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), closed_before date, closed_after date,
  reason text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION finance_guard_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cfg finance_settings;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'finance_entry_immutable'; END IF;
  SELECT * INTO cfg FROM finance_settings WHERE id = true FOR SHARE;
  IF NOT FOUND OR NEW.entry_date < cfg.start_date OR NEW.entry_date <= cfg.closed_through THEN
    RAISE EXCEPTION 'finance_period_unavailable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON finance_entries
  FOR EACH ROW EXECUTE FUNCTION finance_guard_entry();
