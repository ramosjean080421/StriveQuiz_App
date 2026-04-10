"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ConnectedPlayersModalProps {
    gameId: string;
    isOpen: boolean;
    onClose: () => void;
    onPlayerKicked?: () => void;
}

interface Player {
    id: string;
    player_name: string;
    avatar_gif_url: string;
    current_position: number;
    score: number;
}

export default function ConnectedPlayersModal({ gameId, isOpen, onClose, onPlayerKicked }: ConnectedPlayersModalProps) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [kickingIds, setKickingIds] = useState<Set<string>>(new Set());

    // Detección de posibles duplicados por coincidencia parcial de tokens
    // Captura: nombres exactos, abreviaciones ("Fede" vs "Federico") y apellidos compartidos ("Valverde")
    const detectDuplicates = (playerList: Player[]) => {
        const duplicates = new Set<string>();

        // Solo tokens con 3+ caracteres para evitar falsos positivos con palabras cortas ("de", "la", etc.)
        const tokenize = (name: string) =>
            name.toLowerCase().trim().split(/\s+/).filter(t => t.length >= 3);

        for (let i = 0; i < playerList.length; i++) {
            const tokens1 = tokenize(playerList[i].player_name);

            for (let j = i + 1; j < playerList.length; j++) {
                const tokens2 = tokenize(playerList[j].player_name);

                // Hay coincidencia si algún token de uno empieza con el token del otro (o viceversa)
                // Ej: "fede" es prefijo de "federico" → posible duplicado
                // Ej: "valverde" aparece en ambos → posible duplicado
                const hasMatch = tokens1.some(t1 =>
                    tokens2.some(t2 => t1.startsWith(t2) || t2.startsWith(t1))
                );

                if (hasMatch) {
                    duplicates.add(playerList[i].id);
                    duplicates.add(playerList[j].id);
                }
            }
        }
        return duplicates;
    };

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        setLoading(true);

        const fetchPlayers = async () => {
            const { data } = await supabase
                .from("game_players")
                .select("id, player_name, avatar_gif_url, current_position, score")
                .eq("game_id", gameId)
                .gte("current_position", 0) // No mostrar expulsados o que se fueron (-999, -1)
                .order("joined_at", { ascending: true });

            if (data && isMounted) {
                setPlayers(data);
            }
            if (isMounted) setLoading(false);
        };

        fetchPlayers();

        // Suscripción en tiempo real
        const channel = supabase.channel(`modal_players_${gameId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setPlayers(prev => [...prev, payload.new as Player]);
                    } else if (payload.eventType === 'UPDATE') {
                        if (payload.new.current_position === -999 || payload.new.current_position === -1) {
                            setPlayers(prev => prev.filter(p => p.id !== payload.new.id));
                        } else {
                            setPlayers(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
                    }
                }
            ).subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [gameId, isOpen]);

    const handleKick = async (playerId: string) => {
        // Marcar este jugador como "en proceso de expulsión" sin afectar a otros
        setKickingIds(prev => new Set(prev).add(playerId));
        // Optimistic: ocultar de la lista de inmediato
        setPlayers(prev => prev.filter(p => p.id !== playerId));
        onPlayerKicked?.();

        try {
            // 1. Señal letal (-999): el alumno ve la pantalla de expulsión antes de que se borre el registro
            const { error: updateError } = await supabase
                .from("game_players").update({ current_position: -999 }).eq("id", playerId);

            if (updateError) throw updateError;

            // 2. Borrar el registro después de que el alumno reaccione al -999
            await new Promise(resolve => setTimeout(resolve, 1200));
            const { error: deleteError } = await supabase
                .from("game_players").delete().eq("id", playerId);

            if (deleteError) throw deleteError;
        } catch (error) {
            console.error("Error al expulsar al jugador:", error);
            alert("Hubo un error al intentar expulsar al usuario.");
            // Revertir: volver a mostrar al jugador en la lista
            const { data: restored } = await supabase
                .from("game_players")
                .select("id, player_name, avatar_gif_url, current_position, score")
                .eq("id", playerId).single();
            if (restored) setPlayers(prev => [...prev, restored as Player]);
        } finally {
            // Limpiar solo este jugador del set, sin afectar las demás expulsiones en curso
            setKickingIds(prev => {
                const next = new Set(prev);
                next.delete(playerId);
                return next;
            });
        }
    };

    if (!isOpen) return null;

    const duplicates = detectDuplicates(players);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in font-sans">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-900/40 p-6 border-b border-indigo-500/20 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                            <span>👥</span> Lista de Alumnos Conectados
                        </h2>
                        <p className="text-indigo-300 font-bold text-sm mt-1">
                            Total: {players.length} jugador{players.length !== 1 ? 'es' : ''}
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 bg-indigo-500 hover:bg-red-500 text-white font-black rounded-xl flex items-center justify-center transition-colors shadow-lg active:scale-95"
                        title="Cerrar modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-indigo-400">
                            <span className="text-3xl animate-spin mb-3">⏳</span>
                            <span className="font-bold">Cargando jugadores...</span>
                        </div>
                    ) : players.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <span className="text-4xl mb-3 opacity-50">👻</span>
                            <span className="font-bold">Aún no hay nadie conectado</span>
                        </div>
                    ) : (
                        players.map((player) => {
                            const isDuplicate = duplicates.has(player.id);

                            return (
                                <div 
                                    key={player.id} 
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all shadow-md ${
                                        isDuplicate 
                                            ? 'bg-amber-900 border-amber-500' 
                                            : 'bg-white/5 border-white/10 hover:border-indigo-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <img 
                                            src={player.avatar_gif_url} 
                                            alt={player.player_name} 
                                            className="w-12 h-12 rounded-full border-2 border-white/50 object-cover bg-black"
                                        />
                                        <div>
                                            <h3 className={`font-black text-lg ${isDuplicate ? 'text-amber-100' : 'text-white'}`}>
                                                {player.player_name}
                                            </h3>
                                            {isDuplicate && (
                                                <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-black uppercase tracking-wider mt-0.5">
                                                    <span className="animate-pulse">⚠️</span> Posible Duplicado
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={() => handleKick(player.id)}
                                        disabled={kickingIds.has(player.id)}
                                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${
                                            kickingIds.has(player.id)
                                            ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                                            : 'bg-red-600 text-white hover:bg-red-500 active:scale-95'
                                        }`}
                                    >
                                        {kickingIds.has(player.id) ? 'EXPULSANDO...' : 'EXPULSAR'}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
