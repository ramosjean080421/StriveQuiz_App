const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/teacher/game/new/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove state
content = content.replace('const [isKickEnabled, setIsKickEnabled] = useState(true);', '');

// 2. Revert gameMode insertion logic
content = content.replace("game_mode: gameMode === 'ludo' && !isKickEnabled ? 'ludo_nokick' : gameMode", "game_mode: gameMode");

// 3. Remove UI Toggle building layout
const toggleRegex = /\{\/\* Comer oponentes \(Sólo en Ludo\) \*\/\}\s*\{gameMode === 'ludo' && \([\s\S]*?\)\}/;
if (toggleRegex.test(content)) {
    content = content.replace(toggleRegex, '');
    console.log("Teacher toggle removed.");
}

fs.writeFileSync(path, content);
console.log("Teacher UI configs reverted successfully!");
