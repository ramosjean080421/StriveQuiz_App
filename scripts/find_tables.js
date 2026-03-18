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

async function findBlockingTables() {
    console.log("Searching for tables that reference game_players...");
    
    const { data: tables, error } = await supabase.rpc('get_dependent_tables', { table_p: 'game_players' });
    
    if (error) {
        console.error("RPC Error:", error);
        console.log("Assuming standard table layout. Printing all tables to guess relations...");
        
        // Consultar nombres de tablas en el esquema public
        const { data: tNames } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
        if (tNames) {
            console.log("Tables list in public schema:", tNames.map(t => t.tablename));
        }
    } else {
        console.log("Tables referencing game_players:", tables);
    }
}

findBlockingTables();
