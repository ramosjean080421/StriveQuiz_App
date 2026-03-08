"use client";

// Esta vista es la principal "Pantalla de Proyección" (El profesor la ve en la pizarra o proyector)
import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import GameBoard from "@/components/GameBoard";

export default function GameRoomBoard({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = use(params);
    const [pin, setPin] = useState("");
    const [gameStatus, setGameStatus] = useState("waiting"); // 'waiting', 'active', 'finished'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGame = async () => {
            const { data: game } = await supabase
                .from("games")
                .select("pin, status")
                .eq("id", gameId)
                .single();

            if (game) {
                setPin(game.pin);
                setGameStatus(game.status);
            }
            setLoading(false);
        };
        fetchGame();

        // Escuchar cambios de estado globales en tiempo real
        const channel = supabase.channel(`game_room_status_${gameId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                (payload) => setGameStatus(payload.new.status)
            ).subscribe();

        return () => { supabase.removeChannel(channel); };

    }, [gameId]);

    const startGame = async () => {
        const newStatus = "active";
        await supabase.from("games").update({ status: newStatus }).eq("id", gameId);
        setGameStatus(newStatus);
    };

    const finishGame = async () => {
        const newStatus = "finished";
        await supabase.from("games").update({ status: newStatus }).eq("id", gameId);
        setGameStatus(newStatus);
    };

    if (loading) return (
        <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
            <span className="text-3xl font-black text-indigo-500 animate-pulse">Abriendo Portal...</span>
        </div>
    );

    return (
        <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-gray-900 to-black text-white font-sans flex flex-col relative">

            {/* Elementos Decorativos Espaciales/Neón */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>
            <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>

            {/* Header / Top Bar (Estilo Kahoot Espectacular) */}
            <header className="relative z-20 flex-shrink-0 flex justify-between items-center p-4 sm:p-6 bg-white/5 backdrop-blur-md border-b border-white/10 shadow-lg">
                <div className="flex items-center gap-6">
                    <div className="bg-gradient-to-r from-pink-500 to-orange-400 p-3 sm:p-4 rounded-2xl shadow-[0_0_20px_rgba(236,72,153,0.4)] border border-white/20 transform -rotate-2">
                        <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white/90 mb-1 leading-none">Únete en PrismQuiz.com con el PIN:</p>
                        <h1 className="text-5xl sm:text-7xl font-black text-white tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                            {pin}
                        </h1>
                    </div>
                    {gameStatus === "waiting" && (
                        <div className="hidden md:flex items-center gap-3 animate-pulse">
                            <span className="relative flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                            </span>
                            <span className="text-green-400 font-bold uppercase tracking-widest text-sm">Esperando Jugadores...</span>
                        </div>
                    )}
                </div>

                {/* Controles del Profesor */}
                <div className="flex items-center space-x-3 sm:space-x-4">
                    {gameStatus === "waiting" && (
                        <button
                            onClick={startGame}
                            className="group relative px-6 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-2xl font-black shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] text-xl transition-all hover:scale-105 active:scale-95 border-2 border-green-400/50 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1s_forwards]"></div>
                            <span className="relative z-10 flex items-center gap-3">
                                <span className="text-3xl">🚀</span> INICIAR PARTIDA
                            </span>
                        </button>
                    )}
                    {gameStatus === "active" && (
                        <button
                            onClick={finishGame}
                            className="px-6 sm:px-8 py-4 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 rounded-2xl font-black shadow-[0_0_30px_rgba(225,29,72,0.4)] hover:shadow-[0_0_40px_rgba(225,29,72,0.6)] text-lg transition-transform transform hover:scale-105 active:scale-95 border border-red-500/50 flex items-center gap-2"
                        >
                            <span>⏹️</span> TERMINAR JUEGO
                        </button>
                    )}
                    {gameStatus === "finished" && (
                        <div className="px-6 sm:px-10 py-4 sm:py-5 bg-amber-500/20 text-amber-400 border-2 border-amber-500/50 rounded-2xl font-black text-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                            <span className="animate-bounce">🏆</span> PARTIDA FINALIZADA
                        </div>
                    )}
                </div>
            </header>

            {/* Contenedor del Mapa Central (Ocupa el resto de la pantalla) */}
            <main className="flex-1 relative z-10 p-4 sm:p-8 flex items-center justify-center overflow-hidden">
                <GameBoard gameId={gameId} />
            </main>

        </div>
    );
}
