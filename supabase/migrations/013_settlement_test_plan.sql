# Settlement Generation Cron - Test Instructions

## 1. Timezone Edge Case Test

Test that transactions at 23:30 WIB on last day of month are included in that month's settlement.

```sql
-- Insert test transaction at 23:30 WIB on Dec 31, 2024
INSERT INTO transactions (
    partner_id,
    acme_account_id,
    domain_id,
    type,
    description,
    amount,
    status,
    created_at
) 
SELECT 
    '2bea804a-5023-4bc9-b139-10138b9a0543',
    (SELECT id FROM acme_accounts LIMIT 1),
    (SELECT id FROM domains LIMIT 1),
    'add_domain',
    'Timezone edge case test - 23:30 WIB Dec 31',
    50.00,
    'success',
    '2024-12-31 23:30:00+07'::TIMESTAMPTZ;

-- Run settlement generation
SELECT * FROM generate_monthly_settlements();

-- Verify the transaction is included
SELECT 
    s.period_start,
    s.period_end,
    s.total_amount,
    COUNT(t.id) as transaction_count
FROM settlements s
JOIN transactions t ON t.partner_id = s.partner_id
    AND t.created_at >= s.period_start::TIMESTAMPTZ
    AND t.created_at <= s.period_end::TIMESTAMPTZ
WHERE s.partner_id = '2bea804a-5023-4bc9-b139-10138b9a0543'
    AND s.period_start = '2024-12-01'
GROUP BY s.period_start, s.period_end, s.total_amount;
```

**Expected**: Transaction with `created_at = '2024-12-31 23:30:00+07'` should be included in December 2024 settlement.

---

## 2. Zero Settlement Test

Test that $0 settlements are skipped when add_domain = refund.

```sql
-- Setup: Create partner with balanced transactions
DO $$
DECLARE
    test_partner_id UUID := gen_random_uuid();
    test_acme_id UUID;
    test_domain_id UUID;
BEGIN
    -- Insert test partner
    INSERT INTO partners (id, email, status, payment_type, credit_limit)
    VALUES (test_partner_id, 'zero-test@example.com', 'active', 'post_paid', 10000);
    
    -- Get or create ACME account
    SELECT id INTO test_acme_id FROM acme_accounts LIMIT 1;
    
    -- Get or create domain
    SELECT id INTO test_domain_id FROM domains LIMIT 1;
    
    -- Add domain transaction: $100
    INSERT INTO transactions (partner_id, acme_account_id, domain_id, type, amount, status, created_at)
    VALUES (test_partner_id, test_acme_id, test_domain_id, 'add_domain', 100.00, 'success', NOW() - INTERVAL '15 days');
    
    -- Refund transaction: $100
    INSERT INTO transactions (partner_id, acme_account_id, domain_id, type, amount, status, created_at)
    VALUES (test_partner_id, test_acme_id, test_domain_id, 'refund', 100.00, 'success', NOW() - INTERVAL '10 days');
    
    RAISE NOTICE 'Created test partner: %', test_partner_id;
END $$;

-- Run settlement generation
SELECT * FROM generate_monthly_settlements();

-- Verify NO settlement was created for zero-balance partner
SELECT * FROM settlements WHERE total_amount = 0;
```

**Expected**: No settlement record created for partner with $0 net amount (100 - 100 = 0).

---

## 3. Manual API Test

Test the API endpoint using curl or Postman.

```bash
# Set CRON_SECRET in .env.local
# CRON_SECRET=your-secret-key-here

# Test GET (health check)
curl http://localhost:3000/api/cron/generate-settlements

# Test POST (trigger generation)
curl -X POST http://localhost:3000/api/cron/generate-settlements \
  -H "Authorization: Bearer your-secret-key-here"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Settlement generation completed",
  "summary": {
    "partners_processed": 5,
    "settlements_created": 3,
    "skipped_zero_amount": 2
  },
  "timestamp": "2024-12-20T15:21:58.000Z"
}
```

---

## 4. Cron Schedule Verification

```sql
-- Check registered cron jobs
SELECT * FROM cron.job WHERE jobname = 'generate-monthly-settlements';

-- View recent cron job runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-monthly-settlements')
ORDER BY start_time DESC
LIMIT 10;
```
