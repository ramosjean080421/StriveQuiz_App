"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Configurar el worker de PDF.js localmente con ruta absoluta
if (typeof window !== "undefined") {
    // Usamos una ruta absoluta basada en el origen para evitar fallos de carga
    pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';
}

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
    const [canEdit, setCanEdit] = useState(false);
    const [gameMode, setGameMode] = useState<string>('classic');

    const [newText, setNewText] = useState("");
    const [qType, setQType] = useState<'multiple_choice' | 'true_false' | 'fill_in_the_blank' | 'matching'>('multiple_choice');
    const [opts, setOpts] = useState(["", "", "", ""]);
    const [correctIdx, setCorrectIdx] = useState(0);
    const [correctAnswerText, setCorrectAnswerText] = useState("");
    const [matchingPairs, setMatchingPairs] = useState([{ left: "", right: "" }, { left: "", right: "" }]);
    const [saving, setSaving] = useState(false);

    // Modales Personalizados
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDestructive?: boolean } | null>(null);
    const [bulkImportOpen, setBulkImportOpen] = useState(false);
    const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
    const [bulkText, setBulkText] = useState("");

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        const checkPermsAndFetch = async () => {
            setLoading(true);
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (!authUser) {
                router.push("/teacher/login");
                return;
            }
            // 1. Verificar si el usuario tiene permiso sobre este quiz
            const { data: quizData, error: quizError } = await supabase
                .from("quizzes")
                .select("teacher_id, editors_emails, game_mode")
                .eq("id", quizId)
                .single();

            if (quizError || !quizData) {
                showToast("No se pudo encontrar este tablero o no tienes acceso.", "error");
                setTimeout(() => router.push("/teacher/dashboard"), 2000);
                return;
            }

            const userEmail = authUser.email?.toLowerCase();
            const isOwner = quizData.teacher_id === authUser.id;
            const isEditor = quizData.editors_emails?.includes(userEmail);

            if (!isOwner && !isEditor) {
                // Si es solo lector (está en shared_with_emails pero no en editors_emails o no es dueño)
                setCanEdit(false);
                showToast("Acceso denegado: Solo tienes permiso de lectura.", "error");
                setTimeout(() => router.push("/teacher/dashboard"), 2000);
                return;
            }

            setCanEdit(true);
            if (quizData.game_mode) setGameMode(quizData.game_mode);

            // 2. Cargar preguntas solo si tiene permiso
            const { data } = await supabase
                .from("questions")
                .select("*")
                .eq("quiz_id", quizId)
                .order("created_at", { ascending: true });

            if (data) setQuestions(data);
            setLoading(false);
        };
        checkPermsAndFetch();
    }, [quizId, router]);

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
            const processPastedQuestions = async () => {
                setSaving(true);
                const rawText = pasteData;
                const questionsFound = parseQuestionsIntelligently(rawText, quizId);

                if (questionsFound.length > 0) {
                    const { data, error } = await supabase.from("questions").insert(questionsFound).select();
                    if (!error && data) {
                        setQuestions(prev => [...prev, ...data]);
                        showToast(`¡${data.length} preguntas inteligentes añadidas!`, 'success');
                    } else {
                        showToast("Error al insertar: " + error?.message, 'error');
                    }
                } else {
                    showToast("No se detectó un formato válido de preguntas.", "error");
                }
                setSaving(false);
                setConfirmModal(null);
            };

            setConfirmModal({
                isOpen: true,
                title: "Importar Preguntas",
                message: `Parece que estás intentando pegar hasta ${Math.floor(lines.length / 5)} preguntas a la vez. ¿Quieres procesarlas e insertarlas automáticamente?`,
                onConfirm: processPastedQuestions
            });

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
            showToast("Por favor llena la pregunta.", 'error');
            return;
        }

        if (qType === 'multiple_choice' && opts.some(o => !o.trim())) {
            showToast("Para Opción Múltiple, todas las opciones deben tener texto.", 'error'); return;
        }
        if (qType === 'fill_in_the_blank' && !correctAnswerText.trim()) {
            showToast("Para Llenar, ingresa la respuesta correcta exacta.", 'error'); return;
        }
        if (qType === 'matching' && matchingPairs.some(p => !p.left.trim() || !p.right.trim())) {
            showToast("Para Pareo, todos los pares deben estar llenos.", 'error'); return;
        }

        // Se removió el filtro de isDuplicate aquí para que los profesores puedan tener la misma 
        // pregunta genérica repetida en el banco (ej: "Selecciona la respuesta correcta:") 
        // sin que les salte error.

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
            } else {
                showToast("Error al guardar: " + error?.message, 'error');
            }
        }
        setSaving(false);
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            let extractedText = "";

            if (file.name.endsWith('.csv')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target?.result as string;
                    setBulkText(content);
                    setBulkImportOpen(true);
                    setLoading(false);
                };
                reader.readAsText(file);
                return;
            } else if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                const htmlString = result.value;
                const cleanHtml = htmlString
                    .replace(/<mark>(.*?)<\/mark>/g, '*$1*')
                    .replace(/<span style="background-color:[^>]+>(.*?)<\/span>/g, '*$1*')
                    .replace(/<[^>]+>/g, '\n');
                extractedText = cleanHtml;
            } else if (file.name.endsWith('.pdf')) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    let pageText = "";
                    let lastItem: any = null;
                    
                    for (const item of textContent.items as any[]) {
                        if (lastItem) {
                            if (Math.abs(item.transform[5] - lastItem.transform[5]) > 5) {
                                pageText += "\n";
                            } else if (item.transform[4] > (lastItem.transform[4] + lastItem.width + 1) && !lastItem.str.endsWith(' ') && !item.str.startsWith(' ')) {
                                pageText += " ";
                            }
                        }
                        pageText += item.str;
                        lastItem = item;
                    }
                    fullText += pageText + "\n";
                }
                extractedText = fullText;
            } else {
                showToast("Formato no compatible. Usa PDF, Word o CSV.", "error");
                setLoading(false);
                return;
            }

            if (extractedText && extractedText.trim().length > 10) {
                // Limpiar un poco el texto extraído
                const cleanText = extractedText
                    .replace(/\t/g, " ")
                    .replace(/ {2,}/g, " ")
                    .split(/\n/)
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .join("\n");
                
                const lines = cleanText.split("\n");

                // Solo abrimos el modal si detectamos que al menos hay estructura de una pregunta (5 líneas)
                if (lines.length >= 5) {
                    setBulkText(cleanText);
                    setBulkImportOpen(true);
                    showToast("Documento procesado. Revisa y organiza las preguntas.", "success");
                } else {
                    showToast("El archivo no tiene el formato necesario (Mínimo 5 líneas para una pregunta).", "error");
                }
            } else {
                showToast("No se pudo extraer texto legible de este archivo.", "error");
            }
        } catch (error) {
            console.error("Error al procesar archivo:", error);
            showToast("Error al leer el documento.", "error");
        }
        setLoading(false);
        e.target.value = ""; // Reset
    };

    // Función de Procesado Inteligente para detectar preguntas y opciones incluso en texto sucio
    const parseQuestionsIntelligently = (text: string, qId: string) => {
        const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
        const results: any[] = [];

        let currentQuestionText = "";
        let currentOptions: string[] = [];
        let correctIdx = 0;

        const isOptionLine = (line: string) => /^([A-Ea-e])[\.\)]\s*.+/.test(line);
        const hasNumberHeaders = lines.some(line => /^(\d+)[\.\)]\s*(.*)/.test(line));

        const saveCurrentQuestion = () => {
            if (currentQuestionText && currentOptions.length >= 2) {
                while (currentOptions.length < 4) currentOptions.push("---");
                results.push({
                    quiz_id: qId,
                    question_text: currentQuestionText.trim(),
                    options: currentOptions.slice(0, 5),
                    correct_option_index: correctIdx,
                    type: 'multiple_choice'
                });
            }
        };

        lines.forEach((line) => {
            const questionMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
            const optionsRegex = /([A-Ea-e])[\.\)]\s*(.*?)(?=\s*[A-Ea-e][\.\)]|$)/g;
            const optionMatches = [...line.matchAll(optionsRegex)];

            // 1. Línea numerada → nueva pregunta
            if (questionMatch && hasNumberHeaders) {
                saveCurrentQuestion();
                currentQuestionText = questionMatch[2];
                currentOptions = [];
                correctIdx = 0;
            }
            // 2. Línea con opciones A) B) C)
            else if (optionMatches.length > 0) {
                optionMatches.forEach(match => {
                    // Detectar respuesta correcta: *texto*, **texto**, texto en mayúsculas o marcado con (*)
                    let textOpt = match[2].trim();
                    const isCorrect =
                        /\*\s*$/.test(textOpt) ||   // asterisco al final: "Belleza*" o "Belleza *"
                        /^\*/.test(textOpt) ||       // asterisco al inicio: "*Belleza"
                        /\(\*\)/.test(textOpt);      // marcador (*) en cualquier posición
                    if (isCorrect) {
                        correctIdx = currentOptions.length;
                        textOpt = textOpt.replace(/\*/g, '').replace(/\(\*\)/g, '').trim();
                    }
                    if (textOpt.length > 0) currentOptions.push(textOpt);
                });
            }
            // 3. Línea sin número y sin opción
            else {
                // Si ya tenemos 4 opciones, esta línea es la pregunta siguiente
                if (currentOptions.length >= 4) {
                    saveCurrentQuestion();
                    currentQuestionText = line;
                    currentOptions = [];
                    correctIdx = 0;
                } else if (currentOptions.length > 0) {
                    // Continuación de opción larga
                    currentOptions[currentOptions.length - 1] += " " + line;
                } else {
                    // Parte del enunciado (puede ser multilinea)
                    currentQuestionText += (currentQuestionText ? "\n" : "") + line;
                }
            }
        });

        saveCurrentQuestion();
        return results;
    };

    const handleBulkProcess = async () => {
        if (!bulkText.trim()) return;

        setSaving(true);
        const parsed = parseQuestionsIntelligently(bulkText, quizId);
        
        // Filtrar repetidas
        const newQuestions = parsed.filter(newQ => {
            return !questions.some(q => q.question_text.trim().toLowerCase() === newQ.question_text.trim().toLowerCase());
        });

        const duplicatesCount = parsed.length - newQuestions.length;
        if (duplicatesCount > 0) {
            showToast(`Omitidas ${duplicatesCount} preguntas repetidas`, 'error');
        }

        if (newQuestions.length > 0) {
            const { data, error } = await supabase.from("questions").insert(newQuestions).select();
            if (!error && data) {
                setQuestions(prev => [...prev, ...data]);
                setBulkImportOpen(false);
                setBulkText("");
                setTimeout(() => showToast(`✅ ${data.length} preguntas importadas correctamente`, 'success'), 100);
            } else {
                showToast("Error al importar el bloque: " + error?.message, 'error');
            }
        } else {
            showToast("No se detectaron preguntas en el formato correcto (Pregunta + Opciones A,B,C,D).", "error");
        }
        setSaving(false);
    };

    const handleDelete = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Eliminar Pregunta",
            message: "¿Estás seguro de que deseas eliminar esta pregunta para siempre?",
            isDestructive: true,
            onConfirm: async () => {
                if (!canEdit) {
                    showToast("No tienes permiso para eliminar preguntas.", "error");
                    setConfirmModal(null);
                    return;
                }
                setConfirmModal(null);
                setQuestions(questions.filter(q => q.id !== id));
                await supabase.from("questions").delete().eq("id", id);
                showToast("Pregunta eliminada.", 'success');
            }
        });
    };

    const handleDeleteAll = () => {
        if (questions.length === 0) return;
        
        setConfirmModal({
            isOpen: true,
            title: "¡VACIAR BANCO!",
            message: `¿Estás TOTALMENTE seguro? Esto eliminará las ${questions.length} preguntas de este tablero de forma permanente. No podrás deshacer esta acción.`,
            isDestructive: true,
            onConfirm: async () => {
                if (!canEdit) {
                    showToast("No tienes permiso para realizar esta acción.", "error");
                    setConfirmModal(null);
                    return;
                }
                setSaving(true);
                setConfirmModal(null);
                
                const { error } = await supabase.from("questions").delete().eq("quiz_id", quizId);
                
                if (!error) {
                    setQuestions([]);
                    showToast("Todas las preguntas han sido eliminadas.", 'success');
                } else {
                    showToast("Error al vaciar el banco: " + error.message, 'error');
                }
                setSaving(false);
            }
        });
    };

    const handleEditQuestion = (q: any) => {
        setEditQuestionId(q.id);
        setQType(q.type || 'multiple_choice');
        setNewText(q.question_text);
        if (q.options) setOpts(q.options);
        setCorrectIdx(q.correct_option_index || 0);
        setCorrectAnswerText(q.correct_answer || "");
        setMatchingPairs(q.matching_pairs || [{ left: "", right: "" }, { left: "", right: "" }]);
        showToast("Editando pregunta. Revisa el panel derecho.", "success");
    };

    const handleChangeCorrectOption = async (qId: string, newIdx: number) => {
        // Update local state first (optimistic UI)
        setQuestions(questions.map(q => q.id === qId ? { ...q, correct_option_index: newIdx } : q));

        // Update database
        const { error } = await supabase.from("questions").update({ correct_option_index: newIdx }).eq("id", qId);
        if (error) {
            showToast("Error al actualizar la opción correcta: " + error.message, 'error');
        } else {
            showToast("Opción correcta actualizada.", 'success');
        }
    };

    const optionColors = [
        "bg-rose-50 text-rose-700 border-rose-200",
        "bg-blue-50 text-blue-700 border-blue-200",
        "bg-amber-50 text-amber-700 border-amber-200",
        "bg-emerald-50 text-emerald-700 border-emerald-200"
    ];

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
            <span className="text-xl font-bold text-indigo-600 animate-pulse">Cargando preguntas de la aventura...</span>
        </div>
    );

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 dark:bg-slate-950 font-sans relative">

            {/* TOAST FLOTANTE */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-2xl font-bold flex items-center gap-3 animate-slide-up border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                    <span className="text-xl">{toast.type === 'success' ? '✅' : '🚨'}</span>
                    {toast.message}
                </div>
            )}

            {/* MODAL CONFIRMACION */}
            {confirmModal && confirmModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full transform transition-all animate-bounce-short text-center border border-gray-100 dark:border-slate-800">
                        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${confirmModal.isDestructive ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-500'}`}>
                            <span className="text-3xl">{confirmModal.isDestructive ? '🗑️' : '📋'}</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-500 dark:text-slate-400 font-medium leading-relaxed mb-6">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.onConfirm} className={`flex-1 py-3 px-4 font-bold rounded-xl text-white transition-all active:scale-95 ${confirmModal.isDestructive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL IMPORTACIÓN MASIVA (PESTEO) */}
            {bulkImportOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-2xl w-full border border-gray-100 dark:border-slate-800 animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">📋</span>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-none">Importación Masiva</h3>
                                    <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Copia y Pega tus preguntas</p>
                                </div>
                            </div>
                            <button onClick={() => setBulkImportOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 font-bold p-2 text-2xl leading-none">&times;</button>
                        </div>

                        {/* Subir archivo */}
                        <label className="flex items-center justify-center gap-3 w-full py-3 px-5 mb-4 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer hover:border-indigo-500 transition-all group">
                            <span className="text-2xl">📄</span>
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                {loading ? "Procesando archivo..." : "Subir PDF, Word o CSV"}
                            </span>
                            <input type="file" accept=".pdf,.docx,.csv" className="hidden" onChange={handleFileImport} />
                        </label>

                        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4 mb-4 space-y-2 text-sm text-gray-600 dark:text-slate-400">
                            <p className="font-black text-gray-800 dark:text-white text-xs uppercase tracking-widest mb-2">📋 Formato aceptado</p>
                            <p>• Escribe primero el enunciado de la pregunta, luego las 4 opciones con <strong>A) B) C) D)</strong>.</p>
                            <p>• Puedes pegar muchas preguntas seguidas, numeradas o sin numerar.</p>
                            <p>• Para marcar la respuesta correcta, agrega un <strong>asterisco (*)</strong> junto a esa opción. Funciona pegado o con espacio:</p>
                            <pre className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-mono text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre">{`Sinónimo de Beldad\nA) Belleza*       ← pegado\nA) Belleza *      ← con espacio\nA) *Belleza       ← al inicio`}</pre>
                            <p className="text-xs text-gray-400">Si ninguna opción tiene asterisco, se asume la opción A como correcta.</p>
                        </div>

                        <textarea
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder="Ejemplo:&#10;¿Cual es el rio mas largo?&#10;Amazonas&#10;Nilo&#10;Rin&#10;Danubio"
                            className="flex-1 w-full p-6 text-gray-800 dark:text-slate-200 font-medium bg-gray-50 dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-3xl focus:border-indigo-500 focus:ring-0 outline-none resize-none custom-scrollbar"
                        ></textarea>

                        <div className="mt-8 flex gap-4">
                            <button
                                onClick={() => setBulkImportOpen(false)}
                                className="flex-1 py-4 px-6 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-black rounded-2xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkProcess}
                                disabled={saving}
                                className="flex-[2] py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                {saving ? "Procesando..." : "🚀 ¡Importar Ahora!"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cabecera Clásica Strive */}
            <header className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                    <Link
                        href="/teacher/dashboard"
                        className="group flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:text-indigo-600 transition-all border border-gray-200 dark:border-slate-700"
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
                    <Link href="/teacher/dashboard" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors hover:-translate-y-0.5 active:scale-95 inline-flex">
                        ✅ Terminar y Volver
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">

                {/* Panel Izquierdo - Lista de Preguntas */}
                <div className="w-1/2 h-full flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="p-8 pb-6 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-5">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Banco Actual</h2>
                                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Todas tus preguntas guardadas</p>
                            </div>
                            
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {questions.length > 0 && (
                                    <button
                                        onClick={handleDeleteAll}
                                        className="h-10 px-4 flex-shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 shadow-md shadow-red-100"
                                        title="Eliminar TODAS las preguntas"
                                    >
                                        <span className="text-sm">🗑️</span> VACIAR
                                    </button>
                                )}
                                <button
                                    onClick={() => setBulkImportOpen(true)}
                                    className="h-10 px-4 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 shadow-md shadow-indigo-100"
                                >
                                    <span className="text-sm">📥</span> Importar
                                </button>
                                <div className="h-10 px-4 flex-shrink-0 bg-slate-700 text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider flex items-center shadow-sm">
                                    {questions.length} Preguntas
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
                        {questions.length === 0 ? (
                            <div className="text-center p-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300">
                                <span className="text-5xl block mb-4 filter grayscale opacity-50">📝</span>
                                <h3 className="text-xl font-bold text-gray-700 mb-2">No tienes preguntas</h3>
                                <p className="text-gray-500 text-sm">Añade tu primera pregunta desde el panel de la derecha para que los estudiantes puedan avanzar en el juego.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {questions.map((q, idx) => (
                                    <div key={q.id} className="p-5 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-shadow relative group">
                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <button onClick={() => handleEditQuestion(q)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg" title="Editar">✏️</button>
                                            <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Borrar">🗑️</button>
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
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3 leading-tight whitespace-pre-line">{q.question_text}</h4>

                                                {(q.type === 'multiple_choice' || !q.type || q.type === 'true_false') && (
                                                    <div className={`grid ${q.type === 'true_false' ? 'grid-cols-2' : 'grid-cols-2'} gap-2 mt-2`}>
                                                        {q.options.map((opt, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={() => handleChangeCorrectOption(q.id, i)}
                                                                className={`px-3 py-2.5 text-xs font-bold rounded-lg border cursor-pointer transition-all whitespace-pre-line ${i === q.correct_option_index ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-300 hover:border-emerald-300 hover:bg-white dark:hover:bg-slate-600'}`}
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
                                                    <div className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 p-3 rounded-xl mt-2 grid grid-cols-1 gap-2">
                                                        {q.matching_pairs.map((pair, pidx) => (
                                                            <div key={pidx} className="flex items-center gap-3 text-sm font-bold bg-white dark:bg-slate-600 p-2 rounded-lg border border-gray-100 dark:border-slate-500">
                                                                <div className="flex-1 text-center bg-indigo-50 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 py-1 px-2 rounded">{pair.left}</div>
                                                                <span className="text-gray-400">↔️</span>
                                                                <div className="flex-1 text-center bg-amber-50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 py-1 px-2 rounded">{pair.right}</div>
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

                {/* Panel Derecho - Creador de Preguntas */}
                <div className="w-1/2 h-full bg-gray-50 dark:bg-slate-950 p-8 overflow-y-auto">
                    <div className="max-w-xl mx-auto">

                        {/* ====== CREADOR ESTÁNDAR DE PREGUNTAS ====== */}
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 mb-8">
                                <span className="text-3xl">✨</span>
                                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">{editQuestionId ? '✏️ Editar Pregunta' : '✨ Añadir Nueva'}</h2>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Tipo de Pregunta</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'multiple_choice', icon: '📝', label: 'Opción Múltiple' },
                                            { id: 'true_false', icon: '⚖️', label: 'V o F' },
                                            { id: 'fill_in_the_blank', icon: '✍️', label: 'Para Llenar' },
                                            { id: 'matching', icon: '🔗', label: 'Pareo / Unión' },
                                        ].map(t => (
                                            <button
                                                key={t.id} type="button" onClick={() => setQType(t.id as any)}
                                                className={`p-2.5 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1 transition-all ${qType === t.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 fill-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                                            >
                                                <span className="text-xl">{t.icon}</span> {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">La Pregunta o Reto</label>
                                    <textarea
                                        required
                                        value={newText}
                                        onChange={e => setNewText(e.target.value)}
                                        onPaste={qType === 'multiple_choice' ? handlePaste : undefined}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none placeholder-gray-400 dark:placeholder-slate-500"
                                        placeholder="Ej. ¿Cuál es la capital secreta del imperio?"
                                    />
                                </div>

                                {qType === 'multiple_choice' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-3">Opciones y Respuesta Correcta</label>
                                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-800 leading-relaxed font-medium">
                                            💡 <strong>Truco:</strong> Puedes copiar 20 preguntas seguidas desde Word (Ej. 1 pregunta seguida de 4 líneas de opciones) y pegarlas en la caja de arriba para importarlas.
                                        </p>

                                        <div className="space-y-3">
                                            {opts.map((opt, i) => (
                                                <div key={i} className={`flex items-center gap-3 p-2 pr-3 rounded-xl border-2 transition-all ${correctIdx === i ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
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
                                                        className={`flex-1 bg-transparent border-0 focus:ring-0 text-sm font-bold px-2 py-2 ${correctIdx === i ? 'text-emerald-900 dark:text-emerald-300' : 'text-gray-700 dark:text-slate-200'}`}
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
                                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-3">¿Cuál es la correcta?</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div onClick={() => setCorrectIdx(0)} className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center justify-center gap-2 font-black transition-all ${correctIdx === 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-emerald-300'}`}>
                                                <span className="text-3xl">✅</span> VERDADERO
                                            </div>
                                            <div onClick={() => setCorrectIdx(1)} className={`p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center justify-center gap-2 font-black transition-all ${correctIdx === 1 ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-red-300'}`}>
                                                <span className="text-3xl">❌</span> FALSO
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {qType === 'fill_in_the_blank' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Respuesta Correcta Exacta</label>
                                        <input
                                            type="text"
                                            required
                                            value={correctAnswerText}
                                            onChange={(e) => setCorrectAnswerText(e.target.value)}
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl text-emerald-900 dark:text-emerald-300 font-extrabold transition-all"
                                            placeholder="Ej. Napoleón"
                                        />
                                        <p className="text-xs text-gray-400 mt-2 italic">*El estudiante deberá escribir exactamente esta palabra (ignorando mayúsculas).</p>
                                    </div>
                                )}

                                {qType === 'matching' && (
                                    <div>
                                        <div className="flex justify-between items-end mb-3">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-slate-300">Pares Correctos</label>
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
                                                        className="w-full px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-bold text-indigo-900 dark:text-indigo-300"
                                                    />
                                                    <span className="text-xl">↔️</span>
                                                    <input
                                                        required type="text" placeholder="Concepto B" value={pair.right}
                                                        onChange={(e) => {
                                                            const np = [...matchingPairs]; np[pIdx].right = e.target.value; setMatchingPairs(np);
                                                        }}
                                                        className="w-full px-3 py-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm font-bold text-amber-900 dark:text-amber-300"
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

                                <div className="flex gap-2">
                                    {editQuestionId && (
                                        <button
                                            type="button"
                                            onClick={() => { setEditQuestionId(null); setNewText(""); setOpts(["", "", "", ""]); setCorrectIdx(0); setCorrectAnswerText(""); setMatchingPairs([{ left: "", right: "" }, { left: "", right: "" }]); }}
                                            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-xl transition-all"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {saving ? "Guardando..." : editQuestionId ? "💾 Actualizar Pregunta" : "➕ Guardar Pregunta"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
