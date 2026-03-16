const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\[quizId]\\questions\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

// 1. Add editQuestionId state
const stateSearch = `    const [bulkImportOpen, setBulkImportOpen] = useState(false);`;
const stateReplace = `    const [bulkImportOpen, setBulkImportOpen] = useState(false);
    const [editQuestionId, setEditQuestionId] = useState<string | null>(null);`;

if (norm.includes(stateSearch)) {
    norm = norm.replace(stateSearch, stateReplace);
}

// 2. Add handleEditQuestion layout mapping
const functionsInsertSearch = `    const handleChangeCorrectOption = async (qId: string, newIdx: number) => {`;
const functionsInsert = `    const handleEditQuestion = (q: any) => {
        setEditQuestionId(q.id);
        setQType(q.type || 'multiple_choice');
        setNewText(q.question_text);
        if (q.options) setOpts(q.options);
        setCorrectIdx(q.correct_option_index || 0);
        setCorrectAnswerText(q.correct_answer || "");
        setMatchingPairs(q.matching_pairs || [{ left: "", right: "" }, { left: "", right: "" }]);
        showToast("Editando pregunta. Revisa el panel derecho.", "success");
    };

    const handleChangeCorrectOption = async (qId: string, newIdx: number) => {`;

if (norm.includes(functionsInsertSearch)) {
    norm = norm.replace(functionsInsertSearch, functionsInsert);
}

// 3. Update handleAdd logic to support Updates
const addSearch = `        setSaving(true);
        const newQ: any = {
            quiz_id: quizId,
            question_text: newText,
            type: qType,
            options: qType === 'multiple_choice' ? opts : (qType === 'true_false' ? ["Verdadero", "Falso"] : []),
            correct_option_index: (qType === 'multiple_choice' || qType === 'true_false') ? correctIdx : 0,
            correct_answer: qType === 'fill_in_the_blank' ? correctAnswerText.trim() : null,
            matching_pairs: qType === 'matching' ? matchingPairs : null
        };

        const { data, error } = await supabase.from("questions").insert([newQ]).select().single();
        if (!error && data) {
            setQuestions([...questions, data]);
            setNewText("");
            setOpts(["", "", "", ""]);
            setCorrectIdx(0);
            setCorrectAnswerText("");
            setMatchingPairs([{ left: "", right: "" }, { left: "", right: "" }]);
            showToast("Pregunta guardada exitosamente.", 'success');
        }`;

const addReplace = `        setSaving(true);
        const newQ: any = {
            quiz_id: quizId,
            question_text: newText,
            type: qType,
            options: qType === 'multiple_choice' ? opts : (qType === 'true_false' ? ["Verdadero", "Falso"] : []),
            correct_option_index: (qType === 'multiple_choice' || qType === 'true_false') ? correctIdx : 0,
            correct_answer: qType === 'fill_in_the_blank' ? correctAnswerText.trim() : null,
            matching_pairs: qType === 'matching' ? matchingPairs : null
        };

        if (editQuestionId) {
            const { data, error } = await supabase.from("questions").update(newQ).eq("id", editQuestionId).select().single();
            if (!error && data) {
                setQuestions(questions.map(q => q.id === editQuestionId ? data : q));
                setEditQuestionId(null);
                setNewText(""); setOpts(["", "", "", ""]); setCorrectIdx(0); setCorrectAnswerText(""); setMatchingPairs([{ left: "", right: "" }, { left: "", right: "" }]);
                showToast("Pregunta actualizada exitosamente.", 'success');
            } else {
                showToast("Error al actualizar: " + error?.message, 'error');
            }
        } else {
            const { data, error } = await supabase.from("questions").insert([newQ]).select().single();
            if (!error && data) {
                setQuestions([...questions, data]);
                setNewText(""); setOpts(["", "", "", ""]); setCorrectIdx(0); setCorrectAnswerText(""); setMatchingPairs([{ left: "", right: "" }, { left: "", right: "" }]);
                showToast("Pregunta guardada exitosamente.", 'success');
            }
        }`;

if (norm.includes(addSearch)) {
    norm = norm.replace(addSearch, addReplace);
}

