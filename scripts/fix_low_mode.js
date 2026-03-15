const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\player\\play\\[gameId]\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
const norm = content.replace(/\r\n/g, '\n');

const search1 = `const mode = game.game_mode || "classic";`;
const replace1 = `const mode = (game.game_mode || "classic").toLowerCase();`;

let stepContent = norm;
if (stepContent.includes(search1)) {
    stepContent = stepContent.split(search1).join(replace1);
    console.log("Lowercased mode variable in both places.");
} else {
    console.log("Search block not found.");
}

fs.writeFileSync(filepath, stepContent.replace(/\n/g, '\r\n'));
console.log("File saved.");
