"use client";
import { useEffect, useState, useRef } from "react";

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

import { supabase } from "@/lib/supabaseClient";

type Player = {
    id: string;
    player_name: string;
    avatar_gif_url: string;
    current_position: number;
    score: number;
};

interface BombGameBoardProps {
    gameId: string;
    players: Player[];
    totalQuestions: number;
}

export default function BombGameBoard({ gameId }: BombGameBoardProps) {
    const [aliveCount, setAliveCount] = useState(0);
    const [bombHolder, setBombHolder] = useState<{ name: string; avatar: string } | null>(null);
    const [bombHolderId, setBombHolderId] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [questionIdx, setQuestionIdx] = useState(0);
    const [exploding, setExploding] = useState(false);
    const [questionDuration, setQuestionDuration] = useState(15);
    const [timeLeft, setTimeLeft] = useState(15);
    const [winner, setWinner] = useState<{ name: string; avatar: string } | null>(null);
    const bombHolderRef = useRef<string | null>(null);

    // Carga el portador directamente desde DB por su ID — evita desincronía con alivePlayers
    const fetchHolder = async (holderId: string) => {
        const { data } = await supabase.from("game_players")
            .select("player_name, avatar_gif_url")
            .eq("id", holderId)
            .single();
        if (data) setBombHolder({ name: data.player_name, avatar: data.avatar_gif_url });
    };

    useEffect(() => {
        const load = async () => {
            const { data: game } = await supabase.from("games")
                .select("bomb_holder_id, current_question_index, quiz_id, question_duration, boss_hp")
                .eq("id", gameId).single();
            if (!game) return;

            const dur = game.question_duration || 15;
            setQuestionDuration(dur);
            setTimeLeft(dur);
            bombHolderRef.current = game.bomb_holder_id;
            setBombHolderId(game.bomb_holder_id);
            if (game.bomb_holder_id) fetchHolder(game.bomb_holder_id);

            const qIdx = game.current_question_index || 0;
            setQuestionIdx(qIdx);

            const { data: qs } = await supabase.from("questions")
                .select("id, question_text, options, correct_option_index")
                .eq("quiz_id", game.quiz_id)
                .order("created_at");
            if (qs) {
                const count = game.boss_hp > 0 ? game.boss_hp : qs.length;
                const selected = seededShuffle(qs, gameId).slice(0, count);
                setQuestions(selected);
                setCurrentQuestion(selected[qIdx] || null);
            }

            const { count: alive } = await supabase.from("game_players")
                .select("id", { count: "exact", head: true })
                .eq("game_id", gameId)
                .gte("current_position", 0);
            setAliveCount(alive || 0);
        };
        load();

        const channel = supabase.channel(`bomb_board_${gameId}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
                (payload) => {
                    const newBomber = payload.new.bomb_holder_id;
                    const newQIdx = payload.new.current_question_index || 0;

                    if (newBomber !== bombHolderRef.current) {
                        bombHolderRef.current = newBomber;
                        setBombHolderId(newBomber);
                        setTimeLeft(payload.new.question_duration || 15);
                        if (newBomber) fetchHolder(newBomber);
                    }
                    setQuestionIdx(newQIdx);
                    setQuestions(prev => { setCurrentQuestion(prev[newQIdx] || null); return prev; });
                }
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
                (payload) => {
                    if (payload.new.current_position < 0 && (payload.old?.current_position ?? 0) >= 0) {
                        setExploding(true);
                        setAliveCount(prev => {
                            const remaining = prev - 1;
                            if (remaining <= 1) {
                                // Buscar al ganador
                                supabase.from("game_players")
                                    .select("player_name, avatar_gif_url")
                                    .eq("game_id", gameId)
                                    .gte("current_position", 0)
                                    .neq("id", payload.new.id)
                                    .single()
                                    .then(({ data }) => {
                                        if (data) setWinner({ name: data.player_name, avatar: data.avatar_gif_url });
                                    });
                            }
                            return remaining;
                        });
                        setTimeout(() => setExploding(false), 2000);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId]);

    // Timer visual (se resetea cuando cambia el portador)
    useEffect(() => { setTimeLeft(questionDuration); }, [bombHolderId, questionDuration]);
    useEffect(() => {
        if (timeLeft <= 0) return;
        const t = setTimeout(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => clearTimeout(t);
    }, [timeLeft]);

    const timerPct = questionDuration > 0 ? (timeLeft / questionDuration) * 100 : 0;
    const danger = timeLeft <= 5;

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative bg-[#030310]">
            {/* Fondo grid */}
            <div className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(rgba(255,80,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,80,0,0.06) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
            <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-orange-600/15 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-red-700/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Contenido central */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-6">

                {/* Portador actual */}
                {bombHolder && (
                    <div className={`flex flex-col items-center gap-3 px-10 py-6 rounded-3xl border transition-all duration-500
                        ${danger
                            ? 'bg-red-500/15 border-red-500/50 shadow-[0_0_60px_rgba(239,68,68,0.3)]'
                            : 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_40px_rgba(255,100,0,0.15)]'}`}>
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-orange-400/60">
                            Bomba en manos de
                        </p>
                        <span className={`text-6xl drop-shadow-[0_0_20px_rgba(255,100,0,0.9)]
                            ${danger ? 'animate-[shake_0.2s_infinite]' : 'animate-[bombFloat_2s_ease-in-out_infinite]'}`}>
                            💣
                        </span>
                        <div className={`w-28 h-28 rounded-2xl overflow-hidden border-4 shadow-xl
                            ${danger ? 'border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.6)]' : 'border-orange-400/70 shadow-[0_0_20px_rgba(255,100,0,0.4)]'}`}>
                            <img src={bombHolder.avatar} className="w-full h-full object-cover" />
                        </div>
                        <p className={`text-2xl font-black uppercase tracking-wider ${danger ? 'text-red-300' : 'text-white'}`}>
                            {bombHolder.name}
                        </p>
                    </div>
                )}

                {/* Pregunta */}
                <div className="w-full max-w-3xl bg-white/5 backdrop-blur-xl border border-orange-500/20 rounded-2xl px-8 py-5 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-orange-400 mb-2">
                        Pregunta {questionIdx + 1} / {questions.length}
                    </p>
                    <p className="text-white text-xl font-bold leading-snug">
                        {currentQuestion?.question_text || "Esperando..."}
                    </p>
                </div>

                {/* Timer */}
                <div className="w-full max-w-3xl flex items-center gap-4">
                    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${danger ? 'bg-red-500' : 'bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-300'}`}
                            style={{ width: `${timerPct}%`, boxShadow: danger ? '0 0 12px rgba(239,68,68,0.8)' : '0 0 12px rgba(251,146,60,0.6)' }}
                        />
                    </div>
                    <span className={`text-3xl font-black tabular-nums w-16 text-right ${danger ? 'text-red-400 animate-bounce' : 'text-orange-300'}`}>
                        {timeLeft}s
                    </span>
                </div>

                {/* Contador de sobrevivientes */}
                <p className="text-white/25 text-xs font-black uppercase tracking-widest">
                    {aliveCount} alumno{aliveCount !== 1 ? 's' : ''} en pie
                </p>
            </div>

            {/* Overlay ganador */}
            {winner && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="text-center">
                        <div className="text-[7rem] mb-4 drop-shadow-2xl">🏆</div>
                        <div className="w-28 h-28 mx-auto rounded-3xl overflow-hidden border-4 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.5)] mb-4">
                            <img src={winner.avatar} className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-5xl font-black text-yellow-400 uppercase tracking-widest drop-shadow-lg">
                            {winner.name}
                        </h1>
                        <p className="text-white/50 font-black uppercase tracking-[0.3em] text-sm mt-3">Último en pie</p>
                    </div>
                </div>
            )}

            {/* Overlay explosión */}
            {exploding && (
                <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center animate-[flashRed_0.5s_ease-out]">
                    <div className="text-[9rem] animate-ping" style={{ animationDuration: '0.4s' }}>💥</div>
                </div>
            )}

            <style jsx global>{`
                @keyframes bombFloat {
                    0%, 100% { transform: translateX(-50%) translateY(0px) rotate(-5deg); }
                    50% { transform: translateX(-50%) translateY(-10px) rotate(5deg); }
                }
                @keyframes shake {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-8deg) scale(1.05); }
                    75% { transform: rotate(8deg) scale(1.05); }
                }
                @keyframes flashRed {
                    0% { background: rgba(239,68,68,0.6); }
                    100% { background: transparent; }
                }
            `}</style>
        </div>
    );
}
