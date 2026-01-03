/**
 * Sectigo CaaS API Types
 * Based on documentation at references/sectigo-caas/
 */

// ============================================
// Common Types
// ============================================

export interface SectigoCredentials {
    loginName: string
    loginPassword: string
}

export interface SectigoError {
    success: false
    errorCode: number
    errorMessage: string
}

// ============================================
// PREREGISTER - Create ACME Account
// ============================================

export interface PreregisterRequest {
    serverUrl: string  // e.g., 'https://acme.sectigo.com/v2/DV'
    years?: 1 | 2 | 3
    days?: 365 | 730 | 1095
}

export interface AcmeAccountInfo {
    acmeAccountID: string
    accountStatus: 'pending' | 'active' | 'suspended' | 'deactivated'
    eabMACKeyb64url: string
    eabMACIDb64url: string
}

export interface PreregisterSuccessResponse {
    success: true
    Accounts: AcmeAccountInfo[]
}

export type PreregisterResponse = PreregisterSuccessResponse | SectigoError

// ============================================
// LISTSERVERS - Get Available ACME Servers
// ============================================

export interface ServerInfo {
    serverUrl: string
    description: string
    validationType: 'DV' | 'OV'
}

export interface ListServersSuccessResponse {
    success: true
    servers: ServerInfo[]
}

export type ListServersResponse = ListServersSuccessResponse | SectigoError

// ============================================
// Account Management (SUSPEND/UNSUSPEND/DEACTIVATE)
// ============================================

export interface AccountManagementRequest {
    acmeAccountID?: string
    includeAdditionalAccounts?: 'Y' | 'N' | '*'
}

export interface AccountManagementSuccessResponse {
    success: true
    nRecordsUpdated: number
}

export type AccountManagementResponse = AccountManagementSuccessResponse | SectigoError

// ============================================
// ADDDOMAIN
// ============================================

export interface AddDomainRequest {
    acmeAccountID: string
    domainName: string
    quoteOnly?: 'Y' | 'N'
    addAssociatedFQDN?: 'Y' | 'N'
    ovAnchorOrderNumber?: string  // OV only
}

export interface AddDomainSuccessResponse {
    success: true
    orderNumber: number
    cost: number
    currency: string
    domains: { domainName: string }[]
}

export interface AddDomainQuoteResponse {
    success: true
    cost: number
    currency: string
    domains: { domainName: string }[]
}

export type AddDomainResponse = AddDomainSuccessResponse | AddDomainQuoteResponse | SectigoError

// ============================================
// REMOVEDOMAIN
// ============================================

export interface RemoveDomainRequest {
    acmeAccountID: string
    domainName: string
}

export interface RemoveDomainSuccessResponse {
    success: true
    Domains: { domainName: string }[]
}

export type RemoveDomainResponse = RemoveDomainSuccessResponse | SectigoError

// ============================================
// LISTDOMAINS
// ============================================

export interface ListDomainsRequest {
    acmeAccountID: string
}

export interface DomainInfo {
    domainName: string
    orderNumber: number
    type: 'paid' | 'free'
    addedDate?: string
    expiryDate?: string
}

export interface ListDomainsSuccessResponse {
    success: true
    domains: DomainInfo[]
}

export type ListDomainsResponse = ListDomainsSuccessResponse | SectigoError

// ============================================
// EXTENDDOMAINS
// ============================================

export interface ExtendDomainsRequest {
    acmeAccountID: string
    years?: 1 | 2 | 3
    days?: 365 | 730 | 1095
    quoteOnly?: 'Y' | 'N'
}

export interface ExtendDomainsSuccessResponse {
    success: true
    orderNumber: number
    cost: number
    currency: string
}

export interface ExtendDomainsQuoteResponse {
    success: true
    cost: number
    currency: string
}

export type ExtendDomainsResponse = ExtendDomainsSuccessResponse | ExtendDomainsQuoteResponse | SectigoError

// ============================================
// GETLASTORDER
// ============================================

export interface GetLastOrderRequest {
    acmeAccountID: string
    domainName: string
}

export interface OrderInfo {
    orderNumber: number
    acmeOrderID?: string
    acmeOrderStatus?: string
    certificateID?: number
    statusCode: number
    statusDesc: string
    domainName: string
    serialNumber?: string
    validNotBefore?: string
    validNotAfter?: string
    acmeAccountID?: string
    acmeEABKeyID?: string
}

export interface GetLastOrderSuccessResponse {
    Orders: OrderInfo[]
}

export type GetLastOrderResponse = GetLastOrderSuccessResponse | SectigoError

// ============================================
// LISTTRANSACTIONS
// ============================================

export interface ListTransactionsRequest {
    acmeAccountID: string
    fromDate?: string  // YYYY-MM-DD
    toDate?: string    // YYYY-MM-DD
}

export interface SectigoTransaction {
    orderNumber: number
    transactionType: string
    domainName: string
    amount: number
    currency: string
    transactionDate: string
}

export interface ListTransactionsSuccessResponse {
    success: true
    transactions: SectigoTransaction[]
}

export type ListTransactionsResponse = ListTransactionsSuccessResponse | SectigoError

// ============================================
// Helper Type Guards
// ============================================

export function isSectigoError(response: { success: boolean }): response is SectigoError {
    return response.success === false
}

export function hasOrderNumber(response: AddDomainResponse): response is AddDomainSuccessResponse {
    return response.success === true && 'orderNumber' in response
}
