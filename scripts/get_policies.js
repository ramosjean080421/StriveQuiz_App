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

async function getPolicies() {
    const { data: policies, error } = await supabase.rpc('get_policies_for_players'); 
    
    if (error) {
        // Si no hay RPC, consultar con una query raw
        const { data: rawP, error: error2 } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'game_players');
         
         if (error2) {
             console.error("Error reading policies:", error2);
             // Intentar SELECT raw de pg_policy
             console.log("No privileges to read pg_policies directly. Let's guess the SQL based on standard templates.");
         } else {
             console.log("Policies found:", rawP);
         }
    } else {
        console.log("Policies RPC:", policies);
    }
}

getPolicies();
