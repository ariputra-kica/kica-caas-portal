// Database types for KICA CaaS Platform
// Auto-generated from schema, can be regenerated with Supabase CLI

export type Partner = {
    id: string
    company_name: string
    partner_type: 'reseller' | 'direct'
    payment_mode: 'prepaid' | 'postpaid'
    payment_type: 'post_paid' | 'deposit'
    credit_limit: number | null  // Only used for 'deposit' payment_type
    current_usage: number
    pricing_class: string
    mfa_enforced: boolean
    status: 'active' | 'suspended' | 'terminated'
    created_at: string
    updated_at: string
}

export type Client = {
    id: string
    partner_id: string
    name: string
    company_name: string | null
    client_type: 'personal' | 'organization'  // Deprecated in UI, kept for data
    email: string | null
    phone: string | null
    status: 'active' | 'suspended' | 'terminated'
    created_at: string
    updated_at: string
}

export type AcmeAccount = {
    id: string
    client_id: string
    ov_anchor_id: string | null
    acme_account_id: string | null
    eab_key_id: string | null
    eab_hmac_key: string | null
    server_url: string | null
    account_name: string | null
    certificate_type: 'DV' | 'OV'
    subscription_years: number
    status: 'pending_start' | 'active' | 'suspended' | 'expired' | 'terminated'
    created_at: string
    start_date: string | null
    end_date: string | null
    updated_at: string
}

export type Domain = {
    id: string
    acme_account_id: string
    parent_domain_id: string | null
    domain_name: string
    domain_type: 'single' | 'wildcard'
    billing_type: 'paid' | 'free_sibling'
    order_number: string | null
    is_refundable: boolean
    price_charged: number
    status: 'active' | 'removed' | 'expired'
    added_at: string
    expires_at: string | null
}

export type Transaction = {
    id: string
    partner_id: string
    acme_account_id: string | null
    domain_id: string | null
    type: 'add_domain' | 'remove_domain' | 'extend' | 'refund'
    description: string | null
    amount: number
    status: 'pending' | 'success' | 'failed' | 'refunded'
    created_at: string
}

export type Settlement = {
    id: string
    partner_id: string
    period_start: string
    period_end: string
    total_amount: number
    status: 'draft' | 'pending' | 'escalated' | 'confirmed' | 'auto_approved' | 'invoiced'
    confirmed_at: string | null
    auto_approved: boolean
    created_at: string
}

export type AuditLog = {
    id: string
    actor_id: string
    action: string
    target_type: string | null
    target_id: string | null
    details: Record<string, unknown> | null
    ip_address: string | null
    created_at: string
}

// Extended types with relations
export type ClientWithAccounts = Client & {
    acme_accounts: AcmeAccount[]
}

export type AcmeAccountWithDomains = AcmeAccount & {
    domains: Domain[]
    client: Client
}

// Dashboard stats type
export type DashboardStats = {
    total_clients: number
    total_acme_accounts: number
    total_domains: number
    current_usage: number
    credit_limit: number | null  // null for post_paid partners
    payment_type: 'post_paid' | 'deposit'
    billing_cycle_end: string  // ISO date string for end of billing cycle
}
