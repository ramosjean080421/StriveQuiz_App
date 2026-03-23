const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/game/[gameId]/board/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const target1 = "supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('game_id', gameId).then(({ count }) => {";
const replace1 = "supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('game_id', gameId).gte('current_position', 0).then(({ count }) => {";

if (content.includes(target1)) {
  content = content.replace(target1, replace1);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("Successfully replaced initial count.");
} else {
  console.error("Target NOT found!");
}
