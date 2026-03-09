"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Quiz {
    id: string;
    title: string;
    board_image_url: string;
    created_at: string;
    teacher_id: string;
    shared_with_emails?: string[];
}

export default function TeacherDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    // Estados para Modales Personalizados
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDestructive?: boolean } | null>(null);
    const [shareModal, setShareModal] = useState<{ isOpen: boolean, quizId: string, title: string, sharedEmails: string[] } | null>(null);
    const [shareInput, setShareInput] = useState("");

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        const checkUserAndFetchData = async () => {
            const { data: authData } = await supabase.auth.getUser();
            if (!authData.user) {
                router.push("/teacher/login");
                return;
            }
            setUser(authData.user);

            // Fetch Quizzes del profesor y los compartidos con el
            const { data: quizzesData, error } = await supabase
                .from("quizzes")
                .select("*")
                .or(`teacher_id.eq.${authData.user.id},shared_with_emails.cs.{${authData.user.email}}`)
                .order("created_at", { ascending: false });

            if (quizzesData) {
                setQuizzes(quizzesData);
            }
            setLoading(false);
        };

        checkUserAndFetchData();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const handleDeleteQuiz = (quizId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Eliminar Tablero",
            message: "¿Estás seguro de que quieres eliminar este tablero? Esta acción no se puede deshacer.",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
                    if (error) throw error;
                    setQuizzes(quizzes.filter(q => q.id !== quizId));
                    showToast("Tablero eliminado exitosamente.", "success");
                } catch (err: any) {
                    showToast("Error al eliminar: " + err.message, "error");
                }
            }
        });
    };

    const handleDuplicateQuiz = (quizId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Duplicar Tablero Mágico",
            message: "¿Deseas crear una copia exacta de este tablero para poder modificarlo y usarlo en otra clase?",
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    // 1. Obtener Quiz original
                    const { data: originalQuiz, error: errQuiz } = await supabase.from("quizzes").select("*").eq("id", quizId).single();
                    if (errQuiz || !originalQuiz) throw new Error("No se pudo encontrar el tablero original.");

                    // 2. Crear copia del Quiz
                    const { id: _, created_at: __, ...quizData } = originalQuiz;
                    const newTitle = `Copia de ${quizData.title}`;

                    const { data: newQuiz, error: errInsert } = await supabase.from("quizzes").insert({
                        ...quizData,
                        title: newTitle
                    }).select().single();
                    if (errInsert || !newQuiz) throw new Error("Error creando el nuevo tablero.");

                    // 3. Obtener preguntas originales
                    const { data: originalQuestions, error: errQ } = await supabase.from("questions").select("*").eq("quiz_id", quizId);
                    if (errQ) throw errQ;

                    // 4. Copiar preguntas al nuevo quiz
                    if (originalQuestions && originalQuestions.length > 0) {
                        const newQuestions = originalQuestions.map(q => {
                            const { id, created_at, quiz_id, ...qData } = q;
                            return { ...qData, quiz_id: newQuiz.id };
                        });
                        const { error: errInsertQ } = await supabase.from("questions").insert(newQuestions);
                        if (errInsertQ) throw errInsertQ;
                    }

                    // 5. Actualizar la vista
                    setQuizzes([newQuiz, ...quizzes]);
                    showToast("¡Tablero duplicado con éxito!", "success");
                } catch (err: any) {
                    showToast("Error al duplicar: " + err.message, "error");
                }
            }
        });
    };

    const handleOpenShareModal = (quizId: string, currentShared: string[] | null) => {
        setShareModal({
            isOpen: true,
            quizId,
            title: "Gestionar Accesos a Colegas",
            sharedEmails: currentShared || []
        });
        setShareInput("");
    };

    const handleAddShare = async () => {
        if (!shareModal) return;
        const emailToShare = shareInput.trim().toLowerCase();

        if (!emailToShare || !emailToShare.includes("@")) {
            showToast("Por favor ingresa un correo válido.", "error");
            return;
        }

        // evitar compartir con uno mismo si fuera el caso, pero por ahora solo validar duplicados
        if (shareModal.sharedEmails.includes(emailToShare)) {
            showToast("Este correo ya tiene acceso a este tablero.", "error");
            return;
        }

        try {
            // VALIDACIÓN DE USUARIO (Requiere Función RPC check_user_exists)
            const { data: userExists, error: rpcError } = await supabase.rpc('check_user_exists', { lookup_email: emailToShare });

            if (rpcError) {
                console.error("RPC Error:", rpcError);
                showToast("Advertencia: No se pudo verificar si el profesor existe.", "error");
            }

            if (userExists === false) {
                showToast("Este correo NO pertenece a un profesor registrado en la plataforma.", "error");
                return;
            }

            const newShared = [...shareModal.sharedEmails, emailToShare];

            const { error } = await supabase.from("quizzes").update({ shared_with_emails: newShared }).eq("id", shareModal.quizId);
            if (error) throw error;

            showToast(`¡Compartido exitosamente con ${emailToShare}!`, "success");
            setQuizzes(quizzes.map(q => q.id === shareModal.quizId ? { ...q, shared_with_emails: newShared } : q));
            setShareModal({ ...shareModal, sharedEmails: newShared });
            setShareInput("");
        } catch (err: any) {
            showToast("Error al compartir: " + err.message, "error");
        }
    };

    const handleRemoveShare = async (emailToRemove: string) => {
        if (!shareModal) return;
        try {
            const newShared = shareModal.sharedEmails.filter(e => e !== emailToRemove);

            const { error } = await supabase.from("quizzes").update({ shared_with_emails: newShared }).eq("id", shareModal.quizId);
            if (error) throw error;

            showToast(`Se ha revocado el acceso a ${emailToRemove}`, "success");
            setQuizzes(quizzes.map(q => q.id === shareModal.quizId ? { ...q, shared_with_emails: newShared } : q));
            setShareModal({ ...shareModal, sharedEmails: newShared });
        } catch (err: any) {
            showToast("Error al remover acceso: " + err.message, "error");
        }
    };

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 overflow-hidden">
            <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-indigo-400 border-t-indigo-600 rounded-full animate-spin shadow-lg"></div>
                <h2 className="mt-4 text-2xl font-bold text-indigo-800 tracking-tight">Cargando tu espacio...</h2>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans relative">

            {/* TOAST FLOTANTE */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-slide-up border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                    <span className="text-xl">{toast.type === 'success' ? '✅' : '🚨'}</span>
                    {toast.message}
                </div>
            )}

            {/* MODAL CONFIRMACION */}
            {confirmModal && confirmModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl transform transition-all animate-bounce-short text-center border border-gray-100">
                        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${confirmModal.isDestructive ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-500'}`}>
                            <span className="text-3xl">{confirmModal.isDestructive ? '🗑️' : '📋'}</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-500 font-medium leading-relaxed mb-6">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.onConfirm} className={`flex-1 py-3 px-4 font-bold rounded-xl text-white shadow-md transition-all active:scale-95 ${confirmModal.isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL GESTOR DE ACCESOS (Compartir / Descompartir) */}
            {shareModal && shareModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl transform transition-all animate-bounce-short border border-gray-100 max-h-[90vh] flex flex-col">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                            <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-2xl">🤝</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900 leading-tight">{shareModal.title}</h3>
                                <p className="text-sm text-gray-500 font-medium">Docentes invitados a editar y jugar este tablero</p>
                            </div>
                        </div>

                        {/* Lista Animada de Compartidos */}
                        <div className="flex-1 overflow-y-auto min-h-[100px] mb-6 space-y-2 pr-2">
                            {shareModal.sharedEmails.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 font-medium text-sm">
                                    Nadie tiene acceso todavía.<br />¡Invita a tu primer colega!
                                </div>
                            ) : (
                                shareModal.sharedEmails.map((email, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="font-bold text-gray-700 truncate mr-4">{email}</div>
                                        <button
                                            title="Revocar acceso"
                                            onClick={() => handleRemoveShare(email)}
                                            className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0"
                                        >
                                            ✖
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Area para agregar nuevos invitados */}
                        <div className="pt-4 border-t border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Invitar a alguien más</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={shareInput}
                                    onChange={(e) => setShareInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddShare()}
                                    placeholder="profesor@colegio.edu"
                                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                />
                                <button
                                    onClick={handleAddShare}
                                    disabled={!shareInput.trim()}
                                    className="px-6 py-3 font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                >
                                    Añadir
                                </button>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button onClick={() => setShareModal(null)} className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Lleno de Color */}
            <header className="flex-shrink-0 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-b border-indigo-100 px-6 py-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-0 sm:gap-2">
                    <img
                        src="/logo1.png"
                        alt="Logo Prisma Quiz"
                        className="w-16 sm:w-20 h-auto object-contain mix-blend-multiply transform hover:rotate-2 hover:scale-105 transition-all duration-300"
                    />
                    <span className="text-[1.7rem] sm:text-4xl font-black text-[#7D32FF] tracking-tight ml-1">
                        Prisma Quiz
                    </span>
                    <span className="bg-[#7D32FF]/10 text-[#7D32FF] font-black px-3 py-1 rounded-full text-xs hidden md:block ml-4 shadow-sm border border-[#7D32FF]/20 relative top-0.5">
                        Panel de Profesor
                    </span>
                </div>

                <div className="flex items-center space-x-6">
                    <div className="flex-col text-right hidden md:flex justify-center">
                        <span className="text-sm font-bold text-gray-800">Profesor(a)</span>
                        <span className="text-xs text-gray-500 mt-0.5">{user?.user_metadata?.full_name || user?.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/teacher/settings"
                            className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-all shadow-sm border border-gray-200"
                        >
                            <span>⚙️ Ajustes</span>
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md border border-transparent"
                        >
                            <span className="hidden sm:inline">Cerrar Sesión</span>
                            <span className="sm:hidden">Salir</span>
                            <span className="bg-red-700/50 px-1.5 rounded text-white font-normal">🚪</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Layout Principal con Sub-Header Creador */}
            <main className="flex-1 flex flex-col overflow-hidden relative p-4 sm:p-8 z-10">
                {/* Elementos Decorativos Fijos */}
                <div className="absolute top-10 left-10 w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20 -z-10 animate-blob"></div>
                <div className="absolute top-10 right-10 w-64 h-64 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20 -z-10 animate-blob animation-delay-2000"></div>

                {/* Controles de Acción Principal */}
                <div className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center bg-white/60 backdrop-blur-md p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Mis Tableros Mágicos</h1>
                        <p className="text-sm text-gray-500 mt-1 font-medium">Gestiona tus aventuras y lanza nuevas salas de juego.</p>
                    </div>
                    <Link
                        href="/teacher/quiz/builder"
                        className="mt-4 md:mt-0 inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold rounded-2xl shadow-md hover:shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-all transform hover:-translate-y-1 active:scale-95"
                    >
                        <span className="text-xl leading-none">+</span> Crear Nuevo Tablero
                    </Link>
                </div>

                {/* Grid de Tableros Scrolleable */}
                <div className="flex-1 overflow-y-auto px-1 pb-10 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                    {quizzes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center bg-white/40 backdrop-blur-sm rounded-[2.5rem] p-12 shadow-inner border border-white/50 border-dashed">
                            <div className="text-8xl mb-6 filter drop-shadow-md">🚀</div>
                            <h3 className="text-2xl font-extrabold text-gray-800">El lienzo está en blanco</h3>
                            <p className="mt-3 text-lg text-gray-600 max-w-md">No tienes tableros aún. ¡Empieza a crear tu primera aventura interactiva en Prisma Quiz ahora mismo!</p>
                            <Link href="/teacher/quiz/builder" className="mt-8 text-indigo-600 font-bold hover:text-indigo-800 underline decoration-indigo-300 underline-offset-4 decoration-2">Quiero crear mi primer tablero &rarr;</Link>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {[
                                { title: "🏎️ Juegos de Carreras", items: quizzes.filter(q => q.board_image_url?.toLowerCase().includes("carrera")) },
                                { title: "🗺️ Aventuras Clásicas", items: quizzes.filter(q => !q.board_image_url?.toLowerCase().includes("carrera")) }
                            ].filter(cat => cat.items.length > 0).map((category, catIdx) => (
                                <div key={catIdx}>
                                    <h2 className="text-2xl font-black text-indigo-900 mb-6 drop-shadow-sm ml-2">
                                        {category.title}
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {category.items.map((quiz) => (
                                            <div key={quiz.id} className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white shadow-[0_4px_15px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.15)] transition-all duration-300 group flex flex-col overflow-hidden transform hover:-translate-y-1">
                                                {/* Cabecera de Tarjeta con Fondo de Mapa */}
                                                <div className="px-6 py-8 flex-1 relative overflow-hidden">
                                                    {/* Imagen de Fondo Borrosa */}
                                                    {quiz.board_image_url && (
                                                        <div
                                                            className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-[2px] scale-110 group-hover:scale-125"
                                                            style={{
                                                                backgroundImage: `url(${quiz.board_image_url})`,
                                                                backgroundSize: 'cover',
                                                                backgroundPosition: 'center'
                                                            }}
                                                        ></div>
                                                    )}
                                                    {/* Gradiente extra para legibilidad */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent z-0"></div>

                                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
                                                    <div className="relative z-10">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="bg-indigo-100/90 backdrop-blur-sm text-indigo-700 w-max px-3 py-1.5 rounded-lg text-xs font-black shadow-sm border border-indigo-200/50">
                                                                {quiz.teacher_id === user?.id ? "Mio" : "Compartido"}
                                                            </div>
                                                            {quiz.board_image_url && (
                                                                <div className="bg-amber-100/90 backdrop-blur-sm text-amber-800 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm border border-amber-200/50 flex items-center gap-1.5" title="Escenario Seleccionado">
                                                                    <span className="text-sm">🗺️</span>
                                                                    <span className="capitalize">{quiz.board_image_url.split('/').pop()?.split('.')[0].replace(/-/g, ' ') || "Mapa"}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-800 transition-colors line-clamp-2 leading-tight drop-shadow-sm">
                                                            {quiz.title}
                                                        </h3>
                                                        <p className="text-xs font-bold text-gray-500 mt-3 flex items-center gap-1.5 bg-white/60 w-max px-2 py-1 rounded-md">
                                                            <span>📅</span> Creado el {new Date(quiz.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Controles de Tarjeta */}
                                                <div className="bg-gray-50/50 p-4 border-t border-gray-100 flex flex-col gap-2 relative z-20">
                                                    <Link
                                                        href={`/teacher/game/new?quizId=${quiz.id}`}
                                                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-3 text-sm rounded-xl transition-all shadow-sm hover:shadow-md transform active:scale-95"
                                                    >
                                                        <span className="text-base">▶️</span> Lanzar Partida
                                                    </Link>

                                                    <div className="grid grid-cols-3 gap-2">
                                                        <Link
                                                            href={`/teacher/quiz/builder?editId=${quiz.id}`}
                                                            className="flex flex-col items-center justify-center py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold text-[11px] rounded-xl transition-all shadow-sm text-center"
                                                            title="Editar Mapa y Ruta"
                                                        >
                                                            <span className="text-lg mb-0.5">🗺️</span> Mapa
                                                        </Link>

                                                        <Link
                                                            href={`/teacher/quiz/${quiz.id}/questions`}
                                                            className="flex flex-col items-center justify-center py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-[11px] rounded-xl transition-all shadow-sm text-center"
                                                            title="Editar Banco de Preguntas"
                                                        >
                                                            <span className="text-lg mb-0.5">📝</span> Preguntas
                                                        </Link>

                                                        <button
                                                            onClick={() => handleDuplicateQuiz(quiz.id)}
                                                            className="flex flex-col items-center justify-center py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-[11px] rounded-xl transition-all shadow-sm group text-center"
                                                            title="Duplicar Tablero para otra aula"
                                                        >
                                                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">📋</span> Duplicar
                                                        </button>

                                                        <button
                                                            onClick={() => handleOpenShareModal(quiz.id, quiz.shared_with_emails || [])}
                                                            className="col-span-1 flex flex-col items-center justify-center py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-[11px] rounded-xl transition-all shadow-sm group text-center border border-blue-200"
                                                            title="Gestionar Profesores Invitados"
                                                        >
                                                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">🤝</span> Accesos
                                                        </button>

                                                        <Link
                                                            href={`/teacher/quiz/${quiz.id}/reports`}
                                                            className="col-span-1 flex flex-col items-center justify-center py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-[11px] rounded-xl transition-all shadow-sm group text-center"
                                                            title="Ver Reportes de Partidas"
                                                        >
                                                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">📊</span> Reportes
                                                        </Link>

                                                        <button
                                                            onClick={() => handleDeleteQuiz(quiz.id)}
                                                            className="col-span-1 flex flex-col items-center justify-center py-2 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white font-bold text-[11px] rounded-xl transition-all group shadow-sm text-center"
                                                            title="Eliminar Tablero Permanentemente"
                                                        >
                                                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">🗑️</span> Borrar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
