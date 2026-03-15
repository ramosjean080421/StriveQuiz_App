const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\game\\new\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

// 1. Update fallback condition to prevent showing insert errors
const errorSearch = `if (error.message?.includes("streaks_enabled") || error.message?.includes("auto_end"))`;
const errorReplace = `if (error.message?.includes("streaks_enabled") || error.message?.includes("auto_end") || error.message?.includes("game_duration") || error.message?.includes("question_duration") || error.message?.includes("column"))`;

if (norm.includes(errorSearch)) {
    norm = norm.replace(errorSearch, errorReplace);
    console.log("Error fallback condition updated.");
}

// 2. Fix gameDuration input - allow blank space on backspace
const gameDurationInputSearch = `                                value={gameDuration}
                                onChange={(e) => setGameDuration(Number(e.target.value))}`;

const gameDurationInputReplace = `                                value={gameDuration === 0 ? "" : gameDuration}
                                onChange={(e) => setGameDuration(e.target.value === "" ? 0 : Number(e.target.value))}`;

if (norm.includes(gameDurationInputSearch)) {
    norm = norm.replace(gameDurationInputSearch, gameDurationInputReplace);
    console.log("gameDuration input modified.");
}

// 3. Fix questionDuration input - allow blank space on backspace
const questionDurationInputSearch = `                                value={questionDuration}
                                onChange={(e) => setQuestionDuration(Number(e.target.value))}`;

const questionDurationInputReplace = `                                value={questionDuration === 0 ? "" : questionDuration}
                                onChange={(e) => setQuestionDuration(e.target.value === "" ? 0 : Number(e.target.value))}`;

if (norm.includes(questionDurationInputSearch)) {
    norm = norm.replace(questionDurationInputSearch, questionDurationInputReplace);
    console.log("questionDuration input modified.");
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done");
