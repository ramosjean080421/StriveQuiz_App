"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PlayerResult {
    player_name: string;
    score: number;
    correct_answers: number;
    incorrect_answers: number;
    avatar_gif_url: string;
}

interface GameReport {
    id: string;
    created_at: string;
    pin: string;
    game_mode: string;
    players: PlayerResult[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function accuracy(p: PlayerResult): number {
    const total = (p.correct_answers || 0) + (p.incorrect_answers || 0);
    return total > 0 ? Math.round((p.correct_answers || 0) / total * 100) : 0;
}

function sessionAccuracy(players: PlayerResult[]): number {
    const totalCorrect  = players.reduce((s, p) => s + (p.correct_answers  || 0), 0);
    const totalAnswered = players.reduce((s, p) => s + (p.correct_answers  || 0) + (p.incorrect_answers || 0), 0);
    return totalAnswered > 0 ? Math.round(totalCorrect / totalAnswered * 100) : 0;
}

const MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

const MODE_LABEL: Record<string, string> = {
    roblox: "🏝️ Obby",
    memory: "🧠 Memoria",
    classic: "🏆 Clásico",
    race: "🏎️ Carreras",
    ludo: "🎲 Ludo",
};

// ── Avatar con fallback ───────────────────────────────────────────────────────

function Avatar({ url, name, size = "md" }: { url: string; name: string; size?: "sm" | "md" }) {
    const [broken, setBroken] = useState(!url);
    const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-10 h-10 text-sm";
    if (broken) {
        return (
            <div className={`${dim} rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0`}>
                {name.charAt(0).toUpperCase()}
            </div>
        );
    }
    return (
        <img
            src={url}
            alt={name}
            onError={() => setBroken(true)}
            className={`${dim} rounded-full object-cover border border-gray-100 dark:border-slate-700 bg-gray-50 shrink-0`}
        />
    );
}

// ── Componente Principal ──────────────────────────────────────────────────────

export default function QuizReportsPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();

    const [reports, setReports]           = useState<GameReport[]>([]);
    const [quizTitle, setQuizTitle]       = useState("");
    const [loading, setLoading]           = useState(true);
    const [selectedGame, setSelectedGame] = useState<GameReport | null>(null);
    const [canManage, setCanManage]       = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [gameToDelete, setGameToDelete] = useState<string | null>(null);
    const [deleting, setDeleting]         = useState(false);

    // ── Fix #1: Un solo fetch en lugar de N+1 queries ───────────────────────
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) { router.push("/teacher/login"); return; }

            const { data: quiz, error: quizErr } = await supabase
                .from("quizzes")
                .select("title, teacher_id, editors_emails, shared_with_emails")
                .eq("id", quizId)
                .single();

            if (quizErr || !quiz) { router.push("/teacher/dashboard"); return; }

            const userEmail = authUser.email?.toLowerCase() ?? "";
            const isOwner  = quiz.teacher_id === authUser.id;
            const isEditor = quiz.editors_emails?.some((e: string) => e.toLowerCase() === userEmail);
            const isViewer = quiz.shared_with_emails?.some((e: string) => e.toLowerCase() === userEmail);

            if (!isOwner && !isEditor && !isViewer) { router.push("/teacher/dashboard"); return; }

            setQuizTitle(quiz.title);
            setCanManage(isOwner || !!isEditor);

            // Traer partidas
            const { data: games } = await supabase
                .from("games")
                .select("id, created_at, pin, game_mode")
                .eq("quiz_id", quizId)
                .eq("status", "finished")
                .order("created_at", { ascending: false });

            if (!games || games.length === 0) { setLoading(false); return; }

            // Fix #1: UN SOLO query para todos los jugadores de todas las partidas
            const gameIds = games.map(g => g.id);
            const { data: allPlayers } = await supabase
                .from("game_players")
                .select("game_id, player_name, score, correct_answers, incorrect_answers, avatar_gif_url")
                .in("game_id", gameIds)
                .order("score", { ascending: false });

            // Agrupar en memoria
            const byGame: Record<string, PlayerResult[]> = {};
            (allPlayers || []).forEach(p => {
                if (!byGame[p.game_id]) byGame[p.game_id] = [];
                byGame[p.game_id].push(p);
            });

            setReports(games.map(g => ({
                ...g,
                game_mode: g.game_mode ?? "classic",
                players: byGame[g.id] ?? [],
            })));

