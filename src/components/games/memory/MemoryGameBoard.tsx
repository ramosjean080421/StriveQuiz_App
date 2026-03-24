"use client";

import { useEffect, useState, useRef } from "react";

type Player = {
    id: string;
    player_name: string;
    avatar_gif_url: string;
    current_position: number;
    score: number;
    correct_answers?: number;
    incorrect_answers?: number;
};

interface MemoryGameBoardProps {
    gameId: string;
    players: Player[];
    totalQuestions: number;
}

const MEDAL_STYLES = [
    { border: 'border-yellow-400', bg: 'bg-yellow-500/15', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.2)]', text: 'text-yellow-400', medal: '🥇', scale: 'scale-[1.03]' },
    { border: 'border-gray-300', bg: 'bg-gray-400/10', glow: 'shadow-[0_0_20px_rgba(156,163,175,0.15)]', text: 'text-gray-300', medal: '🥈', scale: 'scale-[1.01]' },
    { border: 'border-amber-600', bg: 'bg-amber-600/10', glow: 'shadow-[0_0_20px_rgba(217,119,6,0.15)]', text: 'text-amber-500', medal: '🥉', scale: '' },
];

function formatElapsed(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export default function MemoryGameBoard({ players, totalQuestions }: MemoryGameBoardProps) {
    const [sortedPlayers, setSortedPlayers] = useState<Player[]>([]);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const sorted = [...players]
            .filter(p => p.current_position >= 0)
            .sort((a, b) => {
                if (b.current_position !== a.current_position) return b.current_position - a.current_position;
                return b.score - a.score;
            });
        setSortedPlayers(sorted);
    }, [players]);

    const completedCount = sortedPlayers.filter(p => p.current_position >= totalQuestions).length;
    const allFinished = sortedPlayers.length > 0 && completedCount === sortedPlayers.length;

    // Cronómetro: corre mientras no todos hayan terminado
    useEffect(() => {
        if (allFinished) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [allFinished]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-start overflow-hidden relative px-4 py-3">
            {/* Logo Borroso de Fondo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <img src="/logotransparente.png" alt="" className="w-[50vw] max-w-[400px] opacity-[0.03] blur-[4px] select-none" draggable={false} />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between w-full max-w-4xl mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🧠</span>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Panel de Memoria</h2>
                        <p className="text-[10px] text-indigo-300/60 font-bold uppercase tracking-widest">Ranking en vivo</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                    {/* Parejas totales */}
                    <div className="bg-white/[0.06] border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                        <span className="text-sm">🎴</span>
                        <span className="text-white font-black text-sm">{totalQuestions}</span>
                        <span className="text-gray-400 text-[10px] font-bold uppercase">parejas</span>
                    </div>
                    {/* Jugadores */}
                    <div className="bg-white/[0.06] border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                        <span className="text-sm">👥</span>
                        <span className="text-white font-black text-sm">{sortedPlayers.length}</span>
                        <span className="text-gray-400 text-[10px] font-bold uppercase">jugadores</span>
                    </div>
                    {/* Cronómetro */}
                    <div className={`border px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${allFinished ? 'bg-emerald-500/10 border-emerald-400/30' : 'bg-white/[0.06] border-white/10'}`}>
                        <span className="text-sm">{allFinished ? '✅' : '⏱️'}</span>
                        <span className={`font-black text-sm tabular-nums ${allFinished ? 'text-emerald-400' : 'text-white'}`}>{formatElapsed(elapsedSeconds)}</span>
                        <span className={`text-[10px] font-bold uppercase ${allFinished ? 'text-emerald-400/60' : 'text-gray-400'}`}>
                            {allFinished ? 'finalizado' : 'transcurrido'}
                        </span>
                    </div>
                    {/* Completados */}
                    {completedCount > 0 && !allFinished && (
                        <div className="bg-emerald-500/10 border border-emerald-400/30 px-4 py-2 rounded-xl flex items-center gap-2">
                            <span className="text-sm">✅</span>
                            <span className="text-emerald-400 font-black text-sm">{completedCount}/{sortedPlayers.length}</span>
                            <span className="text-emerald-400/60 text-[10px] font-bold uppercase">terminaron</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Estado: Todos terminaron */}
            {allFinished && (
                <div className="relative z-10 w-full max-w-4xl mb-3 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl px-5 py-3 flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                        <p className="text-emerald-300 font-black text-sm uppercase tracking-wider">¡Todos los jugadores terminaron!</p>
                        <p className="text-emerald-400/60 text-[10px] font-bold">Tiempo total: {formatElapsed(elapsedSeconds)}</p>
                    </div>
                </div>
            )}

            {/* Ranking List */}
            <div className="relative z-10 w-full max-w-4xl flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {sortedPlayers.length === 0 ? (
                    <div className="text-center text-gray-500 py-16 border-2 border-dashed border-white/10 rounded-2xl">
                        <span className="text-4xl block mb-4">🎴</span>
                        <span className="font-black uppercase tracking-widest text-sm">Esperando jugadores...</span>
                    </div>
                ) : (
                    sortedPlayers.map((player, idx) => {
                        const pairsFound = Math.min(Math.max(0, player.current_position), totalQuestions);
                        const progressPct = totalQuestions > 0 ? (pairsFound / totalQuestions) * 100 : 0;
                        const isWinner = pairsFound >= totalQuestions;
                        const isTop3 = idx < 3;
                        const medalStyle = isTop3 ? MEDAL_STYLES[idx] : null;

                        return (
                            <div
                                key={player.id}
                                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-500 ${isWinner ? 'bg-emerald-500/10 border-emerald-500/30' :
                                    medalStyle ? `${medalStyle.bg} ${medalStyle.border} ${medalStyle.glow} ${medalStyle.scale}` :
                                        'bg-white/[0.03] border-white/5'
                                    }`}
                            >
                                {/* Puesto */}
                                <div className="w-10 flex items-center justify-center shrink-0">
                                    {isTop3 ? (
                                        <span className="text-2xl">{medalStyle!.medal}</span>
                                    ) : (
                                        <span className="font-black text-lg text-gray-500 italic">#{idx + 1}</span>
                                    )}
                                </div>

                                {/* Avatar */}
                                <div className={`relative w-11 h-11 rounded-full border-2 overflow-hidden bg-white shadow-lg shrink-0 ${isWinner ? 'border-emerald-400' : medalStyle ? medalStyle.border : 'border-white/20'}`}>
                                    <img src={player.avatar_gif_url} className="w-full h-full object-cover" alt="" />
                                    {isWinner && (
                                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                            <span className="text-xl">✅</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <h3 className={`text-sm font-black truncate ${isWinner ? 'text-emerald-300' : medalStyle ? medalStyle.text : 'text-white/80'}`}>{player.player_name}</h3>
                                        <span className={`text-xs font-black tabular-nums ${isWinner ? 'text-emerald-400' : 'text-indigo-300/70'}`}>
                                            {pairsFound}/{totalQuestions}
                                        </span>
                                    </div>
                                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className={`h-full transition-all duration-700 ease-out rounded-full relative ${isWinner ? 'bg-gradient-to-r from-emerald-400 to-teal-400' :
                                                isTop3 ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500' :
                                                    'bg-gradient-to-r from-indigo-600 to-indigo-400'
                                                }`}
                                            style={{ width: `${progressPct}%` }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Score */}
                                <div className="ml-2 text-center shrink-0 min-w-[50px]">
                                    <span className={`font-black text-base tabular-nums ${isTop3 ? 'text-yellow-400' : 'text-gray-400'}`}>{player.score}</span>
                                    <span className="block text-[8px] text-gray-500 font-bold uppercase tracking-wider">pts</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.6); }
            `}</style>
        </div>
    );
}
