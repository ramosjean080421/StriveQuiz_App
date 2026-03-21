"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface GameReport {
    id: string;
    created_at: string;
    pin: string;
    players: {
        player_name: string;
        score: number;
        correct_answers: number;
        incorrect_answers: number;
        avatar_gif_url: string;
    }[];
}

export default function QuizReportsPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();
    const [reports, setReports] = useState<GameReport[]>([]);
    const [quizTitle, setQuizTitle] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedGame, setSelectedGame] = useState<GameReport | null>(null);
    const [canManage, setCanManage] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            // 1. Verificar usuario
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                router.push("/teacher/login");
                return;
            }

            // 2. Verificar Permisos sobre el Quiz
            const { data: quiz, error: quizErr } = await supabase
                .from("quizzes")
                .select("title, teacher_id, editors_emails, shared_with_emails")
                .eq("id", quizId)
                .single();

            if (quizErr || !quiz) {
                router.push("/teacher/dashboard");
                return;
            }

            const userEmail = authUser.email?.toLowerCase();
            const isOwner = quiz.teacher_id === authUser.id;
            const isEditor = quiz.editors_emails?.includes(userEmail);
            const isViewer = quiz.shared_with_emails?.includes(userEmail);

            if (!isOwner && !isEditor && !isViewer) {
                router.push("/teacher/dashboard");
                return;
            }

            setQuizTitle(quiz.title);
            // Lógica para saber si puede borrar (solo dueño o editor)
            setCanManage(isOwner || isEditor);

            // 3. Obtener todas las partidas finalizadas de este quiz
            const { data: games } = await supabase
                .from("games")
                .select("id, created_at, pin")
                .eq("quiz_id", quizId)
                .eq("status", "finished")
                .order("created_at", { ascending: false });

            if (games) {
                const reportsWithPlayers = await Promise.all(games.map(async (game) => {
                    const { data: players } = await supabase
                        .from("game_players")
                        .select("player_name, score, correct_answers, incorrect_answers, avatar_gif_url")
                        .eq("game_id", game.id)
                        .order("score", { ascending: false });

                    return {
                        ...game,
                        players: players || []
                    };
                }));
                setReports(reportsWithPlayers);
            }
            setLoading(false);
        };

        fetchData();
    }, [quizId, router]);

    // Heatmap data fetching removed per user request
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [gameToDelete, setGameToDelete] = useState<string | null>(null);

    const handleDeleteReport = async () => {
        if (!gameToDelete || !canManage) return;

        try {
            const { error } = await supabase.from("games").delete().eq("id", gameToDelete);
            if (error) throw error;

            // Actualizar el estado local directamente
            setReports(prev => prev.filter(r => r.id !== gameToDelete));
            setSelectedGame(null);
            setShowDeleteModal(false);
            setGameToDelete(null);
        } catch (err: any) {
            console.error("Error al borrar:", err);
            alert("No se pudo borrar el reporte: " + (err.message || "Error desconocido"));
        }
    };

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-indigo-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/teacher/dashboard" className="text-indigo-600 font-bold hover:underline flex items-center gap-2 mb-2">
                            ← Volver al Panel
                        </Link>
                        <h1 className="text-3xl font-black text-gray-900">Reportes de Aventura</h1>
                        <p className="text-gray-500 font-medium">Resultados históricos para: <span className="text-indigo-600 font-bold">{quizTitle}</span></p>
                    </div>
                </header>

                {reports.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
                        <span className="text-6xl mb-4 block">📊</span>
                        <h2 className="text-xl font-bold text-gray-800">No hay partidas finalizadas</h2>
                        <p className="text-gray-500 mt-2">Los resultados aparecerán aquí una vez que completes tus primeras sesiones de juego.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Lista de Partidas */}
                        <div className="lg:col-span-1 space-y-4">
                            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">Historial de Sesiones</h2>
                            {reports.map((report) => (
                                <button
                                    key={report.id}
                                    onClick={() => setSelectedGame(report)}
                                    className={`w-full text-left p-5 rounded-2xl transition-all border ${selectedGame?.id === report.id
                                        ? "bg-indigo-600 border-indigo-400 text-white scale-[1.02]"
                                        : "bg-white border-gray-100 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-md ${selectedGame?.id === report.id ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                                            PIN: {report.pin}
                                        </span>
                                        <span className={`text-[10px] font-bold ${selectedGame?.id === report.id ? "text-indigo-200" : "text-gray-400"}`}>
                                            {new Date(report.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="font-black text-lg">Sesión {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    <div className={`text-sm font-medium ${selectedGame?.id === report.id ? "text-indigo-100" : "text-gray-500"}`}>
                                        {report.players.length} participantes
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Detalle de la Partida Seleccionada */}
                        <div className="lg:col-span-2">
                            {selectedGame ? (
                                <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden animate-fade-in relative">
                                    <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
                                        {/* Decoración de fondo */}
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                                        
                                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
                                            <div className="flex-1">
                                                <h3 className="text-3xl font-black mb-1">Resultados de la Sesión</h3>
                                                <p className="text-indigo-100 font-medium opacity-90 text-sm">PIN: {selectedGame.pin} • {new Date(selectedGame.created_at).toLocaleString()}</p>
                                                
                                                {/* Selector oculto, ya no se usa el Mapa de Calor */}
                                            </div>

                                            <div className="flex flex-col md:flex-row items-end gap-4">
                                                <div className="flex gap-3">
                                                    <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 text-center border border-white/30 min-w-[100px]">
                                                        <div className="text-2xl font-black leading-none">{selectedGame.players.length}</div>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80">Jugadores</div>
                                                    </div>
                                                    <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 text-center border border-white/30 min-w-[100px]">
                                                        <div className="text-2xl font-black leading-none">
                                                            {selectedGame.players.length > 0
                                                                ? Math.round(selectedGame.players.reduce((acc, p) => acc + (p.correct_answers || 0), 0) / (selectedGame.players.reduce((acc, p) => acc + (p.correct_answers + p.incorrect_answers || 0), 0) || 1) * 100)
                                                                : 0}%
                                                        </div>
                                                        <div className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80">Rendimiento</div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setGameToDelete(selectedGame.id);
                                                        setShowDeleteModal(true);
                                                    }}
                                                    className="w-max bg-red-500 hover:bg-red-600 px-6 py-3 rounded-xl text-white transform transition-all active:scale-95 border-b-4 border-red-800 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest self-end"
                                                >
                                                    <span>🗑️</span> BORRAR
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 sm:p-8">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                                            <th className="pb-4 pt-0 px-2 text-center">Rango</th>
                                                            <th className="pb-4 pt-0">Estudiante</th>
                                                            <th className="pb-4 pt-0 text-center">Correctas</th>
                                                            <th className="pb-4 pt-0 text-center">Incorrectas</th>
                                                            <th className="pb-4 pt-0 text-right">Puntaje</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {selectedGame.players.map((player, idx) => (
                                                            <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                                                                <td className="py-4 px-2 text-center">
                                                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm ${idx === 0 ? "bg-yellow-100 text-yellow-700" :
                                                                        idx === 1 ? "bg-gray-100 text-gray-600" :
                                                                            idx === 2 ? "bg-orange-100 text-orange-700" :
                                                                                "text-gray-400"
                                                                        }`}>
                                                                        {idx + 1}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <img src={player.avatar_gif_url} className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100 object-cover" />
                                                                        <span className="font-bold text-gray-800">{player.player_name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-4 text-center">
                                                                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black border border-emerald-100">
                                                                        {player.correct_answers} ✅
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 text-center">
                                                                    <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-black border border-red-100">
                                                                        {player.incorrect_answers} ❌
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 text-right">
                                                                    <span className="font-black text-indigo-600 text-lg">{player.score}</span>
                                                                    <span className="text-[10px] text-gray-400 font-bold ml-1 uppercase">pts</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        {/* Vista de Ranking (Única vista actual) */}

                                        <div className="mt-8 flex justify-center">
                                            <button
                                                onClick={() => window.print()}
                                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-md active:scale-95 border-b-4 border-blue-800 w-max"
                                            >
                                                <span>🖨️</span> Descargar o Imprimir Reporte
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-100/50 rounded-[2.5rem] border-4 border-dashed border-gray-200 p-12 text-center text-gray-400">
                                    <span className="text-6xl mb-4 grayscale opacity-30">👈</span>
                                    <h3 className="text-xl font-bold">Selecciona una sesión</h3>
                                    <p className="max-w-xs mx-auto mt-2">Haz clic en una de las partidas del historial de la izquierda para ver el detalle de los participantes.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DE ELIMINACIÓN PREMIUM */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-xl animate-fade-in" onClick={() => setShowDeleteModal(false)}></div>
                    <div className="bg-white rounded-[2.5rem] max-w-md w-full p-8 relative overflow-hidden animate-scale-in border border-gray-100">
                        {/* Decoración superior */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>

                        <div className="text-center">
                            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                                <span className="text-4xl">⚠️</span>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-3">¿Borrar este reporte?</h2>
                            <p className="text-gray-500 font-medium leading-relaxed mb-8">
                                Esta acción es <span className="text-red-600 font-bold underline decoration-red-200 underline-offset-4">irreversible</span>.
                                Se perderán todos los puntajes y respuestas de esta sesión.
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleDeleteReport}
                                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl transition-all transform active:scale-95"
                                >
                                    SÍ, BORRAR AHORA
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
