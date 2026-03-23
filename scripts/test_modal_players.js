const fs = require('fs');
const path = require('path');

// Leer .env.local manualmente para el script
const envPath = path.join(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    process.env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const gameId = "3f8c21bb-5315-4ca9-953c-87febac20ba4";

async function test() {
  console.log("Fetching for gameId:", gameId);

  const { data: allPlayers, error: allErr } = await supabase
    .from("game_players")
    .select("*")
    .eq("game_id", gameId);

  if (allErr) console.error("All players err:", allErr);
  else console.log("All players:", allPlayers);

  const { data: filterPlayers, error: filterErr } = await supabase
    .from("game_players")
    .select("*")
    .eq("game_id", gameId)
    .gte("current_position", 0);

  if (filterErr) console.error("Filter err:", filterErr);
  else console.log("Filtered players:", filterPlayers);
}

test();
