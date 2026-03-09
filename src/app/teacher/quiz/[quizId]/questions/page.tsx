"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Question {
    id: string;
    type?: 'multiple_choice' | 'true_false' | 'fill_in_the_blank' | 'matching';
    question_text: string;
    options: string[];
    correct_option_index: number;
    correct_answer?: string;
    matching_pairs?: { left: string; right: string }[];
}

export default function QuizQuestionsManager({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);

    const [newText, setNewText] = useState("");
    const [qType, setQType] = useState<'multiple_choice' | 'true_false' | 'fill_in_the_blank' | 'matching'>('multiple_choice');
    const [opts, setOpts] = useState(["", "", "", ""]);
    const [correctIdx, setCorrectIdx] = useState(0);
    const [correctAnswerText, setCorrectAnswerText] = useState("");
    const [matchingPairs, setMatchingPairs] = useState([{ left: "", right: "" }, { left: "", right: "" }]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchQs = async () => {
            const { data } = await supabase
                .from("questions")
                .select("*")
                .eq("quiz_id", quizId)
                .order("created_at", { ascending: true });

            if (data) setQuestions(data);
            setLoading(false);
        };
        fetchQs();
    }, [quizId]);

    const handleUpdateOption = (index: number, value: string) => {
        const newOpts = [...opts];
        newOpts[index] = value;
        setOpts(newOpts);
    };

    // Función mágica para extraer y guardar MÚLTIPLES preguntas al hacer Control+V
    const handlePaste = async (e: React.ClipboardEvent) => {
        const pasteData = e.clipboardData.getData('text');
        if (!pasteData) return;

        // Limpiar líneas vacías
        const lines = pasteData.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        // Si son 5 o más líneas, podríamos estar pegando múltiples preguntas
        if (lines.length >= 5) {
            e.preventDefault();

            if (!confirm(`Parece que estás intentando pegar hasta ${Math.floor(lines.length / 5)} preguntas a la vez. ¿Quieres procesarlas e insertarlas automáticamente?`)) {
                return;
            }

            setSaving(true);
            const newQuestions = [];

            // Leemos bloques de 5 líneas (1 pregunta + 4 opciones)
            for (let i = 0; i < lines.length; i += 5) {
                if (i + 4 < lines.length) {
                    const questionText = lines[i].replace(/^\d+[\.\-\)]\s*/, ''); // Quitar número inicial ej. "1."
                    const optionTexts = [
                        lines[i + 1].replace(/^([A-D]\)|[a-d]\)|[1-4]\.|\-|\*)\s*/, ''),
                        lines[i + 2].replace(/^([A-D]\)|[a-d]\)|[1-4]\.|\-|\*)\s*/, ''),
                        lines[i + 3].replace(/^([A-D]\)|[a-d]\)|[1-4]\.|\-|\*)\s*/, ''),
                        lines[i + 4].replace(/^([A-D]\)|[a-d]\)|[1-4]\.|\-|\*)\s*/, '')
                    ];

                    newQuestions.push({
                        quiz_id: quizId,
                        question_text: questionText,
                        options: optionTexts,
                        correct_option_index: 0 // Por defecto la A, el profesor debe ajustarla luego si desea
                    });
                }
            }

            if (newQuestions.length > 0) {
                const { data, error } = await supabase.from("questions").insert(newQuestions).select();
                if (!error && data) {
                    setQuestions(prev => [...prev, ...data]);
                    alert(`¡${data.length} preguntas añadidas con éxito! Recuerda revisar cuál es la opción correcta en cada una.`);
                } else {
                    alert("Hubo un error al insertar el bloque: " + error?.message);
                }
            }
            setSaving(false);

        } else if (lines.length >= 2) {
            // Comportamiento original para 1 sola pregunta
            e.preventDefault();
            setNewText(lines[0].replace(/^\d+[\.\-\)]\s*/, ''));

            const extractedOptions = lines.slice(1, 5);
            const newOpts = [...opts];
            extractedOptions.forEach((opt, idx) => {
                const cleanOpt = opt.replace(/^([A-D]\)|[a-d]\)|[1-4]\.|\-|\*)\s*/, '');
                if (idx < 4) newOpts[idx] = cleanOpt;
            });
            setOpts(newOpts);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newText) {
            alert("Por favor llena la pregunta.");
            return;
        }

        if (qType === 'multiple_choice' && opts.some(o => !o.trim())) {
            alert("Para Opción Múltiple, todas las opciones deben tener texto."); return;
        }
        if (qType === 'fill_in_the_blank' && !correctAnswerText.trim()) {
            alert("Para Para Llenar, ingresa la respuesta correcta exacta."); return;
        }
        if (qType === 'matching' && matchingPairs.some(p => !p.left.trim() || !p.right.trim())) {
            alert("Para Pareo, todos los pares de izquierda y derecha deben estar llenos."); return;
        }

        setSaving(true);
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
        } else {
            alert("Error al guardar: " + error?.message);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta pregunta para siempre?")) return;
        setQuestions(questions.filter(q => q.id !== id));
        await supabase.from("questions").delete().eq("id", id);
    };

    const handleChangeCorrectOption = async (qId: string, newIdx: number) => {
        // Update local state first (optimistic UI)
        setQuestions(questions.map(q => q.id === qId ? { ...q, correct_option_index: newIdx } : q));

        // Update database
        const { error } = await supabase.from("questions").update({ correct_option_index: newIdx }).eq("id", qId);
        if (error) {
            alert("Error al actualizar la opción correcta: " + error.message);
        }
    };

    const optionColors = [
        "bg-rose-50 text-rose-700 border-rose-200",
        "bg-blue-50 text-blue-700 border-blue-200",
        "bg-amber-50 text-amber-700 border-amber-200",
        "bg-emerald-50 text-emerald-700 border-emerald-200"
    ];

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
            <span className="text-xl font-bold text-indigo-600 animate-pulse">Cargando preguntas de la aventura...</span>
        </div>
    );

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 font-sans">

            {/* Cabecera Clásica Prisma */}
            <header className="flex-shrink-0 bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                    <Link
                        href="/teacher/dashboard"
                        className="group flex items-center gap-2 px-3 sm:px-4 py-2 bg-white hover:bg-gray-50 rounded-xl text-gray-500 hover:text-indigo-600 transition-all border border-gray-200 shadow-sm"
                        title="Volver al Dashboard"
                    >
                        <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="font-bold text-sm hidden sm:block">Volver</span>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                            Gestor de Preguntas
                        </h1>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Fase 2 de la Aventura</p>
                    </div>
                </div>
                <div>
                    <Link href="/teacher/dashboard" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-[0_5px_15px_rgba(79,70,229,0.3)] hover:shadow-lg hover:-translate-y-0.5 active:scale-95 inline-flex">
                        ✅ Terminar y Volver
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">

                {/* Panel Izquierdo - Lista de Preguntas */}
                <div className="w-1/2 h-full overflow-y-auto p-8 border-r border-gray-200 bg-white">
                    <div className="max-w-xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-extrabold text-gray-900">Banco Actual</h2>
                            <span className="bg-indigo-100 text-indigo-700 font-black px-3 py-1 rounded-lg">
                                {questions.length} Preguntas
                            </span>
                        </div>

                        {questions.length === 0 ? (
                            <div className="text-center p-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300">
                                <span className="text-5xl block mb-4 filter grayscale opacity-50">📝</span>
                                <h3 className="text-xl font-bold text-gray-700 mb-2">No tienes preguntas</h3>
                                <p className="text-gray-500 text-sm">Añade tu primera pregunta desde el panel de la derecha para que los estudiantes puedan avanzar en el juego.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {questions.map((q, idx) => (
                                    <div key={q.id} className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow relative group">
                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Borrar pregunta">🗑️</button>
                                        </div>
                                        <div className="flex items-start gap-4 pr-8">
                                            <span className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">{idx + 1}</span>
                                            <div className="flex-1 w-full">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-indigo-200">
                                                        {q.type === 'true_false' ? 'Verdadero o Falso' :
                                                            q.type === 'fill_in_the_blank' ? 'Para Llenar' :
                                                                q.type === 'matching' ? 'Pareo' : 'Opción Múltiple'}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-900 mb-3 leading-tight">{q.question_text}</h4>

                                                {(q.type === 'multiple_choice' || !q.type || q.type === 'true_false') && (
                                                    <div className={`grid ${q.type === 'true_false' ? 'grid-cols-2' : 'grid-cols-2'} gap-2 mt-2`}>
                                                        {q.options.map((opt, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={() => handleChangeCorrectOption(q.id, i)}
                                                                className={`px-3 py-2.5 text-xs font-bold rounded-lg border cursor-pointer transition-all ${i === q.correct_option_index ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-white hover:shadow-sm'}`}
                                                                title="Haz clic para marcar esta opción como correcta"
                                                            >
                                                                {i === q.correct_option_index && <span className="mr-1 inline-block animate-bounce-short">✅</span>}
                                                                {opt}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {q.type === 'fill_in_the_blank' && (
                                                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mt-2">
                                                        <span className="text-xs font-bold text-emerald-700 block mb-1">Respuesta Exacta Guardada:</span>
                                                        <span className="font-black text-emerald-900 border-b-2 border-emerald-300 pb-0.5 inline-block">{q.correct_answer}</span>
                                                    </div>
                                                )}

                                                {q.type === 'matching' && q.matching_pairs && (
                                                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl mt-2 grid grid-cols-1 gap-2">
                                                        {q.matching_pairs.map((pair, pidx) => (
                                                            <div key={pidx} className="flex items-center gap-3 text-sm font-bold bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                                                <div className="flex-1 text-center bg-indigo-50 text-indigo-800 py-1 px-2 rounded">{pair.left}</div>
                                                                <span className="text-gray-400">↔️</span>
                                                                <div className="flex-1 text-center bg-amber-50 text-amber-800 py-1 px-2 rounded">{pair.right}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Derecho - Creador Fijo */}
                <div className="w-1/2 h-full bg-gray-50 p-8 overflow-y-auto">
                    <div className="max-w-xl mx-auto">
                        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
                            <div className="flex items-center gap-3 mb-8">
                                <span className="text-3xl">✨</span>
                                <h2 className="text-2xl font-extrabold text-gray-900">Añadir Nueva</h2>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Pregunta</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'multiple_choice', icon: '📝', label: 'Opción Múltiple' },
                                            { id: 'true_false', icon: '⚖️', label: 'V o F' },
                                            { id: 'fill_in_the_blank', icon: '✍️', label: 'Para Llenar' },
                                            { id: 'matching', icon: '🔗', label: 'Pareo / Unión' },
                                        ].map(t => (
                                            <button
                                                key={t.id} type="button" onClick={() => setQType(t.id as any)}
                                                className={`p-2.5 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1 transition-all ${qType === t.id ? 'border-indigo-600 bg-indigo-50 text-indigo-800 fill-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:bg-gray-50'}`}
                                            >
                                                <span className="text-xl">{t.icon}</span> {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">La Pregunta o Reto</label>
                                    <textarea
                                        required
                                        value={newText}
                                        onChange={e => setNewText(e.target.value)}
                                        onPaste={qType === 'multiple_choice' ? handlePaste : undefined}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none shadow-inner"
                                        placeholder="Ej. ¿Cuál es la capital secreta del imperio?"
                                    />
                                </div>

                                {qType === 'multiple_choice' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-3">Opciones y Respuesta Correcta</label>
                                        <p className="text-xs text-gray-500 mb-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100/50 leading-relaxed font-medium">
                                            💡 <strong>Truco:</strong> Puedes copiar 20 preguntas seguidas desde Word (Ej. 1 pregunta seguida de 4 líneas de opciones) y pegarlas en la caja de arriba para importarlas.
                                        </p>

                                        <div className="space-y-3">
                                            {opts.map((opt, i) => (
                                                <div key={i} className={`flex items-center gap-3 p-2 pr-3 rounded-xl border-2 transition-all ${correctIdx === i ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
                                                    <div
                                                        onClick={() => setCorrectIdx(i)}
                                                        className={`w-6 h-6 ml-2 rounded-full border-2 flex-shrink-0 cursor-pointer flex items-center justify-center transition-all ${correctIdx === i ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}
                                                    >
                                                        {correctIdx === i && <span className="text-white text-xs">✓</span>}
                                                    </div>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={opt}
                                                        onChange={e => handleUpdateOption(i, e.target.value)}
                                                        className={`flex-1 bg-transparent border-0 focus:ring-0 text-sm font-bold px-2 py-2 ${correctIdx === i ? 'text-emerald-900' : 'text-gray-700'}`}
                                                        placeholder={`Opción ${i + 1}`}
                                                    />
                                                    <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black ${optionColors[i]}`}>
                                                        {['A', 'B', 'C', 'D'][i]}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {qType === 'true_false' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-3">¿Cuál es la correcta?</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div onClick={() => setCorrectIdx(0)} className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center justify-center gap-2 font-black transition-all ${correctIdx === 0 ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300'}`}>
                                                <span className="text-3xl">✅</span> VERDADERO
                                            </div>
                                            <div onClick={() => setCorrectIdx(1)} className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center justify-center gap-2 font-black transition-all ${correctIdx === 1 ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-red-300'}`}>
                                                <span className="text-3xl">❌</span> FALSO
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {qType === 'fill_in_the_blank' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Respuesta Correcta Exacta</label>
                                        <input
                                            type="text"
                                            required
                                            value={correctAnswerText}
                                            onChange={(e) => setCorrectAnswerText(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border-2 border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl text-emerald-900 font-extrabold transition-all shadow-inner"
                                            placeholder="Ej. Napoleón"
                                        />
                                        <p className="text-xs text-gray-400 mt-2 italic">*El estudiante deberá escribir exactamente esta palabra (ignorando mayúsculas).</p>
                                    </div>
                                )}

                                {qType === 'matching' && (
                                    <div>
                                        <div className="flex justify-between items-end mb-3">
                                            <label className="block text-sm font-bold text-gray-700">Pares Correctos</label>
                                            <button
                                                type="button"
                                                onClick={() => setMatchingPairs([...matchingPairs, { left: "", right: "" }])}
                                                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                                            >+ Añadir Par</button>
                                        </div>
                                        <div className="space-y-3">
                                            {matchingPairs.map((pair, pIdx) => (
                                                <div key={pIdx} className="flex items-center gap-2 group">
                                                    <input
                                                        required type="text" placeholder="Categoría A" value={pair.left}
                                                        onChange={(e) => {
                                                            const np = [...matchingPairs]; np[pIdx].left = e.target.value; setMatchingPairs(np);
                                                        }}
                                                        className="w-full px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-bold text-indigo-900"
                                                    />
                                                    <span className="text-xl">↔️</span>
                                                    <input
                                                        required type="text" placeholder="Concepto B" value={pair.right}
                                                        onChange={(e) => {
                                                            const np = [...matchingPairs]; np[pIdx].right = e.target.value; setMatchingPairs(np);
                                                        }}
                                                        className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-bold text-amber-900"
                                                    />
                                                    {matchingPairs.length > 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setMatchingPairs(matchingPairs.filter((_, i) => i !== pIdx))}
                                                            className="text-red-400 hover:text-red-600 font-black opacity-0 group-hover:opacity-100"
                                                        >×</button>
                                                    )}
                                                </div>
                                            ))}
                                            <p className="text-xs text-gray-400 mt-3 italic">*La app mezclará automáticamente el lado derecho cuando el estudiante juegue.</p>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full mt-8 flex items-center justify-center gap-2 py-4 px-4 text-base font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 hover:shadow-lg disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {saving ? "Guardando..." : "➕ Agregar Pregunta al Quiz"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
