"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

interface Coordinate {
    x: number;
    y: number;
}

// --- COMPONENTE DE TABLERO LUDO PROCEDURAL PARA PREVISUALIZACIÓN ---
const LudoGridPreview = () => {
    const parchment = "#e8dfc5";
    const woodBorder = "#2d1810";
    const redPath = "linear-gradient(135deg, #ef4444 0%, #991b1b 100%)";
    const greenPath = "linear-gradient(135deg, #10b981 0%, #065f46 100%)";
    const bluePath = "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)";
    const yellowPath = "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";

    const Cell = ({ color, className = "" }: any) => {
        const isPath = color !== "#e8dfc5";
        return (
            <div
                className={`w-full h-full border border-black/40 flex items-center justify-center ${className}`}
                style={{
                    background: isPath ? color : parchment,
                    boxShadow: isPath ? 'inset 0 0 5px rgba(0,0,0,0.3)' : 'none'
                }}
            />
        );
    };

    const Base = ({ color, icon, glowColor }: any) => (
        <div
            className="col-span-6 row-span-6 border-2 border-black/10 rounded-3xl p-3 flex items-center justify-center relative overflow-hidden shadow-lg"
            style={{
                background: color,
                boxShadow: `0 0 15px ${glowColor}33`
            }}
        >
            <div className="w-full h-full bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-6xl shadow-inner">
                {icon}
            </div>
        </div>
    );

    return (
        <div className="aspect-square w-full max-w-[500px] bg-[#e8dfc5] border-8 border-[#2d1810] rounded-[2.5rem] shadow-2xl p-3 grid grid-cols-15 grid-rows-15 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_20%_30%,_rgba(255,255,255,0.4)_0%,_transparent_50%)]"></div>

            <Base color={greenPath} icon="🏰" glowColor="#10b981" />
            <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 p-0.5 gap-[1px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i % 3 === 1 && i > 0 ? "#10b981" : "#e8dfc5"} />)}
            </div>
            <Base color={redPath} icon="🐲" glowColor="#ef4444" />

            <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 p-0.5 gap-[1px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i >= 6 && i < 11 ? "#3b82f6" : "#e8dfc5"} />)}
            </div>
            <div className="col-span-3 row-span-3 bg-white/20 border border-black/10 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-[#f3edd7] flex items-center justify-center text-7xl shadow-inner border border-black/5">📖</div>
            </div>
            <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 p-0.5 gap-[1px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i >= 7 && i < 12 ? "#ef4444" : "#e8dfc5"} />)}
            </div>

            <Base color={bluePath} icon="🚢" glowColor="#3b82f6" />
            <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 p-0.5 gap-[1px]">
                {Array(18).fill(0).map((_, i) => <Cell key={i} color={i % 3 === 1 && i < 15 ? "#f59e0b" : "#e8dfc5"} />)}
            </div>
            <Base color={yellowPath} icon="🕯️" glowColor="#f59e0b" />
        </div>
    );
};

function QuizBuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("editId");

    const [title, setTitle] = useState("");
    const [localMaps, setLocalMaps] = useState<{ id: number, name: string, url: string }[]>([]);
    const [selectedMap, setSelectedMap] = useState<any>(null);
    const [boardPath, setBoardPath] = useState<Coordinate[]>([]);
    const [gameMode, setGameMode] = useState<"classic" | "race" | "ludo">("classic");
    const [ludoTeamsCount, setLudoTeamsCount] = useState<number>(4);
    const [ludoPathType, setLudoPathType] = useState<'bases' | 'circuit' | 'red' | 'blue' | 'green' | 'yellow'>('bases');
    const [ludoPathData, setLudoPathData] = useState<any>({
        bases: [],
        circuit: [],
        finals: { red: [], blue: [], green: [], yellow: [] }
    });
    const [saving, setSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDestructive?: boolean } | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Configuración de recompensas
    const [rewardsEnabled, setRewardsEnabled] = useState(false);
    const [rewardCriteria, setRewardCriteria] = useState(5);
    const [rewardText, setRewardText] = useState("10 Puntos ClassDojo");

    useEffect(() => {
        const fetchMapsAndData = async () => {
            try {
                // Get Current User
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) {
                    router.push("/teacher/login");
                    return;
                }

                const res = await fetch("/api/maps");
                const data = await res.json();

                let formattedMaps: any[] = [];
                if (data.maps && data.maps.length > 0) {
                    formattedMaps = data.maps
                        .map((fileName: string, index: number) => ({
                            id: index + 1,
                            name: fileName,
                            url: `/maps/${fileName}`,
                        }));
                    setLocalMaps(formattedMaps);
                    if (formattedMaps.length > 0 && !editId) {
                        setSelectedMap(formattedMaps[0]);
                    }
                }

                if (editId) {
                    const { data: qData, error: qError } = await supabase
                        .from("quizzes")
                        .select("*")
                        .eq("id", editId)
                        .single();

                    if (qError || !qData) {
                        showToast("No se pudo encontrar el tablero.", "error");
                        router.push("/teacher/dashboard");
                        return;
                    }

                    // Permisos: Dueño o Editor
                    const isOwner = qData.teacher_id === authUser.id;
                    const isEditor = qData.editors_emails?.includes(authUser.email?.toLowerCase());

                    if (!isOwner && !isEditor) {
                        showToast("No tienes permisos para editar este tablero.", "error");
                        router.push("/teacher/dashboard");
                        return;
                    }

                    setTitle(qData.title);
                    setBoardPath(qData.board_path || []);

                    if (formattedMaps.length > 0 && qData.board_image_url) {
                        const mapFound = formattedMaps.find(m => m.url === qData.board_image_url);
                        if (mapFound) setSelectedMap(mapFound);
                    }

                    if (qData.rewards_enabled !== undefined) {
                        setRewardsEnabled(qData.rewards_enabled);
                        setRewardCriteria(qData.reward_criteria || 5);
                        setRewardText(qData.reward_text || "");
                    }
                    if (qData.game_mode) {
                        setGameMode(qData.game_mode as any);
                        setLudoTeamsCount(qData.ludo_teams_count || 4);
                        if (qData.game_mode === 'ludo' && qData.ludo_path_data) {
                            setLudoPathData(qData.ludo_path_data);
                        }
                    }
                }
            } catch (error) {
                console.error("Error cargando mapas/datos", error);
            }
        };
        fetchMapsAndData();
    }, [editId]);

    const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const xPositionsPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPositionsPercent = ((e.clientY - rect.top) / rect.height) * 100;

        if (gameMode === 'ludo') {
            const currentData = { ...ludoPathData };
            const newCoord = { x: xPositionsPercent, y: yPositionsPercent };

            if (ludoPathType === 'bases') {
                if (currentData.bases.length < ludoTeamsCount) {
                    currentData.bases.push(newCoord);
                } else {
                    showToast("Ya colocaste todas las bases.");
                    return;
                }
            } else if (ludoPathType === 'circuit') {
                currentData.circuit.push(newCoord);
            } else {
                currentData.finals[ludoPathType].push(newCoord);
            }
            setLudoPathData(currentData);
        } else {
            setBoardPath([...boardPath, { x: xPositionsPercent, y: yPositionsPercent }]);
        }
    };

    const handleUndo = () => {
        if (gameMode === 'ludo') {
            const currentData = { ...ludoPathData };
            if (ludoPathType === 'bases') {
                currentData.bases.pop();
            } else if (ludoPathType === 'circuit') {
                currentData.circuit.pop();
            } else {
                currentData.finals[ludoPathType].pop();
            }
            setLudoPathData(currentData);
        } else {
            setBoardPath(boardPath.slice(0, -1));
        }
    };

    const handleClear = () => {
        setConfirmModal({
            isOpen: true,
            title: "Limpiar Tablero",
            message: "¿Estás seguro de que quieres borrar toda la ruta trazada? Esta acción no se puede deshacer.",
            isDestructive: true,
            onConfirm: () => {
                setBoardPath([]);
                setConfirmModal(null);
                showToast("Ruta limpiada exitosamente.");
            }
        });
    };

    const handleSaveQuiz = async () => {
        if (!title) {
            showToast("Por favor ingresa un título para la aventura.", "error");
            return;
        }
        if (gameMode !== 'ludo' && boardPath.length < 2) {
            showToast("Por favor traza al menos 2 casillas en el tablero.", "error");
            return;
        }
        if (gameMode !== 'ludo' && !selectedMap) {
            showToast("Por favor selecciona un escenario.", "error");
            return;
        }

        setSaving(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const user = userData?.user;
            if (!user) throw new Error("No autenticado");
            const payload = {
                title,
                board_image_url: gameMode === 'ludo' ? '/LUDO_PROCEDURAL' : selectedMap.url,
                board_path: gameMode === 'ludo' ? [] : boardPath,
                game_mode: gameMode,
                ludo_teams_count: gameMode === 'ludo' ? ludoTeamsCount : null,
                ludo_path_data: null,
                rewards_enabled: rewardsEnabled,
                reward_criteria: rewardCriteria,
                reward_text: rewardText
            };

            let returnedId = editId;

            if (editId) {
                // Update
                const { error } = await supabase.from("quizzes").update(payload).eq("id", editId);
                if (error) throw error;
            } else {
                // Insert
                const { data, error } = await supabase
                    .from("quizzes")
                    .insert([{ teacher_id: user.id, ...payload }])
                    .select()
                    .single();
                if (error) throw error;
                returnedId = data.id;
            }

            router.push(`/teacher/quiz/${returnedId}/questions`);

        } catch (err: any) {
            showToast("Error al guardar: " + err.message, "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[100dvh] w-screen overflow-hidden bg-gray-900 font-sans">

            {/* Panel Izquierdo - Herramientas y Configuraciones */}
            <div className="w-full lg:w-[380px] h-full bg-white flex flex-col z-20 flex-shrink-0 border-r border-gray-200">

                {/* Cabecera del Panel */}
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/teacher/dashboard"
                            className="group flex items-center gap-2 px-3 sm:px-4 py-2 bg-white hover:bg-gray-50 rounded-xl text-gray-500 hover:text-indigo-600 transition-all border border-gray-200"
                            title="Volver al Panel"
                        >
                            <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="font-bold text-sm hidden sm:block">Volver</span>
                        </Link>
                        <h1 className="text-xl font-black tracking-tight text-gray-900">
                            Forja de Tableros
                        </h1>
                    </div>
                </div>

                {/* Contenido Scrolleable del Panel */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-indigo-200">

                    {/* Sección 1: Título */}
                    <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-100">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                            <span className="text-lg">📝</span> Nombre de la Aventura
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej. Bosque de Matemáticas"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>

                    {/* SECCIÓN UNIFICADA: Configuración del Juego (Reglas + Mapa) */}
                    <div className="mb-6 bg-white p-5 rounded-[2rem] border-2 border-indigo-500 shadow-xl shadow-indigo-100/30">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <span className="text-xl">🎮</span>
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-gray-900 leading-none">CONFIGURACIÓN</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">Reglas y Escenario</p>
                            </div>
                        </div>

                        {/* 1. Selector de Reglas (Modo) */}
                        <div className="mb-6">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">1. Elige cómo jugar (Modo)</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'classic', icon: '🏃', name: 'Clásico' },
                                    { id: 'race', icon: '🏎️', name: 'Carreras' },
                                    { id: 'ludo', icon: '🎲', name: 'Ludo' }
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => {
                                            setGameMode(mode.id as any);
                                            // Reset selected map if it doesn't belong to the new mode
                                            setSelectedMap(null);
                                        }}
                                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all group ${gameMode === mode.id
                                            ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200 scale-105'
                                            : 'bg-gray-50 border-gray-100 hover:border-indigo-200'}`}
                                    >
                                        <span className={`text-xl mb-1 transition-transform group-hover:scale-125 ${gameMode === mode.id ? 'scale-110' : ''}`}>{mode.icon}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-tighter ${gameMode === mode.id ? 'text-white' : 'text-gray-500'}`}>{mode.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Nueva sección: Cantidad de Equipos (Solo Ludo) */}
                        {gameMode === 'ludo' && (
                            <div className="mb-6 animate-fade-in">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">1.5 Cantidad de Equipos</label>
                                <div className="flex bg-gray-50 p-1 rounded-xl gap-1">
                                    {[2, 3, 4].map((num) => (
                                        <button
                                            key={num}
                                            onClick={() => setLudoTeamsCount(num)}
                                            className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${ludoTeamsCount === num
                                                ? 'bg-indigo-600 text-white shadow-md'
                                                : 'text-gray-400 hover:text-indigo-600'}`}
                                        >
                                            {num} Equipos
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Selector de Escenario (Mapa) - Solo si NO es Ludo */}
                        {gameMode !== 'ludo' && (
                            <div className="pt-4 border-t border-gray-100">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 block">2. Elige dónde jugar (Escenario)</label>
                                {localMaps.length === 0 ? (
                                    <div className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 font-medium">
                                        No se encontraron mapas en <code className="font-bold">public/maps/</code>.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-200">
                                        {(() => {
                                            let filtered: { id: number, name: string, url: string }[] = [];
                                            if (gameMode === "classic") {
                                                filtered = localMaps.filter(m => !m.name.toUpperCase().includes("CARRERA") && !m.name.toUpperCase().includes("LUDO"));
                                            } else if (gameMode === "race") {
                                                filtered = localMaps.filter(m => m.name.toUpperCase().includes("CARRERA"));
                                            }

                                            return filtered.map((m) => {
                                                const isActive = selectedMap?.url === m.url;
                                                return (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => setSelectedMap(m)}
                                                        className={`group/map relative cursor-pointer rounded-xl overflow-hidden aspect-[2/1] transition-all bg-gray-900 border-4 ${isActive
                                                            ? "border-indigo-500 ring-4 ring-indigo-100"
                                                            : "border-transparent opacity-80 hover:opacity-100"
                                                            }`}
                                                    >
                                                        <img src={m.url} alt={m.name} className="w-full h-full object-cover transition-transform duration-700 group-hover/map:scale-110" />
                                                        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover/map:opacity-100"}`}>
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest leading-none">
                                                                    {gameMode === "classic" ? "🗺️ Aventura" : "🏁 Pista"}
                                                                </span>
                                                                <span className="text-white font-bold text-xs truncate mt-1">{m.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ")}</span>
                                                            </div>
                                                        </div>
                                                        {isActive && (
                                                            <div className="absolute top-2 right-2 bg-indigo-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Sección 2.5: Sistema de Recompensas */}
                    <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                <span className="text-lg">🎁</span> Sistema de Recompensas
                            </label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={rewardsEnabled} onChange={() => setRewardsEnabled(!rewardsEnabled)} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>

                        {rewardsEnabled && (
                            <div className="space-y-4 mt-4 p-4 border-2 border-dashed border-purple-200 rounded-xl bg-purple-50">
                                <div>
                                    <label className="block text-xs font-bold text-purple-900 mb-1">Racha requerida (Ej. 5 correctas seguidas)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={rewardCriteria}
                                        onChange={(e) => setRewardCriteria(Number(e.target.value))}
                                        className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-900 mb-1">Premio a mostrar en pantalla</label>
                                    <input
                                        type="text"
                                        value={rewardText}
                                        onChange={(e) => setRewardText(e.target.value)}
                                        placeholder="Ej. +10 Puntos ClassDojo"
                                        className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sección 3: Instrucciones / Controles de Ruta */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100/50 mt-6">
                        <h3 className="font-bold text-indigo-900 text-sm mb-3 flex items-center gap-2">
                            <span className="text-lg">⚙️</span> Trazar Ruta
                        </h3>

                        {gameMode === 'ludo' ? (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                <p className="text-xs text-amber-800 font-bold leading-relaxed">
                                    ✨ <strong>Modo Ludo Automático:</strong> El tablero se generará por código siguiendo las reglas clásicas. No necesitas trazar ninguna ruta manualmente. ¡Todo está listo para jugar!
                                </p>
                            </div>
                        ) : boardPath.length === 0 ? (
                            <p className="text-xs text-indigo-700/80 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-indigo-100">
                                Haz clic en el mapa para trazar los pasos. <strong>¡Tu primer clic será el inicio!</strong>
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-indigo-800 bg-white/60 px-3 py-2 rounded-xl border border-indigo-100">
                                    <span>Casillas:</span>
                                    <span className="text-sm bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">{boardPath.length}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <button onClick={handleUndo} className="p-2 border rounded-xl bg-amber-50 text-amber-700 font-bold text-xs hover:bg-amber-100">↩️ Deshacer</button>
                                    <button onClick={() => setBoardPath([])} className="p-2 border rounded-xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100">🧨 Limpiar</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pie del Panel - Guardar */}
                <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-white sticky bottom-0 z-30">
                    <button
                        onClick={handleSaveQuiz}
                        disabled={
                            saving ||
                            !title ||
                            (gameMode !== 'ludo' && !selectedMap) ||
                            (gameMode !== 'ludo' && boardPath.length < 2)
                        }
                        className="w-full flex items-center justify-center gap-2 py-4 px-4 text-base font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
                    >
                        {saving ? (
                            <span className="animate-pulse">Guardando Magia...</span>
                        ) : (
                            <><span>✅</span> Publicar Aventura</>
                        )}
                    </button>
                    {gameMode === 'ludo' && (
                        <p className="mt-3 text-[10px] text-gray-400 text-center font-bold uppercase italic animate-pulse">
                            ¡Tablero Procedural Activado! No requiere imagen externa.
                        </p>
                    )}
                </div>
            </div>

            {/* Panel Derecho - Lienzo Principal (Centrado y ajustado al alto de pantalla) */}
            <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black overflow-hidden flex items-center justify-center p-4 sm:p-10 custom-scrollbar">

                {/* Patrón de Fondo de Puntos Estrellado */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

                {gameMode === 'ludo' ? (
                    <div className="relative z-10 w-full flex flex-col items-center gap-6 animate-fade-in-up">
                        <LudoGridPreview />
                        <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-6 py-3 rounded-2xl flex items-center gap-3">
                            <span className="text-2xl animate-bounce">🎲</span>
                            <span className="text-white font-black uppercase tracking-widest text-sm">Previsualización de Mapa Procedural</span>
                        </div>
                    </div>
                ) : selectedMap ? (
                    <div className="relative z-10 w-full h-full flex items-center justify-center">

                        {/* El lienzo invisible para cliquear encima de la imagen */}
                        <div className="relative w-fit h-fit max-w-full max-h-full cursor-crosshair select-none bg-gray-900 rounded-[2rem] border-4 border-indigo-500/30 overflow-hidden shadow-2xl">
                            <img
                                src={selectedMap.url}
                                alt="Previsualización de mapa"
                                onClick={handleImageClick}
                                draggable={false}
                                className="max-w-full max-h-[85vh] block opacity-95 group-hover:opacity-100 transition-opacity duration-500 object-contain"
                            />

                            {/* SVG para dibujar líneas (Ruta) */}
                            {/* SVG de Rutas (Ludo segments) */}
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible">
                                <filter id="glow"><feGaussianBlur stdDeviation="2" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                {(() => {
                                    if ((gameMode as string) === 'ludo') {
                                        const lines: any[] = [];
                                        const drawArr = (arr: any[], color: string) => {
                                            for (let i = 1; i < arr.length; i++) {
                                                lines.push(<line key={`${color}-${i}`} x1={`${arr[i - 1].x}%`} y1={`${arr[i - 1].y}%`} x2={`${arr[i].x}%`} y2={`${arr[i].y}%`} stroke={color} strokeWidth="4" strokeDasharray="5,5" filter="url(#glow)" opacity="0.6" />);
                                            }
                                        };
                                        drawArr(ludoPathData.circuit, 'white');
                                        drawArr(ludoPathData.finals.red, '#ef4444');
                                        drawArr(ludoPathData.finals.blue, '#3b82f6');
                                        drawArr(ludoPathData.finals.green, '#10b981');
                                        drawArr(ludoPathData.finals.yellow, '#fbbf24');
                                        return lines;
                                    } else {
                                        return boardPath.map((coord, i) => {
                                            if (i === 0) return null;
                                            const prev = boardPath[i - 1];
                                            return <line key={`line-${i}`} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${coord.x}%`} y2={`${coord.y}%`} stroke="white" strokeWidth="6" strokeDasharray="12,12" filter="url(#glow)" opacity="0.8" />;
                                        });
                                    }
                                })()}
                            </svg>

                            {/* Casillas Renderizadas */}
                            {(gameMode as string) === 'ludo' ? (
                                <>
                                    {ludoPathData.bases.map((c: any, i: number) => {
                                        const colors = ["bg-red-500", "bg-blue-600", "bg-emerald-600", "bg-amber-500"];
                                        return <div key={`base-${i}`} className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-2xl border-4 border-white z-20 shadow-xl ${colors[i]} flex items-center justify-center text-xl`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>🏠</div>
                                    })}
                                    {ludoPathData.circuit.map((c: any, i: number) => (
                                        <div key={`circ-${i}`} className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-white/20 border-2 border-white/50 z-10 flex items-center justify-center text-[8px] font-black text-white" style={{ left: `${c.x}%`, top: `${c.y}%` }}>{i}</div>
                                    ))}
                                    {Object.entries(ludoPathData.finals).map(([color, points]: [string, any]) =>
                                        points.map((c: any, i: number) => {
                                            const bg = color === 'red' ? 'bg-red-500/50' : color === 'blue' ? 'bg-blue-500/50' : color === 'green' ? 'bg-emerald-500/50' : 'bg-amber-500/50';
                                            return <div key={`final-${color}-${i}`} className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full ${bg} border border-white/30 z-10 flex items-center justify-center text-[8px] font-black text-white`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>🎯</div>
                                        })
                                    )}
                                </>
                            ) : (
                                boardPath.map((coord, index) => {
                                    let styleClass = index === 0 ? "w-14 h-14 -ml-7 -mt-7 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 border-[3px] border-white z-20 text-lg rotate-3" : index === boardPath.length - 1 ? "w-12 h-12 -ml-6 -mt-6 rounded-full bg-gradient-to-br from-rose-400 to-red-600 border-[3px] border-white ring-4 ring-rose-300/50 z-20 animate-pulse text-base" : "w-10 h-10 -ml-5 -mt-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white z-10 text-sm hover:scale-110 hover:z-30";
                                    return <div key={`node-${index}`} className={`absolute flex items-center justify-center font-black text-white transition-all duration-300 cursor-default select-none ${styleClass}`} style={{ left: `${coord.x}%`, top: `${coord.y}%` }}>{index === 0 ? "🏁" : index}</div>;
                                })
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full w-full z-10 relative">
                        <div className="flex flex-col items-center bg-gray-900/40 p-12 rounded-[2rem] border-2 border-dashed border-gray-600/50 backdrop-blur-md max-w-md text-center">
                            <span className="text-7xl mb-6">🗺️</span>
                            <h3 className="text-2xl font-black text-white mb-2">Lienzo Vacío</h3>
                            <p className="text-gray-400 text-base">Escoge un escenario del panel izquierdo para empezar a forjar el camino de tu aventura en Prisma Quiz.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* TOAST FLOTANTE */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[150] px-6 py-4 rounded-2xl font-bold flex items-center gap-3 animate-slide-up border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                    <span className="text-xl">{toast.type === 'success' ? '✅' : '🚨'}</span>
                    {toast.message}
                </div>
            )}

            {/* MODAL CONFIRMACION */}
            {confirmModal && confirmModal.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full transform transition-all animate-bounce-short text-center border border-white/20">
                        <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 rotate-3 ${confirmModal.isDestructive ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-500'}`}>
                            <span className="text-4xl">{confirmModal.isDestructive ? '🧨' : '📋'}</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">{confirmModal.title}</h3>
                        <p className="text-gray-500 font-medium leading-relaxed mb-8">{confirmModal.message}</p>
                        <div className="flex gap-4">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.onConfirm} className={`flex-1 py-4 px-4 font-black rounded-2xl text-white transition-all active:scale-95 ${confirmModal.isDestructive ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'}`}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <style jsx global>{`
                /* Scrollbar mágico súper sutil */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(to bottom, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4));
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to bottom, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8));
                }
            `}</style>
        </div>
    );
}

export default function QuizBuilderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900 text-indigo-400 font-bold text-xl">Iniciando Forja...</div>}>
            <QuizBuilderContent />
        </Suspense>
    );
}
