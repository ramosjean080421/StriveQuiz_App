"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Estructura de las coordenadas trazadas por el profesor en la configuración del tablero
type BoardCoordinate = {
    x: number; // Porcentaje de 0 a 100
    y: number; // Porcentaje de 0 a 100
};

type Player = {
    id: string;
    game_id: string;
    player_name: string;
    avatar_gif_url: string;
    current_position: number;
    score: number;
};

interface GameBoardProps {
    gameId: string;
}

export default function GameBoard({ gameId }: GameBoardProps) {
    const [boardImageUrl, setBoardImageUrl] = useState<string>("");
    const [boardPath, setBoardPath] = useState<BoardCoordinate[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    // Cargar datos iniciales del tablero y los jugadores actuales
    useEffect(() => {
        const fetchGameData = async () => {
            // Obtener quiz asociado y sus datos del tablero
            const { data: gameConfig } = await supabase
                .from("games")
                .select(`
          quiz_id,
          quizzes (
            board_image_url,
            board_path
          )
        `)
                .eq("id", gameId)
                .single();

            if (gameConfig?.quizzes) {
                const quizData: any = Array.isArray(gameConfig.quizzes) ? gameConfig.quizzes[0] : gameConfig.quizzes;
                setBoardImageUrl(quizData?.board_image_url || "/default-board.png");
                setBoardPath(quizData?.board_path as BoardCoordinate[] || []);
            }

            // Obtener el estado inicial de todos los jugadores
            const { data: initialPlayers, error } = await supabase
                .from("game_players")
                .select("*")
                .eq("game_id", gameId);

            if (!error && initialPlayers) {
                setPlayers(initialPlayers as Player[]);
            }
            setLoading(false);
        };

        fetchGameData();

        // =======================================================================
        // MOTOR EN TIEMPO REAL (SUPABASE REALTIME)
        // =======================================================================
        const channel = supabase
            .channel(`game_${gameId}`)
            // Escuchar cuando entra un nuevo jugador a la sala
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
                (payload) => {
                    setPlayers((prev) => [...prev, payload.new as Player]);
                }
            )
            // Escuchar el movimiento de los jugadores en vivo (cuando responden bien y su posición avanza)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
                (payload) => {
                    setPlayers((prev) =>
                        prev.map((player) =>
                            player.id === payload.new.id ? (payload.new as Player) : player
                        )
                    );
                }
            )
            .subscribe();

        // Limpieza al desmontar
        return () => {
            supabase.removeChannel(channel);
        };
    }, [gameId]);

    if (loading) return (
        <div className="w-full h-full flex items-center justify-center font-black text-3xl text-indigo-400 drop-shadow-xl animate-pulse tracking-widest uppercase">
            Cargando Mapa del Tesoro...
        </div>
    );

    return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <div className="relative w-fit h-fit rounded-[3rem] shadow-[0_0_80px_rgba(79,70,229,0.3)] border-4 sm:border-8 border-indigo-500/50 group">

                {/* Brillo dinámico en el borde */}
                <div className="absolute inset-0 z-0 ring-[6px] ring-white/10 rounded-[3rem] pointer-events-none group-hover:ring-white/30 transition-all duration-1000"></div>

                {/* 1. Imagen de Fondo que dicta el tamaño real del contenedor */}
                <img
                    src={boardImageUrl}
                    alt="Tablero de Juego Mágico"
                    className="max-w-full max-h-[65vh] md:max-h-[75vh] w-auto h-auto block filter saturate-110 brightness-110 rounded-[2.5rem]"
                />

                {/* Renderizado opcional de diagnóstico transparente: Casillas holográficas */}
                {boardPath.map((coord, index) => (
                    <div
                        key={`path-${index}`}
                        className="absolute z-10 w-8 h-8 sm:w-12 sm:h-12 -ml-4 -mt-4 sm:-ml-6 sm:-mt-6 bg-cyan-400/20 backdrop-blur-sm border-2 border-cyan-300/60 rounded-full flex items-center justify-center text-xs sm:text-sm font-black text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.5)] transform hover:scale-125 transition-transform"
                        style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                    >
                        <span className="drop-shadow-md">{index}</span>
                    </div>
                ))}

                {/* 2. Renderizar Dinámicamente los Avatares de los Jugadores */}
                {players.map((player) => {
                    // Asegurarse de que el jugador no sobrepase el límite del tablero de casillas
                    const safePositionIndex = Math.min(player.current_position, boardPath.length - 1);
                    // Si la ruta no está definida en la DB o está vacía (0 pts de config), caen del cielo al medio.
                    const coordinate = (boardPath.length > 0) ? boardPath[safePositionIndex] : { x: 50, y: 50 };

                    const positionStyle = coordinate
                        ? { left: `${coordinate.x}%`, top: `${coordinate.y}%` }
                        : { left: "50%", top: "50%" };

                    return (
                        <div
                            key={player.id}
                            className="absolute transition-all duration-1000 ease-out z-20 flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 hover:z-50"
                            style={positionStyle}
                        >
                            {/* Nombre Flotante del Estudiante Estilo MMO */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <span className="bg-black/80 backdrop-blur-md text-white border border-white/20 text-xs sm:text-sm px-3 py-1.5 rounded-full mb-2 font-black tracking-wide shadow-xl drop-shadow-xl whitespace-nowrap block animate-pulse">
                                    {player.player_name}
                                </span>
                            </div>

                            {/* GIF del Meme Flotando */}
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-yellow-400 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden bg-white hover:scale-125 transition-transform duration-300 animate-[bounce_3s_ease-in-out_infinite] group/avatar cursor-help">
                                {/* Halo Dorado brillante al moverse */}
                                <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(250,204,21,0.5)] z-10 pointer-events-none"></div>
                                <img
                                    src={player.avatar_gif_url}
                                    alt={player.player_name}
                                    className="w-full h-full object-cover filter contrast-125 group-hover/avatar:brightness-110"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
