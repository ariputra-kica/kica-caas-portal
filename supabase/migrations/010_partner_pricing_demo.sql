-- ============================================
-- KICA CaaS Portal - Partner Pricing Assignment
-- ============================================
-- Assign pricing tiers to partners and demo pricing queries
-- ============================================

-- View current partners and their pricing
SELECT 
    p.id,
    p.company_name,
    p.pricing_class as tier_code,
    pt.tier_name,
    pt.tier_level,
    pt.dv_single_annual,
    pt.dv_wildcard_annual,
    pt.ov_single_annual,
    pt.ov_wildcard_annual
FROM partners p
LEFT JOIN pricing_tiers pt ON p.pricing_class = pt.tier_code
ORDER BY p.created_at;

-- Example: Update specific partner to different tier
-- UPDATE partners SET pricing_class = 'GOLD' 
-- WHERE id = '2bea804a-5023-4bc9-b139-10138b9a0543';

-- Example: Get pricing for current partner with ACME account context
-- This shows how to calculate price when adding a domain
SELECT 
    p.company_name as partner,
    p.pricing_class as tier,
    a.certificate_type,
    
    -- Annual prices for this partner's tier
    get_annual_price(p.pricing_class, 'DV', 'single') as dv_single_annual,
    get_annual_price(p.pricing_class, 'DV', 'wildcard') as dv_wildcard_annual,
    get_annual_price(p.pricing_class, 'OV', 'single') as ov_single_annual,
    get_annual_price(p.pricing_class, 'OV', 'wildcard') as ov_wildcard_annual,
    
    -- Example: Prorated price for adding domain with 180 days remaining
    calculate_prorated_price(p.pricing_class, a.certificate_type, 'single', 180) as price_180days,
    calculate_prorated_price(p.pricing_class, a.certificate_type, 'wildcard', 180) as price_wildcard_180days
    
FROM partners p
JOIN clients c ON c.partner_id = p.id
JOIN acme_accounts a ON a.client_id = c.id
WHERE p.id = '2bea804a-5023-4bc9-b139-10138b9a0543'
LIMIT 1;

-- Example: Calculate price for adding a domain RIGHT NOW
-- Based on ACME account's remaining subscription time
DO $$
DECLARE
    v_partner_tier TEXT;
    v_cert_type TEXT;
    v_domain_type TEXT := 'single';  -- or 'wildcard'
    v_remaining_days INTEGER;
    v_price NUMERIC(15,2);
BEGIN
    -- Get partner's pricing tier
    SELECT pricing_class INTO v_partner_tier 
    FROM partners WHERE id = '2bea804a-5023-4bc9-b139-10138b9a0543';
    
    -- Get ACME account's certificate type and calculate remaining days
    SELECT 
        certificate_type,
        GREATEST(0, EXTRACT(DAY FROM (end_date - NOW()))::INTEGER)
    INTO v_cert_type, v_remaining_days
    FROM acme_accounts
    WHERE id IN (
        SELECT id FROM acme_accounts 
        WHERE client_id IN (
            SELECT id FROM clients WHERE partner_id = '2bea804a-5023-4bc9-b139-10138b9a0543'
        )
        LIMIT 1
    );
    
    -- Calculate prorated price
    v_price := calculate_prorated_price(v_partner_tier, v_cert_type, v_domain_type, v_remaining_days);
    
    RAISE NOTICE 'Partner Tier: %', v_partner_tier;
    RAISE NOTICE 'Certificate Type: %', v_cert_type;
    RAISE NOTICE 'Domain Type: %', v_domain_type;
    RAISE NOTICE 'Remaining Days: %', v_remaining_days;
    RAISE NOTICE 'Prorated Price: $%', v_price;
END $$;

-- Show pricing comparison across all tiers
SELECT 
    tier_name,
    tier_code,
    dv_single_annual as "DV Single",
    dv_wildcard_annual as "DV Wildcard",
    ov_single_annual as "OV Single",
    ov_wildcard_annual as "OV Wildcard",
    
    -- Show 6-month prorated prices
    ROUND(dv_single_annual * 180 / 365, 2) as "DV Single (6mo)",
    ROUND(dv_wildcard_annual * 180 / 365, 2) as "DV Wildcard (6mo)",
    ROUND(ov_single_annual * 180 / 365, 2) as "OV Single (6mo)",
    ROUND(ov_wildcard_annual * 180 / 365, 2) as "OV Wildcard (6mo)"
FROM pricing_tiers
ORDER BY tier_level;
