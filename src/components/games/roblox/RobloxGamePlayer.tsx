"use client";

import { useState, useEffect } from "react";

interface RobloxGamePlayerProps {
    currentQ: any;
    answering: boolean;
    handleAnswerSubmit: (val: string | number | object) => void;
    feedback: string | null;
    timeLeft: number;
    questionDuration: number;
    isBlurred: boolean;
    players: any[];
    playerId: string | null;
}

export default function RobloxGamePlayer({
    currentQ,
    answering,
    handleAnswerSubmit,
    feedback,
    timeLeft,
    questionDuration,
    isBlurred,
    players,
    playerId
}: RobloxGamePlayerProps) {
    // FIX: input controlado para fill_in_the_blank (se limpia entre preguntas)
    const [fillAnswer, setFillAnswer] = useState("");
    // Estado para preguntas de pareo
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    const [confirmedPairs, setConfirmedPairs] = useState<{ leftIdx: number; rightIdx: number }[]>([]);
    const [shuffledRight, setShuffledRight] = useState<string[]>([]);

    const sortedPlayers = [...players].sort((a, b) => (b.current_position || 0) - (a.current_position || 0));
    const miPuesto = sortedPlayers.findIndex(p => p.id === playerId) + 1;
    const myPlayer = players.find(p => p.id === playerId);
    const myProgress = myPlayer ? myPlayer.current_position : 0;

    const optionStyles = [
        { bg: "bg-rose-500", hover: "hover:bg-rose-400", border: "border-rose-700", shadow: "shadow-rose-900/40", icon: "🔴" },
        { bg: "bg-blue-600", hover: "hover:bg-blue-500", border: "border-blue-800", shadow: "shadow-blue-900/40", icon: "🔷" },
        { bg: "bg-amber-500", hover: "hover:bg-amber-400", border: "border-amber-700", shadow: "shadow-amber-900/40", icon: "⭐" },
        { bg: "bg-emerald-500", hover: "hover:bg-emerald-400", border: "border-emerald-700", shadow: "shadow-emerald-900/40", icon: "🟩" }
    ];

    // Limpiar estados al cambiar de pregunta
    useEffect(() => {
        setFillAnswer("");
        setSelectedLeft(null);
        setConfirmedPairs([]);
        if (currentQ?.matching_pairs) {
            const rights = currentQ.matching_pairs.map((p: any) => p.right);
            setShuffledRight([...rights].sort(() => Math.random() - 0.5));
        }
    }, [currentQ?.id]);

    // Lógica de pareo: cuando se completan todos los pares, enviar
    const handleMatchSelect = (rightIdx: number) => {
        if (selectedLeft === null || answering) return;
        const alreadyMatchedRight = confirmedPairs.some(p => p.rightIdx === rightIdx);
        if (alreadyMatchedRight) return;

        const newPairs = [...confirmedPairs, { leftIdx: selectedLeft, rightIdx }];
        setConfirmedPairs(newPairs);
        setSelectedLeft(null);

        if (newPairs.length === currentQ.matching_pairs.length) {
            // Construir el objeto de respuesta para el handler
            const result: Record<string, string> = {};
            newPairs.forEach(({ leftIdx, rightIdx }) => {
                result[currentQ.matching_pairs[leftIdx].left] = shuffledRight[rightIdx];
            });
            handleAnswerSubmit(result);
        }
    };

    const timePercent = questionDuration > 0 ? (timeLeft / questionDuration) * 100 : 100;
    const timeUrgent = timeLeft <= 5 && questionDuration > 0;

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden relative font-sans select-none">

            {/* Patrón de fondo sutil */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.07) 1px, transparent 0)',
                backgroundSize: '28px 28px'
            }} />

            {/* Anti-trampas overlay */}
            {isBlurred && (
                <div className="absolute inset-0 z-[9999] bg-slate-950/98 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl">
                    <div className="bg-red-500/10 border border-red-500/30 p-10 rounded-[3rem] max-w-md shadow-2xl">
                        <span className="text-8xl mb-6 block animate-bounce">🙈</span>
                        <h1 className="text-3xl font-black text-red-400 mb-4 uppercase tracking-widest leading-none">
                            ¡No hagas trampa!
                        </h1>
                        <p className="text-slate-300 font-medium text-base leading-relaxed mb-6">
                            Detectamos que saliste de la app. Las preguntas están ocultas.<br /><br />
                            <strong className="text-red-400">El profesor fue notificado.</strong>
                        </p>
                        <div className="flex items-center gap-3 opacity-40 justify-center">
                            {[0, 150, 300].map(delay => (
                                <div key={delay} className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-10 relative">
                {/* Posición y progreso */}
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-800 border border-slate-700 rounded-xl shadow-inner">
                        <span className="text-xs font-black text-slate-400 leading-none">#{miPuesto}</span>
                        <span className="text-lg font-black text-white leading-none">{myProgress}</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Isla actual</p>
                        <div className="flex items-center gap-1.5">
                            <span className="text-lg">🏝️</span>
                            <p className="font-black text-white text-sm leading-none">Strive Obby</p>
                        </div>
                    </div>
                </div>

                {/* Barra de tiempo */}
                {questionDuration > 0 && (
                    <div className="flex flex-col items-end gap-1.5">
                        <div className={`text-3xl font-black tabular-nums transition-colors ${timeUrgent ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                            {timeLeft}<span className="text-sm text-slate-500">s</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeUrgent ? 'bg-red-500' : 'bg-indigo-500'}`}
                                style={{ width: `${timePercent}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Contenido de la pregunta */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-6 relative z-10">

                {/* Caja de pregunta — estilo "bloque Roblox" */}
                <div className="w-full bg-white rounded-3xl p-6 sm:p-8 border-b-[6px] border-slate-300 shadow-xl relative overflow-hidden">
                    <div className="absolute -top-3 -left-3 w-11 h-11 bg-indigo-600 rounded-xl rotate-12 flex items-center justify-center font-black text-white text-xl border-b-4 border-indigo-800 shadow-lg">?</div>
                    <div className="absolute top-3 right-3 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            {currentQ.type === 'fill_in_the_blank' ? '✍️ Completar' :
                                currentQ.type === 'true_false' ? '⚖️ V o F' :
                                    currentQ.type === 'matching' ? '🔗 Pareo' : '📝 Elección'}
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 text-center uppercase tracking-tight leading-snug mt-2">
                        {currentQ.question_text}
                    </h2>
                </div>

                {/* Opciones: múltiple / V o F */}
                {(!currentQ.type || currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        {currentQ.options?.map((opt: string, i: number) => {
                            const style = currentQ.type === 'true_false'
                                ? (i === 0 ? optionStyles[3] : optionStyles[0])
                                : optionStyles[i % 4];

                            const isDimmed = feedback && i !== currentQ.correct_option_index;

                            return (
                                <button
                                    key={i}
                                    disabled={answering}
                                    onClick={() => handleAnswerSubmit(i)}
                                    className={`relative ${style.bg} ${!answering ? style.hover : ''} border-b-[6px] ${style.border} rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-center shadow-lg ${style.shadow} active:border-b-0 active:translate-y-1.5 transition-all duration-100 ${isDimmed ? 'opacity-30 grayscale scale-95' : 'scale-100'}`}
                                >
                                    <span className="text-3xl drop-shadow-md mb-2">{style.icon}</span>
                                    <span className="text-white font-black text-lg sm:text-xl text-center uppercase drop-shadow-md leading-tight">
                                        {opt}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Input: completar el espacio */}
                {currentQ.type === 'fill_in_the_blank' && (
                    <div className="flex flex-col flex-1 items-center justify-center gap-4">
                        <input
                            type="text"
                            disabled={answering}
                            value={fillAnswer}
                            onChange={(e) => setFillAnswer(e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !answering && fillAnswer.trim()) {
                                    handleAnswerSubmit(fillAnswer.trim());
                                }
                            }}
                            className="bg-slate-900 border-4 border-slate-700 text-white font-black text-xl sm:text-2xl p-5 rounded-2xl w-full text-center outline-none focus:border-indigo-500 focus:bg-slate-800 transition-colors placeholder-slate-600 disabled:opacity-50"
                            autoFocus
                        />
                        <button
                            disabled={answering || !fillAnswer.trim()}
                            onClick={() => handleAnswerSubmit(fillAnswer.trim())}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 border-b-[6px] border-indigo-800 text-white font-black text-xl rounded-2xl transition-all active:border-b-0 active:translate-y-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/40"
                        >
                            🚀 Enviar Respuesta
                        </button>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">También puedes presionar Enter</p>
                    </div>
                )}

                {/* Pareo / Matching */}
                {currentQ.type === 'matching' && currentQ.matching_pairs && (
                    <div className="flex-1 flex flex-col gap-4">
                        <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                            Selecciona un elemento de cada columna para emparejar ({confirmedPairs.length}/{currentQ.matching_pairs.length})
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Columna izquierda */}
                            <div className="flex flex-col gap-2">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center mb-1">Concepto</p>
                                {currentQ.matching_pairs.map((pair: any, i: number) => {
                                    const isMatched = confirmedPairs.some(p => p.leftIdx === i);
                                    const isSelected = selectedLeft === i;
                                    return (
                                        <button
                                            key={i}
                                            disabled={answering || isMatched}
                                            onClick={() => !isMatched && setSelectedLeft(isSelected ? null : i)}
                                            className={`p-3 rounded-xl border-b-4 font-black text-sm text-center transition-all active:border-b-0 active:translate-y-0.5 ${isMatched
                                                ? 'bg-emerald-600 border-emerald-800 text-white opacity-60'
                                                : isSelected
                                                    ? 'bg-indigo-500 border-indigo-700 text-white scale-105 shadow-lg shadow-indigo-900/40'
                                                    : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                                                }`}
                                        >
                                            {isMatched ? '✅' : isSelected ? '👉' : ''} {pair.left}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Columna derecha (mezclada) */}
                            <div className="flex flex-col gap-2">
                                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest text-center mb-1">Respuesta</p>
                                {shuffledRight.map((right, i) => {
                                    const isMatched = confirmedPairs.some(p => p.rightIdx === i);
                                    return (
                                        <button
                                            key={i}
                                            disabled={answering || isMatched || selectedLeft === null}
                                            onClick={() => handleMatchSelect(i)}
                                            className={`p-3 rounded-xl border-b-4 font-black text-sm text-center transition-all active:border-b-0 active:translate-y-0.5 ${isMatched
                                                ? 'bg-emerald-600 border-emerald-800 text-white opacity-60'
                                                : selectedLeft !== null
                                                    ? 'bg-amber-500 border-amber-700 text-white hover:bg-amber-400 shadow-lg shadow-amber-900/30'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 opacity-60'
                                                }`}
                                        >
                                            {isMatched ? '✅' : right}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Feedback overlay */}
            {feedback && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all ${feedback === 'correct' ? 'bg-indigo-600/85' :
                    feedback === 'timeout' ? 'bg-amber-600/85' :
                        'bg-red-700/85'
                    }`}>
                    <div className="animate-bounce">
                        <div className={`w-36 h-36 bg-white/15 rounded-[2rem] border-8 border-white/40 flex items-center justify-center rotate-6 shadow-2xl ${feedback === 'incorrect' ? 'grayscale opacity-80' : ''}`}>
                            <span className="text-7xl drop-shadow-lg">
                                {feedback === 'correct' ? '🚀' : feedback === 'timeout' ? '⏳' : '💀'}
                            </span>
                        </div>
                    </div>
                    <h2
                        className="text-5xl sm:text-6xl font-black text-white uppercase tracking-tighter mt-8 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                        style={{ WebkitTextStroke: '2px rgba(0,0,0,0.4)' }}
                    >
                        {feedback === 'correct' ? '¡Salto épico!' : feedback === 'timeout' ? 'AFK...' : '¡OOF!'}
                    </h2>
                    <p className="text-white/60 font-bold mt-2 text-lg">
                        {feedback === 'correct' ? '¡Avanzas a la siguiente isla!' :
                            feedback === 'timeout' ? 'Se acabó el tiempo' :
                                'Te quedas en esta isla'}
                    </p>
                </div>
            )}
        </div>
    );
}
