"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function StudentLogin() {
    const router = useRouter();
    const [pin, setPin] = useState("");
    const [playerName, setPlayerName] = useState("");
    const [shuffledMemes, setShuffledMemes] = useState<string[]>([]);
    const [selectedGif, setSelectedGif] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const loadAvatars = async () => {
            try {
                const res = await fetch("/api/avatars");
                const data = await res.json();
                if (data.avatars && data.avatars.length > 0) {
                    const shuffled = [...data.avatars].sort(() => Math.random() - 0.5);
                    setShuffledMemes(shuffled);
                    setSelectedGif(shuffled[0]);
                }
            } catch (err) {
                console.error("Error loading avatars:", err);
            }
        };
        loadAvatars();
    }, []);

    const handleJoinGame = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            // 1. Buscar si la partida existe y está en modo 'waiting' o 'active' usando el PIN
            const { data: game, error: gameError } = await supabase
                .from("games")
                .select("id, status")
                .eq("pin", pin.toUpperCase())
                .single();

            if (gameError || !game) {
                throw new Error("PIN de sala no válido o partida no encontrada.");
            }
            if (game.status === "finished") {
                throw new Error("La partida ya ha finalizado.");
            }

            // 2. Registrar al estudiante en la tabla 'game_players'
            const { data: player, error: playerError } = await supabase
                .from("game_players")
                .insert([
                    {
                        game_id: game.id,
                        player_name: playerName,
                        avatar_gif_url: selectedGif,
                        current_position: 0,
                        score: 0
                    }
                ])
                .select()
                .single();

            if (playerError) throw playerError;

            // 3. Guardar en el dispositivo la ID del jugador y su token secreto (para interactuar en partida de forma segura)
            localStorage.setItem("currentPlayerId", player.id);
            if (player.secret_token) {
                localStorage.setItem("playerSecret", player.secret_token);
            }

            // 4. Redirigir al área de juego del estudiante
            router.push(`/player/play/${game.id}`);

        } catch (err: any) {
            setError(err.message || "Error al intentar entrar a la sala.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-indigo-500 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full animate-fade-in-up">

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold text-indigo-600">
                        GameQuiz!
                    </h1>
                    <p className="text-gray-500 mt-2">¡Ingresa el PIN, elige tu meme y juega!</p>
                </div>

                <form onSubmit={handleJoinGame} className="space-y-6">
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded">
                            <p className="text-sm font-semibold">{error}</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">PIN de la Sala</label>
                        <input
                            type="text"
                            required
                            maxLength={6}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.toUpperCase())}
                            placeholder="Ej. A1B2C3"
                            className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-200 focus:border-purple-500 transition-all uppercase"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Tu Apodo</label>
                        <input
                            type="text"
                            required
                            maxLength={15}
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            placeholder="Ej. ProGamer99"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-200 focus:border-purple-500 transition-all font-semibold"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3 flex justify-between items-center">
                            <span>Elige tu Avatar de Meme</span>
                            <button
                                type="button"
                                onClick={() => setShuffledMemes([...shuffledMemes].sort(() => Math.random() - 0.5))}
                                className="text-xs text-purple-600 hover:text-purple-800 font-black flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg border border-purple-100 transition-colors"
                            >
                                <span>🔄</span> Reordenar
                            </button>
                        </label>
                        <div className="grid grid-cols-3 gap-3 pr-2 max-h-48 overflow-y-auto">
                            {shuffledMemes.map((gif, index) => (
                                <div
                                    key={index}
                                    onClick={() => setSelectedGif(gif)}
                                    className={`cursor-pointer rounded-xl overflow-hidden border-4 transition-transform duration-200 aspect-square ${selectedGif === gif
                                        ? "border-green-400 scale-105"
                                        : "border-transparent hover:scale-105"
                                        }`}
                                >
                                    <img src={gif} alt={`Meme ${index}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !pin || !playerName}
                        className="w-full py-4 rounded-xl text-white font-bold text-lg bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? "Conectando..." : "¡ENTRAR AL JUEGO!"}
                    </button>
                </form>
            </div>
        </div>
    );
}
