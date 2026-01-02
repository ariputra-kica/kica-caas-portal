-- ============================================
-- KICA CaaS Portal - Demo Data for Testing
-- ============================================
-- Run this in Supabase SQL Editor for testing UI/UX
-- ============================================

DO $$
DECLARE
    partner_uuid UUID;
    client1_id UUID;
    client2_id UUID;
    client3_id UUID;
    client4_id UUID;
    acme1_id UUID;
    acme2_id UUID;
    acme3_id UUID;
    acme4_id UUID;
    acme5_id UUID;
    domain1_id UUID;
    domain2_id UUID;
    domain3_id UUID;
    domain4_id UUID;
    domain5_id UUID;
    domain6_id UUID;
    domain7_id UUID;
    domain8_id UUID;
    domain9_id UUID;
    domain10_id UUID;
    domain11_id UUID;
    domain12_id UUID;
    domain13_id UUID;
    domain14_id UUID;
    domain15_id UUID;
BEGIN
    -- Get Partner ID (assuming single partner for demo)
    SELECT id INTO partner_uuid FROM auth.users LIMIT 1;
    
    IF partner_uuid IS NULL THEN
        RAISE EXCEPTION 'No user found in auth.users. Please login first.';
    END IF;
    
    RAISE NOTICE 'Using Partner ID: %', partner_uuid;

    -- ============================================
    -- CLEANUP EXISTING DATA
    -- ============================================
    DELETE FROM certificates;
    DELETE FROM transactions;
    DELETE FROM domains;
    DELETE FROM acme_accounts;
    DELETE FROM clients WHERE partner_id = partner_uuid;
    DELETE FROM audit_logs WHERE actor_id = partner_uuid;
    
    RAISE NOTICE 'Cleaned up existing data';

    -- ============================================
    -- CREATE CLIENTS
    -- ============================================
    
    -- Client 1: PT KICA Indonesia (Enterprise)
    INSERT INTO clients (id, partner_id, name, company_name, email, phone, client_type, status)
    VALUES (gen_random_uuid(), partner_uuid, 'Ahmad Rizki', 'PT KICA Indonesia', 'ahmad.rizki@kica.co.id', '+62815123456', 'organization', 'active')
    RETURNING id INTO client1_id;
    
    -- Client 2: Tokopedia (Enterprise)
    INSERT INTO clients (id, partner_id, name, company_name, email, phone, client_type, status)
    VALUES (gen_random_uuid(), partner_uuid, 'Sarah Wijaya', 'PT Tokopedia', 'sarah.w@tokopedia.com', '+62811234567', 'organization', 'active')
    RETURNING id INTO client2_id;
    
    -- Client 3: Gojek (Enterprise)
    INSERT INTO clients (id, partner_id, name, company_name, email, phone, client_type, status)
    VALUES (gen_random_uuid(), partner_uuid, 'Budi Santoso', 'PT Gojek Indonesia', 'budi.s@gojek.com', '+62812987654', 'organization', 'active')
    RETURNING id INTO client3_id;
    
    -- Client 4: Individual Developer
    INSERT INTO clients (id, partner_id, name, company_name, email, phone, client_type, status)
    VALUES (gen_random_uuid(), partner_uuid, 'Dimas Prayoga', NULL, 'dimas.dev@gmail.com', '+62813567890', 'personal', 'active')
    RETURNING id INTO client4_id;
    
    RAISE NOTICE 'Created 4 Clients';

    -- ============================================
    -- CREATE ACME ACCOUNTS
    -- ============================================
    
    -- ACME Account 1: KICA Production (Active)
    INSERT INTO acme_accounts (id, client_id, account_name, status, subscription_years, eab_key_id, eab_hmac_key, server_url, acme_account_id, start_date, end_date, certificate_type)
    VALUES (gen_random_uuid(), client1_id, 'KICA Production', 'active', 2, 'EAB-KICA-PROD-001', 'hmac-secret-key-kica-prod-demo', 'https://acme.sectigo.com/v2/DV', 'acme-kica-prod-001', NOW() - INTERVAL '6 months', NOW() + INTERVAL '18 months', 'DV')
    RETURNING id INTO acme1_id;
    
    -- ACME Account 2: KICA Staging (Active)
    INSERT INTO acme_accounts (id, client_id, account_name, status, subscription_years, eab_key_id, eab_hmac_key, server_url, acme_account_id, start_date, end_date, certificate_type)
    VALUES (gen_random_uuid(), client1_id, 'KICA Staging', 'active', 1, 'EAB-KICA-STG-002', 'hmac-secret-key-kica-stg-demo', 'https://acme.sectigo.com/v2/DV', 'acme-kica-stg-002', NOW() - INTERVAL '3 months', NOW() + INTERVAL '9 months', 'DV')
    RETURNING id INTO acme2_id;
    
    -- ACME Account 3: Tokopedia (Active)
    INSERT INTO acme_accounts (id, client_id, account_name, status, subscription_years, eab_key_id, eab_hmac_key, server_url, acme_account_id, start_date, end_date, certificate_type)
    VALUES (gen_random_uuid(), client2_id, 'Tokopedia SSL', 'active', 1, 'EAB-TOPED-001', 'hmac-secret-key-tokopedia-demo', 'https://acme.sectigo.com/v2/DV', 'acme-tokopedia-001', NOW() - INTERVAL '2 months', NOW() + INTERVAL '10 months', 'DV')
    RETURNING id INTO acme3_id;
    
    -- ACME Account 4: Gojek (Suspended)
    INSERT INTO acme_accounts (id, client_id, account_name, status, subscription_years, eab_key_id, eab_hmac_key, server_url, acme_account_id, start_date, end_date, certificate_type)
    VALUES (gen_random_uuid(), client3_id, 'Gojek API Gateway', 'suspended', 1, 'EAB-GOJEK-001', 'hmac-secret-key-gojek-demo', 'https://acme.sectigo.com/v2/DV', 'acme-gojek-001', NOW() - INTERVAL '4 months', NOW() + INTERVAL '8 months', 'DV')
    RETURNING id INTO acme4_id;
    
    -- ACME Account 5: Dimas (Pending)
    INSERT INTO acme_accounts (id, client_id, account_name, status, subscription_years, eab_key_id, eab_hmac_key, server_url, acme_account_id, start_date, end_date, certificate_type)
    VALUES (gen_random_uuid(), client4_id, 'Personal Projects', 'pending_start', 1, 'EAB-DIMAS-001', 'hmac-secret-key-dimas-demo', 'https://acme.sectigo.com/v2/DV', 'acme-dimas-001', NULL, NULL, 'DV')
    RETURNING id INTO acme5_id;
    
    RAISE NOTICE 'Created 5 ACME Accounts';

    -- ============================================
    -- CREATE DOMAINS
    -- ============================================
    
    -- KICA Production domains
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme1_id, 'kica.co.id', 'single', 'active', 'paid', 50.00, '7001001', NOW() - INTERVAL '5 months')
    RETURNING id INTO domain1_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme1_id, 'www.kica.co.id', 'single', 'active', 'paid', 50.00, '7001002', NOW() - INTERVAL '5 months')
    RETURNING id INTO domain2_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme1_id, 'api.kica.co.id', 'single', 'active', 'paid', 50.00, '7001003', NOW() - INTERVAL '4 months')
    RETURNING id INTO domain3_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme1_id, '*.kica.co.id', 'wildcard', 'active', 'paid', 150.00, '7001004', NOW() - INTERVAL '3 months')
    RETURNING id INTO domain4_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme1_id, 'portal.kica.co.id', 'single', 'active', 'paid', 50.00, '7001005', NOW() - INTERVAL '2 months')
    RETURNING id INTO domain5_id;
    
    -- KICA Staging domains
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme2_id, 'staging.kica.co.id', 'single', 'active', 'paid', 50.00, '7002001', NOW() - INTERVAL '2 months')
    RETURNING id INTO domain6_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme2_id, 'dev.kica.co.id', 'single', 'active', 'paid', 50.00, '7002002', NOW() - INTERVAL '2 months')
    RETURNING id INTO domain7_id;
    
    -- Tokopedia domains
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme3_id, 'tokopedia.com', 'single', 'active', 'paid', 50.00, '7003001', NOW() - INTERVAL '2 months')
    RETURNING id INTO domain8_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme3_id, 'www.tokopedia.com', 'single', 'active', 'paid', 50.00, '7003002', NOW() - INTERVAL '2 months')
    RETURNING id INTO domain9_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme3_id, 'seller.tokopedia.com', 'single', 'active', 'paid', 50.00, '7003003', NOW() - INTERVAL '1 month')
    RETURNING id INTO domain10_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme3_id, '*.tokopedia.com', 'wildcard', 'active', 'paid', 150.00, '7003004', NOW() - INTERVAL '1 month')
    RETURNING id INTO domain11_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme3_id, 'payment.tokopedia.com', 'single', 'active', 'paid', 50.00, '7003005', NOW() - INTERVAL '15 days')
    RETURNING id INTO domain12_id;
    
    -- Gojek domains
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme4_id, 'gojek.com', 'single', 'active', 'paid', 50.00, '7004001', NOW() - INTERVAL '4 months')
    RETURNING id INTO domain13_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme4_id, 'api.gojek.com', 'single', 'active', 'paid', 50.00, '7004002', NOW() - INTERVAL '3 months')
    RETURNING id INTO domain14_id;
    
    INSERT INTO domains (id, acme_account_id, domain_name, domain_type, status, billing_type, price_charged, order_number, added_at)
    VALUES (gen_random_uuid(), acme4_id, '*.gojek.com', 'wildcard', 'active', 'paid', 150.00, '7004003', NOW() - INTERVAL '2 months')
    RETURNING id INTO domain15_id;
    
    RAISE NOTICE 'Created 15 Domains';

    -- ============================================
    -- CREATE CERTIFICATES
    -- ============================================
    
    -- Certificates for KICA domains (various expiry dates)
    INSERT INTO certificates (id, domain_id, order_number, certificate_id, serial_number, valid_not_before, valid_not_after, status_code, status_desc)
    VALUES 
        -- kica.co.id - Valid, expiring in 60 days
        (gen_random_uuid(), domain1_id, '7001001', 'CERT-KICA-001', 'SN-KICA-001-ABC123', NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 6, 'Valid'),
        -- www.kica.co.id - Valid, expiring in 90 days
        (gen_random_uuid(), domain2_id, '7001002', 'CERT-KICA-002', 'SN-KICA-002-DEF456', NOW() - INTERVAL '30 days', NOW() + INTERVAL '90 days', 6, 'Valid'),
        -- api.kica.co.id - Valid, expiring in 5 days (URGENT!)
        (gen_random_uuid(), domain3_id, '7001003', 'CERT-KICA-003', 'SN-KICA-003-GHI789', NOW() - INTERVAL '85 days', NOW() + INTERVAL '5 days', 6, 'Valid'),
        -- *.kica.co.id - Valid, expiring in 20 days (WARNING)
        (gen_random_uuid(), domain4_id, '7001004', 'CERT-KICA-004', 'SN-KICA-004-JKL012', NOW() - INTERVAL '70 days', NOW() + INTERVAL '20 days', 6, 'Valid'),
        -- portal.kica.co.id - Valid, expiring in 120 days
        (gen_random_uuid(), domain5_id, '7001005', 'CERT-KICA-005', 'SN-KICA-005-MNO345', NOW() - INTERVAL '30 days', NOW() + INTERVAL '120 days', 6, 'Valid');
    
    -- Certificates for Tokopedia (healthy expiry)
    INSERT INTO certificates (id, domain_id, order_number, certificate_id, serial_number, valid_not_before, valid_not_after, status_code, status_desc)
    VALUES 
        (gen_random_uuid(), domain8_id, '7003001', 'CERT-TOPED-001', 'SN-TOPED-001-AAA111', NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 6, 'Valid'),
        (gen_random_uuid(), domain9_id, '7003002', 'CERT-TOPED-002', 'SN-TOPED-002-BBB222', NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 6, 'Valid'),
        (gen_random_uuid(), domain10_id, '7003003', 'CERT-TOPED-003', 'SN-TOPED-003-CCC333', NOW() - INTERVAL '20 days', NOW() + INTERVAL '70 days', 6, 'Valid'),
        (gen_random_uuid(), domain11_id, '7003004', 'CERT-TOPED-004', 'SN-TOPED-004-DDD444', NOW() - INTERVAL '20 days', NOW() + INTERVAL '70 days', 6, 'Valid'),
        (gen_random_uuid(), domain12_id, '7003005', 'CERT-TOPED-005', 'SN-TOPED-005-EEE555', NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days', 6, 'Valid');
    
    -- Certificates for Gojek (some pending)
    INSERT INTO certificates (id, domain_id, order_number, certificate_id, serial_number, valid_not_before, valid_not_after, status_code, status_desc)
    VALUES 
        (gen_random_uuid(), domain13_id, '7004001', 'CERT-GOJEK-001', 'SN-GOJEK-001-XXX111', NOW() - INTERVAL '90 days', NOW() + INTERVAL '1 day', 6, 'Valid'),
        (gen_random_uuid(), domain14_id, '7004002', NULL, NULL, NULL, NULL, 9, 'Pending');
    
    RAISE NOTICE 'Created 12 Certificates';

    -- ============================================
    -- CREATE TRANSACTIONS
    -- ============================================
    
    INSERT INTO transactions (id, partner_id, acme_account_id, domain_id, type, description, amount, status, sectigo_order_number, created_at)
    SELECT 
        gen_random_uuid(), partner_uuid, d.acme_account_id, d.id, 'add_domain', 'Added domain: ' || d.domain_name, d.price_charged, 'success', d.order_number, d.added_at
    FROM domains d;
    
    RAISE NOTICE 'Created Transactions';

    -- ============================================
    -- SUMMARY
    -- ============================================
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Demo Data Population Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Clients: 4 (3 Enterprise, 1 Individual)';
    RAISE NOTICE 'ACME Accounts: 5 (3 Active, 1 Suspended, 1 Pending)';
    RAISE NOTICE 'Domains: 15';
    RAISE NOTICE 'Certificates: 12 (10 Valid, 1 Expiring Soon, 1 Pending)';
    RAISE NOTICE '============================================';

END $$;

-- Verification
SELECT 'Clients' as entity, COUNT(*) as count FROM clients
UNION ALL
SELECT 'ACME Accounts', COUNT(*) FROM acme_accounts
UNION ALL
SELECT 'Domains', COUNT(*) FROM domains
UNION ALL
SELECT 'Certificates', COUNT(*) FROM certificates
UNION ALL
SELECT 'Transactions', COUNT(*) FROM transactions;
