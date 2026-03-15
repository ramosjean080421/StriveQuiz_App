const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\[quizId]\\questions\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

const parsingSearch = `    // Función de Procesado Inteligente para detectar preguntas y opciones incluso en texto sucio
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

        if (results.length === 0) {`;

const parsingReplace = `    // Función de Procesado Inteligente para detectar preguntas y opciones incluso en texto sucio
    const parseQuestionsIntelligently = (text: string, qId: string) => {
        // Separar por salto de línea limpio
        const lines = text.split(/\\n/).map(l => l.trim()).filter(l => l.length > 0);
        const results: any[] = [];
        
        let currentQuestionText = "";
        let currentOptions: string[] = [];
        let correctIdx = 0;

        lines.forEach((line) => {
             // 1. Detectar si empieza con un número de pregunta. Ej: "1.", "1. ¿Cuál...", "10)"
             const questionMatch = line.match(/^(\\d+)[\\.\\)]\\s*(.*)/);
             if (questionMatch) {
                 // Guardar anterior si es válida
                 if (currentQuestionText && currentOptions.length >= 2) {
                     while(currentOptions.length < 4) currentOptions.push("---");
                     results.push({
                         quiz_id: qId,
                         question_text: currentQuestionText.trim(),
                         options: currentOptions.slice(0, 5),
                         correct_option_index: correctIdx,
                         type: 'multiple_choice'
                     });
                 }
                 currentQuestionText = questionMatch[2];
                 currentOptions = [];
                 correctIdx = 0;
                 return; 
             }

             // 2. Detectar si la linea contiene opciones (una o múltiples en la misma línea)
             const optionsRegex = /([A-E]|[a-e])[\\.\\)]\\s*(.*?)(?=\\s*([A-E]|[a-e])[\\.\\)]|$)/g;
             const optionMatches = [...line.matchAll(optionsRegex)];

             if (optionMatches.length > 0) {
                 optionMatches.forEach(match => {
                     let textOpt = match[2].trim();
                     if (textOpt.includes("*") || line.includes(\`*\${textOpt}*\`)) {
                         correctIdx = currentOptions.length;
                         textOpt = textOpt.replace(/\\*/g, '').trim();
                     }
                     if (textOpt.length > 0) {
                         currentOptions.push(textOpt);
                     }
                 });
             } else {
                 // 3. Es un enunciado largo o texto extra
                 if (currentQuestionText.length > 0 && currentOptions.length === 0) {
                     currentQuestionText += " " + line;
                 } else if (currentOptions.length > 0) {
                     const lastIdx = currentOptions.length - 1;
                     currentOptions[lastIdx] += " " + line;
                 }
             }
        });

        // Guardar última pregunta
        if (currentQuestionText && currentOptions.length >= 2) {
             while(currentOptions.length < 4) currentOptions.push("---");
             results.push({
                 quiz_id: qId,
                 question_text: currentQuestionText.trim(),
                 options: currentOptions.slice(0, 5),
                 correct_option_index: correctIdx,
                 type: 'multiple_choice'
             });
        }

        if (results.length === 0) {`;

if (norm.includes(parsingSearch)) {
    norm = norm.replace(parsingSearch, parsingReplace);
    console.log("Rewrote parseQuestionsIntelligently boundary.");
} else {
    console.log("Parsing search block not found.");
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done");
