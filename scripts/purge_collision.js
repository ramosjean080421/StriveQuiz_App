const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/player/play/[gameId]/page.tsx';
const content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');
// Eliminar desde la línea 344 hasta 399
// Los arrays en JS son index-0, así que línea 344 es index 343.
const updatedLines = [
    ...lines.slice(0, 343),
    "                    // Lógica de colisión eliminada.",
    ...lines.slice(399)
];

fs.writeFileSync(path, updatedLines.join('\n'));
console.log("Purged collision logic on student view successfully!");
