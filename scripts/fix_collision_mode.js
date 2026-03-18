const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/player/play/[gameId]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

if (content.includes("if (mode === 'ludo')")) {
    content = content.replace("if (mode === 'ludo')", "if (mode.startsWith('ludo'))");
    fs.writeFileSync(path, content);
    console.log("Fixed collision check fallback successfully!");
} else {
    console.error("Could not find condition to replace.");
}
