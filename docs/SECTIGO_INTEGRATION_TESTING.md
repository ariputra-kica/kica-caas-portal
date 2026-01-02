# Sectigo CaaS API Integration - Testing Guide

> **Target:** CEO Demo - Sunday, January 5, 2026  
> **Last Updated:** January 2, 2026  
> **Status:** Production-Ready Testing Phase

---

## Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Local Testing (Friday, Jan 3)](#local-testing-friday-jan-3)
3. [Staging Testing (Saturday, Jan 4)](#staging-testing-saturday-jan-4)
4. [Production Deployment (Saturday Night, Jan 4)](#production-deployment-saturday-night-jan-4)
5. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
6. [Rollback Procedures](#rollback-procedures)

---

## Pre-Testing Setup

### ✅ Checklist Before Starting

- [ ] Git repository initialized with checkpoint
- [ ] Sectigo API credentials obtained
- [ ] `.env.local` file created (copy from `env.example`)
- [ ] Supabase project accessible
- [ ] Postman collection ready (`docs/postman/KICA_CaaS_Staging_QA.postman_collection.json`)

### 📋 Required Credentials

```bash
# Add these to .env.local
SECTIGO_LOGIN_NAME=your_actual_username
SECTIGO_LOGIN_PASSWORD=your_actual_password
ENABLE_SECTIGO_MOCK=false  # IMPORTANT: Set to false for real API testing
```

---

## Local Testing (Friday, Jan 3)

**Environment:** `localhost:3000`  
**Database:** Supabase Staging/Development  
**Duration:** 3-4 hours  
**Goal:** Verify API integration works correctly before deployment

### Step 1: Environment Setup

```bash
# Navigate to project directory
cd "c:\Users\DESKTOP-OFFICE\AI Workspaces\KICA CaaS\KICA-CAAS\kica-caas-portal"

# Verify .env.local exists and has correct values
cat .env.local | grep ENABLE_SECTIGO_MOCK
# Should show: ENABLE_SECTIGO_MOCK=false

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
```

### Step 2: Verify Mock Mode is OFF

1. Open browser to `http://localhost:3000`
2. Open Developer Console (F12)
3. Look for log messages:
   - ✅ Should see: `[SECTIGO API]` (production mode)
   - ❌ Should NOT see: `[SECTIGO MOCK]` (mock mode)

### Step 3: Test ACME Account Creation

**Test Case:** Create new ACME account with real API

1. **Navigate:** Login → Clients → Select a client → ACME Accounts tab
2. **Action:** Click "Create New ACME Account"
3. **Fill Form:**
   - Validation Type: DV or OV
   - Duration: 1 year
4. **Submit** and wait for response

**Expected Results:**
- ✅ Success message appears
- ✅ ACME Account ID is Base64 format (NOT `MOCK_xxxx`)
- ✅ EAB credentials generated
- ✅ Record saved to Supabase
- ✅ Console shows `[SECTIGO API] PREREGISTER - SUCCESS`

**Validation Query:**
```sql
SELECT acme_account_id, status, created_at 
FROM acme_accounts 
WHERE acme_account_id NOT LIKE 'MOCK_%'
ORDER BY created_at DESC 
LIMIT 1;
```

### Step 4: Test Add Domain

**Test Case:** Add domain to subscription

1. **Navigate:** Select ACME Account → Domains tab
2. **Action:** Click "Add Domain"
3. **Fill Form:**
   - Domain Name: `test-local.yourdomain.com`
   - Validation Method: DNS or HTTP
4. **Submit**

**Expected Results:**
- ✅ Success message
- ✅ Order number is REAL (not 1000000-9999999)
- ✅ Domain appears in list
- ✅ Transaction recorded in database
- ✅ Console shows `[SECTIGO API] ADDDOMAIN - SUCCESS`

**Edge Case Testing:**
```
Test 1: Add same domain twice
Expected: "Domain already subscribed" message (treated as success)

Test 2: Add wildcard domain (*.example.com)
Expected: Success, higher cost shown

Test 3: Invalid domain format
Expected: Clear error message
```

### Step 5: Test Error Handling

**Test Case 1: Rate Limiting Simulation**
- Add 5 domains rapidly (within 10 seconds)
- **Expected:** Some requests show retry messages, all eventually succeed

**Test Case 2: Invalid Credentials**
- Temporarily change `SECTIGO_LOGIN_PASSWORD` to wrong value
- Try to create ACME account
- **Expected:** Clear error: "Authentication failed. Please check credentials."
- Restore correct password

**Test Case 3: Network Timeout**
- Disconnect internet briefly during API call
- **Expected:** Timeout error after 30 seconds

### Step 6: Verify Transaction Recording

**Validation Query:**
```sql
SELECT 
    t.id,
    t.order_number,
    t.transaction_type,
    t.amount,
    t.status,
    t.created_at,
    d.domain_name
FROM transactions t
LEFT JOIN domains d ON t.domain_id = d.id
WHERE t.order_number NOT BETWEEN 1000000 AND 9999999
ORDER BY t.created_at DESC
LIMIT 10;
```

**Expected:**
- ✅ Real order numbers from Sectigo
- ✅ Correct amounts
- ✅ Status = 'success' or 'pending'
- ✅ Linked to correct domains

---

## Staging Testing (Saturday, Jan 4)

**Environment:** `kica-caas-staging.vercel.app`  
**Database:** Supabase Production  
**Duration:** 2-3 hours  
**Goal:** End-to-end testing in production-like environment

### Step 1: Deploy to Vercel Staging

```bash
# Commit any pending changes
git add .
git commit -m "test: local testing complete, ready for staging"

# Push to staging branch (or main for auto-deploy)
git push origin feature/sectigo-api-integration
```

### Step 2: Configure Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select project → Settings → Environment Variables
3. Add for **Preview** environment:

| Variable | Value |
|----------|-------|
| `SECTIGO_CAAS_API_URL` | `https://secure.trust-provider.com/products/!ACMEAdmin` |
| `SECTIGO_LOGIN_NAME` | `your_username` |
| `SECTIGO_LOGIN_PASSWORD` | `your_password` |
| `ENABLE_SECTIGO_MOCK` | `false` |
| `NEXT_PUBLIC_APP_URL` | `https://kica-caas-staging.vercel.app` |

4. Click "Redeploy" to apply changes

### Step 3: Smoke Testing

Use Postman Collection for automated testing:

```bash
# Open Postman
# Import: docs/postman/KICA_CaaS_Staging_QA.postman_collection.json
# Set BASE_URL variable to staging URL
# Run collection
```

**Tests to Run:**
- ✅ Health check
- ✅ Create client
- ✅ Create ACME account
- ✅ Add domain
- ✅ List domains
- ✅ Zombie sweeper cron
- ✅ Generate settlements cron

### Step 4: Performance Testing

**Test:** Add 10 domains sequentially
- Monitor response times
- Check for rate limiting
- Verify retry logic works

**Expected:**
- Average response time: < 3 seconds
- Rate limit retries: Automatic with backoff
- All requests eventually succeed

### Step 5: Verify Logs

1. Vercel Dashboard → Project → Functions → Logs
2. Filter by time range (last hour)
3. Look for:
   - ✅ `[SECTIGO API]` log entries
   - ✅ No credential exposure in logs
   - ✅ Successful API responses
   - ❌ No uncaught errors

---

## Production Deployment (Saturday Night, Jan 4)

**Environment:** Production domain  
**Database:** Supabase Production  
**Duration:** 1-2 hours  
**Goal:** Final deployment for CEO demo

### Step 1: Data Cleanup

**CRITICAL: Clean up mock data before production!**

```sql
-- Connect to Supabase SQL Editor
-- Run validation first
SELECT 
    'TOTAL RECORDS TO CLEANUP' as summary,
    (SELECT COUNT(*) FROM acme_accounts WHERE acme_account_id LIKE 'MOCK_%') as mock_accounts,
    (SELECT COUNT(*) FROM domains WHERE acme_account_id LIKE 'MOCK_%') as mock_domains,
    (SELECT COUNT(*) FROM transactions WHERE order_number BETWEEN 1000000 AND 9999999) as mock_transactions;

-- If counts look correct, run soft delete
-- (See supabase/migrations/cleanup_mock_data.sql for full script)
```

### Step 2: Backup Database

```bash
# From Supabase Dashboard
# Database → Backups → Create Backup
# Name: "pre-ceo-demo-backup-2026-01-04"
```

### Step 3: Deploy to Production

1. Merge feature branch to main:
```bash
git checkout master
git merge feature/sectigo-api-integration
git push origin master
```

2. Vercel will auto-deploy to production

3. Verify deployment:
   - Check Vercel deployment logs
   - Visit production URL
   - Verify no errors

### Step 4: Production Environment Variables

Same as staging, but for **Production** environment in Vercel:

| Variable | Value |
|----------|-------|
| `ENABLE_SECTIGO_MOCK` | `false` ⚠️ |
| `SECTIGO_LOGIN_NAME` | Production credentials |
| `SECTIGO_LOGIN_PASSWORD` | Production credentials |
| `NEXT_PUBLIC_APP_URL` | Production domain |

### Step 5: Final Verification

**CEO Demo Checklist:**

- [ ] Mock mode is OFF (no `MOCK_` prefixes visible)
- [ ] All mock data cleaned from database
- [ ] Create test client → ACME account → domain (full flow)
- [ ] Transaction recording works
- [ ] No errors in Vercel logs
- [ ] UI shows real data only
- [ ] Backup created
- [ ] Rollback plan ready

---

## Common Issues & Troubleshooting

### Issue 1: "SECTIGO_LOGIN_NAME must be set"

**Cause:** Mock mode is OFF but credentials not provided

**Solution:**
```bash
# Check .env.local
cat .env.local | grep SECTIGO_LOGIN

# Add credentials
echo "SECTIGO_LOGIN_NAME=your_username" >> .env.local
echo "SECTIGO_LOGIN_PASSWORD=your_password" >> .env.local

# Restart server
npm run dev
```

### Issue 2: "403 Forbidden - Domain already exists"

**Cause:** Domain already subscribed in Sectigo

**Solution:** This is NORMAL and treated as success. Check console logs:
```
[SECTIGO API] ADDDOMAIN - Domain already subscribed, treating as success
```

### Issue 3: "429 Rate Limit Exceeded"

**Cause:** Too many requests too quickly

**Solution:** System will auto-retry. Wait for:
```
[SECTIGO API] ADDDOMAIN - Retry 1/3 after 2000ms
[SECTIGO API] ADDDOMAIN - Retry 2/3 after 4000ms
```

### Issue 4: Still seeing "MOCK_" prefixes

**Cause:** Mock mode still enabled

**Solution:**
```bash
# Verify environment variable
echo $ENABLE_SECTIGO_MOCK  # Should be 'false'

# If using Vercel, check dashboard
# Settings → Environment Variables → ENABLE_SECTIGO_MOCK

# Redeploy after changing
```

### Issue 5: Request timeout after 30 seconds

**Cause:** Network issue or Sectigo API slow

**Solution:**
- Check internet connection
- Try again (system will retry automatically)
- Check Sectigo API status

---

## Rollback Procedures

### Quick Rollback (5 minutes)

**If something goes wrong during demo:**

1. **Enable Mock Mode:**
   - Vercel Dashboard → Environment Variables
   - Set `ENABLE_SECTIGO_MOCK=true`
   - Redeploy

2. **Verify:**
   - Check logs for `[SECTIGO MOCK]`
   - Test create client flow
   - Should work without real API

### Full Rollback (15 minutes)

**If major issues found:**

```bash
# Revert to pre-integration state
git checkout master
git reset --hard e2ace2d  # Initial commit hash

# Redeploy
git push origin master --force

# Restore database from backup
# Supabase Dashboard → Database → Backups → Restore
```

### Restore Mock Data (if needed)

```sql
-- Use restore script from cleanup_mock_data.sql Section 5
-- This restores soft-deleted mock data
```

---

## Success Criteria

### ✅ Local Testing Complete When:
- [ ] ACME account created with real API
- [ ] Domain added successfully
- [ ] Transactions recorded correctly
- [ ] Error handling works (403, 429, timeout)
- [ ] No mock data visible

### ✅ Staging Testing Complete When:
- [ ] All Postman tests pass
- [ ] Cron jobs work
- [ ] Performance acceptable (< 3s response)
- [ ] Logs clean (no errors)

### ✅ Production Ready When:
- [ ] Mock data cleaned
- [ ] Database backed up
- [ ] Full flow tested end-to-end
- [ ] Rollback plan verified
- [ ] CEO demo script prepared

---

## Contact & Support

**For Issues During Testing:**
- Check this guide first
- Review `env.example` troubleshooting section
- Check Vercel logs
- Review Sectigo API reference: `docs/sectigo_caas_api_reference.md`

**Emergency Rollback:**
- Use Quick Rollback procedure above
- Enable mock mode immediately
- Investigate issue after demo

---

**Good luck with the CEO demo! 🎉**
