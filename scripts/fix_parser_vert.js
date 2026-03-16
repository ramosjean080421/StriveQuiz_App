const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\[quizId]\\questions\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

// 1. Rewrite parseQuestionsIntelligently to maintain formatting and eliminate fallback
const parsingSearch = `    // Función de Procesado Inteligente para detectar preguntas y opciones incluso en texto sucio
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

const parsingReplace = `    // Función de Procesado Inteligente para detectar preguntas y opciones incluso en texto sucio
    const parseQuestionsIntelligently = (text: string, qId: string) => {
        // Separar por salto de línea limpio
        const lines = text.split(/\\n/).map(l => l.trim()).filter(l => l.length > 0);
        const results: any[] = [];
        
        let currentQuestionText = "";
        let currentOptions: string[] = [];
        let correctIdx = 0;

        // Si no hay ninguna línea que empiece con número, asumimos que todo es una sola pregunta
        const hasNumberHeaders = lines.some(line => line.match(/^(\\d+)[\\.\\)]\\s*(.*)/));

        lines.forEach((line) => {
             const questionMatch = line.match(/^(\\d+)[\\.\\)]\\s*(.*)/);
             const optionsRegex = /([A-E]|[a-e])[\\.\\)]\\s*(.*?)(?=\\s*([A-E]|[a-e])[\\.\\)]|$)/g;
             const optionMatches = [...line.matchAll(optionsRegex)];

             // 1. Detectar si empieza una nueva pregunta (solo si hay listas numeradas globales para no romper textos unitarios)
             if (questionMatch && hasNumberHeaders) {
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
             } 
             // 2. Detectar si contiene alternativas letras (como A) B) C))
             else if (optionMatches.length > 0) {
                 optionMatches.forEach(match => {
                     let textOpt = match[2].trim();
                     if (textOpt.includes("*") || line.includes(\`*\${textOpt}*\`)) {
                         correctIdx = currentOptions.length;
                         textOpt = textOpt.replace(/\\*/g, '').trim();
                     }
                     if (textOpt.length > 0) currentOptions.push(textOpt);
                 });
             } 
             // 3. Continuación de enunciado o alternativa larga
             else {
                 if (currentOptions.length > 0) {
                     const lastIdx = currentOptions.length - 1;
                     currentOptions[lastIdx] += "\\n" + line; 
                 } else {
                     // Conservar saltos de línea verticales en el enunciado
                     currentQuestionText += (currentQuestionText ? "\\n" : "") + line;
                 }
             }
        });

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

        // ELIMINADO EL FALLBACK RÍGIDO DE 1+4
        if (false) {`;

if (norm.includes(parsingSearch)) {
    norm = norm.replace(parsingSearch, parsingReplace);
    console.log("Rewrote parseQuestionsIntelligently to fix vertical alignment and fix Roman Numerals.");
} else {
    console.log("Parsing search block not found.");
}

// 2. Add whitespace-pre-line to card question rendering
const renderSearch = `<h4 className="text-lg font-bold text-gray-900 mb-3 leading-tight">{q.question_text}</h4>`;
const renderReplace = `<h4 className="text-lg font-bold text-gray-900 mb-3 leading-tight whitespace-pre-line">{q.question_text}</h4>`;

if (norm.includes(renderSearch)) {
    norm = norm.replace(renderSearch, renderReplace);
}

const renderOptionSearch = `<div
                                                                key={i}
                                                                onClick={() => handleChangeCorrectOption(q.id, i)}
                                                                className={\`px-3 py-2.5 text-xs font-bold rounded-lg border cursor-pointer transition-all \${i === q.correct_option_index ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-white'}\`}
                                                                title="Haz clic para marcar esta opción como correcta"
                                                            >
                                                                {i === q.correct_option_index && <span className="mr-1 inline-block animate-bounce-short">✅</span>}
                                                                {opt}
                                                            </div>`;

const renderOptionReplace = `<div
                                                                key={i}
                                                                onClick={() => handleChangeCorrectOption(q.id, i)}
                                                                className={\`px-3 py-2.5 text-xs font-bold rounded-lg border cursor-pointer transition-all whitespace-pre-line \${i === q.correct_option_index ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-white'}\`}
                                                                title="Haz clic para marcar esta opción como correcta"
                                                            >
                                                                {i === q.correct_option_index && <span className="mr-1 inline-block animate-bounce-short">✅</span>}
                                                                {opt}
                                                            </div>`;

if (norm.includes(renderOptionSearch)) {
    norm = norm.replace(renderOptionSearch, renderOptionReplace);
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done");
