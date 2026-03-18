const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/.env.local', 'utf8');

const getEnv = (key) => {
    const match = envLocal.match(new RegExp(`${key}\\s*=\\s*["']?([^"'\r\n]+)["']?`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDelete() {
    const pin = 'S8QIYN'; 
    
    const { data: game } = await supabase.from('games').select('id').eq('pin', pin).single();
    if (!game) { console.error("Game not found"); return; }

    const { data: players } = await supabase.from('game_players').select('*').eq('game_id', game.id);
    if (!players || players.length === 0) { console.error("No players found"); return; }

    const target = players[0];
    console.log(`Attempting to delete player: ${target.player_name} (ID: ${target.id}), Secret: ${target.secret_token}`);

    // Probar el borrado
    const { data, error } = await supabase.from('game_players')
        .delete()
        .eq('id', target.id)
        .eq('secret_token', target.secret_token);

    if (error) {
        console.error("❌ SUPABASE DELETE ERROR:", error);
    } else {
        console.log("✅ Delete command resolved without Supabase error. Inspecting row presence...");
        const { data: recheck } = await supabase.from('game_players').select('*').eq('id', target.id);
        if (recheck && recheck.length > 0) {
            console.log("⚠️ Player was NOT deleted! (Possibly silent RLS block)");
        } else {
            console.log("🎉 Player successfully deleted!");
        }
    }
}

testDelete();
