const fs = require('fs');
const path = require('path');

const directory = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src';

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            replaceInDir(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            
            // Reemplazar Mindcore<br />Quiz por StriveQuiz (o Strive<br />Quiz si queremos mantener el diseño)
            // Dado que StriveQuiz es lo pedido, probaremos sin el break primero. 
            // Pero si el break estaba ahí por tamaño, quizás sea mejor mantenerlo si es visual.
            // Para ser fieles a la tipografía "StriveQuiz", podemos quitar el break o reemplazarlo.
            content = content.replace(/Mindcore<br \/>Quiz/g, 'StriveQuiz');
            
            // Reemplazar Mindcore Quiz con StriveQuiz
            content = content.replace(/Mindcore Quiz/g, 'StriveQuiz');
            
            // Fallback para Mindcore solo
            content = content.replace(/Mindcore/g, 'Strive');
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Replaced in ${fullPath}`);
            }
        }
    }
}

replaceInDir(directory);
console.log("Renaming done.");
