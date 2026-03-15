const fs = require('fs');
const path = require('path');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\components\\GameBoard.tsx";

const content = fs.readFileSync(filepath, 'utf-8');
const lines = content.split('\n');

const outputLines = [];
let skip = false;

const fixedBlock = `                            y: path[iA].y + (path[iB].y - path[iA].y) * w 
                        };
                    } else if (boardPath.length > 0) {
                        const currentPos = uiPositions[player.id] ?? player.current_position;
                        const safeIdx = Math.min(Math.max(0, currentPos), boardPath.length - 1);
                        coordinate = boardPath[safeIdx];
                    }

                    return (
                        <div
`;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("x: path[iA].x")) {
        outputLines.push(line);
        outputLines.push(fixedBlock);
        skip = true;
        continue;
    }
    if (skip && line.includes("key={player.id}")) {
        skip = false;
        outputLines.push(line);
        continue;
    }
    if (!skip) {
        outputLines.push(line);
    }
}

fs.writeFileSync(filepath, outputLines.join('\n'));
console.log("Fix applied successfully using Node.");
