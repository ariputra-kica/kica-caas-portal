-- ============================================
-- KICA CaaS Portal - 6 Dummy Transactions for December 2024
-- ============================================
-- Run this in Supabase SQL Editor
-- Creates 6 transactions throughout December 2024
-- Includes 1 OV certificate from validated OV ACME Account
-- ============================================

-- First, create an OV ACME Account if not exists
DO $$
DECLARE
    partner_uuid UUID := '2bea804a-5023-4bc9-b139-10138b9a0543';
    client_uuid UUID;
    ov_acme_id UUID;
    dv_acme_id UUID;
    domain1_id UUID;
    domain2_id UUID;
    domain3_id UUID;
    domain4_id UUID;
    domain5_id UUID;
    domain6_id UUID;
BEGIN
    -- Get first client
    SELECT id INTO client_uuid FROM clients WHERE partner_id = partner_uuid LIMIT 1;
    
    IF client_uuid IS NULL THEN
        RAISE EXCEPTION 'No client found. Please create a client first.';
    END IF;
    
    -- Check if OV ACME Account exists, if not create one
    SELECT id INTO ov_acme_id FROM acme_accounts 
    WHERE client_id = client_uuid AND certificate_type = 'OV' LIMIT 1;
    
    IF ov_acme_id IS NULL THEN
        INSERT INTO acme_accounts (
            id, client_id, account_name, status, subscription_years,
            eab_key_id, eab_hmac_key, server_url, acme_account_id,
            start_date, end_date, certificate_type
        ) VALUES (
            gen_random_uuid(), client_uuid, 'OV Production Account', 'active', 2,
            'EAB-OV-PROD-001', 'hmac-secret-key-ov-prod-demo-12345',
            'https://acme.sectigo.com/v2/OV', 'acme-ov-prod-001',
            NOW() - INTERVAL '3 months', NOW() + INTERVAL '21 months', 'OV'
        ) RETURNING id INTO ov_acme_id;
        RAISE NOTICE 'Created OV ACME Account: %', ov_acme_id;
    END IF;
    
    -- Get a DV ACME Account
    SELECT id INTO dv_acme_id FROM acme_accounts 
    WHERE client_id = client_uuid AND (certificate_type = 'DV' OR certificate_type IS NULL) LIMIT 1;
    
    IF dv_acme_id IS NULL THEN
        dv_acme_id := ov_acme_id;  -- Fallback to OV account if no DV
    END IF;
    
    -- Create 6 new domains for the transactions
    -- Domain 1: OV Certificate (Dec 1)
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, price_charged, sectigo_order_number, added_at)
    VALUES (gen_random_uuid(), ov_acme_id, 'secure.enterprise.co.id', 'single', 'active', 250.00, '7010001', '2024-12-01 09:15:00+07')
    RETURNING id INTO domain1_id;
    
    -- Domain 2: DV Certificate (Dec 5)
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, price_charged, sectigo_order_number, added_at)
    VALUES (gen_random_uuid(), dv_acme_id, 'api.startup.io', 'single', 'active', 50.00, '7010002', '2024-12-05 14:30:00+07')
    RETURNING id INTO domain2_id;
    
    -- Domain 3: Wildcard DV (Dec 10)
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, price_charged, sectigo_order_number, added_at)
    VALUES (gen_random_uuid(), dv_acme_id, '*.myapp.dev', 'wildcard', 'active', 150.00, '7010003', '2024-12-10 11:00:00+07')
    RETURNING id INTO domain3_id;
    
    -- Domain 4: DV Certificate (Dec 12)
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, price_charged, sectigo_order_number, added_at)
    VALUES (gen_random_uuid(), dv_acme_id, 'portal.fintech.id', 'single', 'active', 50.00, '7010004', '2024-12-12 16:45:00+07')
    RETURNING id INTO domain4_id;
    
    -- Domain 5: DV Certificate - will be refunded (Dec 15)
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, price_charged, sectigo_order_number, added_at, removed_at)
    VALUES (gen_random_uuid(), dv_acme_id, 'old.legacy-app.com', 'single', 'removed', 50.00, '7010005', '2024-12-15 10:20:00+07', '2024-12-18 09:00:00+07')
    RETURNING id INTO domain5_id;
    
    -- Domain 6: DV Certificate (Dec 19)
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, price_charged, sectigo_order_number, added_at)
    VALUES (gen_random_uuid(), dv_acme_id, 'shop.ecommerce.co.id', 'single', 'active', 50.00, '7010006', '2024-12-19 13:10:00+07')
    RETURNING id INTO domain6_id;
    
    RAISE NOTICE 'Created 6 new domains';
    
    -- Now create 6 transactions
    -- Transaction 1: OV Certificate - Dec 1
    INSERT INTO transactions (id, partner_id, acme_account_id, domain_id, type, description, amount, status, sectigo_order_number, created_at)
    VALUES (gen_random_uuid(), partner_uuid, ov_acme_id, domain1_id, 'add_domain', 'Added OV domain: secure.enterprise.co.id', 250.00, 'success', '7010001', '2024-12-01 09:15:00+07');
    
    -- Transaction 2: DV Certificate - Dec 5
    INSERT INTO transactions (id, partner_id, acme_account_id, domain_id, type, description, amount, status, sectigo_order_number, created_at)
    VALUES (gen_random_uuid(), partner_uuid, dv_acme_id, domain2_id, 'add_domain', 'Added domain: api.startup.io', 50.00, 'success', '7010002', '2024-12-05 14:30:00+07');
    
    -- Transaction 3: Wildcard DV - Dec 10
    INSERT INTO transactions (id, partner_id, acme_account_id, domain_id, type, description, amount, status, sectigo_order_number, created_at)
    VALUES (gen_random_uuid(), partner_uuid, dv_acme_id, domain3_id, 'add_domain', 'Added wildcard domain: *.myapp.dev', 150.00, 'success', '7010003', '2024-12-10 11:00:00+07');
    
    -- Transaction 4: DV Certificate - Dec 12
    INSERT INTO transactions (id, partner_id, acme_account_id, domain_id, type, description, amount, status, sectigo_order_number, created_at)
    VALUES (gen_random_uuid(), partner_uuid, dv_acme_id, domain4_id, 'add_domain', 'Added domain: portal.fintech.id', 50.00, 'success', '7010004', '2024-12-12 16:45:00+07');
    
    -- Transaction 5: DV Certificate (later refunded) - Dec 15
    INSERT INTO transactions (id, partner_id, acme_account_id, domain_id, type, description, amount, status, sectigo_order_number, created_at)
    VALUES (gen_random_uuid(), partner_uuid, dv_acme_id, domain5_id, 'add_domain', 'Added domain: old.legacy-app.com', 50.00, 'success', '7010005', '2024-12-15 10:20:00+07');
    
    -- Transaction 6: Refund for Domain 5 - Dec 18
    INSERT INTO transactions (id, partner_id, acme_account_id, domain_id, type, description, amount, status, sectigo_order_number, created_at)
    VALUES (gen_random_uuid(), partner_uuid, dv_acme_id, domain5_id, 'refund', 'Refund for removed domain: old.legacy-app.com', 50.00, 'success', '7010005', '2024-12-18 09:00:00+07');
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Created 6 Transactions for December 2024!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Dec 1  - OV Certificate (secure.enterprise.co.id) $250';
    RAISE NOTICE 'Dec 5  - DV Certificate (api.startup.io) $50';
    RAISE NOTICE 'Dec 10 - Wildcard DV (*.myapp.dev) $150';
    RAISE NOTICE 'Dec 12 - DV Certificate (portal.fintech.id) $50';
    RAISE NOTICE 'Dec 15 - DV Certificate (old.legacy-app.com) $50';
    RAISE NOTICE 'Dec 18 - Refund (old.legacy-app.com) +$50';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Net Total: $500';

END $$;

-- Verify transactions
SELECT 
    t.created_at::date as date,
    t.type,
    d.domain_name,
    a.certificate_type,
    t.amount,
    t.status
FROM transactions t
LEFT JOIN domains d ON t.domain_id = d.id
LEFT JOIN acme_accounts a ON t.acme_account_id = a.id
WHERE t.partner_id = '2bea804a-5023-4bc9-b139-10138b9a0543'
ORDER BY t.created_at DESC
LIMIT 10;
