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

    if (!quizId) return <div>ID de Cuestionario no proporcionado.</div>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center">
                <h1 className="text-2xl font-bold mb-2">Preparar Sala</h1>
                <p className="text-gray-500 mb-8">Vas a iniciar el tablero: <strong className="text-indigo-600">{quizName || "Cargando..."}</strong></p>

                <button
                    onClick={handleStartGame}
                    disabled={loading || !quizName}
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 font-bold transition-transform transform hover:scale-105 disabled:opacity-50"
                >
                    {loading ? "Creando PIN de Sala..." : "📺 Abrir Sala de Juego"}
                </button>
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
