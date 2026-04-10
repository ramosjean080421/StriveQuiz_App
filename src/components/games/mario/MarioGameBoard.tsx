"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface MarioGameBoardProps {
    gameId: string;
}

export default function MarioGameBoard({ gameId }: MarioGameBoardProps) {
    const [players, setPlayers] = useState<any[]>([]);

    useEffect(() => {
        // Carga inicial
        const load = async () => {
            const { data } = await supabase.from("game_players")
                .select("id, player_name, avatar_gif_url, score, correct_answers")
                .eq("game_id", gameId)
                .gte("current_position", 0) // No mostrar a los que abandonaron (-1)
                .order("score", { ascending: false });

            if (data) setPlayers(data);
        };
        load();

        // Suscripción a cambios
        const channel = supabase.channel(`mario_board_${gameId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
                () => {
                    // Recargar toda la data en caso de puntaje o inserciones
                    load();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId]);

    // Dividimos en podio principal (Top 3) y el resto del rebaño
    const top3 = players.slice(0, 3);
    const others = players.slice(3);

    return (
        <div className="w-full h-full flex flex-col items-center justify-start overflow-y-auto px-6 py-10 relative bg-[#5C94FC] custom-scrollbar text-white">
            {/* Fondo pixelado de cielo de Mario (Simulado) */}
            <div className="fixed inset-0 -z-10 bg-[#5C94FC] overflow-hidden pointer-events-none">
                {/* Piso de tierra */}
                <div className="absolute bottom-0 w-full h-24 bg-[#FF9C00]/80 border-t-8 border-[#000]"></div>
                <div className="absolute bottom-24 w-full h-8 bg-green-500 border-t-[6px] border-black border-b-[6px]"></div>
                
                {/* Decorativos Retro */}
                <div className="absolute top-20 left-[10%] text-white text-[8rem] opacity-70 drop-shadow-md z-0" style={{filter: 'drop-shadow(10px 10px 0px rgba(0,0,0,0.1))'}}>☁️</div>
                <div className="absolute top-40 right-[15%] text-white text-[12rem] opacity-70 drop-shadow-md z-0" style={{filter: 'drop-shadow(10px 10px 0px rgba(0,0,0,0.1))'}}>☁️</div>
                <div className="absolute bottom-32 left-[20%] text-[8rem] z-10" style={{filter: 'drop-shadow(10px 10px 0px rgba(0,0,0,0.2))'}}>🍄</div>
            </div>

            {/* Cabecera del tablero */}
            <div className="bg-black/80 border-4 border-white shadow-[0_10px_0_rgba(0,0,0,0.5)] p-6 rounded-2xl z-10 mb-12 flex flex-col items-center text-center max-w-2xl w-full">
                <h1 className="text-4xl text-[#FFCE00] font-black uppercase tracking-[0.2em] mb-2 drop-shadow-[2px_2px_0_#D82800]">
                    SUPER SCOREBOARD
                </h1>
                <p className="text-white tracking-widest uppercase font-bold text-sm">
                    Tabla de Puntuaciones en Tiempo Real
                </p>
            </div>

            {/* Podio Principal (Top 3) */}
            <div className="flex flex-col sm:flex-row items-end justify-center gap-6 w-full max-w-4xl z-10 mb-16 h-72">
                {/* Segundo Lugar */}
                {top3[1] && (
                    <div className="flex flex-col items-center justify-end h-[70%] animate-slide-up w-40 relative group">
                        <img src={top3[1].avatar_gif_url} className="w-20 h-20 rounded-xl border-4 border-white shadow-xl z-20 -mb-4 bg-gray-200 object-cover" />
                        <div className="w-full bg-[#00A800] border-4 border-white shadow-[8px_8px_0_rgba(0,0,0,0.3)] h-full flex flex-col items-center pt-6 pb-2 text-center">
                            <span className="text-3xl font-black text-white drop-shadow-md">2ND</span>
                            <span className="font-black text-white text-sm truncate w-11/12 uppercase">{top3[1].player_name}</span>
                            <span className="text-[#FFCE00] font-black text-xs drop-shadow-[1px_1px_0_#000]">{top3[1].score} PTS</span>
                        </div>
                    </div>
                )}

                {/* Primer Lugar */}
                {top3[0] && (
                    <div className="flex flex-col items-center justify-end h-full animate-slide-up w-48 relative group z-10">
                        <div className="absolute -top-12 text-5xl animate-bounce z-30 drop-shadow-md">👑</div>
                        <img src={top3[0].avatar_gif_url} className="w-28 h-28 rounded-xl border-4 border-white shadow-[0_0_20px_#FFCE00] z-20 -mb-6 bg-gray-200 object-cover" />
                        <div className="w-full bg-[#E52521] border-4 border-white shadow-[8px_8px_0_rgba(0,0,0,0.3)] h-full flex flex-col items-center pt-8 pb-2 text-center">
                            <span className="text-5xl font-black text-[#FFCE00] drop-shadow-[2px_2px_0_#000]">1ST</span>
                            <span className="font-black text-white text-lg truncate w-11/12 uppercase mt-1">{top3[0].player_name}</span>
                            <span className="bg-black/50 px-3 py-1 rounded-full text-[#FFCE00] font-black text-sm drop-shadow-[1px_1px_0_#000] mt-1">{top3[0].score} PTS</span>
                            <span className="text-white/80 font-bold text-[10px] uppercase mt-2">⭐ {top3[0].correct_answers || 0} Correctas</span>
                        </div>
                    </div>
                )}

                {/* Tercer Lugar */}
                {top3[2] && (
                    <div className="flex flex-col items-center justify-end h-[50%] animate-slide-up w-40 relative group">
                        <img src={top3[2].avatar_gif_url} className="w-16 h-16 rounded-xl border-4 border-white shadow-xl z-20 -mb-4 bg-gray-200 object-cover" />
                        <div className="w-full bg-[#E58C00] border-4 border-white shadow-[8px_8px_0_rgba(0,0,0,0.3)] h-full flex flex-col items-center pt-6 pb-2 text-center">
                            <span className="text-3xl font-black text-white drop-shadow-md">3RD</span>
                            <span className="font-black text-white text-xs truncate w-11/12 uppercase">{top3[2].player_name}</span>
                            <span className="text-[#000] font-black text-xs drop-shadow-[1px_1px_0_#FFF]">{top3[2].score} PTS</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Resto de jugadores (Grid) */}
            {others.length > 0 && (
                <div className="w-full max-w-4xl bg-[#fc9838] border-4 border-white shadow-[8px_8px_0_rgba(0,0,0,0.4)] rounded-xl p-6 z-10">
                    <h2 className="text-white font-black text-xl uppercase tracking-widest mb-6 drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)] border-b-4 border-white/20 pb-2">
                        COMPETIDORES
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {others.map((p, idx) => (
                            <div key={p.id} className="bg-black/70 border-2 border-white rounded-lg p-3 flex items-center justify-between shadow-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-[#FFCE00] font-black text-lg w-6">#{idx + 4}</span>
                                    <img src={p.avatar_gif_url} className="w-10 h-10 rounded-md border-2 border-white/50 object-cover" />
                                    <span className="text-white font-bold text-sm uppercase truncate w-24">{p.player_name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-[#FFCE00] font-black text-sm drop-shadow-[1px_1px_0_#000]">{p.score}</div>
                                    <div className="text-white/60 text-[9px] font-bold uppercase">PTS</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {players.length === 0 && (
                <div className="z-10 text-xl font-black text-white uppercase tracking-widest animate-pulse mt-20">
                    Esperando a los jugadores...
                </div>
            )}
        </div>
    );
}
