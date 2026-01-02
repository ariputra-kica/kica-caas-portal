-- ============================================
-- KICA CaaS Portal - Pricing Tiers Schema
-- ============================================
-- Based on PRD Chapter 2.3: Tiered Pricing Model
-- Pricing Class determines per-partner base pricing
-- Date: December 2024
-- ============================================

-- Create Pricing Tiers table
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_name TEXT UNIQUE NOT NULL,
  tier_code TEXT UNIQUE NOT NULL,      -- "STANDARD", "SILVER", "GOLD"
  tier_level INTEGER NOT NULL,         -- 1=Standard, 2=Silver, 3=Gold (for ranking)
  
  -- Annual base pricing per product type
  dv_single_annual DECIMAL(15,2) NOT NULL,      -- DV Single domain per year
  dv_wildcard_annual DECIMAL(15,2) NOT NULL,    -- DV Wildcard per year
  ov_single_annual DECIMAL(15,2) NOT NULL,      -- OV Single domain per year
  ov_wildcard_annual DECIMAL(15,2) NOT NULL,    -- OV Wildcard per year
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_active ON pricing_tiers(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_code ON pricing_tiers(tier_code);

-- Seed default pricing tiers
-- Pricing based on common SSL market rates
INSERT INTO pricing_tiers (tier_name, tier_code, tier_level, dv_single_annual, dv_wildcard_annual, ov_single_annual, ov_wildcard_annual, description) VALUES
('Standard', 'STANDARD', 1, 50.00, 150.00, 250.00, 500.00, 'Standard pricing tier for regular partners'),
('Silver', 'SILVER', 2, 45.00, 135.00, 225.00, 450.00, 'Silver tier with 10% discount for medium volume partners'),
('Gold', 'GOLD', 3, 40.00, 120.00, 200.00, 400.00, 'Gold tier with 20% discount for high volume partners')
ON CONFLICT (tier_code) DO NOTHING;

-- Update existing partners to use valid uppercase tier codes BEFORE adding FK constraint
UPDATE partners SET pricing_class = 'STANDARD' 
WHERE pricing_class IS NULL 
   OR UPPER(pricing_class) NOT IN ('STANDARD', 'SILVER', 'GOLD');

-- Also update lowercase to uppercase
UPDATE partners SET pricing_class = UPPER(pricing_class)
WHERE pricing_class IN ('standard', 'silver', 'gold');

-- Add foreign key constraint to partners table (if not exists)
-- This ensures pricing_class references a valid tier_code
DO $$
BEGIN
    -- Check if the constraint doesn't exist before adding it
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_partners_pricing_class'
    ) THEN
        ALTER TABLE partners 
        ADD CONSTRAINT fk_partners_pricing_class 
        FOREIGN KEY (pricing_class) 
        REFERENCES pricing_tiers(tier_code);
    END IF;
END $$;

-- Create helper function to get pricing based on tier and product type
CREATE OR REPLACE FUNCTION get_annual_price(
    p_tier_code TEXT,
    p_cert_type TEXT,
    p_domain_type TEXT
) RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_price DECIMAL(15,2);
BEGIN
    SELECT 
        CASE 
            WHEN p_cert_type = 'DV' AND p_domain_type = 'single' THEN dv_single_annual
            WHEN p_cert_type = 'DV' AND p_domain_type = 'wildcard' THEN dv_wildcard_annual
            WHEN p_cert_type = 'OV' AND p_domain_type = 'single' THEN ov_single_annual
            WHEN p_cert_type = 'OV' AND p_domain_type = 'wildcard' THEN ov_wildcard_annual
            ELSE NULL
        END INTO v_price
    FROM pricing_tiers
    WHERE tier_code = p_tier_code AND is_active = TRUE;
    
    RETURN COALESCE(v_price, 0.00);
END;
$$ LANGUAGE plpgsql;

-- Create helper function to calculate prorated price
-- Based on PRD Formula: (Remaining Subscription Days / 365) × Annualized_Base_Price
CREATE OR REPLACE FUNCTION calculate_prorated_price(
    p_tier_code TEXT,
    p_cert_type TEXT,
    p_domain_type TEXT,
    p_remaining_days INTEGER
) RETURNS NUMERIC(15,2) AS $$
DECLARE
    v_annual_price DECIMAL(15,2);
    v_prorated_price DECIMAL(15,2);
BEGIN
    -- Get annual base price
    v_annual_price := get_annual_price(p_tier_code, p_cert_type, p_domain_type);
    
    -- Calculate prorated price
    -- Formula: (Remaining Days / 365) × Annual Price
    v_prorated_price := (p_remaining_days::DECIMAL / 365.0) * v_annual_price;
    
    -- Round to 2 decimal places using CEILING (round up as per PRD)
    -- Using ROUND with 2 decimals for clean output
    RETURN ROUND(v_prorated_price, 2);
END;
$$ LANGUAGE plpgsql;

-- Verification queries
SELECT 
    tier_name,
    tier_code,
    tier_level,
    dv_single_annual,
    dv_wildcard_annual,
    ov_single_annual,
    ov_wildcard_annual,
    is_active
FROM pricing_tiers
ORDER BY tier_level;

-- Test pricing functions
SELECT 
    'Standard DV Single' as product,
    get_annual_price('STANDARD', 'DV', 'single') as annual_price,
    calculate_prorated_price('STANDARD', 'DV', 'single', 180) as prorated_6months;

SELECT 
    'Gold OV Wildcard' as product,
    get_annual_price('GOLD', 'OV', 'wildcard') as annual_price,
    calculate_prorated_price('GOLD', 'OV', 'wildcard', 90) as prorated_3months;

-- COMMENT: This migration adds:
-- 1. pricing_tiers table for managing tiered pricing
-- 2. Default tiers (Standard, Silver, Gold) with market-competitive pricing
-- 3. Helper functions for price calculation
-- 4. Foreign key constraint to ensure valid pricing_class
