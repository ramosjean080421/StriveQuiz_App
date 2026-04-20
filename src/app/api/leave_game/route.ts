import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// Necesitamos usar el service_role key o anon key dependiendo de si RLS permite a anon borrar por ID.
// Como están anónimos, usamos el anon_key.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { playerId } = body;

        // navigator.sendBeacon manda el payload, si no puede leemos form data o text
        if (!playerId) {
            return NextResponse.json({ success: false, error: 'No player ID provided' }, { status: 400 });
        }

        // Eliminar al jugador de la base de datos (ZOMBIE KILLER)
        const { error } = await supabase
            .from('game_players')
            .delete()
            .eq('id', playerId);

        if (error) {
            console.error("Error al limpiar jugador fantasma:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Excepción en leave_game:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
