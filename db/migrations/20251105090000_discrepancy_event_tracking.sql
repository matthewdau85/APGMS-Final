BEGIN;

CREATE TABLE IF NOT EXISTS discrepancy_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES "Org"(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL,
    category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    severity TEXT,
    source TEXT NOT NULL,
    trace_id TEXT,
    detected_at TIMESTAMPTZ NOT NULL,
    shortfall_cents BIGINT,
    payload JSONB NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS discrepancy_events_org_event_key_idx
    ON discrepancy_events (org_id, event_key);

CREATE INDEX IF NOT EXISTS discrepancy_events_org_detected_idx
    ON discrepancy_events (org_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS manual_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discrepancy_id UUID NOT NULL REFERENCES discrepancy_events(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES "Org"(id) ON DELETE CASCADE,
    resolved_by TEXT NOT NULL,
    resolved_by_role TEXT,
    resolution_type TEXT NOT NULL,
    override_amount_cents BIGINT,
    notes TEXT,
    payload JSONB,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_resolutions_org_created_idx
    ON manual_resolutions (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_plan_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES "Org"(id) ON DELETE CASCADE,
    discrepancy_id UUID REFERENCES discrepancy_events(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    arrangement_type TEXT NOT NULL,
    total_outstanding_cents BIGINT,
    installment_amount_cents BIGINT,
    installment_frequency TEXT,
    first_payment_due TIMESTAMPTZ,
    next_payment_due TIMESTAMPTZ,
    last_payment_received TIMESTAMPTZ,
    missed_installments INTEGER,
    terms JSONB,
    payload JSONB NOT NULL,
    notes TEXT,
    updated_by TEXT,
    source TEXT,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_plan_metadata_org_status_idx
    ON payment_plan_metadata (org_id, status);

CREATE INDEX IF NOT EXISTS payment_plan_metadata_org_discrepancy_idx
    ON payment_plan_metadata (org_id, discrepancy_id);

COMMIT;
