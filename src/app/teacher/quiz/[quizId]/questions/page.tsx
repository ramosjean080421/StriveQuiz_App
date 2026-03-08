"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Question {
    id: string;
    question_text: string;
    options: string[];
    correct_option_index: number;
}

export default function QuizQuestionsManager({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);

    const [newText, setNewText] = useState("");
    const [opts, setOpts] = useState(["", "", "", ""]);
    const [correctIdx, setCorrectIdx] = useState(0);
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

    // Función mágica para extraer preguntas y opciones al hacer Control+V
    const handlePaste = (e: React.ClipboardEvent) => {
        const pasteData = e.clipboardData.getData('text');
        if (!pasteData) return;

        // Detectar si el texto copiado tiene múltiples líneas (formato Word/Bloc de notas)
        const lines = pasteData.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        if (lines.length >= 2) {
            e.preventDefault(); // Evitamos que se pegue de golpe en el título

            // La primera línea suele ser la pregunta
            setNewText(lines[0]);

            // Las siguientes líneas (hasta 4) son las opciones
            const extractedOptions = lines.slice(1, 5);
            const newOpts = [...opts];

            extractedOptions.forEach((opt, idx) => {
                // Eliminar viñetas comunes como "A)", "1.", "-", etc, al inicio
                const cleanOpt = opt.replace(/^([A-D]\)|[a-d]\)|[1-4]\.|\-|\*)\s*/, '');
                if (idx < 4) newOpts[idx] = cleanOpt;
            });

            setOpts(newOpts);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newText || opts.some(o => !o.trim())) {
            alert("Por favor llena la pregunta y asegúrate de que todas las opciones tengan texto.");
            return;
        }

        setSaving(true);
        const newQ = {
            quiz_id: quizId,
            question_text: newText,
            options: opts,
            correct_option_index: correctIdx
        };

        const { data, error } = await supabase.from("questions").insert([newQ]).select().single();
        if (!error && data) {
            setQuestions([...questions, data]);
            setNewText("");
            setOpts(["", "", "", ""]);
            setCorrectIdx(0);
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
                    <Link href="/teacher/dashboard" className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-indigo-600 transition-colors" title="Volver al Dashboard">
                        <span className="text-xl">&larr;</span>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                            Gestor de Preguntas
                        </h1>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Fase 2 de la Aventura</p>
                    </div>
                </div>
                <div>
                    <Link href="/teacher/dashboard" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm shadow-indigo-200">
                        Terminar y Volver
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
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900 mb-3">{q.question_text}</h4>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {q.options.map((opt, i) => (
                                                        <div key={i} className={`px-3 py-2 text-xs font-bold rounded-lg border ${i === q.correct_option_index ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                                            {i === q.correct_option_index && <span className="mr-1">✅</span>}
                                                            {opt}
                                                        </div>
                                                    ))}
                                                </div>
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
                                    <label className="block text-sm font-bold text-gray-700 mb-2">La Pregunta o Reto</label>
                                    <textarea
                                        required
                                        value={newText}
                                        onChange={e => setNewText(e.target.value)}
                                        onPaste={handlePaste}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none shadow-inner"
                                        placeholder="Ej. ¿Cuál es la capital secreta del imperio? (También puedes pegar desde Word/Bloc aquí)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Opciones y Respuesta Correcta</label>
                                    <p className="text-xs text-gray-500 mb-4 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                                        💡 Escribe las 4 opciones y selecciona el circulito de la que será la respuesta <strong>Correcta</strong>.
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
