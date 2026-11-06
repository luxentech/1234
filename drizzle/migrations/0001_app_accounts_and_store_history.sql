-- Secure credential storage for the site's own (non-Supabase) accounts.
CREATE TABLE public.app_accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No Data API access at all: only the server (service role) may touch credentials.
GRANT ALL ON public.app_accounts TO service_role;
ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_app_accounts_updated
BEFORE UPDATE ON public.app_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Append-only snapshot log so no shared data version is ever lost.
CREATE TABLE public.site_store_history (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.site_store_history TO service_role;
ALTER TABLE public.site_store_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_site_store_history_key_created ON public.site_store_history (key, created_at DESC);
