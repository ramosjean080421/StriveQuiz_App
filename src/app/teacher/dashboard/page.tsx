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
}

export default function TeacherDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const checkUserAndFetchData = async () => {
            const { data: authData } = await supabase.auth.getUser();
            if (!authData.user) {
                router.push("/teacher/login");
                return;
            }
            setUser(authData.user);

            // Fetch Quizzes del profesor
            const { data: quizzesData, error } = await supabase
                .from("quizzes")
                .select("*")
                .eq("teacher_id", authData.user.id)
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

    const handleDeleteQuiz = async (quizId: string) => {
        if (!confirm("¿Estás seguro de que quieres eliminar este tablero?")) return;

        try {
            const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
            if (error) throw error;

            setQuizzes(quizzes.filter(q => q.id !== quizId));
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        }
    };

    const handleDuplicateQuiz = async (quizId: string) => {
        if (!confirm("¿Deseas duplicar este tablero mágico para usarlo en otra aula?")) return;
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
            alert("¡Tablero duplicado con éxito!");
        } catch (err: any) {
            alert("Error al duplicar: " + err.message);
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
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {quizzes.map((quiz) => (
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
                                                    Tablero Activo
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
                                    <div className="bg-gray-50/50 p-4 border-t border-gray-100 flex flex-col gap-2">
                                        <Link
                                            href={`/teacher/game/new?quizId=${quiz.id}`}
                                            className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-3 text-sm rounded-xl transition-all shadow-sm hover:shadow-md transform active:scale-95"
                                        >
                                            <span className="text-base">▶️</span> Lanzar Partida
                                        </Link>

                                        <div className="grid grid-cols-2 gap-2">
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
                                                className="flex flex-col items-center justify-center py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-[11px] rounded-xl transition-all shadow-sm group text-center"
                                                title="Duplicar Tablero para otra aula"
                                            >
                                                <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">📋</span> Duplicar
                                            </button>

                                            <button
                                                onClick={() => handleDeleteQuiz(quiz.id)}
                                                className="flex flex-col items-center justify-center py-2 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white font-bold text-[11px] rounded-xl transition-all group shadow-sm text-center"
                                                title="Eliminar Tablero Permanentemente"
                                            >
                                                <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">🗑️</span> Borrar
                                            </button>
                                        </div>
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
