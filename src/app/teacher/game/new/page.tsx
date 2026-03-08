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

            // Crear el registro de 'games' (la sala)
            const { data: newGame, error } = await supabase
                .from("games")
                .insert([
                    {
                        quiz_id: quizId,
                        pin: pin,
                        status: "waiting"
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

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-10 sm:p-14 rounded-[3rem] shadow-[0_0_50px_rgba(79,70,229,0.2)] max-w-lg w-full text-center relative z-10 mx-4">
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-[0_10px_30px_rgba(79,70,229,0.5)] flex items-center justify-center rotate-12">
                    <span className="text-white text-4xl font-black -rotate-12">▶️</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black text-white mt-6 mb-2 tracking-tight">Preparar Sala</h1>
                <p className="text-gray-300 text-lg mb-10 leading-relaxed font-medium">
                    Vas a iniciar el tablero:<br />
                    <strong className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 text-2xl font-black block mt-2 drop-shadow-md">
                        {quizName || "Cargando..."}
                    </strong>
                </p>

                <button
                    onClick={handleStartGame}
                    disabled={loading || !quizName}
                    className="w-full py-5 px-6 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-white rounded-2xl shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:shadow-[0_0_40px_rgba(52,211,153,0.6)] font-black text-xl transition-all transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-300/50 uppercase tracking-widest flex items-center justify-center gap-3"
                >
                    {loading ? (
                        <>
                            <span className="animate-spin text-2xl">⏳</span>
                            <span className="animate-pulse">FORJANDO PORTAL...</span>
                        </>
                    ) : (
                        <>
                            <span className="text-3xl">📺</span> ABRIR SALA DE JUEGO
                        </>
                    )}
                </button>

                <p className="text-xs text-indigo-200/50 mt-8 font-bold tracking-widest uppercase">Prisma Quiz Engine</p>
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
