
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://wmffzbkktrozzmlbqvjb.supabase.co",
  "sb_publishable_QO4uLGIc5ZtEJTIp0EC_CA_d-mQUSoN"
);

async function inspect() {
  console.log("Inspeccionando quizzes...");
  const { data: quiz, error: err1 } = await supabase.from('quizzes').select('*').limit(1).maybeSingle();
  if (err1) console.error("Error quizzes:", err1);
  else if (quiz) console.log("Columnas quizzes:", Object.keys(quiz));
  else console.log("No hay quizzes para inspeccionar.");

  console.log("\nInspeccionando games...");
  const { data: game, error: err2 } = await supabase.from('games').select('*').limit(1).maybeSingle();
  if (err2) console.error("Error games:", err2);
  else if (game) console.log("Columnas games:", Object.keys(game));
  else console.log("No hay games para inspeccionar.");
}

inspect();
