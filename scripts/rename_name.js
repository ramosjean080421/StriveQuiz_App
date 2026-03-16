const fs = require('fs');
const path = require('path');

const targetDir = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src";

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

walkDir(targetDir, (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf-8');
        let updated = false;

        if (content.includes('Prisma Quiz')) {
            content = content.replace(/Prisma Quiz/g, 'Mindcore Quiz');
            updated = true;
        }
        
        if (content.includes('PrismaQuiz')) {
            content = content.replace(/PrismaQuiz/g, 'Mindcore Quiz');
            updated = true;
        }

        // Caso separado para capitalizaciones standalone si existiera
        if (content.includes('Prisma') && !filePath.includes('node_modules')) {
             if (content.includes('Prisma<br />Quiz')) {
                  content = content.replace(/Prisma<br \/>Quiz/g, 'Mindcore<br />Quiz');
                  updated = true;
             }
             // Asegurar no romper sintaxis de clases o similares si hubiera
             content = content.replace(/Prisma(?!\s*C)/g, 'Mindcore'); 
             updated = true;
        }

        if (updated) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated: ${filePath}`);
        }
    }
});

// También para layout.tsx title
const layoutPath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\layout.tsx";
if (fs.existsSync(layoutPath)) {
    let l_content = fs.readFileSync(layoutPath, 'utf-8');
    if (l_content.includes('Prisma Quiz')) {
        l_content = l_content.replace(/Prisma Quiz/g, 'Mindcore Quiz');
        fs.writeFileSync(layoutPath, l_content);
        console.log("Updated layout.tsx title");
    }
}

console.log("Global Rename Done!");
