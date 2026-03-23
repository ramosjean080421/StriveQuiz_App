const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/ConnectedPlayersModal.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const target1 = `    const handleKick = async (playerId: string) => {
        setKickingId(playerId);
        try {`;

const replace1 = `    const handleKick = async (playerId: string) => {
        setKickingId(playerId);
        setPlayers(prev => prev.filter(p => p.id !== playerId)); // Optimista para quitarlo de inmediato del modal

        try {`;

const target2 = `            // 1. Forzar señal letal de expulsión lógica (-999)
            await supabase.from("game_players").update({ current_position: -999 }).eq("id", playerId);
            // 2. Destruir registro (Permanente)
            await supabase.from("game_players").delete().eq("id", playerId);`;

const replace2 = `            // 1. Forzar señal letal de expulsión lógica (-999)
            await supabase.from("game_players").update({ current_position: -999 }).eq("id", playerId);
            
            // 2. Retrasamos el delete 1s para que el payload llegue a la TV y el Alumno reaccione antes de que la fila desaparezca
            setTimeout(async () => {
                await supabase.from("game_players").delete().eq("id", playerId);
            }, 1200);`;

if (content.includes(target1) && content.includes(target2)) {
  content = content.replace(target1, replace1);
  content = content.replace(target2, replace2);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("Successfully replaced handleKick with optimistic update and timeout.");
} else {
  console.error("Target NOT found in ConnectedPlayersModal!");
}
