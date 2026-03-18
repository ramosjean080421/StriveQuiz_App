const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/player/play/[gameId]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `current_position: nextPos,`;
const replacement = `current_position: (console.log(\`[SAVE_DEBUG] Name:\`, pData.player_name, \`nextPos:\`, nextPos, \`mode:\`, mode, \`isCorrect:\`, isCorrect), nextPos),`;

if (content.includes('current_position: nextPos')) {
    content = content.replace('current_position: nextPos', replacement);
    fs.writeFileSync(path, content);
    console.log("Injected student debugger log successfully!");
} else {
    console.error("Could not find current_position: nextPos for replacement.");
}
