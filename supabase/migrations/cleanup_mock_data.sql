-- ============================================
-- KICA CaaS Portal - Mock Data Cleanup Scripts
-- ============================================
-- Purpose: Clean up mocked data before production deployment
-- Target: Remove test data created during mock mode development
-- 
-- IMPORTANT: Always backup database before running cleanup!
-- Run: pg_dump -h <host> -U <user> -d <database> > backup_$(date +%Y%m%d).sql
--
-- Created: 2026-01-02
-- For: CEO Demo Preparation (Jan 5, 2026)
-- ============================================

-- ============================================
-- SECTION 1: Data Validation Queries
-- ============================================
-- Run these first to see what will be affected

-- Check mock ACME accounts
SELECT 
    'Mock ACME Accounts' as category,
    COUNT(*) as count,
    STRING_AGG(DISTINCT client_id::text, ', ') as affected_clients
FROM acme_accounts 
WHERE acme_account_id LIKE 'MOCK_%'
GROUP BY category;

-- Check mock transactions
SELECT 
    'Mock Transactions' as category,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM transactions 
WHERE order_number BETWEEN 1000000 AND 9999999
GROUP BY category;

-- Check domains linked to mock accounts
SELECT 
    'Domains (Mock Accounts)' as category,
    COUNT(*) as count
FROM domains 
WHERE acme_account_id LIKE 'MOCK_%'
GROUP BY category;

-- Summary view
SELECT 
    'TOTAL RECORDS TO CLEANUP' as summary,
    (SELECT COUNT(*) FROM acme_accounts WHERE acme_account_id LIKE 'MOCK_%') as mock_accounts,
    (SELECT COUNT(*) FROM domains WHERE acme_account_id LIKE 'MOCK_%') as mock_domains,
    (SELECT COUNT(*) FROM transactions WHERE order_number BETWEEN 1000000 AND 9999999) as mock_transactions;

-- ============================================
-- SECTION 2: SOFT DELETE (Recommended for Staging)
-- ============================================
-- This approach keeps data but marks it as archived
-- Safer option - can be reversed if needed

BEGIN;

-- Archive mock ACME accounts
UPDATE acme_accounts 
SET 
    status = 'archived',
    updated_at = NOW()
WHERE acme_account_id LIKE 'MOCK_%';

-- Get affected count
SELECT 'Archived ACME Accounts:' as action, COUNT(*) as count
FROM acme_accounts 
WHERE acme_account_id LIKE 'MOCK_%' AND status = 'archived';

-- Archive mock transactions
UPDATE transactions 
SET 
    status = 'cancelled',
    updated_at = NOW()
WHERE order_number BETWEEN 1000000 AND 9999999;

-- Get affected count
SELECT 'Archived Transactions:' as action, COUNT(*) as count
FROM transactions 
WHERE order_number BETWEEN 1000000 AND 9999999 AND status = 'cancelled';

-- Archive domains linked to mock accounts
UPDATE domains
SET 
    status = 'removed',
    updated_at = NOW()
WHERE acme_account_id LIKE 'MOCK_%';

-- Get affected count
SELECT 'Archived Domains:' as action, COUNT(*) as count
FROM domains 
WHERE acme_account_id LIKE 'MOCK_%' AND status = 'removed';

-- Review changes before committing
SELECT 'Review the changes above. If correct, run COMMIT; If not, run ROLLBACK;' as instruction;

-- COMMIT;  -- Uncomment to apply changes
-- ROLLBACK;  -- Uncomment to undo changes

-- ============================================
-- SECTION 3: HARD DELETE (Clean Slate for Production)
-- ============================================
-- WARNING: This PERMANENTLY deletes data!
-- Only use this if you want a completely clean database
-- BACKUP FIRST!

-- Uncomment the entire block below to execute hard delete

