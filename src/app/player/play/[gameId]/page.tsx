"use client";

// Vista móvil del Estudiante durante una partida activa
import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Question {
    id: string;
    question_text: string;
    options: string[];
    correct_option_index: number;
}

export default function StudentPlayArea({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = use(params);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [gameStatus, setGameStatus] = useState("waiting");

    const [loading, setLoading] = useState(true);
    const [answering, setAnswering] = useState(false);
    const [feedback, setFeedback] = useState<"correct" | "incorrect" | "timeout" | null>(null);
    const [hasFinishedAll, setHasFinishedAll] = useState(false);
    const [timeLeft, setTimeLeft] = useState(20);

    // Configuraciones de recompensa del quiz
    const [rewardConfig, setRewardConfig] = useState({ enabled: false, criteria: 5, text: "" });
    const [earnedReward, setEarnedReward] = useState<string | null>(null);

    // Reproductor de efectos integrados
    const playSound = (type: "correct" | "incorrect" | "timeout") => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const audioCtx = new AudioContext();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === 'correct') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, audioCtx.currentTime);
                osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.4);
                gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            }
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) { }
    };

    // Cronómetro visual
    useEffect(() => {
        if (gameStatus === "waiting" || gameStatus === "finished" || gameStatus === "paused" || hasFinishedAll || answering || questions.length === 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleAnswerSubmit(-1); // -1 significa que se acabó el tiempo
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [currentQuestionIdx, gameStatus, hasFinishedAll, answering, questions.length]);

    // Reiniciar cronómetro en nueva pregunta
    useEffect(() => {
        setTimeLeft(20);
    }, [currentQuestionIdx]);

    useEffect(() => {
        // 1. Recuperar la ID del Jugador del localStorage
        const savedPlayerId = localStorage.getItem("currentPlayerId");
        if (!savedPlayerId) {
            alert("No estás autenticado en esta sala. Vuelve a ingresar el PIN.");
            window.location.href = "/";
            return;
        }
        setPlayerId(savedPlayerId);

        // 2. Obtener estado de la partida, preguntas y configuracion de recompensas
        const fetchGame = async () => {
            const { data: game } = await supabase.from("games").select("status, quiz_id").eq("id", gameId).single();
            if (game) {
                setGameStatus(game.status);

                // Configuración de recompensa del quiz
                const { data: quizData } = await supabase.from("quizzes").select("rewards_enabled, reward_criteria, reward_text").eq("id", game.quiz_id).single();
                if (quizData) {
                    setRewardConfig({
                        enabled: quizData.rewards_enabled || false,
                        criteria: quizData.reward_criteria || 5,
                        text: quizData.reward_text || ""
                    });
                }

                // Obtener preguntas y aleatorizarlas
                const { data: qData } = await supabase.from("questions").select("*").eq("quiz_id", game.quiz_id);
                if (qData) {
                    const shuffled = [...qData].sort(() => Math.random() - 0.5);
                    setQuestions(shuffled);
                }
            }
            setLoading(false);
        };

        fetchGame();

        // 3. Escuchar cambios de estado de la partida (ej. el profe la inicia)
        const channel = supabase.channel(`game_status_${gameId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                (payload) => setGameStatus(payload.new.status)
            ).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId]);

    // 4. Re-obtener preguntas si el juego pasa a 'active' (Las preguntas no cargan de inicio por las políticas de seguridad de lectura)
    useEffect(() => {
        if (gameStatus === "active" && questions.length === 0) {
            const fetchQuestions = async () => {
                const { data: game } = await supabase.from("games").select("quiz_id").eq("id", gameId).single();
                if (game) {
                    const { data: qData } = await supabase.from("questions").select("*").eq("quiz_id", game.quiz_id);
                    if (qData) {
                        const shuffled = [...qData].sort(() => Math.random() - 0.5);
                        setQuestions(shuffled);
                    }
                }
            };
            fetchQuestions();
        }
    }, [gameStatus, questions.length, gameId]);

    const handleAnswerSubmit = async (selectedIndex: number) => {
        if (answering) return;
        setAnswering(true);

        const question = questions[currentQuestionIdx];
        const isCorrect = selectedIndex === question.correct_option_index;

        let fbType: "correct" | "incorrect" | "timeout" = isCorrect ? "correct" : "incorrect";
        if (selectedIndex === -1) fbType = "timeout";
        setFeedback(fbType);

        // Hardware Feedback
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(isCorrect ? [100, 50, 100] : [300]);
        }
        playSound(fbType);

        if (playerId) {
            // Actualizar: avanzar/retroceder posición, sumar puntos y rachas
            const { data: pData } = await supabase.from("game_players").select("current_position, score, correct_answers, incorrect_answers, current_streak").eq("id", playerId).single();

            if (pData) {
                let nextPos = pData.current_position;
                let newScore = pData.score;
                let newCorrect = pData.correct_answers || 0;
                let newIncorrect = pData.incorrect_answers || 0;
                let newStreak = pData.current_streak || 0;

                if (isCorrect) {
                    nextPos += 1;
                    newScore += 100 + timeLeft * 10;
                    newCorrect += 1;
                    newStreak += 1;

                    // Comprobar sistema de recompensas
                    if (rewardConfig.enabled && newStreak > 0 && newStreak % rewardConfig.criteria === 0) {
                        setEarnedReward(rewardConfig.text);
                        playSound("correct"); // Sonido extra
                    }
                } else {
                    // Retrocede una posición si se equivoca, mínimo en 0
                    nextPos = Math.max(0, nextPos - 1);
                    newIncorrect += 1;
                    newStreak = 0;
                }

                await supabase.from("game_players")
                    .update({
                        current_position: nextPos,
                        score: newScore,
                        correct_answers: newCorrect,
                        incorrect_answers: newIncorrect,
                        current_streak: newStreak
                    })
                    .eq("id", playerId);
            }
        }

        // Esperar feedback antes de la siguiente pregunta
        setTimeout(() => {
            setFeedback(null);
            setEarnedReward(null);
            setAnswering(false);

            if (currentQuestionIdx < questions.length - 1) {
                setCurrentQuestionIdx(prev => prev + 1);
            } else {
                setHasFinishedAll(true);
            }
        }, 2000);
    };

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-900 border-4 border-indigo-500 animate-pulse">
            <span className="text-3xl font-black text-indigo-400">Cargando Aventura...</span>
        </div>
    );

    if (gameStatus === "waiting") {
        return (
            <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 flex flex-col items-center justify-center p-6 text-center relative">
                {/* Elementos Decorativos */}
                <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-[40px] opacity-40 animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-40 h-40 bg-pink-400 rounded-full mix-blend-overlay filter blur-[50px] opacity-40 animate-pulse animation-delay-2000"></div>

                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 sm:p-12 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-10 w-full max-w-sm flex flex-col items-center">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-inner animate-bounce">
                        <span className="text-5xl">🎮</span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight drop-shadow-md">
                        ¡Estás Dentro!
                    </h1>
                    <p className="text-lg text-indigo-100 font-medium leading-tight">
                        Mira la pantalla del profesor. El juego está a punto de empezar...
                    </p>
                </div>
            </div>
        );
    }

    if (gameStatus === "paused") {
        return (
            <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black flex flex-col items-center justify-center p-6 text-center relative z-50">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="bg-amber-500/10 backdrop-blur-xl border-4 border-amber-500/50 p-10 sm:p-14 rounded-[3.5rem] shadow-[0_0_80px_rgba(245,158,11,0.2)] w-full max-w-sm flex flex-col items-center animate-pulse">
                    <span className="text-8xl mb-6 shadow-black">⏸️</span>
                    <h1 className="text-3xl sm:text-4xl font-black text-amber-400 mb-4 uppercase tracking-widest drop-shadow-md">
                        ¡Tiempo Pausado!
                    </h1>
                    <p className="text-amber-100 font-medium leading-relaxed text-lg">
                        El profesor ha detenido el tiempo. Respira profundo mientras esperas instrucciones...
                    </p>
                </div>
            </div>
        );
    }

    if (gameStatus === "finished" || hasFinishedAll) {
        return (
            <div className="h-screen w-screen overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-6 text-center relative">
                {/* Fondo Estrellado / Celebración */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>

                {/* Recompensa masiva si es que la ganó al final */}
                {earnedReward && (
                    <div className="absolute top-10 w-full flex justify-center z-50 animate-bounce">
                        <div className="bg-yellow-400 text-yellow-900 px-6 py-3 rounded-full font-black text-xl shadow-[0_0_30px_rgba(250,204,21,0.6)] border-4 border-yellow-200">
                            🎁 ¡Premio Desbloqueado: {earnedReward}!
                        </div>
                    </div>
                )}

                <div className="relative z-10 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-indigo-500/50 p-10 rounded-[3rem] shadow-[0_0_60px_rgba(79,70,229,0.3)] max-w-sm w-full">
                    <span className="text-8xl mb-6 block transform hover:scale-110 transition-transform cursor-pointer">🏆</span>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 drop-shadow-sm uppercase tracking-wider">
                        ¡Misión Cumplida!
                    </h1>
                    <p className="text-gray-300 font-medium text-lg leading-relaxed">
                        Has completado todas las casillas. Mira el tablero principal para descubrir el podio ganador y tus estadísticas.
                    </p>
                </div>
            </div>
        );
    }

    if (questions.length === 0) {
        return <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white font-bold text-center p-8">El profesor no añadió preguntas a este cuestionario. Dile que edite la aventura.</div>
    }

    // JUEGO ACTIVO
    const currentQ = questions[currentQuestionIdx];

    // Paleta de Colores de Acción (Estilo Kahoot/Quizizz)
    const optionColors = [
        "bg-rose-500 shadow-rose-600/50",      // Rojo/Rosa (A)
        "bg-blue-500 shadow-blue-600/50",      // Azul (B)
        "bg-amber-500 shadow-amber-600/50",    // Naranja/Amarillo (C)
        "bg-emerald-500 shadow-emerald-600/50" // Verde (D)
    ];

    const optionIcons = ["🔺", "🔷", "🟡", "🟩"]; // Símbolos visuales intuitivos

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden relative font-sans">

            {/* Header Mini - Progreso */}
            <div className="bg-white shadow-[0_2px_15px_rgba(0,0,0,0.05)] px-4 py-3 flex justify-between items-center z-10 sticky top-0 border-b border-gray-100">
                <div className="font-black text-xl text-transparent bg-clip-text bg-indigo-600 tracking-tight">Prisma Quiz</div>
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Pregunta</span>
                    <span className="bg-indigo-600 text-white text-sm font-black w-7 h-7 flex items-center justify-center rounded-lg shadow-inner">{currentQuestionIdx + 1}/{questions.length}</span>
                </div>
            </div>

            {/* Cronómetro Barra */}
            <div className="w-full bg-gray-200 h-2">
                <div
                    className="h-full transition-all duration-1000 linear"
                    style={{
                        width: `${(timeLeft / 20) * 100}%`,
                        backgroundColor: timeLeft > 10 ? '#10B981' : timeLeft > 5 ? '#F59E0B' : '#EF4444'
                    }}
                ></div>
            </div>

            {/* Tarjeta de Pregunta Central */}
            <div className="flex items-center justify-center px-4 py-4 sm:py-8">
                <div className="w-full max-w-3xl bg-white rounded-3xl shadow-lg p-6 sm:p-10 border-b-8 border-indigo-500 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 font-black text-3xl opacity-10">⏳ {timeLeft}</div>
                    <div className="absolute -top-4 -left-4 w-16 h-16 bg-indigo-100 rounded-full blur-xl opacity-60"></div>
                    <h2 className="text-2xl sm:text-3xl md:text-3xl font-extrabold text-gray-900 leading-snug break-words relative z-10 mt-2">
                        {currentQ.question_text}
                    </h2>
                </div>
            </div>

            {/* Botones de Opciones (Grid) - Ocupan todo el espacio restante */}
            <div className="flex-1 p-3 pb-6 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-5xl mx-auto w-full">
                {currentQ.options.map((opt, i) => {

                    // Lógica para opacar botones post-respuesta
                    let opacityClass = "opacity-100";
                    if (feedback && i !== currentQ.correct_option_index) {
                        opacityClass = "opacity-25 grayscale scale-95";
                    } else if (feedback && i === currentQ.correct_option_index) {
                        opacityClass = "scale-[1.03] ring-8 ring-white/50 z-10"; // Highlight correcto
                    }

                    return (
                        <button
                            key={i}
                            disabled={answering}
                            onClick={() => handleAnswerSubmit(i)}
                            className={`relative focus:outline-none rounded-2xl sm:rounded-3xl font-black text-xl sm:text-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 text-white shadow-[0_8px_0_0_rgba(0,0,0,0.15)] active:shadow-none active:translate-y-2 transform hover:scale-[1.02] ${optionColors[i % 4]} ${opacityClass}`}
                        >
                            <span className="absolute top-4 left-5 text-3xl opacity-50 drop-shadow-md">
                                {optionIcons[i % 4]}
                            </span>
                            <span className="mt-4 break-words w-full px-4 drop-shadow-md">
                                {opt}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Pantalla Interpuesta de Feedback Rápido (Correcto/Incorrecto) */}
            {feedback && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-500 ${feedback === 'correct' ? 'bg-emerald-500/90' : feedback === 'timeout' ? 'bg-amber-500/90' : 'bg-rose-600/90'
                    }`}>
                    <div className="transform animate-bounce mb-4">
                        {feedback === 'correct' ? (
                            <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                                <span className="text-8xl">🥇</span>
                            </div>
                        ) : feedback === 'timeout' ? (
                            <div className="w-40 h-40 bg-black/20 rounded-full flex items-center justify-center border-8 border-white border-dashed">
                                <span className="text-8xl">⏳</span>
                            </div>
                        ) : (
                            <div className="w-40 h-40 bg-black/20 rounded-full flex items-center justify-center border-8 border-white border-dashed">
                                <span className="text-8xl">💀</span>
                            </div>
                        )}
                    </div>
                    <h2 className="text-5xl font-black text-white uppercase tracking-widest drop-shadow-lg text-center px-4">
                        {feedback === 'correct' ? '¡Genial!' : feedback === 'timeout' ? '¡Tiempo!' : '¡Fallaste!'}
                    </h2>
                </div>
            )}

        </div>
    );
}
