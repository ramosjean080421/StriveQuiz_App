"use client";

// Esta vista es la principal "Pantalla de Proyección" (El profesor la ve en la pizarra o proyector)
import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import GameBoard from "@/components/GameBoard";
import ConnectedPlayersModal from "@/components/ConnectedPlayersModal";
import Link from "next/link";

export default function GameRoomBoard({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = use(params);
    const [pin, setPin] = useState("");
    const [gameStatus, setGameStatus] = useState("waiting"); // 'waiting', 'active', 'paused', 'finished'
    const [loading, setLoading] = useState(true);
    const [podium, setPodium] = useState<any[]>([]);
    const [allPlayers, setAllPlayers] = useState<any[]>([]);
    const [playerCount, setPlayerCount] = useState(0);
    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'ludo' | 'memory'>('classic');
    const [gameDuration, setGameDuration] = useState(0); 
    const [timeLeftSession, setTimeLeftSession] = useState(0);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const [canControl, setCanControl] = useState(false);

    const fetchWinners = async () => {
        const { data: allP } = await supabase
            .from("game_players")
            .select("player_name, avatar_gif_url, score, current_position, correct_answers, incorrect_answers")
            .eq("game_id", gameId)
            .order("score", { ascending: false })
            .order("current_position", { ascending: false });

        if (allP) {
            // Filtrar alumnos que abandonaron la partida (Posición -1)
            const filtered = allP.filter((p: any) => p.current_position !== -1);
            setPodium(filtered.slice(0, 3));
            setAllPlayers(filtered);
        }
    };

    useEffect(() => {
        const fetchGameAndPerms = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();

            const { data: game } = await supabase
                .from("games")
                .select("pin, status, game_mode, quiz_id, game_duration, auto_end")
                .eq("id", gameId)
                .single();

            if (game) {
                setPin(game.pin);
                setGameStatus(game.status);
                setGameMode(game.game_mode as 'classic' | 'race' | 'ludo' || 'classic');
                if (game.game_duration && game.game_duration > 0 && !game.auto_end) {
                    setGameDuration(game.game_duration);
                    if (game.status === "active") {
                        setTimeLeftSession(game.game_duration * 60);
                    }
                }

                // Verificar Permisos
                if (authUser) {
                    const { data: quiz } = await supabase
                        .from("quizzes")
                        .select("teacher_id, editors_emails")
                        .eq("id", game.quiz_id)
                        .single();

                    if (quiz) {
                        const isOwner = quiz.teacher_id === authUser.id;
                        const isEditor = quiz.editors_emails?.includes(authUser.email?.toLowerCase());
                        if (isOwner || isEditor) setCanControl(true);
                    }
                }

                if (game.status === "finished") {
                    fetchWinners();
                }
            }
            setLoading(false);
        };
        fetchGameAndPerms();

        
        const refreshCount = async () => {
            const { count } = await supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('game_id', gameId).gte("current_position", 0);
            setPlayerCount(count || 0);
        };
        const channel = supabase.channel(`game_room_status_${gameId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                (payload) => {
                    setGameStatus(payload.new.status);
                    if (payload.new.status === "finished") {
                        fetchWinners();
                    }
                }
            )
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
                () => refreshCount()
            ).subscribe();

        // Obtener el conteo inicial
        supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('game_id', gameId).gte('current_position', 0).then(({ count }) => {
            if (count) setPlayerCount(count);
        });

        return () => { supabase.removeChannel(channel); };

    }, [gameId]);

    useEffect(() => {
        if (gameStatus !== "active" || timeLeftSession <= 0) return;

        const timer = setInterval(() => {
            setTimeLeftSession(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    finishGame(); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStatus, timeLeftSession]);



    const startGame = async () => {
        const newStatus = "active";
        await supabase.from("games").update({ status: newStatus }).eq("id", gameId);
        if (gameDuration > 0) {
            setTimeLeftSession(gameDuration * 60);
        }
        setGameStatus(newStatus);
        const audio = document.getElementById('bg-music') as HTMLAudioElement;
        if (audio) {
            audio.volume = 0.4;
            audio.play().catch(e => console.log("Autoplay bloqueado:", e));
        }
    };



    const finishGame = async () => {
        const newStatus = "finished";
        await supabase.from("games").update({ status: newStatus }).eq("id", gameId);
        setGameStatus(newStatus);

        const audio = document.getElementById('bg-music') as HTMLAudioElement;
        if (audio) audio.pause();

        fetchWinners();
    };

    if (loading) return (
        <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
            <span className="text-3xl font-black text-indigo-500 animate-pulse">Abriendo Portal...</span>
        </div>
    );

    return (
        <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-gray-900 to-black text-white font-sans flex flex-col relative">            {/* Elementos Decorativos Espaciales/Neón */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>
            <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>

            {/* Header / Top Bar (Más compacto y eficiente) */}
            <header className="relative z-20 flex-shrink-0 flex justify-between items-center px-6 py-3 bg-white/5 backdrop-blur-md border-b border-white/10 shadow-lg">
                <div className="flex items-center gap-6">
                    {gameStatus !== "waiting" && (
                        <div className="bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-2 rounded-xl shadow-lg border border-white/20 transform -rotate-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-0.5 leading-none">CÓDIGO:</p>
                            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-widest drop-shadow-md">
                                {pin}
                            </h1>
                        </div>
                    )}

                    {/* Master Timer Session */}
                    {gameStatus === "active" && timeLeftSession > 0 && (
                        <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-5 py-2 rounded-xl border border-indigo-400/30 backdrop-blur-md flex flex-col items-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-0.5">TIEMPO RESTANTE</p>
                            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-200">
                                {Math.floor(timeLeftSession / 60)}:{(timeLeftSession % 60).toString().padStart(2, '0')}
                            </h2>
                        </div>
                    )}
                    {gameStatus === "waiting" && (
                        <div className="hidden md:flex items-center gap-3 animate-pulse">
                            <span className="relative flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                            </span>
                            <span className="text-green-400 font-bold uppercase tracking-widest text-sm">Esperando Jugadores...</span>
                        </div>
                    )}
                    {gameStatus === "waiting" && (
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="hidden lg:flex items-center gap-2 bg-[#2d3748] hover:bg-[#3f4a61] transition-all active:scale-95 px-4 py-2 rounded-xl text-white font-black border border-white/20 shadow-lg cursor-pointer"
                        >
                            <span>👤</span>
                            {playerCount} Conectados
                        </button>
                    )}
                </div>

                {/* Controles del Profesor */}
                <div className="flex items-center space-x-3 sm:space-x-4">
                    {gameStatus === "waiting" && (
                        <>
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}/?pin=${pin}`;
                                    navigator.clipboard.writeText(url);
                                    showToast("¡Enlace copiado al instante!", "success");
                                }}
                                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2.5 border-b-4 border-blue-800"
                            >
                                <span className="text-xl">🔗</span>
                                <span className="uppercase tracking-widest text-sm">Copiar Link</span>
                            </button>

                            {canControl && (
                                <div className="relative group/tooltip">
                                    <button 
                                        onClick={startGame} 
                                        disabled={playerCount < 1} 
                                        className="px-8 py-3.5 bg-green-500 hover:bg-green-600 active:bg-green-700 rounded-2xl font-black shadow-lg text-lg text-white transition-all active:scale-95 border-b-4 border-green-700 disabled:bg-gray-700 disabled:border-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none flex items-center gap-2.5"
                                    >
                                        <span className="text-2xl">🚀</span> 
                                        <span className="uppercase tracking-widest mt-1">INICIAR</span>
                                    </button>
                                    
                                    {playerCount < 1 && (
                                        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-all duration-300 bg-slate-900/95 backdrop-blur-md text-white font-black text-[11px] px-4 py-2.5 rounded-2xl shadow-2xl whitespace-nowrap pointer-events-none border border-white/10 flex items-center gap-1.5 z-30">
                                            <span className="text-sm">💡</span> Debe haber mínimo 1 jugador
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {(gameStatus === "active" || gameStatus === "paused") && canControl && (
                        <>
                            <button
                                onClick={async () => {
                                    const newStatus = gameStatus === "active" ? "paused" : "active";
                                    const { error } = await supabase.from("games").update({ status: newStatus }).eq("id", gameId);
                                    if (error) {
                                        console.error("Error updating game status:", error);
                                        showToast("Error al cambiar el estado del juego", "error");
                                        return;
                                    }
                                    setGameStatus(newStatus);
                                }}
                                className={`px-6 sm:px-8 py-4 rounded-2xl font-black shadow-md hover:shadow-lg text-lg transition-transform transform hover:scale-105 active:scale-95 border flex items-center gap-2 ${gameStatus === "active" ? 'bg-amber-500 hover:bg-amber-600 border-amber-400 text-white' : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-white'}`}
                            >
                                <span>{gameStatus === "active" ? "⏸️ PAUSAR" : "▶️ CONTINUAR"}</span>
                            </button>

                            <button
                                onClick={finishGame}
                                className="px-6 sm:px-8 py-4 bg-red-600 hover:bg-red-700 rounded-2xl font-black shadow-md hover:shadow-lg text-lg transition-transform transform hover:scale-105 active:scale-95 border border-red-500 flex items-center gap-2"
                            >
                                <span>⏹️ TERMINAR JUEGO</span>
                            </button>
                        </>
                    )}

                    {gameStatus === "finished" && (
                        <div className="flex items-center gap-3">
                            <div className="px-6 sm:px-10 py-4 sm:py-5 bg-amber-500/20 text-amber-400 border-2 border-amber-500/50 rounded-2xl font-black text-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                                <span className="animate-bounce">🏆</span> PARTIDA FINALIZADA
                            </div>
                            <Link
                                href="/teacher/dashboard"
                                className="group px-6 sm:px-8 py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-md transition-all hover:scale-105 active:scale-95 border-2 border-indigo-400 flex items-center gap-2"
                            >
                                <svg className="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <span>VOLVER AL PANEL</span>
                            </Link>
                        </div>
                    )}
                </div>
            </header >

            {/* Contenedor del Mapa Central o Podio (Ocupa el resto de la pantalla) */}
            <main className={`flex-1 relative z-10 p-2 sm:p-4 flex ${gameStatus === "finished" ? "flex-col overflow-y-auto items-center justify-start h-full custom-scrollbar pt-10" : "items-center justify-center overflow-hidden"}`}>
                {gameStatus === "finished" ? (
                    <div className="flex flex-col items-center justify-start w-full max-w-5xl animate-fade-in relative pb-20">
                        {/* Confeti Sencillo CSS */}
                        <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse"></div>
                        <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-12 drop-shadow-xl uppercase tracking-widest text-center mt-10">
                            ¡Podio de Ganadores!
                        </h2>

                        <div className="flex items-end justify-center gap-4 sm:gap-8 h-80">
                            {/* Segundo Lugar */}
                            {podium[1] && (
                                <div className="flex flex-col items-center justify-end h-[80%] animate-slide-up animation-delay-300">
                                    <img src={podium[1].avatar_gif_url} className="w-20 h-20 rounded-full border-4 border-gray-300 shadow-xl z-20 -mb-6 bg-white object-cover" />
                                    <div className="w-32 bg-gradient-to-b from-gray-300 to-gray-400 h-full rounded-t-xl flex flex-col items-center pt-8 relative shadow-2xl border-t-4 border-gray-100 p-2 text-center">
                                        <span className="text-4xl font-black text-white drop-shadow-md text-center w-full mt-6">2°</span>
                                        <p className="font-bold text-gray-800 text-sm mt-2">{podium[1].player_name}</p>
                                        <p className="text-xs text-gray-700 font-bold">{podium[1].score} pts</p>
                                        <div className="flex gap-1 text-[10px] mt-1 opacity-80">
                                            <span className="text-green-800">✅ {podium[1].correct_answers || 0}</span>
                                            <span className="text-red-800">❌ {podium[1].incorrect_answers || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Primer Lugar */}
                            {podium[0] && (
                                <div className="flex flex-col items-center justify-end h-full animate-slide-up z-10 shadow-2xl">
                                    <div className="absolute -top-10 text-6xl animate-bounce z-30">👑</div>
                                    <img src={podium[0].avatar_gif_url} className="w-28 h-28 rounded-full border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] z-20 -mb-8 bg-white object-cover" />
                                    <div className="w-40 bg-gradient-to-b from-yellow-400 to-amber-600 h-full rounded-t-xl flex flex-col items-center pt-10 relative shadow-2xl border-t-4 border-yellow-200 p-2 text-center">
                                        <span className="text-6xl font-black text-white drop-shadow-md mt-6">1°</span>
                                        <p className="font-bold text-yellow-900 text-lg mt-2 truncate w-full">{podium[0].player_name}</p>
                                        <p className="text-sm text-yellow-800 font-black">{podium[0].score} pts</p>
                                        <div className="flex gap-2 text-xs mt-1 bg-yellow-900/10 px-2 py-0.5 rounded-full shadow-inner font-bold">
                                            <span className="text-green-800 drop-shadow-sm">✅ {podium[0].correct_answers || 0}</span>
                                            <span className="text-red-800 drop-shadow-sm">❌ {podium[0].incorrect_answers || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tercer Lugar */}
                            {podium[2] && (
                                <div className="flex flex-col items-center justify-end h-[60%] animate-slide-up animation-delay-600">
                                    <img src={podium[2].avatar_gif_url} className="w-16 h-16 rounded-full border-4 border-orange-400 shadow-xl z-20 -mb-4 bg-white object-cover" />
                                    <div className="w-32 bg-gradient-to-b from-orange-400 to-rose-500 h-full rounded-t-xl flex flex-col items-center pt-6 relative shadow-2xl border-t-4 border-orange-200 p-2 text-center">
                                        <span className="text-3xl font-black text-white drop-shadow-md mt-4">3°</span>
                                        <p className="font-bold text-rose-900 text-sm mt-2 truncate w-full">{podium[2].player_name}</p>
                                        <p className="text-xs text-rose-800 font-bold">{podium[2].score} pts</p>
                                        <div className="flex gap-1 text-[10px] mt-1 opacity-80">
                                            <span className="text-green-900 font-bold">✅ {podium[2].correct_answers || 0}</span>
                                            <span className="text-red-900 font-bold">❌ {podium[2].incorrect_answers || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tabla de Reporte Final de todos los jugadores */}
                        <div className="w-full mt-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] p-6 sm:p-8 shadow-2xl z-20">
                            <h3 className="text-2xl sm:text-3xl font-black text-indigo-300 mb-6 text-left flex items-center gap-2 drop-shadow-md">
                                📊 Reporte Especial de Jugadores
                            </h3>
                            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                                <table className="w-full text-left text-white whitespace-nowrap">
                                    <thead className="bg-indigo-900/40 text-xs uppercase tracking-wider text-indigo-200">
                                        <tr>
                                            <th className="p-4 font-black">Rank</th>
                                            <th className="p-4 font-black">Estudiante</th>
                                            <th className="p-4 font-black text-center">Correctas</th>
                                            <th className="p-4 font-black text-center">Incorrectas</th>
                                            <th className="p-4 font-black text-right">Puntaje</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {allPlayers.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-4 font-black text-xl text-indigo-400/80">#{idx + 1}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-4">
                                                        <img src={p.avatar_gif_url} className="w-10 h-10 rounded-full border-2 border-indigo-400/50 group-hover:border-indigo-400 transition-colors shadow-lg object-cover" />
                                                        <span className="font-bold text-lg drop-shadow-md">{p.player_name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-block bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-xl font-bold border border-emerald-500/30">
                                                        ✅ {p.correct_answers || 0}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-block bg-rose-500/20 text-rose-400 px-4 py-1.5 rounded-xl font-bold border border-rose-500/30">
                                                        ❌ {p.incorrect_answers || 0}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="font-black text-amber-400 text-xl drop-shadow-sm">
                                                        {p.score} <span className="text-xs text-amber-500/80">pts</span>
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : gameStatus === 'waiting' ? (
                    /* ====== Lobby Premium del Profesor ====== */
                    <div className="flex flex-col items-center justify-center w-full h-full relative">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                            <img src="/logotransparente.png" alt="" className="w-[120vw] max-w-[1000px] opacity-[0.04] blur-[6px] select-none" draggable={false} />
                        </div>
                        <div className="relative z-10 flex flex-col items-center gap-8">
                            <img src="/logotransparente.png" alt="StriveQuiz" className="w-48 h-48 object-contain drop-shadow-2xl" />
                            <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 px-12 py-8 rounded-[3rem] flex flex-col items-center shadow-[0_20px_80px_rgba(79,70,229,0.15)]">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="relative flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-emerald-400 font-black uppercase tracking-[0.2em] text-sm">Sala Abierta</span>
                                </div>
                                <h2 className="text-6xl sm:text-7xl font-black text-white tracking-[0.3em] mb-3 drop-shadow-md">{pin}</h2>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Comparte este código a tus alumnos</p>
                            </div>
                            <div className="flex items-center gap-3 opacity-30">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                <span className="text-indigo-300/50 text-[10px] font-black uppercase tracking-[0.3em] ml-2">Esperando para iniciar</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <GameBoard gameId={gameId} />
                )}
            </main>

            <ConnectedPlayersModal
                gameId={gameId}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            {/* Música de Juego */}
            <audio id="bg-music" loop src="https://cdns-preview-f.dzcdn.net/stream/c-f458e0aae13fa26ea7f2c69bb128deba-3.mp3"></audio>

            {/* TOAST FLOTANTE PERSONALIZADO */}
            {toast && (
                <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-[2rem] font-bold flex items-center gap-4 animate-bounce-short border backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
                    toast.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 
                    toast.type === 'error' ? 'bg-red-500/90 text-white border-red-400' :
                    'bg-indigo-500/90 text-white border-indigo-400'
                }`}>
                    <span className="text-2xl">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '🚨' : 'ℹ️'}</span>
                    <span className="tracking-wide uppercase text-xs">{toast.message}</span>
                </div>
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(to bottom, rgba(99, 102, 241, 0.6), rgba(168, 85, 247, 0.6));
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to bottom, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.9));
                }
            `}</style>
        </div>
    );
}
