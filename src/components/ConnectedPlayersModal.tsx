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
    const [activeTab, setActiveTab] = useState<'connected' | 'pending'>('connected');

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
                .gte("current_position", -100) // Mostrar conectados (0+) y pendientes (-100)
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

    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [isApprovingAll, setIsApprovingAll] = useState(false);

    const handleApproveAll = async () => {
        setIsApprovingAll(true);
        try {
            const pending = players.filter(p => p.current_position === -100);
            if (pending.length === 0) return;
            
            // Actualización optimista para que la UI reaccione instantáneamente
            setPlayers(prev => prev.map(p => p.current_position === -100 ? { ...p, current_position: 0 } : p));

            // Actualizar individualmente para evitar problemas de RLS en actualizaciones masivas
            await Promise.all(
                pending.map(p => 
                    supabase.from("game_players").update({ current_position: 0 }).eq("id", p.id)
                )
            );
        } catch (error) {
            console.error("Excepción en handleApproveAll:", error);
        } finally {
            setIsApprovingAll(false);
        }
    };

    const handleApprove = async (playerId: string) => {
        setProcessingIds(prev => new Set(prev).add(playerId));
        // Actualización optimista
        setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, current_position: 0 } : p));
        try {
            const { error } = await supabase.from("game_players").update({ current_position: 0 }).eq("id", playerId);
            if (error) {
                console.error("Error en base de datos al aprobar:", error);
                alert("Hubo un error real en la base de datos. Si migraste tu BD, verifica las políticas de seguridad (RLS).");
            }
            // Realtime actualizará el maestro y confirmará el movimiento
        } catch (error) {
            console.error("Excepción en handleApprove:", error);
        } finally {
            setProcessingIds(prev => { const next = new Set(prev); next.delete(playerId); return next; });
        }
    };

    const handleDeny = async (playerId: string) => {
        setProcessingIds(prev => new Set(prev).add(playerId));
        setPlayers(prev => prev.filter(p => p.id !== playerId));
        try {
            const { error } = await supabase.from("game_players").delete().eq("id", playerId);
            if (error) {
                console.error("Error en base de datos al rechazar:", error);
                // Revertir si falla
                const { data: restored } = await supabase
                    .from("game_players")
                    .select("id, player_name, avatar_gif_url, current_position, score")
                    .eq("id", playerId).single();
                if (restored) setPlayers(prev => [...prev, restored as Player]);
                alert("Hubo un error al rechazar. Verifica las políticas RLS.");
            }
        } catch (error) {
            console.error("Excepción en handleDeny:", error);
        } finally {
            setProcessingIds(prev => { const next = new Set(prev); next.delete(playerId); return next; });
        }
    };

    if (!isOpen) return null;

    const duplicates = detectDuplicates(players);
    const connectedPlayers = players.filter(p => p.current_position >= 0);
    const pendingPlayers = players.filter(p => p.current_position === -100);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in font-sans">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-900/40 p-6 border-b border-indigo-500/20 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                            <span>👥</span> Gestión de Alumnos
                        </h2>
                        <p className="text-indigo-300 font-bold text-sm mt-1">
                            {connectedPlayers.length} en partida | {pendingPlayers.length} por aprobar
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

                {/* Tabs de Navegación */}
                <div className="flex bg-indigo-900/20 border-b border-indigo-500/20 shrink-0">
                    <button
                        onClick={() => setActiveTab('connected')}
                        className={`flex-1 py-3 text-sm font-black uppercase tracking-wider transition-all ${
                            activeTab === 'connected' 
                            ? 'bg-indigo-500/20 text-white border-b-2 border-indigo-400' 
                            : 'text-indigo-400/60 hover:text-indigo-300 hover:bg-indigo-500/10'
                        }`}
                    >
                        🎮 Alumnos en Partida ({connectedPlayers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-3 text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'pending' 
                            ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-400' 
                            : 'text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10'
                        }`}
                    >
                        ⏳ Solicitudes ({pendingPlayers.length})
                        {pendingPlayers.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                                {pendingPlayers.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-slate-900/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-indigo-400">
                            <span className="text-3xl animate-spin mb-3">⏳</span>
                            <span className="font-bold">Cargando jugadores...</span>
                        </div>
                    ) : (
                        <>
                            {/* PESTAÑA: SOLICITUDES PENDIENTES */}
                            {activeTab === 'pending' && (
                                pendingPlayers.length > 0 ? (
                                    <div className="space-y-3 animate-fade-in">
                                        <div className="flex justify-between items-center px-2 mb-4 mt-2">
                                            <p className="text-gray-400 font-bold text-sm">Alumnos en espera: <span className="text-indigo-400">{pendingPlayers.length}</span></p>
                                            
                                            {pendingPlayers.length > 1 && (
                                                <button 
                                                    onClick={handleApproveAll}
                                                    disabled={isApprovingAll}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white flex items-center gap-2 shadow-lg ${
                                                        isApprovingAll ? 'bg-gray-600 cursor-not-allowed shadow-none' : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-emerald-900/50'
                                                    }`}
                                                >
                                                    <span>✅</span> {isApprovingAll ? 'Procesando...' : 'Permitir a Todos'}
                                                </button>
                                            )}
                                        </div>
                                        {pendingPlayers.map((player) => (
                                            <div key={player.id} className="flex items-center justify-between p-4 rounded-2xl border-2 bg-slate-800/80 border-amber-500/30 hover:border-amber-500/60 transition-all shadow-md">
                                                <div className="flex items-center gap-4 opacity-90">
                                                    <img 
                                                        src={player.avatar_gif_url} 
                                                        alt={player.player_name} 
                                                        className="w-12 h-12 rounded-full border-2 border-amber-100/30 object-cover bg-black"
                                                    />
                                                    <div>
                                                        <h3 className="font-black text-lg text-white">
                                                            {player.player_name}
                                                        </h3>
                                                        <p className="text-xs text-amber-400 font-bold">Desea unirse a la sala</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleDeny(player.id)}
                                                        disabled={processingIds.has(player.id)}
                                                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white flex items-center gap-1.5 ${
                                                            processingIds.has(player.id) ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600/90 hover:bg-red-500 active:scale-95'
                                                        }`}
                                                    >
                                                        <span>❌</span> {processingIds.has(player.id) ? '...' : 'Rechazar'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(player.id)}
                                                        disabled={processingIds.has(player.id)}
                                                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white flex items-center gap-1.5 shadow-lg ${
                                                            processingIds.has(player.id) ? 'bg-gray-600 cursor-not-allowed shadow-none' : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-emerald-900/50'
                                                        }`}
                                                    >
                                                        <span>✅</span> {processingIds.has(player.id) ? '...' : 'Permitir'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-amber-500/50 animate-fade-in">
                                        <span className="text-5xl mb-4 opacity-50">📭</span>
                                        <span className="font-bold text-lg tracking-wide uppercase">La bandeja está vacía</span>
                                        <span className="text-sm font-medium mt-1">No hay solicitudes de ingreso pendientes</span>
                                    </div>
                                )
                            )}

                            {/* PESTAÑA: ALUMNOS ACTIVOS CONECTADOS */}
                            {activeTab === 'connected' && (
                                connectedPlayers.length > 0 ? (
                                    <div className="space-y-3 animate-fade-in">
                                        {connectedPlayers.map((player) => {
                                            const isDuplicate = duplicates.has(player.id);
                                            return (
                                                <div 
                                                    key={player.id} 
                                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all shadow-md group ${
                                                        isDuplicate 
                                                            ? 'bg-amber-900/80 border-amber-500/80' 
                                                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-indigo-400/50'
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
                                                            {isDuplicate ? (
                                                                <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-black uppercase tracking-wider mt-0.5 bg-amber-950/50 w-fit px-2 py-0.5 rounded-full border border-amber-700/50">
                                                                    <span className="animate-pulse">⚠️</span> Posible Duplicado
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] text-emerald-400 font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    Activo en la sala
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <button
                                                        onClick={() => handleKick(player.id)}
                                                        disabled={kickingIds.has(player.id)}
                                                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${
                                                            kickingIds.has(player.id)
                                                            ? 'bg-gray-700/80 text-gray-400 cursor-not-allowed border border-gray-600'
                                                            : 'bg-red-600/90 text-white hover:bg-red-500 active:scale-95 border border-red-500'
                                                        }`}
                                                    >
                                                        {kickingIds.has(player.id) ? 'EXPULSANDO...' : 'EXPULSAR'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-indigo-400/50 animate-fade-in">
                                        <span className="text-5xl mb-4 opacity-50">👻</span>
                                        <span className="font-bold text-lg tracking-wide uppercase">Nadie en la sala</span>
                                        <span className="text-sm font-medium mt-1">Acéptalos en la pestaña de Solicitudes</span>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
