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

async function checkPositions() {
    const pin = 'BEC9QF'; 
    
    // 1. Buscar Game por PIN
    const { data: game } = await supabase.from('games').select('id, status').eq('pin', pin).single();
    if (!game) {
        console.error("Game not found for PIN:", pin);
        return;
    }
    
    console.log(`Found Game ID: ${game.id}, Status: ${game.status}`);
    
    // 2. Obtener jugadores
    const { data: players, error } = await supabase.from('game_players').select('*').eq('game_id', game.id);
    
    if (error) {
        console.error("Error reading players:", error);
    } else {
        console.log("Player Positions in DB:");
        players.forEach(p => {
            console.log(`- ${p.player_name}: Pos=${p.current_position}, Correct=${p.correct_answers}, Score=${p.score}`);
        });
    }
}

checkPositions();