            setLoading(false);
        };

        fetchData();
    }, [quizId, router]);

    // ── Fix #2: Borrado limpia game_players Y games ──────────────────────────
    const handleDeleteReport = async () => {
        if (!gameToDelete || !canManage) return;
        setDeleting(true);
        try {
            // Primero borrar los jugadores asociados (evita registros huérfanos)
            const { error: playersErr } = await supabase
                .from("game_players")
                .delete()
                .eq("game_id", gameToDelete);
            if (playersErr) throw playersErr;

            const { error: gameErr } = await supabase
                .from("games")
                .delete()
                .eq("id", gameToDelete);
            if (gameErr) throw gameErr;

            setReports(prev => prev.filter(r => r.id !== gameToDelete));
            if (selectedGame?.id === gameToDelete) setSelectedGame(null);
            setShowDeleteModal(false);
            setGameToDelete(null);
        } catch (err: any) {
            alert("No se pudo borrar el reporte: " + (err.message ?? "Error desconocido"));
        } finally {
            setDeleting(false);
        }
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-indigo-50 dark:bg-slate-950">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Fix #5: Estilos de impresión */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #print-area, #print-area * { visibility: visible !important; }
                    #print-area {
                        position: fixed !important;
                        inset: 0 !important;
                        padding: 24px !important;
                        background: white !important;
                        color: black !important;
                    }
                    .no-print { display: none !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; }
                }
            `}</style>

            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 font-sans p-4 sm:p-8">
                <div className="max-w-6xl mx-auto">

                    {/* Header */}
                    <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                        <div>
                            <Link href="/teacher/dashboard" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-2 mb-2">
                                ← Volver al Panel
                            </Link>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white">Reportes de Aventura</h1>
                            <p className="text-gray-500 dark:text-slate-400 font-medium">
                                Resultados históricos para: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{quizTitle}</span>
                            </p>
                        </div>
                    </header>

                    {reports.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-800">
                            <span className="text-6xl mb-4 block">📊</span>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">No hay partidas finalizadas</h2>
                            <p className="text-gray-500 dark:text-slate-400 mt-2">Los resultados aparecerán aquí una vez que completes tus primeras sesiones de juego.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* Lista de Partidas */}
                            <div className="lg:col-span-1 space-y-3 no-print">
                                <h2 className="text-sm font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-2">
                                    {reports.length} Sesión{reports.length !== 1 ? "es" : ""} Finalizadas
                                </h2>
                                {reports.map((report) => {
                                    const isSelected = selectedGame?.id === report.id;
                                    const acc = sessionAccuracy(report.players);
                                    return (
                                        <button
                                            key={report.id}
                                            onClick={() => setSelectedGame(report)}
                                            className={`w-full text-left p-4 rounded-2xl transition-all border ${isSelected
                                                ? "bg-indigo-600 border-indigo-400 text-white scale-[1.02] shadow-lg shadow-indigo-900/20"
                                                : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-xs font-black px-2 py-0.5 rounded-md ${isSelected ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400"}`}>
                                                    PIN {report.pin}
                                                </span>
                                                <span className={`text-[10px] font-bold ${isSelected ? "text-indigo-200" : "text-gray-400 dark:text-slate-500"}`}>
                                                    {new Date(report.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="font-black text-base leading-tight">
                                                Sesión {new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                            <div className={`flex items-center justify-between mt-1.5 text-xs font-bold ${isSelected ? "text-indigo-100" : "text-gray-500 dark:text-slate-400"}`}>
                                                <span>{report.players.length} jugadores</span>
                                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isSelected ? "bg-white/15" : "bg-gray-100 dark:bg-slate-800"}`}>
                                                    {MODE_LABEL[report.game_mode] ?? "🎮 Juego"} • {acc}% precisión
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Detalle */}
                            <div className="lg:col-span-2">
                                {selectedGame ? (
                                    <div id="print-area" className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 overflow-hidden">

                                        {/* Cabecera azul */}
                                        <div className="bg-indigo-600 p-6 sm:p-8 text-white relative overflow-hidden">
                                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                                            <div className="relative z-10">
                                                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-5">
                                                    <div className="flex-1">
                                                        <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">
                                                            {MODE_LABEL[selectedGame.game_mode] ?? "Sesión de Juego"}
                                                        </p>
                                                        <h3 className="text-2xl sm:text-3xl font-black leading-tight">Resultados de la Sesión</h3>
                                                        <p className="text-indigo-100/80 text-sm mt-1">
                                                            PIN {selectedGame.pin} · {new Date(selectedGame.created_at).toLocaleString()}
                                                        </p>
                                                    </div>

                                                    {canManage && (
                                                        <button
                                                            onClick={() => { setGameToDelete(selectedGame.id); setShowDeleteModal(true); }}
                                                            className="no-print shrink-0 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-white font-black text-xs uppercase tracking-wider border-b-4 border-red-800 active:border-b-0 active:translate-y-0.5 transition-all flex items-center gap-2"
                                                        >
                                                            🗑️ Borrar
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Fix #3: Estadísticas con fórmula corregida */}
                                                {(() => {
                                                    const ps = selectedGame.players;
                                                    const acc = sessionAccuracy(ps);
                                                    const avgScore = ps.length > 0 ? Math.round(ps.reduce((s, p) => s + (p.score || 0), 0) / ps.length) : 0;
                                                    const totalErrors = ps.reduce((s, p) => s + (p.incorrect_answers || 0), 0);
                                                    return (
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                            {[
                                                                { label: "Jugadores",    value: ps.length,     icon: "👥" },
                                                                { label: "Precisión",    value: `${acc}%`,     icon: acc >= 70 ? "🎯" : acc >= 40 ? "📊" : "📉" },
                                                                { label: "Puntaje Prom", value: avgScore,      icon: "⭐" },
                                                                { label: "Errores Tot.", value: totalErrors,   icon: "❌" },
                                                            ].map(stat => (
                                                                <div key={stat.label} className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 border border-white/20 text-center">
                                                                    <div className="text-xl mb-0.5">{stat.icon}</div>
                                                                    <div className="text-xl font-black leading-none">{stat.value}</div>
                                                                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-1">{stat.label}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Fix #6: Resumen visual de rendimiento */}
                                        {selectedGame.players.length > 0 && (
                                            <div className="px-6 sm:px-8 pt-6 pb-2">
                                                <h4 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Distribución de Precisión</h4>
                                                <div className="flex flex-col gap-1.5">
                                                    {selectedGame.players.map((p, i) => {
                                                        const acc = accuracy(p);
                                                        const total = (p.correct_answers || 0) + (p.incorrect_answers || 0);
                                                        return (
                                                            <div key={i} className="flex items-center gap-3">
                                                                <Avatar url={p.avatar_gif_url} name={p.player_name} size="sm" />
                                                                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 w-24 truncate shrink-0">{p.player_name}</span>
                                                                <div className="flex-1 h-4 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${acc >= 70 ? "bg-emerald-500" : acc >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                                                                        style={{ width: `${acc}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs font-black text-gray-500 dark:text-slate-400 w-10 text-right shrink-0">{acc}%</span>
                                                                <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">{total} resp.</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Tabla de jugadores */}
                                        <div className="p-6 sm:p-8 pt-4">
                                            <h4 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Ranking Detallado</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800">
                                                            <th className="pb-3 px-2 text-center">#</th>
                                                            <th className="pb-3">Estudiante</th>
                                                            <th className="pb-3 text-center">✅</th>
                                                            <th className="pb-3 text-center">❌</th>
                                                            <th className="pb-3 text-center">Precisión</th>
                                                            <th className="pb-3 text-right">Puntaje</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                                        {selectedGame.players.map((player, idx) => {
                                                            const acc = accuracy(player);
                                                            return (
                                                                <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                                                    <td className="py-3 px-2 text-center">
                                                                        {MEDAL[idx] ? (
                                                                            <span className="text-lg">{MEDAL[idx]}</span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800">
                                                                                {idx + 1}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3">
                                                                        <div className="flex items-center gap-2.5">
                                                                            {/* Fix #4: Avatar con fallback */}
                                                                            <Avatar url={player.avatar_gif_url} name={player.player_name} />
                                                                            <span className="font-bold text-gray-800 dark:text-slate-200">{player.player_name}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 text-center">
                                                                        <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-black border border-emerald-100 dark:border-emerald-800">
                                                                            {player.correct_answers || 0}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 text-center">
                                                                        <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full text-xs font-black border border-red-100 dark:border-red-800">
                                                                            {player.incorrect_answers || 0}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                            <div className="w-14 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                                <div
                                                                                    className={`h-full rounded-full ${acc >= 70 ? "bg-emerald-500" : acc >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                                                                                    style={{ width: `${acc}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className={`text-xs font-black ${acc >= 70 ? "text-emerald-600 dark:text-emerald-400" : acc >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
                                                                                {acc}%
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 text-right">
                                                                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-lg">{player.score || 0}</span>
                                                                        <span className="text-[10px] text-gray-400 font-bold ml-1 uppercase">pts</span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Fix #5: Botón de impresión mejorado */}
                                            <div className="mt-6 flex justify-end no-print">
                                                <button
                                                    onClick={() => window.print()}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black rounded-xl transition-all shadow-md active:scale-95 border-b-4 border-slate-900 dark:border-slate-900 text-xs uppercase tracking-wider"
                                                >
                                                    🖨️ Imprimir / Guardar PDF
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-100/50 dark:bg-slate-900/40 rounded-[2.5rem] border-4 border-dashed border-gray-200 dark:border-slate-800 p-12 text-center text-gray-400">
                                        <span className="text-6xl mb-4 grayscale opacity-30">👈</span>
                                        <h3 className="text-xl font-bold dark:text-slate-400">Selecciona una sesión</h3>
                                        <p className="max-w-xs mx-auto mt-2 text-sm dark:text-slate-500">Haz clic en una de las partidas del historial para ver el detalle completo.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de eliminación */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print">
                    <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-xl" onClick={() => !deleting && setShowDeleteModal(false)} />
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-md w-full p-8 relative overflow-hidden border border-gray-100 dark:border-slate-800 shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
                        <div className="text-center">
                            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-5 -rotate-6">
                                <span className="text-4xl">⚠️</span>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">¿Borrar este reporte?</h2>
                            <p className="text-gray-500 dark:text-slate-400 leading-relaxed mb-7 text-sm">
                                Esta acción es <span className="text-red-600 dark:text-red-400 font-bold">irreversible</span>.
                                Se eliminarán todos los puntajes y datos de esta sesión.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleDeleteReport}
                                    disabled={deleting}
                                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deleting ? "Borrando..." : "SÍ, BORRAR AHORA"}
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={deleting}
                                    className="w-full py-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-black rounded-2xl transition-all"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
