const fs = require('fs');

const filePath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\builder\\page.tsx";
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Find index where handleUndo starts/contains the leftover
const undoIndex = lines.findIndex(line => line.includes('currentData.finals[ludoPathType].pop()'));
if (undoIndex !== -1) {
    console.log("Found handleUndo leftover index:", undoIndex);
    // Leftovers are usually:
    // lines[undoIndex] = currentData.finals[ludoPathType].pop();
    // lines[undoIndex+1] = setLudoPathData(currentData);
    // lines[undoIndex+2] = } else {
    // lines[undoIndex+3] = setBoardPath(boardPath.slice(0, -1));
    // lines[undoIndex+4] = }
    
    // We want to replace undoIndex to undoIndex+4 inclusive (5 lines) with just setBoardPath
    lines.splice(undoIndex, 5, '        setBoardPath(boardPath.slice(0, -1));');
    console.log("Fixed handleUndo");
} else {
    console.log("No handleUndo leftover found.");
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log("Dynamic fix complete");