// 4. Panel Left Static Header Setup
const layoutSearch1 = `<main className="flex-1 flex overflow-hidden">

                {/* Panel Izquierdo - Lista de Preguntas */}
                <div className="w-1/2 h-full overflow-y-auto p-8 border-r border-gray-200 bg-white">
                    <div className="max-w-xl mx-auto">
                        <div className="mb-8 pb-6 border-b border-gray-100 flex flex-col gap-5">`;

const layoutReplace1 = `<main className="flex-1 flex overflow-hidden">

                {/* Panel Izquierdo - Lista de Preguntas */}
                <div className="w-1/2 h-full flex flex-col border-r border-gray-200 bg-white">
                    <div className="p-8 pb-6 border-b border-gray-100 flex flex-col gap-5">`;

if (norm.includes(layoutSearch1)) {
    norm = norm.replace(layoutSearch1, layoutReplace1);
}

const layoutSearch2 = `                    <div className="max-w-xl mx-auto">
                        <div className="mb-8 pb-6 border-b border-gray-100 flex flex-col gap-5">`;

const layoutReplace2 = `<div className="p-8 pb-6 border-b border-gray-100 flex flex-col gap-5 bg-white z-10">`;

if (norm.includes(layoutSearch2)) {
    norm = norm.replace(layoutSearch2, layoutReplace2);
}

// Wrap the questions body with overflow scroll
const listSearch = `                    </div>

                        {questions.length === 0 ? (`;

const listReplace = `                    </div>

                        <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
                        {questions.length === 0 ? (`;

if (norm.includes(listSearch)) {
    norm = norm.replace(listSearch, listReplace);
}

// 5. Add closing div layout
const listSearch2 = `                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Derecho - Creador Fijo */}`;

const listReplace2 = `                                    </div>
                                ))}
                            </div>
                        )}
                        </div>
                    </div>
                </div>

                {/* Panel Derecho - Creador Fijo */}`;

if (norm.includes(listSearch2)) {
    norm = norm.replace(listSearch2, listReplace2);
}

// 6. Add Edit Individual Button on items list
const buttonSearch = `<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Borrar pregunta">🗑️</button>
                                        </div>`;

const buttonReplace = `<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <button onClick={() => handleEditQuestion(q)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg" title="Editar pregunta">✏️</button>
                                            <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Borrar pregunta">🗑️</button>
                                        </div>`;

if (norm.includes(buttonSearch)) {
    norm = norm.replace(buttonSearch, buttonReplace);
}

// 7. Update Title Layout and Add Cancel layout on Right Panel
const creatorTitleSearch = `<h2 className="text-2xl font-extrabold text-gray-900">Añadir Nueva</h2>`;
const creatorTitleReplace = `<h2 className="text-2xl font-extrabold text-gray-900">{editQuestionId ? '✏️ Editar Pregunta' : '✨ Añadir Nueva'}</h2>`;

if (norm.includes(creatorTitleSearch)) {
    norm = norm.replace(creatorTitleSearch, creatorTitleReplace);
}

const submitButtonSearch = `<form onSubmit={handleAdd} className="space-y-6">`;
const submitButtonReplace = `<form onSubmit={handleAdd} className="space-y-6">`;

const submitButtonInsideSearch = `                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {saving ? "Guardando..." : "➕ Guardar Pregunta"}
                                </button>`;

const submitButtonInsideReplace = `                                <div className="flex gap-2">
                                    {editQuestionId && (
                                        <button
                                            type="button"
                                            onClick={() => { setEditQuestionId(null); setNewText(""); setOpts(["", "", "", ""]); setCorrectIdx(0); setCorrectAnswerText(""); setMatchingPairs([{ left: "", right: "" }, { left: "", right: "" }]); }}
                                            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? "Guardando..." : editQuestionId ? "💾 Actualizar Pregunta" : "➕ Guardar Pregunta"}
                                    </button>
                                </div>`;

if (norm.includes(submitButtonSearch)) {
    // Find the submit button inside
    if (norm.includes(submitButtonInsideSearch)) {
        norm = norm.replace(submitButtonInsideSearch, submitButtonInsideReplace);
        console.log("Submit buttons updated for editing mode.");
    }
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done adding static headers and individual question editing");
