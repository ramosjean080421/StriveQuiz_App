const fs = require('fs');

const filePath = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/components/GameBoard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `<span className="bg-black/90 backdrop-blur-md text-white text-[clamp(9px,1.2vh,13px)] px-3 py-1 rounded-full mb-2 font-bold whitespace-nowrap border-t border-white/30 shadow-[0_5px_15px_rgba(0,0,0,0.4)] uppercase tracking-wider">
                                {player.player_name}
                            </span>`;

const replacement = `<span className="bg-black/90 backdrop-blur-md text-white text-[clamp(9px,1.2vh,13px)] px-3 py-1 rounded-full mb-2 font-bold whitespace-nowrap border-t border-white/30 shadow-[0_5px_15px_rgba(0,0,0,0.4)] uppercase tracking-wider">
                                {player.player_name} ({uiPositions[player.id] ?? player.current_position}/{totalQuestions})
                            </span>`;

if (content.includes('{player.player_name}')) {
    content = content.replace(/\{\s*player\.player_name\s*\}/, `{player.player_name} ({uiPositions[player.id] ?? player.current_position}/{totalQuestions})`);
    fs.writeFileSync(filePath, content);
    console.log("Injected debug label successfully!");
} else {
    console.error("Could not find {player.player_name} for replacement.");
}
