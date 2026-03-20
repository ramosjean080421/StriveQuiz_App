"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Question {
    id: string;
    type?: 'multiple_choice' | 'true_false' | 'fill_in_the_blank' | 'matching' | 'memory_pair';
    question_text: string;
    correct_answer?: string;
    options: string[];
    correct_option_index: number;
}

interface MemoryGamePlayerProps {
    questions: Question[];
    currentQuestionIdx: number;
    gameId: string;
    playerId: string | null;
    playerSecret: string | null;
    timeLeft: number;
    questionDuration: number;
    answering: boolean;
    onSubmit: (scoreDelta: number, correctMatches: number) => void; 
}

type CardItem = {
    id: string;
    content: string;
    type: "question" | "answer";
    pairId: string;
};

export default function MemoryGamePlayer({
    questions,
    gameId,
    playerId,
    playerSecret,
    timeLeft,
    questionDuration,
    onSubmit
}: MemoryGamePlayerProps) {
    const [cards, setCards] = useState<CardItem[]>([]);
    const [flipped, setFlipped] = useState<number[]>([]);
    const [matched, setMatched] = useState<string[]>([]);
    const [lockBoard, setLockBoard] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [initialAnimation, setInitialAnimation] = useState(true);
    const [lastMatchedPair, setLastMatchedPair] = useState<string | null>(null);
    const [shakeCards, setShakeCards] = useState<number[]>([]);
    const [cardSize, setCardSize] = useState({ w: 0, h: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    // 1. Crear y Barajar las cartas
    useEffect(() => {
        if (questions.length === 0) return;

        const generatedCards: CardItem[] = [];
        questions.forEach((q) => {
            let correctAnswerText: string | undefined;
            if (q.type === 'memory_pair' || q.type === 'fill_in_the_blank') {
                correctAnswerText = q.correct_answer;
            } else {
                correctAnswerText = q.options?.[q.correct_option_index];
            }
            if (!correctAnswerText) return;

            const baseId = q.id;
            generatedCards.push({
                id: `${baseId}_q`,
                content: q.question_text,
                type: "question",
                pairId: baseId
            });
            generatedCards.push({
                id: `${baseId}_a`,
                content: correctAnswerText,
                type: "answer",
                pairId: baseId
            });
        });

        const shuffledCards = generatedCards.sort(() => Math.random() - 0.5);
        setCards(shuffledCards);

        const timer = setTimeout(() => {
            setInitialAnimation(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, [questions]);

    // Algoritmo para cuadrícula horizontal óptima
    const totalCards = cards.length;
    let cols = 4;
    let rows = Math.ceil(totalCards / 4);

    if (totalCards === 10) { cols = 5; rows = 2; }
    else if (totalCards === 12) { cols = 4; rows = 3; }
    else if (totalCards === 14) { cols = 5; rows = 3; }
    else if (totalCards === 16) { cols = 4; rows = 4; }
    else if (totalCards === 18) { cols = 6; rows = 3; }
    else if (totalCards === 20) { cols = 5; rows = 4; }
    else if (totalCards === 24) { cols = 6; rows = 4; }
    else if (totalCards > 24) {
        cols = Math.ceil(Math.sqrt(totalCards * 1.3));
        rows = Math.ceil(totalCards / cols);
    } else {
        while (cols * rows < totalCards || cols < rows) {
            if (cols <= rows) cols++;
            else rows++;
        }
    }

    // 2. Calcular tamaño de cartas dinámicamente
    const calculateCardSize = useCallback(() => {
        if (!containerRef.current || totalCards === 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const padding = 40; // p-5 = 20px each side
        const containerW = rect.width - padding;
        const containerH = rect.height - padding;

        const gapSize = 10;
        const totalGapW = gapSize * (cols - 1);
        const totalGapH = gapSize * (rows - 1);

        const availW = containerW - totalGapW;
        const availH = containerH - totalGapH;

        // Tamaño máximo por dimensión
        const maxW = Math.floor(availW / cols);
        const maxH = Math.floor(availH / rows);

        // Elegimos el menor para que todas las cartas quepan
        // Mantenemos proporción 3:4 (w:h)
        let finalW: number;
        let finalH: number;

        if (maxW * (4 / 3) <= maxH) {
            // El ancho es el límite
            finalW = maxW;
            finalH = Math.floor(maxW * (4 / 3));
        } else {
            // La altura es el límite
            finalH = maxH;
            finalW = Math.floor(maxH * (3 / 4));
        }

        setCardSize({ w: Math.max(finalW, 40), h: Math.max(finalH, 53) });
    }, [totalCards, cols, rows]);

    useEffect(() => {
        calculateCardSize();
        window.addEventListener('resize', calculateCardSize);
        return () => window.removeEventListener('resize', calculateCardSize);
    }, [calculateCardSize]);

    // Recalcular cuando las cartas se cargan
    useEffect(() => {
        if (cards.length > 0) {
            const t = setTimeout(calculateCardSize, 50);
            return () => clearTimeout(t);
        }
    }, [cards, calculateCardSize]);

    // 3. Lógica de selección
    const handleCardClick = (index: number) => {
        if (lockBoard || initialAnimation || flipped.includes(index) || matched.includes(cards[index].pairId)) return;

        const newFlipped = [...flipped, index];
        setFlipped(newFlipped);

        if (newFlipped.length === 2) {
            setAttempts(prev => prev + 1);
            setLockBoard(true);

            const card1 = cards[newFlipped[0]];
            const card2 = cards[newFlipped[1]];

            if (card1.pairId === card2.pairId && card1.type !== card2.type) {
                const currentPairsFound = matched.length + 1;
                setMatched(prev => [...prev, card1.pairId]);
                setLastMatchedPair(card1.pairId);
                setTimeout(() => setLastMatchedPair(null), 800);
                setFlipped([]);
                setLockBoard(false);

                let pointsToAdd = 100;
                if (currentPairsFound === questions.length) {
                    setIsFinished(true);
                    pointsToAdd += 1000 + (timeLeft * 10);
                }
                
                onSubmit(pointsToAdd, currentPairsFound);
            } else {
                setShakeCards([...newFlipped]);
                setTimeout(() => {
                    setShakeCards([]);
                    setFlipped([]);
                    setLockBoard(false);
                }, 900);
            }
        }
    };

    if (cards.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-bold text-indigo-300 uppercase tracking-widest">Preparando cartas...</span>
                </div>
            </div>
        );
    }

    const progress = questions.length > 0 ? (matched.length / questions.length) * 100 : 0;

    return (
        <div className="flex flex-col items-center w-full h-full p-3 sm:p-4 relative">
            
            {/* Header Premium con estadísticas */}
            <div className="w-full flex flex-col gap-2 mb-3 shrink-0">
                <div className="flex justify-between items-center gap-3">
                    {/* Intentos */}
                    <div className="flex-1 bg-gradient-to-r from-orange-500/15 to-amber-500/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-orange-400/20 flex items-center gap-2.5 group hover:border-orange-400/40 transition-all">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                            <span className="text-sm">🧠</span>
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-orange-300/60 uppercase tracking-widest">Intentos</div>
                            <div className="text-lg font-black text-orange-200 leading-none tracking-tight">{attempts}</div>
                        </div>
                    </div>

                    {/* Parejas */}
                    <div className="flex-1 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-emerald-400/20 flex items-center gap-2.5 group hover:border-emerald-400/40 transition-all">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                            <span className="text-sm">💎</span>
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-emerald-300/60 uppercase tracking-widest">Parejas</div>
                            <div className="text-lg font-black text-emerald-200 leading-none tracking-tight">{matched.length}<span className="text-emerald-500/50 text-sm">/{questions.length}</span></div>
                        </div>
                    </div>

                    {/* Tiempo (si aplica) */}
                    {timeLeft > 0 && (
                        <div className={`flex-1 backdrop-blur-md px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 group transition-all ${timeLeft < 10 ? 'bg-gradient-to-r from-rose-500/20 to-red-500/15 border-rose-400/30' : 'bg-gradient-to-r from-blue-500/15 to-indigo-500/10 border-blue-400/20 hover:border-blue-400/40'}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${timeLeft < 10 ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20 animate-pulse' : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20'}`}>
                                <span className="text-sm">⏳</span>
                            </div>
                            <div>
                                <div className={`text-[9px] font-black uppercase tracking-widest ${timeLeft < 10 ? 'text-rose-300/60' : 'text-blue-300/60'}`}>Tiempo</div>
                                <div className={`text-lg font-black leading-none tracking-tight ${timeLeft < 10 ? 'text-rose-200' : 'text-blue-200'}`}>{timeLeft}<span className="text-xs opacity-50">s</span></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Barra de progreso */}
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className="h-full rounded-full transition-all duration-700 ease-out relative"
                        style={{ 
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, #10b981, #06b6d4, #8b5cf6)'
                        }}
                    >
                        <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Caja contenedora de cartas */}
            <div 
                ref={containerRef}
                className="w-full flex-1 min-h-0 bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-[2rem] p-5 flex items-center justify-center overflow-hidden relative"
            >
                {/* Glow ambiental inferior */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[40%] bg-gradient-to-t from-violet-600/10 to-transparent rounded-full blur-[60px] pointer-events-none"></div>
                
                {cardSize.w > 0 && (
                    <div 
                        className="grid relative z-10"
                        style={{ 
                            gridTemplateColumns: `repeat(${cols}, ${cardSize.w}px)`,
                            gridTemplateRows: `repeat(${rows}, ${cardSize.h}px)`,
                            gap: '10px',
                        }}
                    >
                        {cards.map((card, idx) => {
                            const isFlipped = flipped.includes(idx) || matched.includes(card.pairId);
                            const isMatched = matched.includes(card.pairId);
                            const isJustMatched = lastMatchedPair === card.pairId;
                            const isShaking = shakeCards.includes(idx);

                            return (
                                <div 
                                    key={card.id} 
                                    onClick={() => handleCardClick(idx)}
                                    className={`cursor-pointer perspective-1000 transition-all duration-500 ${initialAnimation ? 'scale-0 opacity-0' : 'scale-100 opacity-100'} ${isJustMatched ? 'animate-bounce-once' : ''} ${isShaking ? 'animate-shake' : ''}`}
                                    style={{ 
                                        width: `${cardSize.w}px`,
                                        height: `${cardSize.h}px`,
                                        transitionDelay: `${initialAnimation ? idx * 50 : 0}ms`
                                    }}
                                >
                                    <div className={`relative w-full h-full text-center transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                                        
                                        {/* Reverso de la carta */}
                                        <div className={`absolute inset-0 backface-hidden flex items-center justify-center rounded-xl sm:rounded-2xl border-2 select-none shadow-lg overflow-hidden transition-all group/card ${isMatched ? 'opacity-0 pointer-events-none' : 'hover:scale-[1.04] hover:shadow-xl hover:shadow-purple-500/10 active:scale-95 border-white/15 hover:border-white/30'}`}>
                                            <img src="/reversocarta.png" alt="Carta" className="w-full h-full object-cover" draggable={false} />
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/0 group-hover/card:from-white/10 group-hover/card:via-transparent group-hover/card:to-transparent transition-all duration-300 pointer-events-none"></div>
                                        </div>

                                        {/* Frente de la carta */}
                                        <div className={`absolute inset-0 backface-hidden rotate-y-180 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center p-1.5 sm:p-2 select-none overflow-hidden transition-all ${isMatched ? 'border-[#006400] bg-[#008000] shadow-lg shadow-[#008000]/30' : 'border-indigo-400/60 bg-gradient-to-br from-white to-indigo-50 shadow-lg shadow-indigo-500/10'}`}>
                                            
                                            <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-[0.15em] mb-0.5 px-1.5 py-0.5 rounded-md ${isMatched ? 'text-white bg-white/20' : card.type === 'question' ? 'text-indigo-500 bg-indigo-100' : 'text-amber-600 bg-amber-100'}`}>
                                                {card.type === 'question' ? '📘 PREGUNTA' : '📗 RESPUESTA'}
                                            </span>

                                            <div className="w-full flex-1 flex items-center justify-center">
                                                 <p className={`text-[9px] sm:text-xs font-bold text-center leading-snug break-words ${isMatched ? 'text-white' : 'text-gray-800'}`}>
                                                     {card.content}
                                                 </p>
                                            </div>

                                            {isMatched && (
                                                <div className="absolute top-1 right-1 w-5 h-5 bg-white/25 rounded-full flex items-center justify-center shadow-md">
                                                    <span className="text-white text-[8px] font-black">✓</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating Particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[20%] left-[10%] w-3 h-3 bg-indigo-400/20 rounded-full animate-float-slow"></div>
                <div className="absolute top-[60%] right-[15%] w-2 h-2 bg-purple-400/20 rounded-full animate-float-medium"></div>
                <div className="absolute bottom-[30%] left-[25%] w-2.5 h-2.5 bg-cyan-400/15 rounded-full animate-float-fast"></div>
                <div className="absolute top-[40%] right-[30%] w-2 h-2 bg-emerald-400/15 rounded-full animate-float-slow" style={{ animationDelay: '2s' }}></div>
                <div className="absolute bottom-[15%] right-[40%] w-3 h-3 bg-pink-400/10 rounded-full animate-float-medium" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Estilos Custom */}
            <style jsx>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
                    50% { transform: translateY(-30px) translateX(10px); opacity: 0.6; }
                }
                @keyframes float-medium {
                    0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
                    50% { transform: translateY(-20px) translateX(-15px); opacity: 0.5; }
                }
                @keyframes float-fast {
                    0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
                    50% { transform: translateY(-15px) translateX(8px); opacity: 0.4; }
                }
                .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
                .animate-float-medium { animation: float-medium 4.5s ease-in-out infinite; }
                .animate-float-fast { animation: float-fast 3.5s ease-in-out infinite; }
                
                @keyframes bounce-once {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.08); }
                }
                .animate-bounce-once { animation: bounce-once 0.4s ease-out; }
                
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-4px); }
                    40% { transform: translateX(4px); }
                    60% { transform: translateX(-3px); }
                    80% { transform: translateX(3px); }
                }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
        </div>
    );
}
