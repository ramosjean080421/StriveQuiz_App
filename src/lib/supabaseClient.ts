import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,    // Renovar el token automáticamente antes de que expire
        persistSession: true,      // Mantener la sesión en localStorage entre recargas
        detectSessionInUrl: true,  // Manejar callbacks de OAuth/magic links
    }
})

// Si el refresh token es inválido o expiró, limpiar el storage silenciosamente.
// Evita el AuthApiError que aparece cuando el docente tiene una sesión vieja guardada.
if (typeof window !== 'undefined') {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' && !session) {
            // Limpiar cualquier token inválido del localStorage y sessionStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) localStorage.removeItem(key);
            });
        }
        // Token renovado correctamente — no se requiere acción adicional
        // if (event === 'TOKEN_REFRESHED') { ... }
    });
}
