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
    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'ludo'>('classic');

    useEffect(() => {
        if (quizId) {
            supabase.from("quizzes").select("title, board_image_url, game_mode").eq("id", quizId).single()
                .then(({ data }) => {
                    if (data) {
                        setQuizName(data.title);
                        setBoardImageUrl(data.board_image_url || "");
                        if (data.game_mode) setGameMode(data.game_mode as any);
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

            // Crear el registro de 'games' (la sala) con su modo y configuraciones
            const { data: newGame, error } = await supabase
                .from("games")
                .insert([
                    {
                        quiz_id: quizId,
                        pin: pin,
                        status: "waiting",
                        auto_end: autoEnd,
                        game_mode: gameMode
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            // Navegar a la sala de Proyección o 'Board' del profesor
            router.push(`/game/${newGame.id}/board`);

        } catch (err: any) {
            alert("Error al crear la sala: " + err.message);
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

            <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 p-10 sm:p-14 rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.5),0_0_50px_rgba(79,70,229,0.1)] max-w-lg w-full text-center relative z-10 mx-4 border-t-white/20">
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] shadow-[0_15px_40px_rgba(79,70,229,0.4)] flex items-center justify-center rotate-12 relative group">
                        <div className="absolute inset-0 bg-white/20 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-white text-4xl font-black -rotate-12 drop-shadow-lg">🎮</span>
                    </div>
                </div>

                <div className="mt-8 space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        Preparar Sala
                    </h1>
                    <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-[0.3em]">
                        Prisma Quiz Engine
                    </p>
                </div>

                <div className="mt-10 mb-8 p-6 rounded-[2rem] bg-indigo-500/10 border border-indigo-400/20 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">🗺️</div>
                    <p className="text-gray-400 text-sm font-medium mb-1">Cargando Aventura:</p>
                    <strong className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 text-2xl sm:text-3xl font-black block drop-shadow-sm leading-tight">
                        {quizName || "Configurando..."}
                    </strong>
                </div>

                {/* Sección de Configuración */}
                <div className="space-y-4 mb-10 text-left">
                    {/* Toggle de Auto-finalizar (Editable) */}
                    <div
                        onClick={() => setAutoEnd(!autoEnd)}
                        className={`cursor-pointer group relative overflow-hidden p-6 rounded-[2rem] border-2 transition-all duration-500 ${
                            autoEnd 
                            ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_20px_40px_rgba(16,185,129,0.1)]" 
                            : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                        }`}
                    >
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 shadow-xl ${
                                    autoEnd ? 'bg-emerald-500 text-white animate-pulse' : 'bg-white/5 text-white/30'
                                }`}>
                                    {autoEnd ? '🏁' : '🏳️'}
                                </div>
                                <div>
                                    <h4 className={`text-base font-black transition-colors ${autoEnd ? 'text-emerald-400' : 'text-gray-300'}`}>
                                        Auto-finalizar
                                    </h4>
                                    <p className="text-gray-500 text-xs font-medium">El primero en llegar cierra la sala</p>
                                </div>
                            </div>
                            
                            {/* Toggle Switch Estilizado */}
                            <div className={`w-16 h-8 rounded-full p-1.5 transition-colors duration-500 flex items-center ${autoEnd ? 'bg-emerald-500' : 'bg-gray-800'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-500 shadow-2xl ${autoEnd ? 'translate-x-8 scale-110' : 'translate-x-0'}`}></div>
                            </div>
                        </div>
                    </div>
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
