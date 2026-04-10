"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type BoardCoordinate = {
    x: number;
    y: number;
};

type Player = {
    id: string;
    game_id: string;
    player_name: string;
    avatar_gif_url: string;
    current_position: number;
    score: number;
    is_blocked?: boolean; // NUEVA COLUMNA
};

interface GameBoardProps {
    gameId: string;
}

export default function GameBoard({ gameId }: GameBoardProps) {
    const [boardImageUrl, setBoardImageUrl] = useState<string>("");
    const [boardPath, setBoardPath] = useState<BoardCoordinate[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameMode, setGameMode] = useState<"classic" | "race">("classic");
    const [eatenAnim, setEatenAnim] = useState<{playerId: string, x: number, y: number} | null>(null);
    const [uiPositions, setUiPositions] = useState<Record<string, number>>({});

    const playersRef = useRef<any[]>([]);
    useEffect(() => { playersRef.current = players; }, [players]);
    const gameModeRef = useRef<string>("classic");
    useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
    const boardPathRef = useRef<BoardCoordinate[]>([]);
    useEffect(() => { boardPathRef.current = boardPath; }, [boardPath]);

    // Estado del juego para el sistema de presencia (solo borrar en lobby)
    const gameStatusRef = useRef<string>("waiting");
    // Timers pendientes de borrado (cancelables si el alumno reconecta por refresh)
    const pendingLeaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        const fetchGameData = async () => {
            const { data: gameConfig } = await supabase.from("games").select(`game_mode, quiz_id, quizzes (board_image_url, board_path, ludo_teams_count)`).eq("id", gameId).single();
            if (gameConfig) {
                setGameMode(gameConfig.game_mode as any || "classic");
                const quizData: any = Array.isArray(gameConfig.quizzes) ? gameConfig.quizzes[0] : gameConfig.quizzes;
                setBoardImageUrl(quizData?.board_image_url || "/default-board.png");
                setBoardPath(quizData?.board_path as BoardCoordinate[] || []);
            }
            const { data: initialPlayers } = await supabase.from("game_players").select("*").eq("game_id", gameId);
            if (initialPlayers) setPlayers(initialPlayers as Player[]);
            setLoading(false);
        };
        fetchGameData();

        const channel = supabase.channel(`game_${gameId}`, {
            config: { presence: { key: "board" } }
        })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
                // Rastrear estado del juego para el sistema de presencia
                gameStatusRef.current = payload.new.status;
            })
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, (payload) => {
                setPlayers((prev) => [...prev, payload.new as Player]);
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, (payload) => {
                const newPlayer = payload.new as Player & { correct_answers?: number, incorrect_answers?: number, game_id?: string };

                // Si el alumno se salda voluntariamente o es expulsado (< 0), lo removemos
                if (newPlayer.current_position < 0) {
                    setPlayers((prev) => prev.filter(p => p.id !== newPlayer.id));
                    return;
                }

                const oldPlayer = playersRef.current.find(p => p.id === newPlayer.id);

                if (oldPlayer) {
                    // Detectar si fue "comido" (regresado a 0 desde una posición positiva)
                    if (newPlayer.current_position === 0 && oldPlayer.current_position > 0) {
                        // Activar animación de "Eaten"
                        setEatenAnim({ playerId: newPlayer.id, x: 50, y: 50 }); // Temporal coords
                        setTimeout(() => setEatenAnim(null), 1000);
                    }

                }
                setPlayers((prev) => prev.map((p) => p.id === payload.new.id ? (payload.new as Player) : p));
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, (payload) => {
                setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
            })
            .on("presence", { event: "join" }, ({ newPresences }) => {
                // Si el alumno reconectó (ej: actualizó la página), cancelar su timer de borrado
                newPresences.forEach((p: any) => {
                    const id = p.player_id || p.state?.player_id || p.state?.[0]?.player_id;
                    if (id && pendingLeaveTimers.current.has(id)) {
                        clearTimeout(pendingLeaveTimers.current.get(id)!);
                        pendingLeaveTimers.current.delete(id);
                        console.log(`[PRESENCE_JOIN] Alumno reconectó, borrado cancelado: ${id}`);
                    }
                });
            })
            .on("presence", { event: "leave" }, ({ leftPresences }) => {
                leftPresences.forEach((p: any) => {
                    const id = p.player_id || p.state?.player_id || p.state?.[0]?.player_id;
                    const secret = p.secret || p.state?.secret || p.state?.[0]?.secret;
                    const name = p.player_name || p.state?.player_name || p.state?.[0]?.player_name;

                    if (id && secret) {
                        // Esperar 15 segundos antes de borrar:
                        // - Refresh de página: reconecta en ~2-5s → timer se cancela en "join"
                        // - Cierre real de navegador: no reconecta → se borra después del timeout
                        // - Solo borrar si el juego sigue en "waiting" (lobby)
                        const timer = setTimeout(() => {
                            pendingLeaveTimers.current.delete(id);
                            if (gameStatusRef.current !== "waiting") return;
                            console.log(`[PRESENCE_LEAVE] Alumno no reconectó, eliminando: ${name || id}`);
                            fetch('/api/leave_player', {
                                method: 'POST',
                                keepalive: true,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id, secret })
                            });
                            setPlayers((prev) => prev.filter(pl => pl.id !== id));
                        }, 15000);
                        pendingLeaveTimers.current.set(id, timer);
                        console.log(`[PRESENCE_LEAVE] Alumno desconectado, esperando 15s: ${name || id}`);
                    }
                });
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
            // Limpiar timers pendientes al desmontar
            pendingLeaveTimers.current.forEach(timer => clearTimeout(timer));
            pendingLeaveTimers.current.clear();
        };
    }, [gameId]);

    // Polling de seguridad: si Supabase Realtime pierde un evento de is_blocked,
    // el tablero lo detecta en máximo 4 segundos consultando la BD directamente.
    useEffect(() => {
        const poll = setInterval(async () => {
            const { data } = await supabase
                .from("game_players")
                .select("id, is_blocked")
                .eq("game_id", gameId);
            if (!data) return;
            setPlayers(prev => {
                let changed = false;
                const next = prev.map(p => {
                    const fresh = data.find(d => d.id === p.id);
                    if (fresh && !!fresh.is_blocked !== !!p.is_blocked) {
                        changed = true;
                        return { ...p, is_blocked: fresh.is_blocked };
                    }
                    return p;
                });
                return changed ? next : prev;
            });
        }, 4000);
        return () => clearInterval(poll);
    }, [gameId]);

    // Efecto para que los avatares "caminen" casilla a casilla (Corregido: Evita carrera de estados)
    useEffect(() => {
        const timer = setInterval(() => {
            setUiPositions(prev => {
                const nextUi = { ...prev };
                let hasChanges = false;
                
                players.forEach(p => {
                    const currentUI = prev[p.id] ?? p.current_position;
                    if (currentUI < p.current_position) {
                        nextUi[p.id] = currentUI + 1;
                        hasChanges = true;
                    } else if (currentUI > p.current_position) {
                        nextUi[p.id] = p.current_position;
                        hasChanges = true;
                    }
                });
                
                return hasChanges ? nextUi : prev;
            });
        }, 350); // Tiempo por paso
        
        return () => clearInterval(timer);
    }, [players]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-white">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xl font-black animate-pulse uppercase tracking-widest text-indigo-400">Invocando el Tablero...</p>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-row items-center justify-center overflow-hidden relative p-4 gap-8">
            <div className="relative inline-block">
                <img src={boardImageUrl} className="max-h-[65vh] w-auto h-auto block rounded-[2rem] shadow-2xl saturate-125" />

                {/* Renderizar Jugadores */}
                {players.map((player) => {
                    let coordinate = { x: 50, y: 50 };
                    if (boardPath.length > 0) {
                        const currentPos = uiPositions[player.id] ?? player.current_position;
                        const safeIdx = Math.min(Math.max(0, currentPos), boardPath.length - 1);
                        coordinate = boardPath[safeIdx];
                    }

                    return (
                        <div

                            key={player.id} 
                            className={`absolute transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-30 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${eatenAnim?.playerId === player.id ? 'animate-shake' : ''}`} 
                            style={{ 
                                left: `${coordinate.x}%`, 
                                top: `${coordinate.y}%`,
                                opacity: eatenAnim?.playerId === player.id ? 0.5 : 1
                            }}
                        >
                            <span className="bg-black/90 backdrop-blur-md text-white text-[clamp(9px,1.2vh,13px)] px-3 py-1 rounded-full mb-2 font-bold whitespace-nowrap border-t border-white/30 shadow-[0_5px_15px_rgba(0,0,0,0.4)] uppercase tracking-wider">
                                {player.player_name}
                            </span>
                            <div className="w-[clamp(2.8rem,7vh,5rem)] h-[clamp(2.8rem,7vh,5rem)] rounded-full border-[clamp(2px,0.4vh,4px)] border-white shadow-[0_15px_30px_rgba(0,0,0,0.6),_inset_0_0_10px_rgba(0,0,0,0.2)] overflow-hidden bg-white hover:scale-125 transition-transform animate-[bounce-subtle_2s_infinite_ease-in-out]">
                                <img src={player.avatar_gif_url} className="w-full h-full object-cover" />
                            </div>
                            
                            {/* Reflejo/Sombra en el suelo */}
                            <div className="w-8 h-2 bg-black/20 blur-sm rounded-full mt-1 animate-[pulse_2s_infinite]"></div>

                            {/* Efecto de "Comido"Explosión */}
                            {eatenAnim?.playerId === player.id && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-4xl animate-ping select-none">💥</div>
                                    <div className="absolute text-xl font-black text-red-500 animate-bounce -top-12">¡OH NO!</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            

            
            <style jsx global>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                @keyframes shake {
                    0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
                    25% { transform: translate(-52%, -48%) rotate(-10deg); }
                    75% { transform: translate(-48%, -52%) rotate(10deg); }
                }
                .animate-shake { animation: shake 0.2s infinite; }
            `}</style>
        </div>
    );
}
