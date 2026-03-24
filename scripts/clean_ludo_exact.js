const fs = require('fs');

const filePath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\builder\\page.tsx";
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Lines from handleImageClick (1-based: 131 to 140) => 0-based: 130 to 139
console.log("ImageClick snippet before:");
console.log(lines.slice(130, 140).join('\n'));

// Replace lines 131 to 141 (indices 130 to 140 inclusive if you want line 140 replacement)
// We want to replace everything from 131 to 141 (exclusive slice).
lines.splice(130, 10, '            setBoardPath([...boardPath, { x: xPositionsPercent, y: yPositionsPercent }]);');

// handleUndo (indices shifted because of previous splice of 9 lines)
// wait, line 172 was before inside the indices before modification. Line 173 to 177 is what we want.
// Since line indices shifted by 9 lines: 172 becomes 163.
// Let's just find the text or do it backwards so indices are stable!

// BACKWARDS DO IT!
// handleUndo: lines 173 to 177 (1-based) => indices 172 to 176
lines.splice(172, 5, '        setBoardPath(boardPath.slice(0, -1));');

// handleImageClick: lines 131 to 141 (1-based) => indices 130 to 140 inclusive
lines.splice(130, 10, '            setBoardPath([...boardPath, { x: xPositionsPercent, y: yPositionsPercent }]);');

fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log("Exact lines replaced");
