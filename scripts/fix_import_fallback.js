const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\[quizId]\\questions\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');

// Normalize line endings
let nContent = content.replace(/\r\n/g, '\n');
const lines = nContent.split('\n');

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("file.name.endsWith('.docx')") || lines[i].includes('file.name.endsWith(".docx")')) {
        startIdx = i;
    }
    if (startIdx !== -1 && lines[i].includes("extractedText = fullText;")) {
        endIdx = i;
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    console.log("Found block to replace from line", startIdx + 1, "to", endIdx + 1);

    const replacement = `            } else if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                const htmlString = result.value;
                const cleanHtml = htmlString
                    .replace(/<mark>(.*?)<\\/mark>/g, '*$1*')
                    .replace(/<span style="background-color:[^>]+>(.*?)<\\/span>/g, '*$1*')
                    .replace(/<[^>]+>/g, '\\n');
                extractedText = cleanHtml;
            } else if (file.name.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    let pageText = "";
                    let lastItem = null;
                    
                    for (const item of textContent.items) {
                        if (lastItem) {
                            if (Math.abs(item.transform[5] - lastItem.transform[5]) > 5) {
                                pageText += "\\n";
                            } else if (item.transform[4] > (lastItem.transform[4] + lastItem.width + 1) && !lastItem.str.endsWith(' ') && !item.str.startsWith(' ')) {
                                pageText += " ";
                            }
                        }
                        pageText += item.str;
                        lastItem = item;
                    }
                    fullText += pageText + "\\n";
                }
                extractedText = fullText;`;

    // Replace items
    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx + 1);
    const replacementLines = replacement.split('\n');
    
    const finalLines = [...before, ...replacementLines, ...after];
    
    // Save back with \r\n
    fs.writeFileSync(filepath, finalLines.join('\r\n'));
    console.log("File import updated successfully!");
} else {
    console.log("Could not find start/end bounds for file import");
}
