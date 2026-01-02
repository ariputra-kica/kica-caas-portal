import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Validate IP address format (IPv4 or CIDR)
function isValidIP(ip: string): { valid: boolean; type: 'single' | 'cidr' } {
    // IPv4 pattern
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    // CIDR pattern (IPv4/prefix)
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/

    if (cidrRegex.test(ip)) {
        // Validate CIDR parts
        const [ipPart, prefix] = ip.split('/')
        const octets = ipPart.split('.').map(Number)
        const prefixNum = parseInt(prefix)

        if (octets.some(o => o < 0 || o > 255)) return { valid: false, type: 'single' }
        if (prefixNum < 0 || prefixNum > 32) return { valid: false, type: 'single' }

        return { valid: true, type: 'cidr' }
    }

    if (ipv4Regex.test(ip)) {
        const octets = ip.split('.').map(Number)
        if (octets.some(o => o < 0 || o > 255)) return { valid: false, type: 'single' }
        return { valid: true, type: 'single' }
    }

    return { valid: false, type: 'single' }
}

/**
 * GET /api/settings/ip-whitelist
 * Fetch all whitelisted IPs for current partner
 */
export async function GET() {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('partner_ip_whitelist')
            .select('id, ip_address, ip_type, description, created_at')
            .eq('partner_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[IP Whitelist GET]', error)
            return NextResponse.json({ error: 'Failed to fetch IP whitelist' }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error('[IP Whitelist GET] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/settings/ip-whitelist
 * Add new IP to whitelist
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { ip_address, description } = body

        if (!ip_address || typeof ip_address !== 'string') {
            return NextResponse.json({ error: 'IP address is required' }, { status: 400 })
        }

        const trimmedIP = ip_address.trim()
        const validation = isValidIP(trimmedIP)

        if (!validation.valid) {
            return NextResponse.json({
                error: 'Invalid IP address format. Use IPv4 (e.g., 192.168.1.1) or CIDR (e.g., 10.0.0.0/24)'
            }, { status: 400 })
        }

        // Check for duplicate
        const { data: existing } = await supabase
            .from('partner_ip_whitelist')
            .select('id')
            .eq('partner_id', user.id)
            .eq('ip_address', trimmedIP)
            .single()

        if (existing) {
            return NextResponse.json({ error: 'This IP address is already whitelisted' }, { status: 409 })
        }

        // Insert new IP
        const { data, error } = await supabase
            .from('partner_ip_whitelist')
            .insert({
                partner_id: user.id,
                ip_address: trimmedIP,
                ip_type: validation.type,
                description: description?.trim() || null
            })
            .select()
            .single()

        if (error) {
            console.error('[IP Whitelist POST]', error)
            return NextResponse.json({ error: 'Failed to add IP' }, { status: 500 })
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'add_ip_whitelist',
            target_type: 'ip_whitelist',
            target_id: data.id,
            details: { ip_address: trimmedIP, ip_type: validation.type }
        })

        return NextResponse.json({ data })
    } catch (error) {
        console.error('[IP Whitelist POST] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE /api/settings/ip-whitelist
 * Remove IP from whitelist
 */
export async function DELETE(request: Request) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'IP ID is required' }, { status: 400 })
        }

        // Verify ownership and get IP for audit log
        const { data: ipRecord } = await supabase
            .from('partner_ip_whitelist')
            .select('ip_address')
            .eq('id', id)
            .eq('partner_id', user.id)
            .single()

        if (!ipRecord) {
            return NextResponse.json({ error: 'IP not found' }, { status: 404 })
        }

        // Delete
        const { error } = await supabase
            .from('partner_ip_whitelist')
            .delete()
            .eq('id', id)
            .eq('partner_id', user.id)

        if (error) {
            console.error('[IP Whitelist DELETE]', error)
            return NextResponse.json({ error: 'Failed to remove IP' }, { status: 500 })
        }

        // Audit log
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'remove_ip_whitelist',
            target_type: 'ip_whitelist',
            target_id: id,
            details: { ip_address: ipRecord.ip_address }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[IP Whitelist DELETE] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
