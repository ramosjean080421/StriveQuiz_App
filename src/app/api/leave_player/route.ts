import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Usaremos la clave anon y validaremos con secret_token de RLS
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
    try {
        const { id, secret } = await req.json();
        console.log(`[ROUTE_API] Leave Player intent: id=${id}, secret=${secret ? 'provided' : 'missing'}`);
        if (!id || !secret) return NextResponse.json({ error: "Missing id or secret" }, { status: 400 });

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // 0. Validar que el ID y el Secreto coinciden (Seguridad)
        const { data: validPlayer, error: authError } = await supabase
            .from("game_players")
            .select("id")
            .eq("id", id)
            .eq("secret_token", secret)
            .single();

        if (authError || !validPlayer) {
            console.error(`[ROUTE_API] Unauthorized leave attempt for id=${id}`);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Borrar respuestas asociadas para evitar errores de clave foránea (Manual Cascade)
        await supabase.from("game_responses")
            .delete()
            .eq("player_id", id);

        // 2. Actualizar con posición -1 para visualización segura en tablero (Backdoor)
        await supabase.from("game_players")
            .update({ current_position: -1 })
            .eq("id", id);

        // 3. Borrar de la base de datos para que no salga en reportes
        const { error } = await supabase.from("game_players")
            .delete()
            .eq("id", id);

        if (error) console.error("Error deleting player on exit route:", error);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
