const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\[quizId]\\questions\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

// 1. Add Duplicate check in handleAdd
const handleAddSearch = `        setSaving(true);
        const newQ: any = {`;

const handleAddReplace = `        // Evitar preguntas repetidas
        const isDuplicate = questions.some(q => q.id !== editQuestionId && q.question_text.trim().toLowerCase() === newText.trim().toLowerCase());
        if (isDuplicate) {
            showToast("Esta pregunta ya existe en tu banco.", "error");
            return;
        }

        setSaving(true);
        const newQ: any = {`;

if (norm.includes(handleAddSearch)) {
    norm = norm.replace(handleAddSearch, handleAddReplace);
}

// 2. Add Duplicate batch check in handleBulkProcess
const handleBulkSearch = `        setSaving(true);
        const newQuestions = parseQuestionsIntelligently(bulkText, quizId);

        if (newQuestions.length > 0) {`;

const handleBulkReplace = `        setSaving(true);
        const parsed = parseQuestionsIntelligently(bulkText, quizId);
        
        // Filtrar repetidas
        const newQuestions = parsed.filter(newQ => {
            return !questions.some(q => q.question_text.trim().toLowerCase() === newQ.question_text.trim().toLowerCase());
        });

        const duplicatesCount = parsed.length - newQuestions.length;
        if (duplicatesCount > 0) {
            showToast(\`Omitidas \${duplicatesCount} preguntas repetidas\`, 'error');
        }

        if (newQuestions.length > 0) {`;

if (norm.includes(handleBulkSearch)) {
    norm = norm.replace(handleBulkSearch, handleBulkReplace);
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done adding duplicate validations");
