-- ============================================
-- KICA CaaS Portal - Settlement Schema Update
-- ============================================
-- Add fields for discrepancy workflow
-- ============================================

-- Add new columns for discrepancy workflow
ALTER TABLE settlements 
ADD COLUMN IF NOT EXISTS discrepancy_note TEXT,
ADD COLUMN IF NOT EXISTS admin_resolution_note TEXT,
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Update status check constraint to include 'paid' status
ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_status_check;
ALTER TABLE settlements ADD CONSTRAINT settlements_status_check 
CHECK (status IN ('draft', 'pending', 'escalated', 'confirmed', 'auto_approved', 'invoiced', 'paid'));

-- Add RLS policy for settlements
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Partners can view own settlements
DROP POLICY IF EXISTS "Partners can view own settlements" ON settlements;
CREATE POLICY "Partners can view own settlements" ON settlements
  FOR SELECT USING (partner_id = auth.uid());

-- Partners can update own settlements (for confirm/escalate)
DROP POLICY IF EXISTS "Partners can update own settlements" ON settlements;
CREATE POLICY "Partners can update own settlements" ON settlements
  FOR UPDATE USING (partner_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settlements_partner ON settlements(partner_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(period_start, period_end);

-- Create sample settlement data for testing
INSERT INTO settlements (
    partner_id, 
    period_start, 
    period_end, 
    total_amount, 
    status, 
    created_at
)
SELECT 
    '2bea804a-5023-4bc9-b139-10138b9a0543',
    DATE_TRUNC('month', NOW() - INTERVAL '1 month')::DATE,
    (DATE_TRUNC('month', NOW()) - INTERVAL '1 day')::DATE,
    500.00,
    'draft',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM settlements 
    WHERE partner_id = '2bea804a-5023-4bc9-b139-10138b9a0543'
    AND period_start = DATE_TRUNC('month', NOW() - INTERVAL '1 month')::DATE
);

-- Verify
SELECT * FROM settlements ORDER BY created_at DESC LIMIT 5;
