-- ============================================
-- KICA CaaS Portal - Billing Preferences
-- ============================================
-- Table for partner billing and notification settings
-- Supports auto-confirm statement workflow
-- ============================================

-- Create billing preferences table
CREATE TABLE IF NOT EXISTS billing_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Billing Contact
  billing_email TEXT NOT NULL,
  billing_phone TEXT,
  
  -- Monthly Statement Workflow
  auto_confirm_statement BOOLEAN DEFAULT TRUE,
  statement_reviewer_email TEXT, -- Receives draft statement on 1st of month
  
  -- Email Notification Settings
  notify_on_expiry BOOLEAN DEFAULT TRUE,        -- Certificate expiry alerts (H-30, H-7)
  notify_on_new_client BOOLEAN DEFAULT TRUE,    -- New client registration
  notify_monthly_report BOOLEAN DEFAULT FALSE,  -- Monthly usage summary
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_billing_preferences_partner ON billing_preferences(partner_id);

-- Enable RLS
ALTER TABLE billing_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Partners can view own billing preferences" ON billing_preferences;
CREATE POLICY "Partners can view own billing preferences" ON billing_preferences
  FOR SELECT USING (partner_id = auth.uid());

DROP POLICY IF EXISTS "Partners can update own billing preferences" ON billing_preferences;
CREATE POLICY "Partners can update own billing preferences" ON billing_preferences
  FOR UPDATE USING (partner_id = auth.uid());

DROP POLICY IF EXISTS "Partners can insert own billing preferences" ON billing_preferences;
CREATE POLICY "Partners can insert own billing preferences" ON billing_preferences
  FOR INSERT WITH CHECK (partner_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_billing_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_billing_preferences_updated_at ON billing_preferences;
CREATE TRIGGER trigger_update_billing_preferences_updated_at
    BEFORE UPDATE ON billing_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_preferences_updated_at();

-- Seed default preferences for existing partners
INSERT INTO billing_preferences (
  partner_id,
  billing_email,
  statement_reviewer_email,
  auto_confirm_statement,
  notify_on_expiry,
  notify_on_new_client,
  notify_monthly_report
)
SELECT 
  p.id,
  -- Use partner's auth email as default billing email
  (SELECT email FROM auth.users WHERE id = p.id),
  (SELECT email FROM auth.users WHERE id = p.id),
  TRUE,  -- Default: auto-confirm enabled
  TRUE,  -- Default: expiry notifications enabled
  TRUE,  -- Default: new client notifications enabled
  FALSE  -- Default: monthly reports disabled
FROM partners p
WHERE NOT EXISTS (
  SELECT 1 FROM billing_preferences WHERE partner_id = p.id
)
ON CONFLICT (partner_id) DO NOTHING;

-- Verify
SELECT 
  p.company_name,
  bp.billing_email,
  bp.auto_confirm_statement,
  bp.statement_reviewer_email
FROM partners p
LEFT JOIN billing_preferences bp ON p.id = bp.partner_id
ORDER BY p.created_at DESC
LIMIT 5;
