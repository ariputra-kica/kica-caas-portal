-- ============================================
-- KICA CaaS Portal - IP Whitelist RLS Policies
-- ============================================
-- Enables Row Level Security for partner_ip_whitelist table
-- Partners can only manage their own IP entries
-- ============================================

-- Enable RLS on the table
ALTER TABLE partner_ip_whitelist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotent reruns)
DROP POLICY IF EXISTS "Partners can view own IPs" ON partner_ip_whitelist;
DROP POLICY IF EXISTS "Partners can insert own IPs" ON partner_ip_whitelist;
DROP POLICY IF EXISTS "Partners can delete own IPs" ON partner_ip_whitelist;

-- SELECT: Partners can only view their own whitelisted IPs
CREATE POLICY "Partners can view own IPs" ON partner_ip_whitelist
  FOR SELECT USING (partner_id = auth.uid());

-- INSERT: Partners can only add IPs to their own whitelist
CREATE POLICY "Partners can insert own IPs" ON partner_ip_whitelist
  FOR INSERT WITH CHECK (partner_id = auth.uid());

-- DELETE: Partners can only remove their own whitelisted IPs
CREATE POLICY "Partners can delete own IPs" ON partner_ip_whitelist
  FOR DELETE USING (partner_id = auth.uid());

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_partner ON partner_ip_whitelist(partner_id);

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'partner_ip_whitelist';
