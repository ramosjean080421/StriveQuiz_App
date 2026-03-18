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

async function testUpdate() {
    const pin = 'S8QIYN'; 
    const { data: game } = await supabase.from('games').select('id').eq('pin', pin).single();
    if (!game) { console.error("Game not found"); return; }

    const { data: players } = await supabase.from('game_players').select('*').eq('game_id', game.id);
    const target = players[0];
    
    console.log(`Testing update for: ${target.player_name}`);
    
    // Probar actualización a -1
    await supabase.from('game_players')
        .update({ current_position: -1 })
        .eq('id', target.id)
        .eq('secret_token', target.secret_token);

    const { data: check } = await supabase.from('game_players').select('current_position').eq('id', target.id).single();
    console.log(`Current position inside DB for player: ${check.current_position}`);
}

testUpdate();
