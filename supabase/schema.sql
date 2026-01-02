-- KICA CaaS MVP Database Schema
-- Version 2.3 (Fixed: end_users → clients terminology)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Partners (portal users)
CREATE TABLE partners (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  partner_type TEXT DEFAULT 'reseller' CHECK (partner_type IN ('reseller', 'direct')),
  payment_mode TEXT DEFAULT 'postpaid' CHECK (payment_mode IN ('prepaid', 'postpaid')),
  payment_type TEXT DEFAULT 'post_paid' CHECK (payment_type IN ('post_paid', 'deposit')),
  credit_limit DECIMAL(15,2) DEFAULT NULL, -- Only used for 'deposit' payment_type
  current_usage DECIMAL(15,2) DEFAULT 0,
  pricing_class TEXT DEFAULT 'standard',
  mfa_enforced BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partner IP Whitelist (for future API security)
CREATE TABLE partner_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  ip_type TEXT DEFAULT 'single' CHECK (ip_type IN ('single', 'cidr')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients (partner's customers - formerly end_users)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT, -- Organization name (optional for DV, required for OV)
  client_type TEXT DEFAULT 'organization' CHECK (client_type IN ('personal', 'organization')),
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACME Accounts (subscriptions)
CREATE TABLE acme_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  ov_anchor_id UUID, -- nullable for DV accounts
  
  -- Sectigo data
  acme_account_id TEXT,
  eab_key_id TEXT,
  eab_hmac_key TEXT, -- Should be encrypted in production
  server_url TEXT,
  
  -- Account info
  account_name TEXT,
  certificate_type TEXT DEFAULT 'DV' CHECK (certificate_type IN ('DV', 'OV')),
  subscription_years INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending_start' CHECK (status IN ('pending_start', 'active', 'suspended', 'expired', 'terminated')),
  
  -- Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domains
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acme_account_id UUID REFERENCES acme_accounts(id) ON DELETE CASCADE,
  parent_domain_id UUID REFERENCES domains(id) ON DELETE CASCADE, -- Self-ref for siblings
  
  domain_name TEXT NOT NULL,
  domain_type TEXT DEFAULT 'single' CHECK (domain_type IN ('single', 'wildcard')),
  billing_type TEXT DEFAULT 'paid' CHECK (billing_type IN ('paid', 'free_sibling')),
  order_number TEXT,
  is_refundable BOOLEAN DEFAULT TRUE,
  price_charged DECIMAL(15,2) DEFAULT 0,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed', 'expired')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Transactions (for billing/audit)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_ref TEXT UNIQUE, -- Human-readable reference (e.g., TXN-20241219-001)
  partner_id UUID REFERENCES partners(id),
  acme_account_id UUID REFERENCES acme_accounts(id),
  domain_id UUID REFERENCES domains(id),
  
  -- Transaction linking for audit trail
  related_transaction_id UUID REFERENCES transactions(id), -- Links refund → original add_domain
  
  type TEXT CHECK (type IN ('add_domain', 'remove_domain', 'extend', 'refund')),
  description TEXT,
  amount DECIMAL(15,2),
  status TEXT DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  sectigo_order_number TEXT, -- Sectigo order number from API response
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups on linked transactions
CREATE INDEX IF NOT EXISTS idx_transactions_related ON transactions(related_transaction_id);

-- Certificates (synced from Sectigo GETLASTORDER)
-- Supports MULTIPLE certificates per domain (e.g., wildcard on different servers)
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  
  -- Sectigo data (from GETLASTORDER API)
  order_number TEXT,                        -- orderNumber (unique per issuance request)
  acme_order_id TEXT,                       -- acmeOrderID 
  certificate_id TEXT UNIQUE,               -- certificateID (unique per certificate)
  serial_number TEXT UNIQUE,                -- serialNumber (unique per certificate)
  
  -- Validity period
  valid_not_before TIMESTAMPTZ,             -- validNotBefore
  valid_not_after TIMESTAMPTZ,              -- validNotAfter (Certificate Expiry)
  
  -- Status from Sectigo
  status_code INTEGER,                      -- 6=Valid, 8=Revoked, 9=Pending, etc.
  status_desc TEXT,                         -- statusDesc
  
  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlements (monthly billing cycle)
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id),
  period_start DATE,
  period_end DATE,
  total_amount DECIMAL(15,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'escalated', 'confirmed', 'auto_approved', 'invoiced')),
  confirmed_at TIMESTAMPTZ,
  auto_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs (Black Box for forensics)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES partners(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_clients_partner ON clients(partner_id);
CREATE INDEX idx_acme_accounts_client ON acme_accounts(client_id);
CREATE INDEX idx_domains_acme_account ON domains(acme_account_id);
CREATE INDEX idx_transactions_partner ON transactions(partner_id);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Row Level Security (RLS)
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE acme_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partners (users can only see their own data)
CREATE POLICY "Partners can view own data" ON partners
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Partners can update own data" ON partners
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for clients
CREATE POLICY "Partners can view own clients" ON clients
  FOR SELECT USING (partner_id = auth.uid());

CREATE POLICY "Partners can insert own clients" ON clients
  FOR INSERT WITH CHECK (partner_id = auth.uid());

CREATE POLICY "Partners can update own clients" ON clients
  FOR UPDATE USING (partner_id = auth.uid());

CREATE POLICY "Partners can delete own clients" ON clients
  FOR DELETE USING (partner_id = auth.uid());

-- RLS Policies for acme_accounts
CREATE POLICY "Partners can view own acme_accounts" ON acme_accounts
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE partner_id = auth.uid())
  );

CREATE POLICY "Partners can insert own acme_accounts" ON acme_accounts
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE partner_id = auth.uid())
  );

CREATE POLICY "Partners can update own acme_accounts" ON acme_accounts
  FOR UPDATE USING (
    client_id IN (SELECT id FROM clients WHERE partner_id = auth.uid())
  );

-- RLS Policies for domains
CREATE POLICY "Partners can view own domains" ON domains
  FOR SELECT USING (
    acme_account_id IN (
      SELECT id FROM acme_accounts WHERE client_id IN (
        SELECT id FROM clients WHERE partner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Partners can insert own domains" ON domains
  FOR INSERT WITH CHECK (
    acme_account_id IN (
      SELECT id FROM acme_accounts WHERE client_id IN (
        SELECT id FROM clients WHERE partner_id = auth.uid()
      )
    )
  );

-- RLS Policies for transactions
CREATE POLICY "Partners can view own transactions" ON transactions
  FOR SELECT USING (partner_id = auth.uid());

CREATE POLICY "Partners can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (partner_id = auth.uid());

-- RLS Policies for settlements
CREATE POLICY "Partners can view own settlements" ON settlements
  FOR SELECT USING (partner_id = auth.uid());

CREATE POLICY "Partners can update own settlements" ON settlements
  FOR UPDATE USING (partner_id = auth.uid());

-- RLS Policies for audit_logs
CREATE POLICY "Partners can view own audit_logs" ON audit_logs
  FOR SELECT USING (actor_id = auth.uid());

CREATE POLICY "Partners can insert own audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- Function to automatically create partner profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.partners (id, company_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'New Partner'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
