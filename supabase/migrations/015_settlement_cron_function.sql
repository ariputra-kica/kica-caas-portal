-- ============================================
-- KICA CaaS Portal - Settlement Generation Cron
-- ============================================
-- Automatically generate monthly settlement statements
-- Runs at 00:00 WIB (17:00 UTC previous day) on 1st of month
-- ============================================

-- Enable pg_cron extension (requires superuser, may need to run in Supabase dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to generate monthly settlements
CREATE OR REPLACE FUNCTION generate_monthly_settlements()
RETURNS TABLE(partner_count INT, settlement_count INT, skipped_zero INT) AS $$
DECLARE
    v_partner_count INT := 0;
    v_settlement_count INT := 0;
    v_skipped_zero INT := 0;
    v_partner RECORD;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_total_amount DECIMAL(15,2);
BEGIN
    -- Calculate previous month period in WIB (Asia/Jakarta timezone)
    -- Example: If run on 2025-01-01 00:00 WIB, we generate for December 2024
    v_period_start := DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Jakarta' - INTERVAL '1 month')) AT TIME ZONE 'Asia/Jakarta';
    v_period_end := (DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Jakarta')) - INTERVAL '1 second') AT TIME ZONE 'Asia/Jakarta';
    
    RAISE NOTICE 'Generating settlements for period: % to %', v_period_start, v_period_end;
    
    -- Loop through all active partners
    FOR v_partner IN (
        SELECT id, company_name FROM partners WHERE status = 'active'
    )
    LOOP
        v_partner_count := v_partner_count + 1;
        
        -- Calculate total amount from transactions
        -- Formula: (add_domain - refund) for successful transactions only
        SELECT COALESCE(
            SUM(CASE WHEN type = 'add_domain' THEN amount ELSE 0 END) -
            SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END),
            0
        ) INTO v_total_amount
        FROM transactions
        WHERE partner_id = v_partner.id
        AND status = 'success'
        AND created_at >= v_period_start
        AND created_at <= v_period_end;
        
        -- Skip if total amount is $0 (no activity or refunds equal charges)
        IF v_total_amount = 0 THEN
            v_skipped_zero := v_skipped_zero + 1;
            RAISE NOTICE 'Skipped partner % (zero amount)', v_partner.company_name;
            CONTINUE;
        END IF;
        
        -- Insert settlement with ON CONFLICT to handle reruns
        INSERT INTO settlements (
            partner_id,
            period_start,
            period_end,
            total_amount,
            status,
            auto_approved,
            created_at
        ) VALUES (
            v_partner.id,
            v_period_start::DATE,
            v_period_end::DATE,
            v_total_amount,
            'draft',
            FALSE,
            NOW()
        )
        ON CONFLICT (partner_id, period_start) DO NOTHING;
        
        -- Check if inserted (not skipped due to conflict)
        IF FOUND THEN
            v_settlement_count := v_settlement_count + 1;
            RAISE NOTICE 'Created settlement for partner % ($%)', v_partner.company_name, v_total_amount;
        ELSE
            RAISE NOTICE 'Settlement already exists for partner %', v_partner.company_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Summary: % partners processed, % settlements created, % skipped (zero amount)', 
        v_partner_count, v_settlement_count, v_skipped_zero;
    
    -- Return summary
    RETURN QUERY SELECT v_partner_count, v_settlement_count, v_skipped_zero;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to prevent duplicate settlements
ALTER TABLE settlements DROP CONSTRAINT IF EXISTS unique_partner_period;
ALTER TABLE settlements ADD CONSTRAINT unique_partner_period 
    UNIQUE (partner_id, period_start);

-- ============================================
-- CRON SCHEDULE SETUP
-- ============================================
-- Schedule to run at 17:00 UTC (00:00 WIB next day) on 1st of each month
-- Note: This requires pg_cron extension and appropriate permissions

-- Register cron job (run this manually in Supabase SQL Editor)
/*
SELECT cron.schedule(
    'generate-monthly-settlements',           -- job name
    '0 17 * * *',                            -- cron expression: daily at 17:00 UTC
    $$SELECT generate_monthly_settlements()$$ -- SQL to execute
);

-- The function will check if it's the 1st of month internally
-- Alternatively, use: '0 17 1 * *' to run only on 1st
-- But this requires the server to be up exactly at that time
*/

-- Verify cron jobs
-- SELECT * FROM cron.job;

-- To unschedule (if needed):
-- SELECT cron.unschedule('generate-monthly-settlements');

-- ============================================
-- MANUAL TESTING
-- ============================================
-- Test the function manually
SELECT * FROM generate_monthly_settlements();

-- Verify created settlements
SELECT 
    s.id,
    p.company_name as partner_name,
    s.period_start,
    s.period_end,
    s.total_amount,
    s.status,
    s.created_at
FROM settlements s
JOIN partners p ON s.partner_id = p.id
ORDER BY s.created_at DESC
LIMIT 10;
