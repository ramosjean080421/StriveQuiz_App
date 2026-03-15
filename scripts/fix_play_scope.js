const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\player\\play\\[gameId]\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
const lines = content.replace(/\r\n/g, '\n').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("let isCorrect = false;") && !lines[i+1].includes("let skippedThisStep = false;")) {
        lines[i] = "        let isCorrect = false;\n        let skippedThisStep = false;";
        console.log("Added skippedThisStep declaration on line", i+1);
    }
}

let fileContent = lines.join('\n');

const streakSearch = `                    if (mode !== 'ludo' && dbStreaksEnabled && streaksEnabled && newStreak > 0 && newStreak % 5 === 0) {
                        nextPos += 1; 
                        console.log("¡BONO DE RACHA! +1 casilla extra y salto de pregunta.");
                    }`;

const streakReplace = `                    if (mode !== 'ludo' && dbStreaksEnabled && streaksEnabled && newStreak > 0 && newStreak % 5 === 0) {
                        nextPos += 1; 
                        skippedThisStep = true;
                        console.log("¡BONO DE RACHA! +1 casilla extra y salto de pregunta.");
                    }`;

if (fileContent.includes(streakSearch)) {
    fileContent = fileContent.replace(streakSearch, streakReplace);
    console.log("Streak scope variable assignment added.");
} else {
    console.log("Streak search block not found.");
}

const timeoutSearch = `            const skipQuestion = isCorrect && mode !== 'ludo' && dbStreaksEnabled && streaksEnabled && newStreak > 0 && newStreak % 5 === 0;`;

const timeoutReplace = `            const skipQuestion = isCorrect && skippedThisStep;`;

if (fileContent.includes(timeoutSearch)) {
    fileContent = fileContent.replace(timeoutSearch, timeoutReplace);
    console.log("Timeout skip assignment corrected.");
} else {
    console.log("Timeout search block not found.");
}

fs.writeFileSync(filepath, fileContent.replace(/\n/g, '\r\n'));
console.log("Done correcting scope.");
