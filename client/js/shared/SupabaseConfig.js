/**
 * Supabase Configuration for Claw World
 * 
 * Replace these values with your Supabase project credentials
 * from: supabase.com/dashboard > Settings > API
 */

const SUPABASE_CONFIG = {
    // Your Supabase project URL
    url: 'YOUR_SUPABASE_URL',  // e.g., 'https://abcdefg.supabase.co'
    
    // Your Supabase anon/public key (safe for client-side)
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    
    // Service role key (ONLY for server-side bot API - never expose to client!)
    // serviceKey: 'YOUR_SERVICE_ROLE_KEY',
    
    // Feature flags
    features: {
        // Use Supabase for multiplayer (set to false to use legacy WebSocket)
        useSupabaseMultiplayer: true,
        
        // Use Supabase auth (anonymous sessions)
        useSupabaseAuth: true,
        
        // Enable chat persistence
        persistChat: true,
        
        // Enable faction reputation sync
        syncFactions: true
    }
};

// Validate config
if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL') {
    console.warn('⚠️ Supabase not configured - falling back to legacy WebSocket multiplayer');
    SUPABASE_CONFIG.features.useSupabaseMultiplayer = false;
    SUPABASE_CONFIG.features.useSupabaseAuth = false;
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
