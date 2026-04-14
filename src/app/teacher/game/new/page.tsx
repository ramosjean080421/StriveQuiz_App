"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function StartGameContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get("quizId");

    const [loading, setLoading] = useState(false);
    const [quizName, setQuizName] = useState("");
    const [boardImageUrl, setBoardImageUrl] = useState("");

    const [autoEnd, setAutoEnd] = useState(false);
    const [enableGameTimer, setEnableGameTimer] = useState(false);
    const [enableQuestionTimer, setEnableQuestionTimer] = useState(true);
    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'bomb' | 'mario'>('classic');
    const [marioDifficulty, setMarioDifficulty] = useState<number>(1);
    const [marioIsGrupal, setMarioIsGrupal] = useState<boolean>(false);

    const [dataLoaded, setDataLoaded] = useState(false);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [gameDuration, setGameDuration] = useState(10);
    const [questionDuration, setQuestionDuration] = useState(20);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [bombQuestionCount, setBombQuestionCount] = useState<number | ''>(10);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        if (quizId) {
            supabase.from("quizzes").select("title, board_image_url, game_mode").eq("id", quizId).single()
                .then(({ data }) => {
                    if (data) {
                        setQuizName(data.title);
                        setBoardImageUrl(data.board_image_url || "");
                        if (data.game_mode) setGameMode(data.game_mode as any);
                        setDataLoaded(true);
                    }
                });
            supabase.from("questions").select("*", { count: 'exact', head: true }).eq("quiz_id", quizId)
                .then(({ count }) => { setTotalQuestions(count || 0); });
        }
    }, [quizId]);

    const handleStartGame = async () => {
        if (!quizId) return;

        if (['bomb', 'mario'].includes(gameMode)) {
            const requestedCount = Number(bombQuestionCount) || 10;
            if (requestedCount > totalQuestions) {
                showToast(gameMode === 'mario'
                    ? `🍄 Intentas poner ${requestedCount} bloques, pero solo hay ${totalQuestions} preguntas.`
                    : `💣 Quieres ${requestedCount} preguntas, pero el banco solo tiene ${totalQuestions}.`,
                    "error");
                return;
            }
        }

        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            showToast("Tu sesión expiró. Vuelve a iniciar sesión.", "error");
            setLoading(false);
            setTimeout(() => { window.location.href = "/auth/login"; }, 2000);
            return;
        }

        try {
            const pin = Math.random().toString(36).substring(2, 8).toUpperCase();

            const baseInsertData: any = {
                quiz_id: quizId, pin, status: "waiting", auto_end: autoEnd,
                game_mode: gameMode,
                game_duration: (enableGameTimer && !autoEnd) ? gameDuration : null,
                question_duration: ['bomb', 'mario'].includes(gameMode)
                    ? (enableQuestionTimer ? questionDuration : 15)
                    : (enableQuestionTimer ? questionDuration : 0),
                boss_hp: ['bomb', 'mario'].includes(gameMode) ? (Number(bombQuestionCount) || 10) : 0
            };

            const extendedInsertData: any = {
                ...baseInsertData,
                bonus_time_per_match: gameMode === 'mario' ? marioDifficulty : null,
                team_distribution_mode: gameMode === 'mario' ? (marioIsGrupal ? 'multiplayer' : 'individual') : null,
            };

            let { data: newGame, error } = await supabase.from("games").insert([extendedInsertData]).select().single();

            if (error) {
                const fallback = await supabase.from("games").insert([baseInsertData]).select().single();
                if (fallback.error) {
                    const e = fallback.error as any;
                    throw new Error(e?.code ? `[${e.code}] ${e?.hint || e?.message}` : JSON.stringify(e));
                }
                newGame = fallback.data;
            }

            router.push(`/game/${newGame.id}/board`);
        } catch (err: any) {
            showToast("Error al crear la sala: " + err.message, "error");
            setLoading(false);
        }
    };

    if (!quizId) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
            <span className="text-xl font-bold text-red-400">ID no proporcionado. Vuelve al panel.</span>
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-gray-950 p-6 selection:bg-indigo-500/30">

            {/* Fondo */}
            {boardImageUrl && (
                <div className="absolute inset-0 z-0 opacity-20 blur-[8px] scale-110"
                    style={{ backgroundImage: `url("${boardImageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/95 via-gray-950/98 to-black z-0" />
            <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[55%] bg-indigo-600/15 rounded-full blur-[130px] pointer-events-none z-0 animate-pulse" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[55%] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none z-0" />

            {/* Botón volver */}
            <Link href="/teacher/dashboard"
                className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all text-xs font-black uppercase tracking-widest whitespace-nowrap">
                <span className="text-lg leading-none">‹</span> Volver al Panel
            </Link>

            {/* ══ LAYOUT PÁGINA: logo izquierda | tarjeta derecha ══ */}
            <div className="relative z-10 w-full max-w-6xl flex items-center gap-10">

                {/* ── Logo lateral (solo pantallas grandes) ── */}
                <div className="hidden xl:flex flex-col items-center justify-center flex-shrink-0 w-56 gap-6">
                    <img src="/logotransparente.png" alt="StriveQuiz" className="w-44 h-44 object-contain drop-shadow-[0_0_40px_rgba(99,102,241,0.5)]" />
                    <div className="text-center">
                        <p className="text-white font-black text-xl tracking-tight drop-shadow-md">StriveQuiz</p>
                        <p className="text-indigo-300/50 text-[10px] font-black uppercase tracking-[0.3em]">Engine</p>
                    </div>
                </div>

                {/* ══ TARJETA HORIZONTAL ══ */}
                <div className="flex-1 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,0.6),0_0_60px_rgba(79,70,229,0.08)] overflow-hidden flex flex-col lg:flex-row min-h-0">

                    {/* ── Panel Izquierdo ── */}
                    <div className="lg:w-[36%] flex flex-col items-center justify-between p-7 border-b lg:border-b-0 lg:border-r border-white/[0.07] bg-white/[0.02] gap-5">

                        {/* Header */}
                        <div className="flex flex-col items-center gap-3 w-full">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[1.4rem] shadow-[0_10px_40px_rgba(79,70,229,0.4)] flex items-center justify-center rotate-6">
                                <span className="text-3xl -rotate-6">🎮</span>
                            </div>
                            <div className="text-center">
                                <p className="text-indigo-300/50 text-[9px] font-black uppercase tracking-[0.4em]">StriveQuiz Engine</p>
                                <h1 className="text-2xl font-black text-white tracking-tight">Preparar Sala</h1>
                            </div>
                        </div>

                        {/* Card del quiz */}
                        <div className="w-full p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-400/20 relative overflow-hidden group flex-1 flex flex-col justify-center">
                            <div className="absolute top-1 right-2 opacity-10 group-hover:rotate-12 transition-transform text-xl select-none">🗺️</div>
                            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Aventura Seleccionada</p>
                            <strong className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 text-base font-black block leading-snug mb-1">
                                {quizName || "Cargando..."}
                            </strong>
                            <p className="text-gray-500 text-[10px] font-bold">📚 {totalQuestions} preguntas disponibles</p>
                        </div>

                        {/* Botón lanzar */}
                        <div className="w-full">
                            <button onClick={handleStartGame} disabled={loading || !quizName} className="w-full relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 blur-lg opacity-25 group-hover:opacity-50 transition-opacity rounded-xl" />
                                <div className="relative py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 border border-white/20 flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap">
                                    <div className="absolute inset-0 bg-white/10 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                                    {loading
                                        ? <><span className="animate-spin text-lg">⏳</span><span className="animate-pulse tracking-widest text-xs uppercase">Abriendo Sala...</span></>
                                        : <><span className="text-lg">⚡</span><span className="uppercase tracking-widest">Comenzar Partida</span></>
                                    }
                                </div>
                            </button>

                            {/* Chips */}
                            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 font-bold uppercase tracking-wider whitespace-nowrap">
                                    {gameMode === 'mario' ? '🍄 SuperStrive' : gameMode === 'bomb' ? '💣 Bomba' : gameMode === 'race' ? '🏎️ Carrera' : '🎮 Clásico'}
                                </span>
                                {gameMode !== 'mario' && autoEnd && <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-wider">🏁 Auto-fin</span>}
                                {enableGameTimer && !autoEnd && gameDuration > 0 && gameMode !== 'mario' && <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold uppercase tracking-wider whitespace-nowrap">⏳ {gameDuration} min</span>}
                                {gameMode === 'mario' && <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 font-bold uppercase tracking-wider whitespace-nowrap">{marioIsGrupal ? '🌐 Grupal' : '👤 Individual'}</span>}
                            </div>
                        </div>
                    </div>

                    {/* ── Panel Derecho: configuración ── */}
                    <div className={`lg:w-[64%] flex flex-col justify-center p-7 gap-4 transition-opacity duration-300 ${dataLoaded ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>

                        <h2 className="text-[9px] font-black text-white/25 uppercase tracking-[0.35em]">⚙️ Configuración de la Partida</h2>

                        <div className="grid grid-cols-2 gap-3">

                            {/* Auto-finalizar */}
                            {gameMode !== 'mario' && (
                                <div onClick={() => setAutoEnd(!autoEnd)}
                                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between gap-2 ${autoEnd ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/[0.02] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]"}`}>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-xl">{autoEnd ? '🏁' : '🏳️'}</span>
                                        <div>
                                            <p className={`text-xs font-black ${autoEnd ? 'text-emerald-400' : 'text-gray-300'}`}>Auto-finalizar</p>
                                            <p className="text-gray-500 text-[10px]">Meta cierra la sala</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${autoEnd ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoEnd ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            )}

                            {/* Tiempo de Partida */}
                            {!autoEnd && gameMode !== 'mario' && (
                                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setEnableGameTimer(v => !v)}>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">⏳ Duración Partida</span>
                                        <div className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${enableGameTimer ? 'bg-indigo-500' : 'bg-gray-700'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enableGameTimer ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                    {enableGameTimer && (
                                        <input type="number" min="1" max="120" value={gameDuration || ""} placeholder="Minutos..."
                                            onChange={(e) => setGameDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-black focus:outline-none focus:border-indigo-500" />
                                    )}
                                </div>
                            )}

                            {/* Tiempo por Pregunta */}
                            {gameMode !== 'mario' && (
                                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setEnableQuestionTimer(v => !v)}>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">⏱️ Tiempo Pregunta</span>
                                        <div className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${enableQuestionTimer ? 'bg-indigo-500' : 'bg-gray-700'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enableQuestionTimer ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                    {enableQuestionTimer && (
                                        <input type="number" min="5" max="120" value={questionDuration || ""} placeholder="Segundos..."
                                            onChange={(e) => setQuestionDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-black focus:outline-none focus:border-indigo-500" />
                                    )}
                                </div>
                            )}

                            {/* Bloques / Preguntas del reto */}
                            {['bomb', 'mario'].includes(gameMode) && (
                                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        {gameMode === 'bomb' ? '💣 Preguntas del reto' : '🍄 Bloques en el mundo'}
                                    </span>
                                    <input type="number" min="1" max="200"
                                        value={bombQuestionCount === '' ? '' : bombQuestionCount} placeholder="Ej. 10..."
                                        onChange={(e) => setBombQuestionCount(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-black focus:outline-none focus:border-indigo-500" />
                                    <p className="text-[10px] text-gray-500 font-bold">{bombQuestionCount} de {totalQuestions} disponibles</p>
                                </div>
                            )}
                        </div>

                        {/* Panel exclusivo SuperStrive */}
                        {gameMode === 'mario' && (
                            <div className="p-5 rounded-2xl bg-indigo-900/30 border border-indigo-500/25 relative overflow-hidden">
                                <div className="absolute top-2 right-3 opacity-10 text-5xl pointer-events-none select-none">🍄</div>
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <span className="text-xs font-black text-indigo-300 uppercase tracking-widest block">⚔️ Dificultad</span>
                                        <p className="text-[10px] text-indigo-200/60 font-bold">Enemigos que enfrentarán los estudiantes.</p>
                                        <select value={marioDifficulty} onChange={(e) => setMarioDifficulty(Number(e.target.value))}
                                            className="w-full bg-black/40 border border-indigo-400/40 rounded-xl px-3 py-2 text-white text-xs font-black focus:outline-none cursor-pointer appearance-none text-center"
                                            style={{ textAlignLast: 'center' }}>
                                            <option value={0}>🟢 Práctica (Solo Goombas)</option>
                                            <option value={1}>🟡 Normal (Goombas + Koopas)</option>
                                            <option value={2}>🔴 Extremo (+ Bill Balas)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-xs font-black text-indigo-300 uppercase tracking-widest block">👥 Modo de Juego</span>
                                        <p className="text-[10px] text-indigo-200/60 font-bold">Grupal: ven los avatares de todos.</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => setMarioIsGrupal(false)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all border-2 whitespace-nowrap ${!marioIsGrupal ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30' : 'bg-transparent border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10'}`}>
                                                👤 Individual
                                            </button>
                                            <button onClick={() => setMarioIsGrupal(true)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all border-2 whitespace-nowrap ${marioIsGrupal ? 'bg-pink-600 border-pink-400 text-white shadow-lg shadow-pink-500/30' : 'bg-transparent border-pink-500/30 text-pink-300 hover:bg-pink-500/10'}`}>
                                                🌐 Grupal
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modo clásico/race/bomb sin opciones mario: rellenar con info */}
                        {gameMode !== 'mario' && (
                            <div className="p-4 rounded-2xl bg-white/[0.015] border border-white/[0.04] flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl shrink-0">
                                    {gameMode === 'bomb' ? '💣' : gameMode === 'race' ? '🏎️' : '🎮'}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white/60 uppercase tracking-widest">
                                        {gameMode === 'bomb' ? 'Modo Bomba' : gameMode === 'race' ? 'Modo Carrera' : 'Modo Clásico'}
                                    </p>
                                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                        {gameMode === 'bomb' ? 'Responde en equipo antes de que explote el tiempo.' : gameMode === 'race' ? 'El primero en llegar al final gana la carrera.' : 'Avanza en el tablero respondiendo correctamente.'}
                                    </p>
                                </div>
                                <div className="ml-auto text-right shrink-0">
                                    <p className="text-white font-black text-lg">{totalQuestions}</p>
                                    <p className="text-gray-500 text-[9px] uppercase tracking-wider font-bold">preguntas</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-[2rem] font-bold flex items-center gap-4 border backdrop-blur-2xl shadow-2xl ${toast.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-red-500/90 text-white border-red-400'}`}>
                    <span className="text-2xl">{toast.type === 'success' ? '✅' : '🚨'}</span>
                    <span className="tracking-wide uppercase text-xs">{toast.message}</span>
                </div>
            )}
        </div>
    );
}

export default function StartGamePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-indigo-500 font-bold">Cargando...</div>}>
            <StartGameContent />
        </Suspense>
    );
}
