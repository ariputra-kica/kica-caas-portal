-- ============================================
-- Fix RLS Policies for clients/acme_accounts/domains
-- ============================================
-- Safe version - only creates policies, doesn't reference end_users
-- ============================================

-- Enable RLS on clients table (if not already)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if they exist) - safe way
DO $$ 
BEGIN
    -- Drop acme_accounts policies
    DROP POLICY IF EXISTS "Partners can view own acme_accounts" ON acme_accounts;
    DROP POLICY IF EXISTS "Partners can insert own acme_accounts" ON acme_accounts;
    DROP POLICY IF EXISTS "Partners can update own acme_accounts" ON acme_accounts;
    
    -- Drop domains policies
    DROP POLICY IF EXISTS "Partners can view own domains" ON domains;
    DROP POLICY IF EXISTS "Partners can insert own domains" ON domains;
    
    -- Drop clients policies (in case they need update)
    DROP POLICY IF EXISTS "Partners can view own clients" ON clients;
    DROP POLICY IF EXISTS "Partners can insert own clients" ON clients;
    DROP POLICY IF EXISTS "Partners can update own clients" ON clients;
    DROP POLICY IF EXISTS "Partners can delete own clients" ON clients;
    
    -- Drop certificates policies
    DROP POLICY IF EXISTS "Partners can view own certificates" ON certificates;
END $$;

-- RLS Policies for clients
CREATE POLICY "Partners can view own clients" ON clients
  FOR SELECT USING (partner_id = auth.uid());

CREATE POLICY "Partners can insert own clients" ON clients
  FOR INSERT WITH CHECK (partner_id = auth.uid());

CREATE POLICY "Partners can update own clients" ON clients
  FOR UPDATE USING (partner_id = auth.uid());

CREATE POLICY "Partners can delete own clients" ON clients
  FOR DELETE USING (partner_id = auth.uid());

-- RLS Policies for acme_accounts (using client_id)
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

-- RLS Policies for domains (using clients chain)
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

-- RLS Policies for certificates
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own certificates" ON certificates
  FOR SELECT USING (
    domain_id IN (
      SELECT d.id FROM domains d
      JOIN acme_accounts a ON d.acme_account_id = a.id
      JOIN clients c ON a.client_id = c.id
      WHERE c.partner_id = auth.uid()
    )
  );

-- Verification
SELECT 'RLS Policies Fixed!' as status;
