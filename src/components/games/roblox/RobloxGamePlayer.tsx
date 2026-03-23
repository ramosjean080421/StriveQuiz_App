"use client";

import React from "react";

interface RobloxGamePlayerProps {
    currentQ: any;
    answering: boolean;
    handleAnswerSubmit: (val: string | number | object) => void;
    feedback: string | null;
    timeLeft: number;
    questionDuration: number;
    isBlurred: boolean;
    setIsBlurred: (v: boolean) => void;
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
    const sortedPlayers = [...players].sort((a, b) => (b.current_position || 0) - (a.current_position || 0));
    const miPuesto = sortedPlayers.findIndex(p => p.id === playerId) + 1;

    // Roblox style Obby palette
    const robloxBlue = "#0a56d9";
    const robloxRed = "#dc2626";
    const robloxGreen = "#16a34a";
    const robloxYellow = "#d97706";
    const bgPattern = "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)";

    const optionStyles = [
        { bg: "bg-rose-500", border: "border-rose-700", icon: "🔴" },
        { bg: "bg-blue-600", border: "border-blue-800", icon: "🔷" },
        { bg: "bg-yellow-500", border: "border-yellow-700", icon: "⭐" },
        { bg: "bg-emerald-500", border: "border-emerald-700", icon: "🟩" }
    ];

    return (
        <div className="h-screen w-screen flex flex-col bg-[#111827] overflow-hidden relative font-sans select-none" style={{ backgroundImage: bgPattern, backgroundSize: '24px 24px' }}>
            
            {/* Lógica Anti-Trampas (usar overlay compartido) */}
            {isBlurred && (
                <div className="absolute inset-0 z-[9999] bg-gray-950/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl">
                    <div className="bg-red-500/10 border border-red-500/30 p-10 rounded-[3rem] max-w-md shadow-2xl">
                        <span className="text-8xl mb-6 block animate-bounce">🙈</span>
                        <h1 className="text-3xl font-black text-red-500 mb-4 uppercase tracking-widest leading-none">
                            ¡NO HAGAS TRAMPA!
                        </h1>
                        <p className="text-gray-300 font-medium text-lg leading-relaxed mb-8">
                            Ocultamos las preguntas porque detectamos un intento de hacer trampa o uso de otra aplicación. <br/><br/>
                            <strong className="text-red-400">El profesor ha sido notificado.</strong> Espera a que te permita regresar al juego.
                        </p>
                        <div className="flex items-center gap-3 opacity-40 justify-center">
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header / Obby Stats */}
            <div className="p-4 bg-slate-900 border-b-4 border-slate-950 flex justify-between items-center shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-800 rounded-xl border-2 border-slate-700 flex items-center justify-center shadow-inner">
                        <span className="text-2xl font-black text-white">{miPuesto}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase">Posición Global</span>
                        <span className="text-white font-black text-lg leading-none">Strive Obby</span>
                    </div>
                </div>
                {questionDuration > 0 && (
                    <div className="px-4 py-2 bg-slate-800 border-2 border-slate-700 rounded-xl flex items-center gap-2">
                        <span className="text-xl">⏳</span>
                        <span className={`text-2xl font-black tabular-nums ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}</span>
                    </div>
                )}
            </div>

            {/* Question Display */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col pt-8">
                <div className="w-full bg-white rounded-[2rem] p-6 sm:p-10 border-b-[8px] border-slate-300 shadow-xl mb-8 relative">
                    <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-500 rounded-xl rotate-12 flex items-center justify-center font-black text-white border-b-4 border-blue-700 shadow-lg">?</div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 text-center uppercase tracking-tight leading-snug">
                        {currentQ.question_text}
                    </h2>
                </div>

                {/* Options Layout */}
                {(!currentQ.type || currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                        {currentQ.options?.map((opt: string, i: number) => {
                            const style = currentQ.type === 'true_false' 
                                ? (i === 0 ? optionStyles[3] : optionStyles[0]) 
                                : optionStyles[i % 4];
                            
                            let opacityClass = "opacity-100 scale-100";
                            if (feedback && i !== currentQ.correct_option_index) {
                                opacityClass = "opacity-30 grayscale scale-95";
                            }
                            
                            return (
                                <button
                                    key={i}
                                    disabled={answering}
                                    onClick={() => handleAnswerSubmit(i)}
                                    className={`relative ${style.bg} border-b-8 ${style.border} rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg active:border-b-0 active:translate-y-2 transition-all duration-100 ${opacityClass}`}
                                >
                                    <span className="text-4xl drop-shadow-md mb-2">{style.icon}</span>
                                    <span className="text-white font-black text-xl sm:text-2xl text-center uppercase drop-shadow-md leading-tight">
                                        {opt}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Text Fill Input (Roblox Chat Style) */}
                {currentQ.type === 'fill_in_the_blank' && (
                    <div className="flex flex-col flex-1 items-center justify-center gap-4">
                        <input
                            type="text"
                            disabled={answering}
                            placeholder="Escribe aquí (Presiona Enter)"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !answering && (e.target as HTMLInputElement).value.trim()) {
                                    handleAnswerSubmit((e.target as HTMLInputElement).value);
                                }
                            }}
                            className="bg-slate-900 border-4 border-slate-700 text-white font-black text-2xl p-6 rounded-2xl w-full text-center outline-none focus:border-blue-500 focus:bg-slate-800 transition-colors placeholder-slate-600"
                        />
                        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Chat Global Obby</p>
                    </div>
                )}
            </div>

            {/* Popups de Feedback (Muerte/Salto Roblox) */}
            {feedback && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all ${
                    feedback === 'correct' ? 'bg-emerald-500/80' : 
                    feedback === 'timeout' ? 'bg-amber-500/80' : 
                    'bg-red-600/80'
                }`}>
                    <div className="animate-bounce">
                        <div className={`w-40 h-40 bg-white/20 rounded-[2rem] border-8 border-white/50 flex items-center justify-center rotate-6 shadow-2xl backdrop-blur-xl ${
                            feedback === 'incorrect' ? 'grayscale opacity-80' : ''
                        }`}>
                            <span className="text-8xl drop-shadow-lg">{feedback === 'correct' ? '🚀' : feedback === 'timeout' ? '⏳' : '💀'}</span>
                        </div>
                    </div>
                    <h2 className="text-6xl font-black text-white uppercase tracking-tighter mt-8 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] border-black stroke-black stroke-2" style={{ WebkitTextStroke: '2px black' }}>
                        {feedback === 'correct' ? '¡SALTO ÉPICO!' : feedback === 'timeout' ? 'AFK...' : '¡OOF!'}
                    </h2>
                </div>
            )}
        </div>
    );
}
