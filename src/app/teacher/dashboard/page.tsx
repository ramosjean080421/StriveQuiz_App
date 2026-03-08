"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Quiz {
    id: string;
    title: string;
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
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md transform hover:rotate-12 transition-transform">
                        <span className="text-white font-black text-xl">P</span>
                    </div>
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">
                        Prisma Quiz
                    </span>
                    <span className="bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs hidden sm:block">Panel de Profesor</span>
                </div>

                <div className="flex items-center space-x-6">
                    <div className="flex-col text-right hidden md:flex justify-center">
                        <span className="text-sm font-bold text-gray-800">Profesor(a)</span>
                        <span className="text-xs text-gray-500 mt-0.5">{user?.user_metadata?.full_name || user?.email}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md border border-transparent"
                    >
                        <span>Cerrar Sesión</span>
                        <span className="bg-red-700/50 px-1.5 rounded text-white font-normal">🚪</span>
                    </button>
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
                                    {/* Cabecera de Tarjeta */}
                                    <div className="px-6 py-8 flex-1 relative overflow-hidden">
                                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
                                        <div className="relative z-10">
                                            <div className="bg-indigo-100 text-indigo-600 w-max px-3 py-1 rounded-lg text-xs font-bold mb-3">Tablero Activo</div>
                                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-2 leading-tight">
                                                {quiz.title}
                                            </h3>
                                            <p className="text-xs font-semibold text-gray-400 mt-3 flex items-center gap-1">
                                                <span>📅</span> Creado el {new Date(quiz.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Controles de Tarjeta */}
                                    <div className="bg-gray-50/50 p-4 border-t border-gray-100 flex items-center gap-2">
                                        <Link
                                            href={`/teacher/game/new?quizId=${quiz.id}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-3 text-sm rounded-xl transition-all shadow-sm hover:shadow-md transform active:scale-95"
                                        >
                                            <span className="text-base">▶️</span> Lanzar
                                        </Link>

                                        <Link
                                            href={`/teacher/quiz/${quiz.id}/questions`}
                                            className="flex items-center justify-center px-4 py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-sm rounded-xl transition-all shadow-sm"
                                            title="Editar Preguntas"
                                        >
                                            ⚙️ Preguntas
                                        </Link>

                                        <button
                                            onClick={() => handleDeleteQuiz(quiz.id)}
                                            className="flex items-center justify-center w-11 h-11 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white rounded-xl transition-all group shadow-sm flex-shrink-0"
                                            title="Eliminar Tablero permanentemente"
                                        >
                                            <span className="text-base group-hover:scale-110 transition-transform">🗑️</span>
                                        </button>
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
