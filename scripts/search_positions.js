const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/player/play/[gameId]/page.tsx';
const content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('current_position') || line.includes('nextPos')) {
        console.log(`${i + 1}: ${line.trim()}`);
    }
});
