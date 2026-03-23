const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) process.env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  const { data, error } = await supabase
    .from("game_players")
    .select("*")
    .limit(1);

  if (error) console.error("Error:", error);
  else console.log("Player columns:", Object.keys(data[0] || {}));
}

inspect();
