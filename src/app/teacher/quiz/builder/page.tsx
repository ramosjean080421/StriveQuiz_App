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

function QuizBuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("editId");

    const [title, setTitle] = useState("");
    const [localMaps, setLocalMaps] = useState<{ id: number, name: string, url: string }[]>([]);
    const [selectedMap, setSelectedMap] = useState<any>(null);
    const [boardPath, setBoardPath] = useState<Coordinate[]>([]);
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
                    // Set default map ONLY if not editing
                    if (formattedMaps.length > 0 && !editId) {
                        setSelectedMap(formattedMaps[0]);
                    }

                } // Close if (data.maps && data.maps.length > 0)

                if (editId) {
                    const { data: qData } = await supabase.from("quizzes").select("*").eq("id", editId).single();
                    if (qData) {
                        setTitle(qData.title);
                        setBoardPath(qData.board_path || []);

                        if (formattedMaps.length > 0 && qData.board_image_url) {
                            const mapFound = formattedMaps.find(m => m.url === qData.board_image_url);
                            if (mapFound) setSelectedMap(mapFound);
                        }

                        // Set rewards config
                        if (qData.rewards_enabled !== undefined) {
                            setRewardsEnabled(qData.rewards_enabled);
                            setRewardCriteria(qData.reward_criteria || 5);
                            setRewardText(qData.reward_text || "");
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

        setBoardPath([...boardPath, { x: xPositionsPercent, y: yPositionsPercent }]);
    };

    const handleUndo = () => {
        setBoardPath(boardPath.slice(0, -1));
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
        if (boardPath.length < 2) {
            showToast("Por favor traza al menos 2 casillas en el tablero.", "error");
            return;
        }
        if (!selectedMap) {
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
                board_image_url: selectedMap.url,
                board_path: boardPath, // Always save boardPath
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
            <div className="w-full lg:w-[380px] h-full bg-white flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.2)] z-20 flex-shrink-0 border-r border-gray-200">

                {/* Cabecera del Panel */}
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/teacher/dashboard"
                            className="group flex items-center gap-2 px-3 sm:px-4 py-2 bg-white hover:bg-gray-50 rounded-xl text-gray-500 hover:text-indigo-600 transition-all border border-gray-200 shadow-sm"
                            title="Volver al Panel"
                        >
                            <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="font-bold text-sm hidden sm:block">Volver</span>
                        </Link>
                        <h1 className="text-xl font-black tracking-tight text-gray-900">Forja de Tableros</h1>
                    </div>
                </div>

                {/* Contenido Scrolleable del Panel */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-indigo-200">

                    {/* Sección 1: Título */}
                    <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                            <span className="text-lg">📝</span> Nombre de la Aventura
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej. Bosque de Matemáticas"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                        />
                    </div>

                    {/* Sección 2: Selector de Mapa (Escenario) */}
                    <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                            <span className="text-lg">🗺️</span> Elige un Escenario
                        </label>

                        {localMaps.length === 0 ? (
                            <div className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 font-medium">
                                No se encontraron imágenes. Sube mapas a <code className="font-bold">public/maps/</code>.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-200">
                                {[
                                    { title: "🏎️ Circuitos de Carreras", maps: localMaps.filter(m => m.url.toLowerCase().includes("carrera")) },
                                    { title: "🗺️ Aventuras Clásicas", maps: localMaps.filter(m => !m.url.toLowerCase().includes("carrera")) }
                                ].filter(cat => cat.maps.length > 0).map((category, catIdx) => (
                                    <details key={catIdx} className="group bg-gray-50 rounded-2xl border border-gray-100 shadow-sm transition-all open:bg-white open:shadow-md">
                                        <summary className="text-xs font-black text-gray-600 uppercase tracking-wider cursor-pointer flex items-center justify-between hover:text-indigo-600 transition-colors p-4 select-none outline-none rounded-2xl group-open:rounded-b-none group-open:border-b group-open:border-gray-100">
                                            {category.title}
                                            <span className="text-sm transform group-open:rotate-180 transition-transform duration-300 text-gray-400">▼</span>
                                        </summary>
                                        <div className="flex flex-col gap-4 p-4">
                                            {category.maps.map((map) => (
                                                <div
                                                    key={map.id}
                                                    onClick={() => setSelectedMap(map)}
                                                    className={`group/map relative cursor-pointer rounded-2xl overflow-hidden aspect-[21/9] transition-all bg-gray-900 border-4 shadow-sm hover:shadow-md ${selectedMap?.id === map.id
                                                        ? "border-indigo-500 transform scale-102 z-10 shadow-indigo-200/50"
                                                        : "border-transparent opacity-85 hover:opacity-100"
                                                        }`}
                                                >
                                                    <img
                                                        src={map.url}
                                                        alt={map.name}
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover/map:scale-110"
                                                    />
                                                    <div className={`absolute inset-0 flex items-center justify-center transition-colors duration-300 ${selectedMap?.id === map.id ? 'bg-black/20' : 'bg-black/50 group-hover/map:bg-black/30'}`}>
                                                        <span className={`px-4 py-1.5 font-bold tracking-wider uppercase rounded-xl backdrop-blur-md transition-all text-sm shadow-sm ${selectedMap?.id === map.id ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-white text-gray-900 group-hover/map:scale-105'}`}>
                                                            {map.name.replace('.png', '').replace('.jpg', '')}
                                                        </span>
                                                    </div>
                                                    {selectedMap?.id === map.id && (
                                                        <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full p-1 shadow-md">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Sección 2.5: Sistema de Recompensas */}
                    <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
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
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100/50 shadow-inner mt-6">
                        <h3 className="font-bold text-indigo-900 text-sm mb-3 flex items-center gap-2">
                            <span className="text-lg">⚙️</span> Trazar Ruta
                        </h3>
                        {boardPath.length === 0 ? (
                            <p className="text-xs text-indigo-700/80 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-indigo-100">
                                Haz clic en la gran previsualización de la derecha para trazar los pasos que los jugadores deberán recorrer. <strong>¡Tu primer clic será la casilla de inicio!</strong>
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-indigo-800 bg-white/60 px-3 py-2 rounded-xl border border-indigo-100 shadow-sm">
                                    <span>Casillas Plasmadas:</span>
                                    <span className="text-sm bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">{boardPath.length}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <button
                                        onClick={handleUndo}
                                        className="flex flex-col items-center justify-center p-2 text-[11px] font-bold rounded-xl border transition-all text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-400 focus:ring-2 focus:ring-amber-200 shadow-sm"
                                        title="Borrar último punto transado"
                                    >
                                        <span className="text-xl mb-1 mt-0.5">↩️</span>
                                        Deshacer
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        className="flex flex-col items-center justify-center p-2 text-[11px] font-bold rounded-xl border transition-all text-red-600 bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-400 focus:ring-2 focus:ring-red-200 shadow-sm"
                                        title="Borrar absolutamente todos los puntos"
                                    >
                                        <span className="text-xl mb-1 mt-0.5">🧨</span>
                                        Limpiar Todo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pie del Panel - Guardar */}
                <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-white sticky bottom-0 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
                    <button
                        onClick={handleSaveQuiz}
                        disabled={saving || !title || (!selectedMap || boardPath.length < 2)}
                        className="w-full flex items-center justify-center gap-2 py-4 px-4 text-base font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
                    >
                        {saving ? (
                            <span className="animate-pulse">Guardando Magia...</span>
                        ) : (
                            <><span>✅</span> Publicar Aventura</>
                        )}
                    </button>
                </div>
            </div>

            {/* Panel Derecho - Lienzo Principal (Scroll interno solo para imagen grande) */}
            <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black overflow-y-auto overflow-x-hidden p-4 sm:p-8 custom-scrollbar scroll-smooth">

                {/* Patrón de Fondo de Puntos Estrellado */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>

                {selectedMap ? (
                    <div className="relative z-10 w-full max-w-6xl mx-auto rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.4)] border border-indigo-500/20 overflow-hidden group hover:border-indigo-400/40 transition-colors duration-500">

                        {/* El lienzo invisible para cliquear encima de la imagen */}
                        <div className="relative w-full cursor-crosshair select-none bg-gray-900">
                            <img
                                src={selectedMap.url}
                                alt="Previsualización de mapa"
                                onClick={handleImageClick}
                                draggable={false}
                                className="w-full h-auto block opacity-95 group-hover:opacity-100 transition-opacity duration-500"
                            />

                            {/* SVG para dibujar líneas (Ruta) */}
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible">
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                {boardPath.map((coord, i) => {
                                    if (i === 0) return null;
                                    const prev = boardPath[i - 1];
                                    return (
                                        <line
                                            key={`line-${i}`}
                                            x1={`${prev.x}%`}
                                            y1={`${prev.y}%`}
                                            x2={`${coord.x}%`}
                                            y2={`${coord.y}%`}
                                            stroke="rgba(255, 255, 255, 0.9)"
                                            strokeWidth="6"
                                            strokeDasharray="12,12"
                                            filter="url(#glow)"
                                            className="drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] opacity-80"
                                        />
                                    );
                                })}
                            </svg>

                            {/* Casillas Renderizadas (Puntos) */}
                            {boardPath.map((coord, index) => (
                                <div
                                    key={`node-${index}`}
                                    className={`absolute flex items-center justify-center font-black text-white shadow-[0_5px_15px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-default select-none
                                        ${index === 0
                                            ? "w-14 h-14 -ml-7 -mt-7 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 border-[3px] border-white z-20 text-lg rotate-3"
                                            : index === boardPath.length - 1
                                                ? "w-12 h-12 -ml-6 -mt-6 rounded-full bg-gradient-to-br from-rose-400 to-red-600 border-[3px] border-white ring-4 ring-rose-300/50 z-20 animate-pulse text-base"
                                                : "w-10 h-10 -ml-5 -mt-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white z-10 text-sm hover:scale-110 hover:z-30 shadow-indigo-500/50"
                                        }`}
                                    style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                                >
                                    {index === 0 ? "🏁" : index}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full w-full z-10 relative">
                        <div className="flex flex-col items-center bg-gray-900/40 p-12 rounded-[2rem] border-2 border-dashed border-gray-600/50 backdrop-blur-md max-w-md text-center shadow-2xl">
                            <span className="text-7xl mb-6 filter drop-shadow-md">🗺️</span>
                            <h3 className="text-2xl font-black text-white mb-2">Lienzo Vacío</h3>
                            <p className="text-gray-400 text-base">Escoge un escenario del panel izquierdo para empezar a forjar el camino de tu aventura en Prisma Quiz.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* TOAST FLOTANTE */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[150] px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-slide-up border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                    <span className="text-xl">{toast.type === 'success' ? '✅' : '🚨'}</span>
                    {toast.message}
                </div>
            )}

            {/* MODAL CONFIRMACION */}
            {confirmModal && confirmModal.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transform transition-all animate-bounce-short text-center border border-white/20">
                        <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 rotate-3 shadow-lg ${confirmModal.isDestructive ? 'bg-red-100 text-red-500 shadow-red-100' : 'bg-indigo-100 text-indigo-500 shadow-indigo-100'}`}>
                            <span className="text-4xl">{confirmModal.isDestructive ? '🧨' : '📋'}</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">{confirmModal.title}</h3>
                        <p className="text-gray-500 font-medium leading-relaxed mb-8">{confirmModal.message}</p>
                        <div className="flex gap-4">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.onConfirm} className={`flex-1 py-4 px-4 font-black rounded-2xl text-white shadow-lg transition-all active:scale-95 ${confirmModal.isDestructive ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-200' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-200'}`}>
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
