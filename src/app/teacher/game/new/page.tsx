"use client";

// Este componente permite al profesor instanciar una nueva Partida (juego) de uno de sus Cuestionarios.
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function StartGameContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get("quizId");

    const [loading, setLoading] = useState(false);
    const [quizName, setQuizName] = useState("");
    const [boardImageUrl, setBoardImageUrl] = useState("");

    // Nuevas configuraciones de partida
    const [autoEnd, setAutoEnd] = useState(false);
    const [enableGameTimer, setEnableGameTimer] = useState(false);
    const [enableQuestionTimer, setEnableQuestionTimer] = useState(true);
    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'ludo' | 'memory' | 'roblox'>('classic');
    
    const [dataLoaded, setDataLoaded] = useState(false);
    const [gameDuration, setGameDuration] = useState(10); // Minutos
    const [questionDuration, setQuestionDuration] = useState(20); // Segundos

    // Memoria: Tiempo extra por acierto
    const [enableBonusTime, setEnableBonusTime] = useState(false);
    const [bonusTimePerMatch, setBonusTimePerMatch] = useState(5); // Segundos
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // Roblox: Límite de preguntas / islas generadas
    const [customQuestionCount, setCustomQuestionCount] = useState<number | ''>(10);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        if (quizId) {
            supabase.from("quizzes").select("title, board_image_url, game_mode").eq("id", quizId).single()
                .then(({ data }) => {
                    if (data) {
                        setQuizName(data.title);
                        setBoardImageUrl(data.board_image_url || "");
                        if (data.game_mode) setGameMode(data.game_mode as any);
                        setDataLoaded(true);
                    }
                });
        }
    }, [quizId]);

    const handleStartGame = async () => {
        if (!quizId) return;
        setLoading(true);

        try {
            // General un PIN aleatorio de 6 caracteres (letras y números)
            const pin = Math.random().toString(36).substring(2, 8).toUpperCase();

            let insertData: any = {
                quiz_id: quizId,
                pin: pin,
                status: "waiting",
                auto_end: autoEnd,
                game_mode: gameMode,
                game_duration: (enableGameTimer && !autoEnd) ? gameDuration : null,
                question_duration: gameMode === 'memory' ? 0 : (enableQuestionTimer ? questionDuration : 0),
                bonus_time_per_match: (gameMode === 'memory' && enableBonusTime) ? bonusTimePerMatch : null,
                boss_hp: gameMode === 'roblox' ? Number(customQuestionCount) : 0
            };

            // Primer intento: con todas las columnas
            const { data: newGame, error } = await supabase
                .from("games")
                .insert([insertData])
                .select()
                .single();

            if (error) {
                console.error("Error creating game:", error);
                throw error;
            }

            router.push(`/game/${newGame.id}/board`);

        } catch (err: any) {
            showToast("Error al crear la sala: " + err.message, "error");
            setLoading(false);
        }
    };

    if (!quizId) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <span className="text-xl font-bold text-red-500">ID de tablero no proporcionado. Vuelve al panel.</span>
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-gray-900 selection:bg-indigo-500/30">
            {/* Fondo Dinámico con Mapa */}
            {boardImageUrl && (
                <div
                    className="absolute inset-0 z-0 opacity-40 blur-[4px] scale-110"
                    style={{ backgroundImage: `url("${boardImageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                ></div>
            )}
            {/* Gradiente Oscuro Base encima del mapa */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-gray-900/95 to-black z-0"></div>

            {/* Elementos Decorativos Espaciales/Neón Mejorados */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0 animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0 animate-pulse animation-delay-2000"></div>

            {/* Botón Volver Flotante Premium */}
            <Link
                href="/teacher/dashboard"
                className="absolute top-8 left-8 z-50 flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-2xl border border-white/10 hover:border-white/20 rounded-[1.2rem] text-white/70 hover:text-white transition-all shadow-2xl group font-black text-xs uppercase tracking-[0.2em] overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                <span className="text-xl group-hover:-translate-x-1.5 transition-transform duration-300 leading-none">‹</span>
                <span className="relative z-10">Volver al Panel</span>
            </Link>

            <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 p-8 sm:p-10 rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.5),0_0_50px_rgba(79,70,229,0.1)] max-w-lg w-full text-center relative z-10 mx-4 border-t-white/20 my-10">
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[1.8rem] shadow-[0_15px_40px_rgba(79,70,229,0.4)] flex items-center justify-center rotate-12 relative group">
                        <div className="absolute inset-0 bg-white/20 rounded-[1.8rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-white text-3xl font-black -rotate-12 drop-shadow-lg">🎮</span>
                    </div>
                </div>

                <div className="mt-8 space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        Preparar Sala
                    </h1>
                    <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-[0.3em]">
                        StriveQuiz Engine
                    </p>
                </div>

                <div className="mt-8 mb-6 p-5 rounded-[1.8rem] bg-indigo-500/10 border border-indigo-400/20 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:rotate-12 transition-transform">🗺️</div>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Aventura Seleccionada</p>
                    <strong className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 text-xl sm:text-2xl font-black block drop-shadow-sm leading-tight">
                        {quizName || "Cargando..."}
                    </strong>
                </div>

                {/* Sección de Configuración */}
                <div className={`space-y-4 mb-10 transition-opacity duration-300 ${dataLoaded ? 'opacity-100' : 'opacity-0'}`}>
                    

                    {/* Toggle de Auto-finalizar (Editable) */}
                    <div
                        onClick={() => setAutoEnd(!autoEnd)}
                        className={`cursor-pointer group relative overflow-hidden p-4 rounded-[1.8rem] border-2 transition-all duration-500 ${
                            autoEnd 
                            ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_20px_40px_rgba(16,185,129,0.1)]" 
                            : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                        }`}
                    >
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-left">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-500 shadow-xl ${
                                    autoEnd ? 'bg-emerald-500 text-white animate-pulse' : 'bg-white/5 text-white/30'
                                }`}>
                                    {autoEnd ? '🏁' : '🏳️'}
                                </div>
                                <div className="text-left">
                                    <h4 className={`text-sm font-black transition-colors ${autoEnd ? 'text-emerald-400' : 'text-gray-300'}`}>
                                        Auto-finalizar
                                    </h4>
                                    <p className="text-gray-500 text-[10px] font-medium">Meta cierra la sala</p>
                                </div>
                            </div>
                            
                            {/* Toggle Switch Estilizado */}
                            <div className={`w-16 h-8 rounded-full p-1.5 transition-colors duration-500 flex items-center ${autoEnd ? 'bg-emerald-500' : 'bg-gray-800'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-500 shadow-2xl ${autoEnd ? 'translate-x-8 scale-110' : 'translate-x-0'}`}></div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Duración de la Partida (Sólo si NO es Auto-finalizar) */}
                    {!autoEnd && (
                        <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-3">
                            <div onClick={() => setEnableGameTimer(!enableGameTimer)} className="flex items-center justify-between cursor-pointer px-1">
                                <span className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest">⏳ Activar Tiempo de Partida</span>
                                <div className={`w-12 h-6 rounded-full p-1 flex items-center transition-colors ${enableGameTimer ? 'bg-indigo-500' : 'bg-gray-800'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enableGameTimer ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            {enableGameTimer && (
                                <input 
                                    type="number" 
                                    min="1" max="120"
                                    value={gameDuration === 0 ? "" : gameDuration}
                                    placeholder="Ingresa los minutos..."
                                    onChange={(e) => setGameDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            )}
                        </div>
                    )}

                    {/* Duración de la Pregunta (Solo para juegos NO memoria) */}
                    {gameMode !== 'memory' && (
                        <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-3">
                            <div onClick={() => setEnableQuestionTimer(!enableQuestionTimer)} className="flex items-center justify-between cursor-pointer px-1">
                                <span className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest">⏱️ Activar Tiempo por Pregunta</span>
                                <div className={`w-12 h-6 rounded-full p-1 flex items-center transition-colors ${enableQuestionTimer ? 'bg-indigo-500' : 'bg-gray-800'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enableQuestionTimer ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            {enableQuestionTimer && (
                                <input 
                                    type="number" 
                                    min="5" max="120"
                                    value={questionDuration === 0 ? "" : questionDuration}
                                    placeholder="Ingresa los segundos..."
                                    onChange={(e) => setQuestionDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            )}
                        </div>
                    )}

                    {/* Tiempo Extra por Acierto (Solo Memoria + Solo si hay tiempo de partida activo) */}
                    {gameMode === 'memory' && !autoEnd && enableGameTimer && (
                        <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-3">
                            <div onClick={() => setEnableBonusTime(!enableBonusTime)} className="flex items-center justify-between cursor-pointer px-1">
                                <span className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest">⏱️ Tiempo Extra por Acierto</span>
                                <div className={`w-12 h-6 rounded-full p-1 flex items-center transition-colors ${enableBonusTime ? 'bg-cyan-500' : 'bg-gray-800'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enableBonusTime ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </div>
                            {enableBonusTime && (
                                <div className="space-y-2">
                                    <input 
                                        type="number" 
                                        min="1" max="30"
                                        value={bonusTimePerMatch === 0 ? "" : bonusTimePerMatch}
                                        placeholder="Segundos extra por acierto..."
                                        onChange={(e) => setBonusTimePerMatch(e.target.value === "" ? 0 : Number(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                    />
                                    <p className="text-[10px] text-cyan-400/60 font-bold text-center">Cada pareja acertada sumará {bonusTimePerMatch}s al reloj</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Límite de Islas y Aleatorización (Solo Roblox) */}
                    {gameMode === 'roblox' && (
                        <div className="p-4 rounded-[1.8rem] bg-indigo-900/10 border border-indigo-500/30 space-y-3 shadow-inner">
                            <div className="flex flex-col text-left px-1 mb-2">
                                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">🎲 Límite de Plataformas (Obby)</span>
                            </div>
                            <div className="space-y-2 mt-2 pt-2 border-t border-indigo-500/20">
                                <input 
                                    type="number" 
                                    min="1" max="200"
                                    value={customQuestionCount === 0 ? "" : customQuestionCount}
                                    placeholder="Ej. 10 islas..."
                                    onChange={(e) => setCustomQuestionCount(e.target.value === "" ? "" : Number(e.target.value))}
                                    className="w-full bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                />
                                <p className="text-[10px] text-indigo-300/80 font-bold leading-relaxed text-center mt-2 border-t border-indigo-500/10 pt-2">
                                    Se sortearán de tu banco principal y <span className="text-indigo-200 font-black">cada alumno tendrá preguntas y orden diferentes</span> de forma permanente.
                                </p>
                            </div>
                        </div>
                    )}
 
                </div>

                <button
                    onClick={handleStartGame}
                    disabled={loading || !quizName}
                    className="w-full relative group"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-3xl"></div>
                    <div className="relative py-5 px-8 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-2xl shadow-xl font-black text-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border border-white/20 flex items-center justify-center gap-4 overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                        {loading ? (
                            <>
                                <span className="animate-spin text-2xl">⏳</span>
                                <span className="animate-pulse tracking-widest text-sm uppercase">Abriendo Sala...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-2xl drop-shadow-md">⚡</span>
                                <span className="uppercase tracking-widest">Comenzar Partida</span>
                            </>
                        )}
                    </div>
                </button>

                <div className="mt-10 flex items-center justify-center gap-2 opacity-30">
                    <div className="h-px w-8 bg-white"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    <div className="h-px w-8 bg-white"></div>
                </div>
            </div>

            {/* TOAST FLOTANTE PERSONALIZADO */}
            {toast && (
                <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-[2rem] font-bold flex items-center gap-4 animate-bounce-short border backdrop-blur-2xl shadow-2xl ${
                    toast.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-red-500/90 text-white border-red-400'
                }`}>
                    <span className="text-2xl">{toast.type === 'success' ? '✅' : '🚨'}</span>
                    <span className="tracking-wide uppercase text-xs">{toast.message}</span>
                </div>
            )}
        </div>
    );
}

export default function StartGamePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-indigo-500 font-bold">Cargando...</div>}>
            <StartGameContent />
        </Suspense>
    );
}
