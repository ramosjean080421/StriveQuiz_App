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
    const [activeTab, setActiveTab] = useState<'ranking' | 'heatmap'>('ranking');
    const [heatmapData, setHeatmapData] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            // 1. Verificar usuario
            const { data: authData } = await supabase.auth.getUser();
            if (!authData.user) {
                router.push("/teacher/login");
                return;
            }

            // 2. Obtener título del Quiz
            const { data: quiz } = await supabase.from("quizzes").select("title").eq("id", quizId).single();
            if (quiz) setQuizTitle(quiz.title);

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

    // Obtener datos detallados para el mapa de calor cuando se selecciona una partida
    useEffect(() => {
        if (!selectedGame) return;

        const fetchHeatmap = async () => {
            // 1. Obtener preguntas originales del quiz
            const { data: questions } = await supabase.from("questions").select("*").eq("quiz_id", quizId).order("created_at", { ascending: true });

            // 2. Obtener TODAS las respuestas registradas en esta sesión
            const { data: responses } = await supabase.from("game_responses").select("*").eq("game_id", selectedGame.id);

            if (questions && responses) {
                const heatmap = questions.map(q => {
                    const qResponses = responses.filter(r => r.question_id === q.id);
                    const correctCount = qResponses.filter(r => r.is_correct).length;
                    const totalCount = qResponses.length;
                    const errorRate = totalCount > 0 ? ((totalCount - correctCount) / totalCount) * 100 : 0;

                    return {
                        text: q.question_text,
                        total: totalCount,
                        correct: correctCount,
                        errorRate: errorRate
                    };
                });
                setHeatmapData(heatmap);
            } else {
                setHeatmapData([]); // Limpiar si no hay datos
            }
        };
        fetchHeatmap();
    }, [selectedGame, quizId]);

    const handleDeleteReport = async (gameId: string) => {
        if (!window.confirm("¿Estás seguro de que deseas borrar este reporte de forma permanente? Se eliminarán todos los datos de los estudiantes y el ranking de esta sesión.")) return;

        try {
            const { error } = await supabase.from("games").delete().eq("id", gameId);
            if (error) throw error;

            // Actualizar el estado local directamente
            setReports(prev => prev.filter(r => r.id !== gameId));
            setSelectedGame(null);
            alert("Reporte eliminado con éxito.");
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
                    <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
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
                                        ? "bg-indigo-600 border-indigo-400 text-white shadow-lg scale-[1.02]"
                                        : "bg-white border-gray-100 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm"
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
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
                                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white relative group">
                                        <div className="flex justify-between items-center mr-10 relative z-10">
                                            <div>
                                                <h3 className="text-2xl font-black">Resultados de la Sesión</h3>
                                                <p className="text-indigo-100 font-medium opacity-90">PIN: {selectedGame.pin} • {new Date(selectedGame.created_at).toLocaleString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 text-center border border-white/30">
                                                    <div className="text-2xl font-black leading-none">{selectedGame.players.length}</div>
                                                    <div className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80">Jugadores</div>
                                                </div>
                                                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 text-center border border-white/30">
                                                    <div className="text-2xl font-black leading-none">
                                                        {selectedGame.players.length > 0
                                                            ? Math.round(selectedGame.players.reduce((acc, p) => acc + (p.correct_answers || 0), 0) / (selectedGame.players.reduce((acc, p) => acc + (p.correct_answers + p.incorrect_answers || 0), 0) || 1) * 100)
                                                            : 0}%
                                                    </div>
                                                    <div className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80">Rendimiento</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Selector de Pestañas interno */}
                                        <div className="mt-8 flex bg-black/20 p-1.5 rounded-2xl w-max relative z-10 backdrop-blur-sm border border-white/10">
                                            <button
                                                onClick={() => setActiveTab('ranking')}
                                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ranking' ? 'bg-white text-indigo-600 shadow-lg' : 'text-white/60 hover:text-white'}`}
                                            >
                                                🏆 Ranking
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('heatmap')}
                                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'heatmap' ? 'bg-white text-indigo-600 shadow-lg' : 'text-white/60 hover:text-white'}`}
                                            >
                                                🔥 Mapa de Calor
                                            </button>
                                        </div>

                                        {/* Botón Flotante para borrar */}
                                        <button
                                            onClick={() => handleDeleteReport(selectedGame.id)}
                                            className="absolute top-4 right-4 bg-white/10 hover:bg-red-500 p-3 rounded-2xl text-white/50 hover:text-white transition-all border border-white/20 hover:border-red-400 group-hover:opacity-100 lg:opacity-30 z-20"
                                            title="Eliminar este reporte"
                                        >
                                            <span className="text-xl">🗑️</span>
                                        </button>
                                    </div>

                                    <div className="p-6 sm:p-8">
                                        {activeTab === 'ranking' ? (
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
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="bg-blue-50 border border-blue-100 p-5 rounded-3xl flex items-center gap-4">
                                                    <div className="text-3xl">💡</div>
                                                    <p className="text-sm text-blue-800 font-medium">
                                                        El <strong>Mapa de Calor</strong> analiza qué preguntas fueron más difíciles para la clase.
                                                        Las preguntas con más fallos aparecen en rojo para que puedas reforzarlas.
                                                    </p>
                                                </div>

                                                <div className="space-y-3">
                                                    {heatmapData.length === 0 ? (
                                                        <div className="py-12 text-center text-gray-400 font-bold italic">
                                                            No hay datos detallados para esta sesión (solo partidas nuevas generan mapa de calor).
                                                        </div>
                                                    ) : (
                                                        heatmapData.map((data, idx) => (
                                                            <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="flex gap-3">
                                                                        <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500">{idx + 1}</span>
                                                                        <h4 className="font-bold text-gray-800 leading-tight">{data.text}</h4>
                                                                    </div>
                                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${data.errorRate > 60 ? 'bg-red-100 text-red-700 border border-red-200' :
                                                                        data.errorRate > 30 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                                            'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                        }`}>
                                                                        {Math.round(data.errorRate)}% Fallos
                                                                    </div>
                                                                </div>

                                                                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex shadow-inner">
                                                                    <div
                                                                        title={`Correctas: ${data.correct}`}
                                                                        className="bg-emerald-400 h-full transition-all duration-1000"
                                                                        style={{ width: `${(data.correct / (data.total || 1)) * 100}%` }}
                                                                    ></div>
                                                                    <div
                                                                        title={`Incorrectas: ${data.total - data.correct}`}
                                                                        className="bg-rose-400 h-full transition-all duration-1000"
                                                                        style={{ width: `${((data.total - data.correct) / (data.total || 1)) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                                <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                                                    <span>Éxito: {data.correct}</span>
                                                                    <span>Total: {data.total} Respuestas</span>
                                                                    <span>Fallo: {data.total - data.correct}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-8 flex justify-center">
                                            <button
                                                onClick={() => window.print()}
                                                className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
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
        </div>
    );
}
