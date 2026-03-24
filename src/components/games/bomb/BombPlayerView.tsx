"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

interface BombPlayerViewProps {
    gameId: string;
    playerId: string;
}

type Question = {
    id: string;
    question_text: string;
    options: string[];
    correct_option_index: number;
};

type Player = {
    id: string;
    player_name: string;
    avatar_gif_url: string;
    current_position: number;
    score: number;
};

// Shuffle determinístico basado en gameId — todos los clientes obtienen el mismo orden
function seededShuffle<T>(arr: T[], seed: string): T[] {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        hash = (hash * 1664525 + 1013904223) | 0;
        const j = Math.abs(hash) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export default function BombPlayerView({ gameId, playerId }: BombPlayerViewProps) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [bombHolderId, setBombHolderId] = useState<string | null>(null);
    const [bombHolderName, setBombHolderName] = useState("");
    const [bombHolderAvatar, setBombHolderAvatar] = useState("");
    const [alivePlayers, setAlivePlayers] = useState<Player[]>([]);
    const [questionDuration, setQuestionDuration] = useState(15);
    const [timeLeft, setTimeLeft] = useState(15);
    const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
    const [lastPointsEarned, setLastPointsEarned] = useState(0);
    const [streak, setStreak] = useState(0);
    // Estados de pantalla: null = jugando, "exploding" = animación, "eliminated" = fuera, "winner" = ganó
    const [screen, setScreen] = useState<null | "exploding" | "eliminated" | "winner">(null);
    const [myScore, setMyScore] = useState(0);

    // Refs para evitar stale closures en callbacks async y timers
    const questionsRef = useRef<Question[]>([]);
    const questionIdxRef = useRef(0);
    const aliveRef = useRef<Player[]>([]);
    const bombHolderRef = useRef<string | null>(null);
    const answeringRef = useRef(false);
    const eliminatedRef = useRef(false);
    const myScoreRef = useRef(0);
    const streakRef = useRef(0);
    const timeLeftRef = useRef(15);
    const questionDurRef = useRef(15);

    useEffect(() => { questionsRef.current = questions; }, [questions]);
    useEffect(() => { aliveRef.current = alivePlayers; }, [alivePlayers]);
    useEffect(() => { myScoreRef.current = myScore; }, [myScore]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

    useEffect(() => {
        const load = async () => {
            const { data: game } = await supabase.from("games")
                .select("bomb_holder_id, current_question_index, quiz_id, question_duration, status, boss_hp")
                .eq("id", gameId).single();
            if (!game) return;

            const dur = game.question_duration || 15;
            setQuestionDuration(dur);
            questionDurRef.current = dur;
            setTimeLeft(dur);
            timeLeftRef.current = dur;

            const qIdx = game.current_question_index || 0;
            questionIdxRef.current = qIdx;
            bombHolderRef.current = game.bomb_holder_id;
            setBombHolderId(game.bomb_holder_id);

            if (game.status === "finished") {
                if (!eliminatedRef.current) setScreen("winner");
                else setScreen("eliminated");
                return;
            }

            const { data: qs } = await supabase.from("questions")
                .select("id, question_text, options, correct_option_index")
                .eq("quiz_id", game.quiz_id)
                .order("created_at");
            if (qs) {
                const count = game.boss_hp > 0 ? game.boss_hp : qs.length;
                const selected = seededShuffle(qs, gameId).slice(0, count);
                setQuestions(selected);
                questionsRef.current = selected;
                setCurrentQuestion(selected[qIdx] || null);
            }

            const { data: players } = await supabase.from("game_players")
                .select("id, player_name, avatar_gif_url, current_position, score")
                .eq("game_id", gameId)
                .gte("current_position", 0);
            if (players) {
                setAlivePlayers(players);
                aliveRef.current = players;
                const holder = players.find((p: Player) => p.id === game.bomb_holder_id);
                if (holder) { setBombHolderName(holder.player_name); setBombHolderAvatar(holder.avatar_gif_url); }
                const me = players.find((p: Player) => p.id === playerId);
                if (me) setMyScore(me.score);
            }
        };
        load();

        const channel = supabase.channel(`bomb_player_${gameId}_${playerId}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
                (payload) => {
                    if (payload.new.status === "finished") {
                        if (!eliminatedRef.current) setScreen("winner");
                        return;
                    }
                    const newBomber = payload.new.bomb_holder_id;
                    const newQIdx = payload.new.current_question_index || 0;

                    bombHolderRef.current = newBomber;
                    setBombHolderId(newBomber);
                    questionIdxRef.current = newQIdx;

                    // Reset de ronda — solo si la bomba cambió de manos
                    answeringRef.current = false;
                    setFeedback(null);
                    setLastPointsEarned(0);
                    setTimeLeft(questionDurRef.current);
                    timeLeftRef.current = questionDurRef.current;

                    setQuestions(prev => {
                        setCurrentQuestion(prev[newQIdx] || null);
                        return prev;
                    });
                    setAlivePlayers(prev => {
                        const h = prev.find(p => p.id === newBomber);
                        if (h) { setBombHolderName(h.player_name); setBombHolderAvatar(h.avatar_gif_url); }
                        return prev;
                    });
                }
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
                (payload) => {
                    if (payload.new.current_position < 0) {
                        setAlivePlayers(prev => prev.filter(p => p.id !== payload.new.id));
                        aliveRef.current = aliveRef.current.filter(p => p.id !== payload.new.id);
                        if (payload.new.id === playerId && !eliminatedRef.current) {
                            eliminatedRef.current = true;
                            // La animación ya fue disparada en handleAnswer; solo asegurar pantalla
                            setTimeout(() => setScreen("eliminated"), 1400);
                        }
                    } else if (payload.new.id === playerId) {
                        setMyScore(payload.new.score);
                    }
                }
            )
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
                (payload) => {
                    if (payload.old?.id === playerId) {
                        sessionStorage.setItem("isKicked", "true");
                        window.location.href = "/?kicked=true";
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId, playerId]);

    // Timer — usa refs para evitar doble timer y stale closures
    useEffect(() => {
        // Verificar via ref (no estado reactivo) para evitar múltiples instancias
        if (bombHolderRef.current !== playerId || answeringRef.current || eliminatedRef.current || timeLeft <= 0) return;
        const t = setTimeout(() => {
            // Re-verificar dentro del callback por si cambió
            if (answeringRef.current || eliminatedRef.current || bombHolderRef.current !== playerId) return;
            setTimeLeft(p => {
                if (p <= 1) {
                    handleAnswer(-1);
                    return 0;
                }
                return p - 1;
            });
        }, 1000);
        return () => clearTimeout(t);
    }, [timeLeft, bombHolderId]); // bombHolderId como dep para re-evaluar cuando cambia la bomba

    // Reset completo cuando la bomba llega a mí
    useEffect(() => {
        if (bombHolderRef.current === playerId) {
            setTimeLeft(questionDurRef.current);
            timeLeftRef.current = questionDurRef.current;
            answeringRef.current = false;
            setFeedback(null);
            setLastPointsEarned(0);
        }
    }, [bombHolderId, playerId]);

    const handleAnswer = async (idx: number) => {
        if (answeringRef.current || eliminatedRef.current) return;
        if (bombHolderRef.current !== playerId) return;
        answeringRef.current = true; // Bloquear inmediatamente via ref

        const q = questionsRef.current[questionIdxRef.current];
        if (!q) return;

        const isCorrect = idx !== -1 && idx === q.correct_option_index;
        const others = aliveRef.current.filter(p => p.id !== playerId);

        if (isCorrect) {
            setFeedback("correct");

            // Cálculo de puntos: base + velocidad + supervivencia + streak
            const speedBonus = Math.floor((timeLeftRef.current / questionDurRef.current) * 150);
            const newStreak = streakRef.current + 1;
            const streakMult = newStreak >= 3 ? 1.5 : newStreak === 2 ? 1.2 : 1;
            const survivorBonus = Math.max(0, 5 - aliveRef.current.length) * 20;
            const pointsEarned = Math.round((50 + speedBonus + survivorBonus) * streakMult);

            streakRef.current = newStreak;
            setStreak(newStreak);
            setLastPointsEarned(pointsEarned);

            const newScore = myScoreRef.current + pointsEarned;
            const { data: cur } = await supabase.from("game_players").select("correct_answers").eq("id", playerId).single();
            await supabase.from("game_players").update({
                score: newScore,
                correct_answers: (cur?.correct_answers || 0) + 1
            }).eq("id", playerId);
            setMyScore(newScore);

            const nextQIdx = questionIdxRef.current + 1;

            // Si no hay más preguntas o soy el único → yo gano
            if (others.length === 0 || nextQIdx >= questionsRef.current.length) {
                await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
                setScreen("winner");
                return;
            }

            // Pasar la bomba a otro jugador aleatorio
            const next = others[Math.floor(Math.random() * others.length)];
            await supabase.from("games").update({
                bomb_holder_id: next.id,
                current_question_index: nextQIdx,
            }).eq("id", gameId);

        } else {
            // Respuesta incorrecta o timeout
            streakRef.current = 0;
            setStreak(0);
            eliminatedRef.current = true;
            setScreen("exploding");

            await supabase.from("game_players").update({ current_position: -2 }).eq("id", playerId);

            // Si queda exactamente 1 jugador después de mi eliminación → ellos ganan
            if (others.length <= 1) {
                await supabase.from("games").update({
                    status: "finished",
                    bomb_holder_id: others.length === 1 ? others[0].id : null
                }).eq("id", gameId);
                setTimeout(() => setScreen("eliminated"), 1500);
                return;
            }

            // Pasar la bomba a otro jugador con nueva pregunta
            const next = others[Math.floor(Math.random() * others.length)];
            const nextQIdxOnFail = questionIdxRef.current + 1;
            await supabase.from("games").update({
                bomb_holder_id: next.id,
                current_question_index: nextQIdxOnFail < questionsRef.current.length ? nextQIdxOnFail : 0,
            }).eq("id", gameId);
            setTimeout(() => setScreen("eliminated"), 1500);
        }
    };

    const timerPct = questionDuration > 0 ? (timeLeft / questionDuration) * 100 : 0;
    const amITheBombHolder = bombHolderId === playerId;
    const danger = timeLeft <= 5 && amITheBombHolder;
    const OPTION_LABELS = ["A", "B", "C", "D"];

    // --- PANTALLAS DE RESULTADO ---
    if (screen === "exploding") {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 overflow-hidden">
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(239,68,68,0.5) 0%, transparent 70%)' }} />
                <div className="text-[9rem] leading-none animate-ping" style={{ animationDuration: '0.4s' }}>💥</div>
            </div>
        );
    }

    if (screen === "eliminated") {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 gap-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.2)_0%,_transparent_70%)]" />
                <div className="text-[7rem] leading-none drop-shadow-2xl animate-bounce">💥</div>
                <div className="text-center z-10">
                    <h1 className="text-5xl font-black text-red-400 uppercase tracking-widest mb-2">¡BOOM!</h1>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-sm">La bomba explotó en tus manos</p>
                </div>
                <div className="z-10 flex flex-col items-center gap-1">
                    <span className="text-white/20 text-xs uppercase tracking-widest font-bold">Puntaje final</span>
                    <span className="text-3xl font-black text-white/60">{myScore} pts</span>
                </div>
            </div>
        );
    }

    if (screen === "winner") {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-yellow-950 via-orange-950 to-black flex flex-col items-center justify-center z-50 gap-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(250,204,21,0.15)_0%,_transparent_70%)]" />
                <div className="text-[7rem] leading-none animate-bounce">🏆</div>
                <div className="text-center z-10">
                    <h1 className="text-5xl font-black text-yellow-400 uppercase tracking-widest mb-2">¡GANASTE!</h1>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Sobreviviste la bomba</p>
                </div>
                <div className="z-10 flex flex-col items-center">
                    <span className="text-white/20 text-xs uppercase tracking-widest font-bold">Puntaje</span>
                    <span className="text-4xl font-black text-yellow-300">{myScore} pts</span>
                </div>
            </div>
        );
    }

    // --- JUEGO ACTIVO ---
    return (
        <div className={`fixed inset-0 flex flex-col items-center justify-center transition-colors duration-700 overflow-hidden
            ${amITheBombHolder ? 'bg-[#1a0500]' : 'bg-[#05050f]'}`}>

            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${amITheBombHolder ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,80,0,0.2) 0%, transparent 65%)' }} />

            {danger && (
                <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none z-50" />
            )}

            <div className="w-full max-w-sm px-5 flex flex-col items-center gap-5 relative z-10">

                {/* Quién tiene la bomba (si no soy yo) */}
                {!amITheBombHolder && (
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 w-full">
                        {bombHolderAvatar && (
                            <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-orange-500/50 flex-shrink-0">
                                <img src={bombHolderAvatar} className="w-full h-full object-cover" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Bomba en manos de</p>
                            <p className="text-white font-black truncate">{bombHolderName || "..."}</p>
                        </div>
                        <span className="text-2xl animate-bounce">💣</span>
                    </div>
                )}

                {/* Bomba + timer (si soy yo) */}
                {amITheBombHolder && (
                    <div className="flex flex-col items-center gap-3 w-full">
                        <div className={`text-[5.5rem] leading-none drop-shadow-[0_0_25px_rgba(255,100,0,0.9)]
                            ${danger ? 'animate-[shake_0.25s_infinite]' : 'animate-[bombFloat_1.8s_ease-in-out_infinite]'}`}>
                            💣
                        </div>
                        <p className={`font-black text-xs uppercase tracking-[0.3em] ${danger ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}>
                            ¡LA BOMBA ES TUYA!
                        </p>
                        <div className="w-full">
                            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${danger ? 'bg-red-500' : 'bg-gradient-to-r from-orange-400 to-yellow-300'}`}
                                    style={{ width: `${timerPct}%`, boxShadow: danger ? '0 0 10px rgba(239,68,68,0.8)' : '0 0 10px rgba(251,146,60,0.6)' }}
                                />
                            </div>
                            <p className={`text-center text-2xl font-black tabular-nums mt-1 ${danger ? 'text-red-400' : 'text-orange-300'}`}>{timeLeft}s</p>
                        </div>
                    </div>
                )}

                {/* Pregunta */}
                <div className={`w-full rounded-2xl p-5 border transition-all duration-500
                    ${amITheBombHolder
                        ? 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_30px_rgba(255,80,0,0.1)]'
                        : 'bg-white/5 border-white/10'}`}>
                    <p className={`font-bold text-center leading-snug text-sm ${amITheBombHolder ? 'text-white' : 'text-white/50'}`}>
                        {currentQuestion?.question_text || "Cargando..."}
                    </p>
                </div>

                {/* Opciones */}
                {currentQuestion?.options && (
                    <div className="w-full grid grid-cols-2 gap-3">
                        {currentQuestion.options.map((opt, i) => {
                            let style = "";
                            if (!amITheBombHolder) {
                                style = "bg-white/5 border-white/10 text-white/20 cursor-not-allowed";
                            } else if (feedback === "correct" && i === currentQuestion.correct_option_index) {
                                style = "bg-green-500 border-green-400 text-white scale-105 shadow-[0_0_20px_rgba(34,197,94,0.5)]";
                            } else if (feedback === "incorrect") {
                                style = i === currentQuestion.correct_option_index
                                    ? "bg-green-500/40 border-green-500/60 text-green-300"
                                    : "bg-white/5 border-white/10 text-white/30";
                            } else {
                                style = "bg-white/10 border-white/20 text-white hover:bg-orange-500/20 hover:border-orange-500/50 active:scale-95 cursor-pointer";
                            }
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleAnswer(i)}
                                    disabled={!amITheBombHolder || answeringRef.current || !!feedback}
                                    className={`p-4 rounded-2xl font-bold text-sm text-left border transition-all duration-200 ${style}`}
                                >
                                    <span className="text-[10px] font-black opacity-50 block mb-1">{OPTION_LABELS[i]}</span>
                                    {opt}
                                </button>
                            );
                        })}
                    </div>
                )}

                {!amITheBombHolder && (
                    <p className="text-white/20 text-[10px] font-black uppercase tracking-widest text-center">
                        Solo quien tiene la bomba puede responder
                    </p>
                )}

                {/* Puntos ganados */}
                {feedback === "correct" && lastPointsEarned > 0 && (
                    <div className="flex flex-col items-center gap-1 animate-bounce">
                        <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                            +{lastPointsEarned} pts
                        </span>
                        {streak >= 2 && (
                            <span className="text-xs font-black uppercase tracking-widest text-yellow-400">
                                🔥 streak ×{streak} ({streak >= 3 ? '×1.5' : '×1.2'})
                            </span>
                        )}
                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                            Total: {myScore} pts
                        </span>
                    </div>
                )}

                {/* Jugadores en pie */}
                <div className="flex items-center gap-2 opacity-30">
                    <span className="text-white text-xs font-black uppercase tracking-widest">{alivePlayers.length} en pie</span>
                    <div className="flex gap-1">
                        {alivePlayers.slice(0, 8).map(p => (
                            <div key={p.id} className="w-5 h-5 rounded-full overflow-hidden border border-white/20">
                                <img src={p.avatar_gif_url} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes bombFloat {
                    0%, 100% { transform: translateY(0px) rotate(-3deg); }
                    50% { transform: translateY(-12px) rotate(3deg); }
                }
                @keyframes shake {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-8deg) scale(1.05); }
                    75% { transform: rotate(8deg) scale(1.05); }
                }
            `}</style>
        </div>
    );
}
