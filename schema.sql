-- Melann Lending Loan Monitoring System Schema
-- PostgreSQL syntax (compatible with other RDBMS with minor tweaks)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users (authentication & role management)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin','supervisor','collector')),
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Collectors (profile linked to a user)
CREATE TABLE IF NOT EXISTS collectors (
    collector_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Loans (core transactional data)
CREATE TABLE IF NOT EXISTS loans (
    loan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_code VARCHAR(30) NOT NULL UNIQUE,
    collector_id UUID NOT NULL REFERENCES collectors(collector_id) ON DELETE RESTRICT,
    borrower_name VARCHAR(150) NOT NULL,
    month_reported CHAR(5) NOT NULL, -- MM-YY
    due_date DATE NOT NULL,
    outstanding_balance NUMERIC(12,2) NOT NULL CHECK (outstanding_balance >= 0),
    amount_collected NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_collected >= 0),
    running_balance NUMERIC(12,2) GENERATED ALWAYS AS (outstanding_balance - amount_collected) STORED,
    moving_status VARCHAR(10) NOT NULL DEFAULT 'Moving' CHECK (moving_status IN ('Moving','NM','NMSR','Paid')),
    location_status VARCHAR(2) NOT NULL DEFAULT 'NL' CHECK (location_status IN ('L','NL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Loan history (audit per field change)
CREATE TABLE IF NOT EXISTS loan_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(user_id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT
);

-- 5. General audit log (actions other than field changes)
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    details TEXT
);

-- 6. Remarks (comments on loan records)
CREATE TABLE IF NOT EXISTS loan_remarks (
    remark_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    remark TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_loans_collector ON loans(collector_id);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loans_moving_status ON loans(moving_status);
CREATE INDEX IF NOT EXISTS idx_loans_location_status ON loans(location_status);
CREATE INDEX IF NOT EXISTS idx_loans_month_reported ON loans(month_reported);

-- Trigger: auto‑set Paid status when running_balance reaches zero
CREATE OR REPLACE FUNCTION trg_set_paid_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.running_balance = 0 THEN
        UPDATE loans SET moving_status = 'Paid' WHERE loan_id = NEW.loan_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paid_after_update ON loans;
CREATE TRIGGER trg_paid_after_update
AFTER UPDATE OF amount_collected, outstanding_balance ON loans
FOR EACH ROW EXECUTE FUNCTION trg_set_paid_status();

-- Trigger: record field changes into loan_history (simplified version)
CREATE OR REPLACE FUNCTION trg_loan_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user UUID := current_setting('app.current_user')::uuid; -- set by app layer
    v_col TEXT;
    v_old TEXT;
    v_new TEXT;
BEGIN
    FOREACH v_col IN ARRAY ARRAY['outstanding_balance','amount_collected','moving_status','location_status'] LOOP
        EXECUTE format('SELECT ($1).%I, ($2).%I', v_col, v_col) INTO v_old, v_new USING OLD, NEW;
        IF v_old IS DISTINCT FROM v_new THEN
            INSERT INTO loan_history (loan_id, changed_by, field_name, old_value, new_value)
            VALUES (NEW.loan_id, v_user, v_col, v_old::text, v_new::text);
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_loan_changes ON loans;
CREATE TRIGGER trg_audit_loan_changes
AFTER UPDATE ON loans
FOR EACH ROW EXECUTE FUNCTION trg_loan_audit();

-- Materialized view for nightly summary (used by reports)
DROP MATERIALIZED VIEW IF EXISTS loan_summary;
CREATE MATERIALIZED VIEW loan_summary AS
SELECT
    collector_id,
    COUNT(*) AS total_accounts, 
    SUM(outstanding_balance) AS total_outstanding,
    SUM(running_balance) AS total_running,
    SUM(amount_collected) AS total_collected,
    COUNT(*) FILTER (WHERE moving_status = 'Paid') AS paid_accounts,
    COUNT(*) FILTER (WHERE moving_status = 'NM') AS not_moving_accounts
FROM loans
GROUP BY collector_id;

-- Refresh schedule (example for cron on Linux; on Windows use Task Scheduler)
-- 0 2 * * * psql -d yourdb -c "REFRESH MATERIALIZED VIEW CONCURRENTLY loan_summary;"

-- End of schema
