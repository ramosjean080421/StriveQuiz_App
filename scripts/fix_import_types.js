const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\[quizId]\\questions\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');

let norm = content.replace(/\r\n/g, '\n');

const lastItemSearch = `                    let lastItem = null;`;
const lastItemReplace = `                    let lastItem: any = null;`;

if (norm.includes(lastItemSearch)) {
    norm = norm.replace(lastItemSearch, lastItemReplace);
}

const forSearch = `                    for (const item of textContent.items) {`;
const forReplace = `                    for (const item of textContent.items as any[]) {`;

if (norm.includes(forSearch)) {
    norm = norm.replace(forSearch, forReplace);
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Types fixed.");
