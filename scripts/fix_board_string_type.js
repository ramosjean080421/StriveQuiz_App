const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\player\\play\\[gameId]\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
const norm = content.replace(/\r\n/g, '\n');

// 1. FetchGame Replacement
const fetchSearch1 = `                    const boardPath = quizData?.board_path as any[] || [];
                    const mode = game.game_mode || "classic";
                    
                    if ((mode === 'classic' || mode === 'race') && boardPath.length > 0) {
                        shuffled = shuffled.slice(0, boardPath.length);
                    }`;

const fetchReplace1 = `                    let boardPath = quizData?.board_path || [];
                    if (typeof boardPath === "string") {
                        try { boardPath = JSON.parse(boardPath); } catch(e) { boardPath = []; }
                    }
                    const mode = game.game_mode || "classic";
                    
                    if ((mode === 'classic' || mode === 'race') && (boardPath && boardPath.length > 0)) {
                        shuffled = shuffled.slice(0, boardPath.length);
                        console.log("Slicing questions to board path length:", boardPath.length);
                    }`;

let stepContent = norm;
if (stepContent.includes(fetchSearch1)) {
    stepContent = stepContent.replace(fetchSearch1, fetchReplace1);
} else {
    console.log("Fetch 1 search block not found.");
}

// 2. FetchQuestions Replacement (dynamic effect)
const fetchSearch2 = `                        const boardPath = quizData?.board_path as any[] || [];
                        const mode = game.game_mode || "classic";
                        
                        if ((mode === 'classic' || mode === 'race') && boardPath.length > 0) {
                            shuffled = shuffled.slice(0, boardPath.length);
                        }`;

const fetchReplace2 = `                        let boardPath = quizData?.board_path || [];
                        if (typeof boardPath === "string") {
                            try { boardPath = JSON.parse(boardPath); } catch(e) { boardPath = []; }
                        }
                        const mode = game.game_mode || "classic";
                        
                        if ((mode === 'classic' || mode === 'race') && (boardPath && boardPath.length > 0)) {
                            shuffled = shuffled.slice(0, boardPath.length);
                        }`;

if (stepContent.includes(fetchSearch2)) {
    stepContent = stepContent.replace(fetchSearch2, fetchReplace2);
} else {
    console.log("Fetch 2 search block not found.");
}

fs.writeFileSync(filepath, stepContent.replace(/\n/g, '\r\n'));
console.log("Done adding board string parsing correction");
