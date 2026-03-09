"use client";

// Este componente permite al profesor instanciar una nueva Partida (juego) de uno de sus Cuestionarios.
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

function StartGameContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get("quizId");

    const [loading, setLoading] = useState(false);
    const [quizName, setQuizName] = useState("");

    // Configuración del Modo de Juego
    const [gameMode, setGameMode] = useState<"classic" | "boss">("classic");
    const [bossHp, setBossHp] = useState<number>(1000);

    useEffect(() => {
        if (quizId) {
            supabase.from("quizzes").select("title").eq("id", quizId).single()
                .then(({ data }) => { if (data) setQuizName(data.title) });
        }
    }, [quizId]);

    const handleStartGame = async () => {
        if (!quizId) return;
        setLoading(true);

        try {
            // General un PIN aleatorio de 6 caracteres (letras y números)
            const pin = Math.random().toString(36).substring(2, 8).toUpperCase();

            // Crear el registro de 'games' (la sala) con su modo
            const { data: newGame, error } = await supabase
                .from("games")
                .insert([
                    {
                        quiz_id: quizId,
                        pin: pin,
                        status: "waiting",
                        game_mode: gameMode,
                        boss_hp: gameMode === "boss" ? bossHp : 0,
                        boss_max_hp: gameMode === "boss" ? bossHp : 0
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
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900 via-gray-900 to-black overflow-hidden relative font-sans">
            {/* Elementos Decorativos Espaciales/Neón */}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 sm:p-12 rounded-[3rem] shadow-[0_0_50px_rgba(79,70,229,0.2)] max-w-lg w-full text-center relative z-10 mx-4">
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-[0_10px_30px_rgba(79,70,229,0.5)] flex items-center justify-center rotate-12">
                    <span className="text-white text-3xl font-black -rotate-12">🎮</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white mt-4 mb-1 tracking-tight">Preparar Sala</h1>
                <p className="text-gray-300 text-sm mb-6 leading-relaxed font-medium">
                    Vas a iniciar el tablero:<br />
                    <strong className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 text-xl font-black block mt-1 drop-shadow-md">
                        {quizName || "Cargando..."}
                    </strong>
                </p>

                {/* Selector de Modo de Juego */}
                <div className="mb-8 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setGameMode("classic")}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${gameMode === 'classic' ? 'bg-indigo-600/20 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                        >
                            <span className="text-3xl">🏃‍♂️</span>
                            <span className="text-white font-black text-sm">Clásico</span>
                            <span className="text-[10px] text-gray-400 leading-tight">Carrera normal<br />por el tablero</span>
                        </button>

                        <button
                            onClick={() => setGameMode("boss")}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${gameMode === 'boss' ? 'bg-rose-600/20 border-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                        >
                            <span className="text-3xl">🐲</span>
                            <span className="text-white font-black text-sm">Modo Jefe</span>
                            <span className="text-[10px] text-gray-400 leading-tight">Trabajo en equipo<br />vs Monstruo</span>
                        </button>
                    </div>

                    {/* Configurador de Jefe (Solo visible si es modo Boss) */}
                    {gameMode === "boss" && (
                        <div className="bg-black/30 p-5 rounded-2xl border border-rose-500/30 animate-fade-in mt-4 text-left">
                            <label className="text-rose-300 text-xs font-black uppercase tracking-widest flex items-center justify-between mb-3">
                                <span>❤️ Vida del Monstruo</span>
                                <span className="text-xl text-white font-black bg-rose-600 px-3 py-1 rounded-lg">{bossHp} HP</span>
                            </label>
                            <input
                                type="range"
                                min="100"
                                max="10000"
                                step="100"
                                value={bossHp}
                                onChange={(e) => setBossHp(Number(e.target.value))}
                                className="w-full accent-rose-500 mb-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-[11px] text-gray-400 font-medium">
                                Recomendación: {bossHp < 1000 ? "Fácil (Para pocas preguntas o pocos alumnos)" : bossHp < 5000 ? "Normal" : "Difícil (¡Guerra total!)"}
                            </p>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleStartGame}
                    disabled={loading || !quizName}
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-white rounded-2xl shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:shadow-[0_0_40px_rgba(52,211,153,0.6)] font-black text-lg transition-all transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-300/50 uppercase tracking-widest flex items-center justify-center gap-3"
                >
                    {loading ? (
                        <>
                            <span className="animate-spin text-2xl">⏳</span>
                            <span className="animate-pulse">ABRIENDO SALA...</span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl">⚡</span> COMENZAR PARTIDA
                        </>
                    )}
                </button>

                <p className="text-[10px] text-indigo-200/50 mt-6 font-bold tracking-widest uppercase">Prisma Quiz Engine</p>
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
