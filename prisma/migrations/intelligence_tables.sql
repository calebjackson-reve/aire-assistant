-- AIRE Intelligence Tables
-- These tables are managed by raw SQL (not Prisma) and populated by MCP ingestion servers.
-- Run via: npx tsx scripts/run-intelligence-migration.ts

-- ═══════════════════════════════════════════════════════════════════════════════
-- properties_clean — canonical property records, deduplicated across sources
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS properties_clean (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id     TEXT UNIQUE NOT NULL,   -- canonical ID: "70816-123-n-oak-dr"
  address_canonical TEXT NOT NULL,         -- "123 N OAK DR, BATON ROUGE, LA 70816"
  street_number   TEXT,
  street_name     TEXT,
  city            TEXT,
  state           TEXT NOT NULL DEFAULT 'LA',
  zip             TEXT,
  parish          TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  property_type   TEXT,                    -- residential, commercial, land
  bedrooms        INTEGER,
  bathrooms       NUMERIC(3,1),
  sqft            INTEGER,
  lot_sqft        INTEGER,
  year_built      INTEGER,
  garage_spaces   INTEGER,
  pool            BOOLEAN DEFAULT FALSE,
  subdivision     TEXT,
  school_district TEXT,
  parcel_id       TEXT,
  mls_id          TEXT,
  propstream_id   TEXT,
  assessor_id     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_zip ON properties_clean(zip);
CREATE INDEX IF NOT EXISTS idx_properties_parish ON properties_clean(parish);
CREATE INDEX IF NOT EXISTS idx_properties_mls ON properties_clean(mls_id) WHERE mls_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_propstream ON properties_clean(propstream_id) WHERE propstream_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- market_snapshots — time-series pricing data per property per source
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_snapshots (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id     TEXT NOT NULL REFERENCES properties_clean(property_id),
  snapshot_date   DATE NOT NULL,
  source          TEXT NOT NULL,            -- mls, propstream, zillow, redfin, assessor
  list_price      NUMERIC(12,2),
  sold_price      NUMERIC(12,2),
  zillow_estimate NUMERIC(12,2),
  redfin_estimate NUMERIC(12,2),
  propstream_avm  NUMERIC(12,2),
  assessor_fmv    NUMERIC(12,2),
  dom             INTEGER,
  price_reductions INTEGER DEFAULT 0,
  compete_score   INTEGER,
  status          TEXT,                     -- active, pending, sold, withdrawn
  list_date       DATE,
  sold_date       DATE,
  price_per_sqft  NUMERIC(8,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_property ON market_snapshots(property_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_status ON market_snapshots(status, snapshot_date DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_snapshots_sold ON market_snapshots(sold_price, sold_date) WHERE sold_price IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- aire_scores — append-only AIRE scoring history
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS aire_scores (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id                 TEXT NOT NULL,
  score_date                  DATE NOT NULL,
  -- Ensemble AVM
  aire_estimate               NUMERIC(12,2),
  ensemble_weight_mls         NUMERIC(5,4),
  ensemble_weight_propstream  NUMERIC(5,4),
  ensemble_weight_zillow      NUMERIC(5,4),
  ensemble_weight_redfin      NUMERIC(5,4),
  -- Disagreement
  source_disagreement_pct     NUMERIC(6,4),
  confidence_tier             TEXT,           -- HIGH, MEDIUM, LOW
  -- PPS
  pps_total                   NUMERIC(6,2),
  pps_pricing_fit             NUMERIC(5,3),
  pps_demand_strength         NUMERIC(5,3),
  pps_condition_match         NUMERIC(5,3),
  pps_competition_relief      NUMERIC(5,3),
  pps_seller_flexibility      NUMERIC(5,3),
  pps_momentum                NUMERIC(5,3),
  -- BPS
  bps_total                   NUMERIC(6,2),
  bps_curb_appeal             NUMERIC(5,3),
  bps_interior_finish         NUMERIC(5,3),
  bps_layout_flow             NUMERIC(5,3),
  bps_lighting                NUMERIC(5,3),
  bps_cleanliness_staging     NUMERIC(5,3),
  bps_modernity               NUMERIC(5,3),
  bps_photo_presentation      NUMERIC(5,3),
  -- URI
  uri_score                   NUMERIC(6,3),
  uri_expected_value_lift     NUMERIC(12,2),
  uri_upgrade_cost            NUMERIC(12,2),
  uri_confidence_factor       NUMERIC(3,2),
  uri_appraiser_support_factor NUMERIC(3,2),
  -- Assessor
  assessor_gap_pct            NUMERIC(6,4),
  -- Metadata
  reason_codes                JSONB,
  is_manually_reviewed        BOOLEAN DEFAULT FALSE,
  reviewed_by                 TEXT,
  review_notes                TEXT,
  job_run_id                  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_property ON aire_scores(property_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_scores_confidence ON aire_scores(confidence_tier) WHERE confidence_tier = 'LOW';
CREATE INDEX IF NOT EXISTS idx_scores_date ON aire_scores(score_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- job_runs — ingestion job tracking
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_runs (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_name          TEXT NOT NULL,
  source            TEXT,
  status            TEXT NOT NULL DEFAULT 'running',  -- running, success, partial, failed
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  records_attempted INTEGER DEFAULT 0,
  records_imported  INTEGER DEFAULT 0,
  records_skipped   INTEGER DEFAULT 0,
  records_errored   INTEGER DEFAULT 0,
  summary           JSONB,
  triggered_by      TEXT NOT NULL DEFAULT 'scheduler'
);

CREATE INDEX IF NOT EXISTS idx_jobs_name ON job_runs(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_runs(status) WHERE status = 'running';

-- ═══════════════════════════════════════════════════════════════════════════════
-- error_logs — per-record error logging
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS error_logs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_run_id      TEXT REFERENCES job_runs(id),
  error_type      TEXT NOT NULL,
  source          TEXT,
  raw_record      JSONB,
  address_raw     TEXT,
  error_message   TEXT NOT NULL,
  stack_trace     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_errors_job ON error_logs(job_run_id);
CREATE INDEX IF NOT EXISTS idx_errors_date ON error_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- raw_imports — raw CSV data before processing
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS raw_imports (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source          TEXT NOT NULL,
  source_file     TEXT,
  raw_data        JSONB,
  import_batch_id TEXT,
  address_raw     TEXT,
  status          TEXT DEFAULT 'pending',   -- pending, processed, errored
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imports_batch ON raw_imports(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_imports_status ON raw_imports(status) WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════
-- backtest_results — accuracy validation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS backtest_results (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_date                    DATE NOT NULL,
  model_version               TEXT DEFAULT '1.0',
  geography                   TEXT,
  price_band                  TEXT,
  property_type               TEXT,
  sample_size                 INTEGER,
  -- AIRE metrics
  aire_mae                    NUMERIC(12,2),
  aire_mape                   NUMERIC(6,2),
  aire_hit_rate_3pct          NUMERIC(5,2),
  aire_hit_rate_5pct          NUMERIC(5,2),
  aire_hit_rate_10pct         NUMERIC(5,2),
  -- Zillow
  zillow_mae                  NUMERIC(12,2),
  zillow_mape                 NUMERIC(6,2),
  zillow_hit_rate_5pct        NUMERIC(5,2),
  -- Redfin
  redfin_mae                  NUMERIC(12,2),
  redfin_mape                 NUMERIC(6,2),
  redfin_hit_rate_5pct        NUMERIC(5,2),
  -- PropStream
  propstream_mae              NUMERIC(12,2),
  propstream_mape             NUMERIC(6,2),
  propstream_hit_rate_5pct    NUMERIC(5,2),
  -- Comparisons
  aire_vs_zillow_accuracy_gain NUMERIC(6,2),
  aire_vs_redfin_accuracy_gain NUMERIC(6,2),
  weights_used                JSONB,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_date ON backtest_results(run_date DESC);
