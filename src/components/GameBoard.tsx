"use client";

import { useEffect, useState, useRef } from "react";
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

type AttackAnim = {
    id: string;
    type: "correct" | "incorrect";
    avatarUrl: string;
    startX: number;
    startY: number;
};

export default function GameBoard({ gameId }: GameBoardProps) {
    const [boardImageUrl, setBoardImageUrl] = useState<string>("");
    const [boardPath, setBoardPath] = useState<BoardCoordinate[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    const [gameMode, setGameMode] = useState<"classic" | "boss">("classic");
    const [bossHp, setBossHp] = useState<number>(0);
    const [bossMaxHp, setBossMaxHp] = useState<number>(0);
    const [attackAnims, setAttackAnims] = useState<AttackAnim[]>([]);

    // Refs para acceder a estados recientes en los manejadores de eventos (Websockets)
    const playersRef = useRef<any[]>([]);
    useEffect(() => { playersRef.current = players; }, [players]);
    const gameModeRef = useRef<string>("classic");
    useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
    const boardPathRef = useRef<BoardCoordinate[]>([]);
    useEffect(() => { boardPathRef.current = boardPath; }, [boardPath]);

    const triggerAttackAnim = (playerId: string, type: "correct" | "incorrect", avatarUrl: string) => {
        const path = boardPathRef.current;
        const currentPlayers = playersRef.current;
        const pIndex = currentPlayers.findIndex(p => p.id === playerId);
        const safeIndex = pIndex >= 0 ? (pIndex % Math.max(1, path.length)) : 0;
        const startCoord = path.length > 0 ? path[safeIndex] : { x: 50, y: 50 };

        const animId = Math.random().toString(36).substring(7);
        setAttackAnims(prev => [...prev, {
            id: animId,
            type,
            avatarUrl,
            startX: startCoord.x,
            startY: startCoord.y,
        }]);

        setTimeout(() => {
            setAttackAnims(prev => prev.filter(a => a.id !== animId));
        }, 2000); // Darle 2 segundos para la animación
    };

    // Cargar datos iniciales del tablero y los jugadores actuales
    useEffect(() => {
        const fetchGameData = async () => {
            // Obtener quiz asociado y sus datos del tablero, además de los datos del juego
            const { data: gameConfig } = await supabase
                .from("games")
                .select(`
          game_mode,
          boss_hp,
          boss_max_hp,
          quiz_id,
          quizzes (
            board_image_url,
            board_path
          )
        `)
                .eq("id", gameId)
                .single();

            if (gameConfig) {
                setGameMode(gameConfig.game_mode as "classic" | "boss" || "classic");
                setBossHp(gameConfig.boss_hp || 0);
                setBossMaxHp(gameConfig.boss_max_hp || 0);

                if (gameConfig.quizzes) {
                    const quizData: any = Array.isArray(gameConfig.quizzes) ? gameConfig.quizzes[0] : gameConfig.quizzes;
                    setBoardImageUrl(quizData?.board_image_url || "/default-board.png");
                    setBoardPath(quizData?.board_path as BoardCoordinate[] || []);
                }
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
                    const newPlayer = payload.new as Player & { correct_answers?: number, incorrect_answers?: number };
                    const oldPlayer = playersRef.current.find(p => p.id === newPlayer.id) as any;

                    // Detectar si contestó para activar la super animación
                    if (oldPlayer && gameModeRef.current === "boss") {
                        if ((newPlayer.correct_answers || 0) > (oldPlayer.correct_answers || 0)) {
                            triggerAttackAnim(newPlayer.id, "correct", newPlayer.avatar_gif_url);
                        } else if ((newPlayer.incorrect_answers || 0) > (oldPlayer.incorrect_answers || 0)) {
                            triggerAttackAnim(newPlayer.id, "incorrect", newPlayer.avatar_gif_url);
                        }
                    }

                    setPlayers((prev) =>
                        prev.map((player) =>
                            player.id === payload.new.id ? (payload.new as Player) : player
                        )
                    );
                }
            )
            // Escuchar si el monstruo recibe daño
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
                (payload) => {
                    if (payload.new.boss_hp !== undefined) {
                        setBossHp(payload.new.boss_hp);
                    }
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
        <div className="w-full h-full flex items-center justify-center overflow-hidden relative">

            {/* Si estamos en Modo Jefe, mostramos la Barra de Vida gigante en la parte superior, fuera del contenedor escalable para que no se oculte */}
            {gameMode === "boss" && bossMaxHp > 0 && (
                <div className="absolute top-[2%] md:top-[5%] left-1/2 transform -translate-x-1/2 w-[90%] max-w-3xl bg-gray-900 rounded-full h-10 sm:h-12 md:h-14 border-4 sm:border-[6px] border-gray-900 shadow-[0_0_50px_rgba(225,29,72,0.9)] overflow-hidden z-50 pointer-events-none transition-all">
                    <div
                        className="bg-gradient-to-r from-rose-500 via-red-500 to-rose-600 h-full transition-all duration-700 ease-out relative"
                        style={{ width: `${Math.max(0, (bossHp / bossMaxHp) * 100)}%` }}
                    >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 mix-blend-overlay"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-between px-6 sm:px-10 text-white font-black text-sm sm:text-xl md:text-2xl tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                        {bossHp > 0 ? (
                            <>
                                <span>🐉 REY BESTIA</span>
                                <span>{bossHp} / {bossMaxHp} HP</span>
                            </>
                        ) : (
                            <span className="text-center w-full">¡MONSTRUO DERROTADO! 🎉</span>
                        )}
                    </div>
                </div>
            )}

            <div className="relative w-fit h-fit rounded-[3rem] shadow-[0_0_80px_rgba(79,70,229,0.3)] border-4 sm:border-8 border-indigo-500/50 group mt-10">

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
                {players.map((player, index) => {
                    // En Modo Jefe, el jugador no avanza por posiciones, se queda anclado a un cañón.
                    // En Modo Clásico, el jugador avanza de acuerdo a current_position.
                    const safePositionIndex = gameMode === "boss"
                        ? (index % Math.max(1, boardPath.length)) // Se le asigna un cañón equitativamente según su orden de llegada
                        : Math.min(player.current_position, boardPath.length - 1);

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

                {/* 3. Animaciones de Disparo / misiles (Boss Mode) */}
                {attackAnims.map(anim => (
                    <div
                        key={anim.id}
                        className="absolute z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                        style={{
                            '--start-x': `${anim.startX}%`,
                            '--start-y': `${anim.startY}%`,
                            left: '50%',
                            top: '50%',
                            animation: `flyFromStart 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards`
                        } as React.CSSProperties}
                    >
                        {/* El proyectil (el avatar del chico en una bola mágica) */}
                        <div className={`relative w-16 h-16 rounded-full border-4 ${anim.type === 'correct' ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,1)]' : 'border-rose-400 shadow-[0_0_40px_rgba(225,29,72,1)]'} bg-white overflow-hidden animate-[spin_0.5s_linear_infinite]`}>
                            <img src={anim.avatarUrl} className="w-full h-full object-cover" />
                        </div>
                        {/* Texto de daño emergente (aparece al final en el centro) */}
                        <div
                            className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-center font-black text-5xl whitespace-nowrap opacity-0 ${anim.type === 'correct' ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(0,0,0,1)]' : 'text-rose-500 drop-shadow-[0_0_20px_rgba(0,0,0,1)]'}`}
                            style={{ animation: 'damagePop 1.5s forwards' }}
                        >
                            {anim.type === 'correct' ? '-10 HP' : '+5 HP 😥'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Estilos inyectados críticos para la animación balística */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes flyFromStart {
                    0% {
                        left: var(--start-x);
                        top: var(--start-y);
                        transform: translate(-50%, -50%) scale(0.8);
                        opacity: 1;
                    }
                    35% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(0.4);
                        opacity: 1;
                        filter: drop-shadow(0 0 40px white) brightness(2);
                    }
                    40% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(3);
                        opacity: 0;
                    }
                    100% {
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%) scale(3);
                        opacity: 0;
                    }
                }
                
                @keyframes damagePop {
                    0%, 35% { opacity: 0; transform: translate(-50%, 0) scale(0.5); }
                    38% { opacity: 1; transform: translate(-50%, -20px) scale(1.5); }
                    80% { opacity: 1; transform: translate(-50%, -40px) scale(1.2); }
                    100% { opacity: 0; transform: translate(-50%, -60px) scale(1); }
                }
            `}} />
        </div>
    );
}
