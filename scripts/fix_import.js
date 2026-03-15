const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\[quizId]\\questions\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

const fileImportSearch = `            } else if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                extractedText = result.value;
            } else if (file.name.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(" ");
                    fullText += pageText + "\n";
                }
                extractedText = fullText;
            } else {`;

const fileImportReplace = `            } else if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                // Convert to HTML to preserve highilight tag marks
                const result = await mammoth.convertToHtml({ arrayBuffer });
                const htmlString = result.value;
                const cleanHtml = htmlString
                    .replace(/<mark>(.*?)<\\/mark>/g, '*$1*')
                    .replace(/<span style="background-color:[^>]+>(.*?)<\\/span>/g, '*$1*')
                    .replace(/<[^>]+>/g, '\\n'); // Strip layout to readable text
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
                            // Fix splitting words spacing bug from pdf.js kerning
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
                extractedText = fullText;
            } else {`;

if (norm.includes(fileImportSearch)) {
    norm = norm.replace(fileImportSearch, fileImportReplace);
    console.log("File import extraction replaced.");
} else {
    console.log("File import search block not found");
}

const parseSearch = `    // Función de Procesado Inteligente para detectar preguntas y opciones incluso en texto sucio
    const parseQuestionsIntelligently = (text: string, qId: string) => {
        // Normalizar el texto: quitar múltiples espacios y unificar saltos de línea
        const cleanText = text.replace(/\\s+/g, ' ').trim();
        
        // Expresión regular para encontrar el inicio de una pregunta (Ej: "1. ¿Cuál...")
        // Buscamos números seguidos de punto o paréntesis
        const questionRegex = /(\\d+)[\\.\\)]\\s*(.*?)(?=\\s*\\d+[\\.\\)]|$)/g;
        const matches = [...cleanText.matchAll(questionRegex)];
        
        const results: any[] = [];
        
        matches.forEach(match => {
            const fullBlock = match[0];
            const content = match[2];
            
            // Intentar detectar opciones dentro del bloque (A), B), etc.)
            const optionsRegex = /([A-D]|[a-d])[\\.\\)]\\s*(.*?)(?=\\s*([A-D]|[a-d])[\\.\\)]|$)/g;
            const optionMatches = [...content.matchAll(optionsRegex)];
            
            if (optionMatches.length >= 2) {
                // Es una pregunta con opciones detectadas
                const questionText = content.split(/[A-D][\\.\\)]/)[0].trim();
                const options = optionMatches.slice(0, 4).map(o => o[2].trim());
                
                // Rellenar si faltan hasta 4
                while(options.length < 4 && options.length > 0) options.push("---");
                
                if (questionText && options.length >= 2) {
                    results.push({
                        quiz_id: qId,
                        question_text: questionText,
                        options: options,
                        correct_option_index: 0,
                        type: 'multiple_choice'
                    });
                }
            }
        });

        // Si el regex inteligente no funcionó (no hay números), probar con el método original de 5 líneas
        if (results.length === 0) {
            const lines = text.split(/\\n/).map(l => l.trim()).filter(l => l.length > 0);
            for (let i = 0; i < lines.length; i += 5) {
                if (i + 4 < lines.length) {
                    results.push({
                        quiz_id: qId,
                        question_text: lines[i].replace(/^\\d+[\\.\\-\\)]\\s*/, ''),
                        options: [
                            lines[i+1].replace(/^(([A-D]|[a-d])[\\.\\)]|[1-4]\\.|[\\-\\*])\\s*/, ''),
                            lines[i+2].replace(/^(([A-D]|[a-d])[\\.\\)]|[1-4]\\.|[\\-\\*])\\s*/, ''),
                            lines[i+3].replace(/^(([A-D]|[a-d])[\\.\\)]|[1-4]\\.|[\\-\\*])\\s*/, ''),
                            lines[i+4].replace(/^(([A-D]|[a-d])[\\.\\)]|[1-4]\\.|[\\-\\*])\\s*/, '')
                        ],
                        correct_option_index: 0,
                        type: 'multiple_choice'
                    });
                }
            }
        }

        return results;
    };`;

const parseReplace = `    // Función de Procesado Inteligente para detectar preguntas y opciones incluso en texto sucio
    const parseQuestionsIntelligently = (text: string, qId: string) => {
        // Normalizar el texto: quitar múltiples espacios y unificar saltos de línea
        const cleanText = text.replace(/\\s+/g, ' ').trim();
        
        // Expresión regular para encontrar el inicio de una pregunta (Ej: "1. ¿Cuál...")
        const questionRegex = /(\\d+)[\\.\\)]\\s*(.*?)(?=\\s*\\d+[\\.\\)]|$)/g;
        const matches = [...cleanText.matchAll(questionRegex)];
        
        const results: any[] = [];
        
        matches.forEach(match => {
            const fullBlock = match[0];
            const content = match[2];
            
            // Aumentado a E para soportar 5 opciones
            const optionsRegex = /([A-E]|[a-e])[\\.\\)]\\s*(.*?)(?=\\s*([A-E]|[a-e])[\\.\\)]|$)/g;
            const optionMatches = [...content.matchAll(optionsRegex)];
            
            if (optionMatches.length >= 2) {
                const questionText = content.split(/[A-E][\\.\\)]/)[0].trim();
                const options = optionMatches.slice(0, 5).map(o => o[2].trim());
                
                let correctIdx = 0;
                const cleanedOptions = options.map((opt, i) => {
                    // Detectar si está resaltada/marcada con asteriscos
                    if (opt.startsWith("*") || opt.endsWith("*") || opt.includes("*")) {
                        correctIdx = i;
                        return opt.replace(/\\*/g, '').trim();
                    }
                    return opt;
                });

                // Rellenar si faltan hasta 4 para evitar errores de renderizado
                while(cleanedOptions.length < 4 && cleanedOptions.length > 0) cleanedOptions.push("---");
                
                if (questionText && cleanedOptions.length >= 2) {
                    results.push({
                        quiz_id: qId,
                        question_text: questionText,
                        options: cleanedOptions,
                        correct_option_index: correctIdx,
                        type: 'multiple_choice'
                    });
                }
            }
        });

        if (results.length === 0) {
            const lines = text.split(/\\n/).map(l => l.trim()).filter(l => l.length > 0);
            for (let i = 0; i < lines.length; i += 5) {
                if (i + 4 < lines.length) {
                    let correctIdx = 0;
                    const rawOpts = [lines[i+1], lines[i+2], lines[i+3], lines[i+4]];
                    const cleanedOpts = rawOpts.map((opt, j) => {
                        let textOpt = opt.replace(/^(([A-E]|[a-e])[\\.\\)]|[1-4]\\.|[\\-\\*])\\s*/, '');
                        if (opt.includes("*") || textOpt.includes("*")) {
                            correctIdx = j;
                            textOpt = textOpt.replace(/\\*/g, '').trim();
                        }
                        return textOpt;
                    });

                    results.push({
                        quiz_id: qId,
                        question_text: lines[i].replace(/^\\d+[\\.\\-\\)]\\s*/, ''),
                        options: cleanedOpts,
                        correct_option_index: correctIdx,
                        type: 'multiple_choice'
                    });
                }
            }
        }

        return results;
    };`;

if (norm.includes(parseSearch)) {
    norm = norm.replace(parseSearch, parseReplace);
    console.log("parseQuestions intelligent algorithm replaced.");
} else {
    console.log("parseSearch fallback failed: manual match fallback");
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done");
