import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Return null-like client during build if env vars missing
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not available, client creation skipped')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
