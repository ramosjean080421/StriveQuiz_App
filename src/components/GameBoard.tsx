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

// --- COMPONENTE DE TABLERO LUDO PROCEDURAL ---
const LudoGrid = () => {
    // Paleta que mezcla lo Clásico (Original) con lo Moderno (Premium)
    const parchment = "#e8dfc5"; // Recuperamos el color cálido original
    const neutralCell = "rgba(255, 255, 255, 0.4)";
    const woodBorder = "#2d1810"; // Marco oscuro elegante

    const redPath = "linear-gradient(135deg, #ef4444 0%, #991b1b 100%)";
    const greenPath = "linear-gradient(135deg, #10b981 0%, #065f46 100%)";
    const bluePath = "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)";
    const yellowPath = "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";

    const Cell = ({ color, className = "" }: any) => {
        const isPath = color !== "#e8dfc5";
        return (
            <div 
                className={`w-full h-full border border-black/30 flex items-center justify-center transition-all duration-300 relative group ${className}`} 
                style={{ 
                    background: isPath ? color : parchment,
                    boxShadow: isPath ? 'inset 0 0 12px rgba(0,0,0,0.4), 0 0 5px rgba(255,255,255,0.1)' : 'inset 0 0 2px rgba(0,0,0,0.1)'
                }}
            >
                {/* Micro-brillo para celdas de camino */}
                {isPath && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                )}
            </div>
        );
    };

    const Base = ({ color, icon, glowColor }: any) => (
        <div 
            className="col-span-6 row-span-6 border-[clamp(4px,1vh,12px)] border-black/40 rounded-[3rem] p-4 flex items-center justify-center relative shadow-2xl overflow-hidden group" 
            style={{ 
                background: color,
                boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), inset 0 0 30px rgba(0,0,0,0.3)`
            }}
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.2)_0%,_transparent_70%)]"></div>
            <div 
                className="w-full h-full bg-white/15 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center text-[clamp(4rem,11vh,7.5rem)] drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-700 ease-out z-10 border border-white/20"
                style={{ boxShadow: `0 0 50px ${glowColor}66` }}
            >
                <span className="group-hover:rotate-12 transition-transform duration-500">{icon}</span>
            </div>
            
            {/* Animación de pulso ambiental */}
            <div className="absolute -inset-full bg-white/5 rotate-45 animate-[pulse_4s_infinite] pointer-events-none"></div>
        </div>
    );

    return (
        <div className="aspect-square h-[min(65vh,85vw)] max-w-[100vw] bg-[#e8dfc5] border-[clamp(10px,2vh,20px)] border-[#2d1810] rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.5)] p-3 grid grid-cols-15 grid-rows-15 relative overflow-hidden ring-4 ring-[#3d2616]/20">
            {/* Textura de Mapa Antiguo muy sutil */}
            <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_20%_30%,_rgba(255,255,255,0.4)_0%,_transparent_50%),_radial-gradient(circle_at_80%_70%,_rgba(0,0,0,0.1)_0%,_transparent_50%)]"></div>
            
            {/* Bases Superiores */}
            <Base color={greenPath} icon="🏰" glowColor="#10b981" />
            <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 p-1.5 gap-[3px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i % 3 === 1 && i > 0 ? "#ef4444" : "#e8dfc5"} className="rounded-lg" />)}
            </div>
            <Base color={redPath} icon="🐲" glowColor="#ef4444" />

            {/* Fila del medio */}
            <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 p-1.5 gap-[3px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i >= 6 && i < 11 ? "#10b981" : "#e8dfc5"} className="rounded-lg" />)}
            </div>
            
            {/* Centro Moderno Clásico - Libro Literario Gigante */}
            <div className="col-span-3 row-span-3 bg-white/10 border-2 border-black/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-white/10 animate-pulse"></div>
                <div className="w-full h-full bg-[#f3edd7] flex items-center justify-center text-[clamp(4rem,14vh,10rem)] shadow-inner border border-black/10">
                    <span className="drop-shadow-2xl transform hover:scale-110 transition-transform duration-500">📖</span>
                </div>
            </div>

            <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 p-1.5 gap-[3px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i >= 7 && i < 12 ? "#f59e0b" : "#e8dfc5"} className="rounded-lg" />)}
            </div>

            {/* Bases Inferiores */}
            <Base color={bluePath} icon="🚢" glowColor="#3b82f6" />
            <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 p-1.5 gap-[3px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i % 3 === 1 && i < 15 ? "#3b82f6" : "#e8dfc5"} className="rounded-lg" />)}
            </div>
            <Base color={yellowPath} icon="🕯️" glowColor="#f59e0b" />
        </div>
    );
};

export default function GameBoard({ gameId }: GameBoardProps) {
    const [boardImageUrl, setBoardImageUrl] = useState<string>("");
    const [boardPath, setBoardPath] = useState<BoardCoordinate[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameMode, setGameMode] = useState<"classic" | "race" | "ludo">("classic");
    const [ludoTeamsCount, setLudoTeamsCount] = useState<number>(4);
    const [totalQuestions, setTotalQuestions] = useState<number>(10);
    const [attackAnims, setAttackAnims] = useState<AttackAnim[]>([]);
    const [eatenAnim, setEatenAnim] = useState<{playerId: string, x: number, y: number} | null>(null);
    const [teams, setTeams] = useState<Record<string, Player[]>>({});
    const [uiPositions, setUiPositions] = useState<Record<string, number>>({});

    const playersRef = useRef<any[]>([]);
    useEffect(() => { playersRef.current = players; }, [players]);
    const gameModeRef = useRef<string>("classic");
    useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
    const boardPathRef = useRef<BoardCoordinate[]>([]);
    useEffect(() => { boardPathRef.current = boardPath; }, [boardPath]);

    const getLudoPath = (teamIndex: number) => {
        const gridToPct = (v: number) => (v * (100 / 15)) + (100 / 30);
        const commonCircuit = [
            [1,6],[2,6],[3,6],[4,6],[5,6], [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
            [7,0],[8,0], [8,1],[8,2],[8,3],[8,4],[8,5], [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
            [14,7],[14,8], [13,8],[12,8],[11,8],[10,8],[9,8], [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
            [7,14],[6,14], [6,13],[6,12],[6,11],[6,10],[6,9], [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
            [0,7],[0,6]
        ];
        // Bases en orden: Verde (TL), Rojo (TR), Amarillo (BR), Azul (BL)
        const bases = [[2.5, 2.5], [11.5, 2.5], [11.5, 11.5], [2.5, 11.5]]; 
        const teamOffsets = [0, 13, 26, 39]; 
        const finals = [
            [[1,7],[2,7],[3,7],[4,7],[5,7],[7,7]], // Verde
            [[7,1],[7,2],[7,3],[7,4],[7,5],[7,7]], // Rojo
            [[13,7],[12,7],[11,7],[10,7],[9,7],[7,7]], // Amarillo
            [[7,13],[7,12],[7,11],[7,10],[7,9],[7,7]]  // Azul
        ];

        const startIdx = teamOffsets[teamIndex];
        const initialPoint = bases[teamIndex];
        const loop = [...commonCircuit.slice(startIdx), ...commonCircuit.slice(0, startIdx)];
        const myFinal = finals[teamIndex];
        return [initialPoint, ...loop, ...myFinal].map(p => ({ x: gridToPct(p[0]), y: gridToPct(p[1]) }));
    };

    const triggerAttackAnim = (playerId: string, type: "correct" | "incorrect", avatarUrl: string) => {
        const path = boardPathRef.current;
        if (path.length === 0) return;
        const currentPlayers = playersRef.current;
        const pIndex = currentPlayers.findIndex(p => p.id === playerId);
        const safeIndex = pIndex >= 0 ? (pIndex % path.length) : 0;
        const startCoord = path[safeIndex];

        const animId = Math.random().toString(36).substring(7);
        setAttackAnims(prev => [...prev, { id: animId, type, avatarUrl, startX: startCoord.x, startY: startCoord.y }]);
        setTimeout(() => setAttackAnims(prev => prev.filter(a => a.id !== animId)), 2000);
    };

    useEffect(() => {
        const fetchGameData = async () => {
            const { data: gameConfig } = await supabase.from("games").select(`game_mode, quiz_id, quizzes (board_image_url, board_path, ludo_teams_count)`).eq("id", gameId).single();
            if (gameConfig) {
                setGameMode(gameConfig.game_mode as any || "classic");
                const quizData: any = Array.isArray(gameConfig.quizzes) ? gameConfig.quizzes[0] : gameConfig.quizzes;
                setBoardImageUrl(quizData?.board_image_url || "/default-board.png");
                setBoardPath(quizData?.board_path as BoardCoordinate[] || []);
                setLudoTeamsCount(quizData?.ludo_teams_count || 4);
                const { count } = await supabase.from("questions").select("*", { count: 'exact', head: true }).eq("quiz_id", gameConfig.quiz_id);
                if (count) setTotalQuestions(count);
                else setTotalQuestions(10); // Fallback robusto
            }
            const { data: initialPlayers } = await supabase.from("game_players").select("*").eq("game_id", gameId);
            if (initialPlayers) setPlayers(initialPlayers as Player[]);
            setLoading(false);
        };
        fetchGameData();

        const channel = supabase.channel(`game_${gameId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, (payload) => {
                setPlayers((prev) => [...prev, payload.new as Player]);
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, (payload) => {
                const newPlayer = payload.new as Player & { correct_answers?: number, incorrect_answers?: number, game_id?: string };
                const oldPlayer = playersRef.current.find(p => p.id === newPlayer.id);
                
                if (oldPlayer) {
                    // Detectar si fue "comido" (regresado a 0 desde una posición positiva)
                    if (newPlayer.current_position === 0 && oldPlayer.current_position > 0) {
                        // Activar animación de "Eaten"
                        setEatenAnim({ playerId: newPlayer.id, x: 50, y: 50 }); // Temporal coords
                        setTimeout(() => setEatenAnim(null), 2000);
                    }
                    
                    if (gameModeRef.current === "classic" || gameModeRef.current === "race") {
                        if ((newPlayer.correct_answers || 0) > (oldPlayer.correct_answers || 0)) triggerAttackAnim(newPlayer.id, "correct", newPlayer.avatar_gif_url);
                        else if ((newPlayer.incorrect_answers || 0) > (oldPlayer.incorrect_answers || 0)) triggerAttackAnim(newPlayer.id, "incorrect", newPlayer.avatar_gif_url);
                    }
                }
                setPlayers((prev) => prev.map((p) => p.id === payload.new.id ? (payload.new as Player) : p));
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [gameId]);

    useEffect(() => {
        if (gameMode === "ludo") {
            const teamNames = ["Verde", "Rojo", "Amarillo", "Azul"].slice(0, ludoTeamsCount);
            const newTeams: Record<string, Player[]> = {};
            teamNames.forEach(name => newTeams[name] = []);
            const sortedPlayers = [...players].sort((a,b) => a.id.localeCompare(b.id)); // Deterministic
            sortedPlayers.forEach((p, i) => {
                const teamName = teamNames[i % ludoTeamsCount];
                newTeams[teamName].push(p);
            });
            setTeams(newTeams);
        }
    }, [players, gameMode, ludoTeamsCount]);

    // Efecto para que los avatares "caminen" casilla a casilla
    useEffect(() => {
        players.forEach(p => {
            const currentUI = uiPositions[p.id] ?? p.current_position;
            if (currentUI < p.current_position) {
                const timer = setTimeout(() => {
                    setUiPositions(prev => ({ ...prev, [p.id]: currentUI + 1 }));
                }, 500); // 500ms para un caminar más pausado y premium
                return () => clearTimeout(timer);
            } else if (currentUI > p.current_position) {
                setUiPositions(prev => ({ ...prev, [p.id]: p.current_position }));
            }
        });
    }, [players, uiPositions]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-white">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xl font-black animate-pulse uppercase tracking-widest text-indigo-400">Invocando el Tablero...</p>
        </div>
    );

    const isLudo = gameMode === "ludo";

    return (
        <div className="w-full h-full flex flex-row items-center justify-center overflow-hidden relative p-4 gap-8">
            {isLudo && (
                <div className="w-[clamp(200px,22vw,300px)] flex flex-col gap-2 z-20 self-start mt-2">
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[clamp(1.2rem,2.5vh,1.8rem)]">🎲</span>
                        <h2 className="text-[clamp(1rem,2.2vh,1.5rem)] font-black text-white tracking-tighter uppercase italic drop-shadow-md">EQUIPOS</h2>
                    </div>
                    
                    {Object.entries(teams).map(([name, members]) => {
                        const icon = name === "Verde" ? "🏰" : name === "Rojo" ? "🐲" : name === "Amarillo" ? "🕯️" : "🚢";
                        const baseColor = name === "Verde" ? "#1d6b2f" : name === "Rojo" ? "#911d1d" : name === "Amarillo" ? "#cc8a16" : "#1d408c";
                        const accentColor = name === "Verde" ? "#2a8c3f" : name === "Rojo" ? "#b02e2e" : name === "Amarillo" ? "#e6a01b" : "#2c58b8";
                        
                        return (
                            <div 
                                key={name} 
                                className="group relative overflow-hidden rounded-2xl border-t border-white/10 border-b-4 border-black/40 shadow-xl transition-all hover:translate-y-[-2px]"
                                style={{ backgroundColor: baseColor }}
                            >
                                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '12px 12px' }}></div>
                                
                                <div className="relative p-3 z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-[clamp(2.5rem,6vh,4rem)] h-[clamp(2.5rem,6vh,4rem)] rounded-xl bg-white/10 flex items-center justify-center text-[clamp(1.5rem,3.5vh,2.5rem)] shadow-inner border border-white/10 group-hover:scale-105 transition-transform">
                                                {icon}
                                            </div>
                                            <h3 className="text-[clamp(1rem,2.5vh,1.8rem)] font-black text-white tracking-tighter italic uppercase drop-shadow-md">
                                                {name}
                                            </h3>
                                        </div>

                                        <span className="text-[clamp(1.2rem,3.5vh,2.2rem)] font-black text-white leading-none drop-shadow-lg pr-1">
                                            {members.length}
                                        </span>
                                    </div>

                                    {/* Mini Avatares - Muy compactos verticalmente */}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {members.map(m => (
                                            <div key={m.id} className="relative w-7 h-7 rounded-full border border-white/50 overflow-hidden shadow-md bg-black/40">
                                                <img src={m.avatar_gif_url} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="relative inline-block">
                {isLudo ? <LudoGrid /> : (
                    <img src={boardImageUrl} className="max-h-[65vh] w-auto h-auto block rounded-[2rem] shadow-2xl saturate-125" />
                )}

                {/* Renderizar Jugadores */}
                {players.map((player) => {
                    let coordinate = { x: 50, y: 50 };
                    if (isLudo) {
                        const teamNames = ["Verde", "Rojo", "Amarillo", "Azul"].slice(0, ludoTeamsCount);
                        const teamName = Object.keys(teams).find(n => teams[n].some(p => p.id === player.id));
                        const teamIdx = teamNames.indexOf(teamName || "");
                        const path = getLudoPath(teamIdx >= 0 ? teamIdx : 0);
                        
                        // Usamos uiPositions para el renderizado suave
                        const currentPos = uiPositions[player.id] ?? player.current_position;
                        const progress = Math.min(currentPos / (totalQuestions || 1), 1);
                        const vIdx = progress * (path.length - 1);
                        const iA = Math.floor(vIdx);
                        const iB = Math.min(iA + 1, path.length - 1);
                        const w = vIdx - iA;
                        coordinate = { 
                            x: path[iA].x + (path[iB].x - path[iA].x) * w, 
                            y: path[iA].y + (path[iB].y - path[iA].y) * w 
                        };
                    } else if (boardPath.length > 0) {
                        const currentPos = uiPositions[player.id] ?? player.current_position;
                        const progress = Math.min(currentPos / (totalQuestions || 1), 1);
                        const vIdx = progress * (boardPath.length - 1);
                        const iA = Math.floor(vIdx);
                        const iB = Math.min(iA + 1, boardPath.length - 1);
                        const w = vIdx - iA;
                        coordinate = { x: boardPath[iA].x + (boardPath[iB].x-boardPath[iA].x)*w, y: boardPath[iA].y + (boardPath[iB].y-boardPath[iA].y)*w };
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
                            <div className="w-[clamp(2.8rem,7vh,5rem)] h-[clamp(2.8rem,7vh,5rem)] rounded-full border-[clamp(3px,0.5vh,6px)] border-white shadow-[0_15px_30px_rgba(0,0,0,0.6),_inset_0_0_10px_rgba(0,0,0,0.2)] overflow-hidden bg-white hover:scale-125 transition-transform animate-[bounce-subtle_2s_infinite_ease-in-out]">
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
