const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/game/[gameId]/board/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Añadir refreshCount() y cambiar escucha
const refreshCountNode = `
        const refreshCount = async () => {
            const { count } = await supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('game_id', gameId);
            setPlayerCount(count || 0);
        };
`;

const channelInject = `
        const channel = supabase.channel(\`game_room_status_\${gameId}\`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: \`id=eq.\${gameId}\` },
                (payload) => {
                    setGameStatus(payload.new.status);
                    if (payload.new.status === "finished") {
                        fetchWinners();
                    }
                }
            )
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: \`game_id=eq.\${gameId}\` },
                () => refreshCount()
            ).subscribe();
`;

// Insertamos refreshCount() justo antes de la creación del canal
if (content.includes('const channel = supabase.channel')) {
    content = content.replace('const channel = supabase.channel', refreshCountNode + '        const channel = supabase.channel');
    console.log("Injected refreshCount handler.");
}

// Reemplazamos la definición del canal antigua por la nueva con escucha '*'
const oldChannelRegex = /const channel = supabase\.channel\([\s\S]*?\.subscribe\(\);/;
if (oldChannelRegex.test(content)) {
    content = content.replace(oldChannelRegex, channelInject.trim());
    console.log("Updated channel listeners for accurate playerCount.");
}

// 2. Deshabilitar botón INICIAR
const buttonRegex = /<button\s*onClick=\{startGame\}\s*className="([^"]+)"/;
const disabledClass = "disabled:bg-gray-700 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:scale-100";

if (buttonRegex.test(content)) {
    content = content.replace(
        buttonRegex, 
        (match, classes) => `<button onClick={startGame} disabled={playerCount < 1} className="${classes} ${disabledClass}"`
    );
    console.log("Disabled INICIAR button if playerCount < 1.");
}

fs.writeFileSync(path, content);
console.log("Safe Start Game rule implemented fully!");