/*
BEGIN;

-- Delete domains first (foreign key constraint)
DELETE FROM domains 
WHERE acme_account_id LIKE 'MOCK_%';

SELECT 'Deleted Domains:' as action, ROW_COUNT() as count;

-- Delete mock transactions
DELETE FROM transactions 
WHERE order_number BETWEEN 1000000 AND 9999999;

SELECT 'Deleted Transactions:' as action, ROW_COUNT() as count;

-- Delete mock ACME accounts
DELETE FROM acme_accounts 
WHERE acme_account_id LIKE 'MOCK_%';

SELECT 'Deleted ACME Accounts:' as action, ROW_COUNT() as count;

-- Review changes before committing
SELECT 'Review the changes above. If correct, run COMMIT; If not, run ROLLBACK;' as instruction;

-- COMMIT;  -- Uncomment to apply changes
-- ROLLBACK;  -- Uncomment to undo changes
*/

-- ============================================
-- SECTION 4: Post-Cleanup Verification
-- ============================================
-- Run these after cleanup to verify success

-- Verify no mock data remains
SELECT 
    'Post-Cleanup Verification' as check_type,
    (SELECT COUNT(*) FROM acme_accounts WHERE acme_account_id LIKE 'MOCK_%') as remaining_mock_accounts,
    (SELECT COUNT(*) FROM transactions WHERE order_number BETWEEN 1000000 AND 9999999) as remaining_mock_transactions,
    (SELECT COUNT(*) FROM domains WHERE acme_account_id LIKE 'MOCK_%') as remaining_mock_domains;

-- Check production data is intact
SELECT 
    'Production Data Check' as check_type,
    (SELECT COUNT(*) FROM acme_accounts WHERE acme_account_id NOT LIKE 'MOCK_%') as real_accounts,
    (SELECT COUNT(*) FROM transactions WHERE order_number NOT BETWEEN 1000000 AND 9999999) as real_transactions,
    (SELECT COUNT(*) FROM domains WHERE acme_account_id NOT LIKE 'MOCK_%') as real_domains;

-- ============================================
-- SECTION 5: Restore from Soft Delete (If Needed)
-- ============================================
-- Use this to restore data if soft delete was done by mistake

/*
BEGIN;

-- Restore archived ACME accounts
UPDATE acme_accounts 
SET 
    status = 'active',
    updated_at = NOW()
WHERE acme_account_id LIKE 'MOCK_%' AND status = 'archived';

-- Restore archived transactions
UPDATE transactions 
SET 
    status = 'success',
    updated_at = NOW()
WHERE order_number BETWEEN 1000000 AND 9999999 AND status = 'cancelled';

-- Restore archived domains
UPDATE domains
SET 
    status = 'active',
    updated_at = NOW()
WHERE acme_account_id LIKE 'MOCK_%' AND status = 'removed';

COMMIT;
*/

-- ============================================
-- USAGE INSTRUCTIONS
-- ============================================
/*
STEP 1: BACKUP DATABASE
  pg_dump -h your-host -U your-user -d kica_caas > backup_before_cleanup.sql

STEP 2: RUN VALIDATION (Section 1)
  - Review what will be affected
  - Confirm the counts match expectations

STEP 3: CHOOSE CLEANUP METHOD
  Option A: Soft Delete (Section 2) - Recommended for staging
    - Marks data as archived
    - Can be restored if needed
    - Run the BEGIN block
    - Review output
    - Run COMMIT if correct, ROLLBACK if not

  Option B: Hard Delete (Section 3) - For production clean slate
    - Permanently deletes data
    - Cannot be undone (unless restored from backup)
    - Uncomment the entire block
    - Run carefully
    - COMMIT only if you're absolutely sure

STEP 4: VERIFY (Section 4)
  - Confirm mock data is gone
  - Confirm production data is intact

STEP 5: (Optional) RESTORE (Section 5)
  - Only if you need to undo soft delete
  - Uncomment and run the restore block

TIMING RECOMMENDATION:
  - Staging: Run soft delete after testing complete (Sat night)
  - Production: Start with clean database (no mock data)
*/
