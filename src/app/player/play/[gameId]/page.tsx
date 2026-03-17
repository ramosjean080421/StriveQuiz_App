"use client";

// Vista móvil del Estudiante durante una partida activa
import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Question {
    id: string;
    type?: 'multiple_choice' | 'true_false' | 'fill_in_the_blank' | 'matching';
    question_text: string;
    options: string[];
    correct_option_index: number;
    correct_answer?: string;
    matching_pairs?: { left: string; right: string }[];
}

export default function StudentPlayArea({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = use(params);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [playerSecret, setPlayerSecret] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [gameStatus, setGameStatus] = useState("waiting");
    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'ludo'>('classic');
    const [players, setPlayers] = useState<any[]>([]);
    const [totalQuestions, setTotalQuestions] = useState(10);
    const [ludoTeamsCount, setLudoTeamsCount] = useState(4);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [answering, setAnswering] = useState(false);
    const [feedback, setFeedback] = useState<"correct" | "incorrect" | "timeout" | null>(null);
    const [hasFinishedAll, setHasFinishedAll] = useState(false);
    const [timeLeft, setTimeLeft] = useState(20);
    const [questionDuration, setQuestionDuration] = useState(20);

    // Respuestas para nuevos tipos de preguntas
    const [blankAnswer, setBlankAnswer] = useState("");
    const [userMatches, setUserMatches] = useState<Record<string, string>>({});
    const [shuffledMatchRight, setShuffledMatchRight] = useState<string[]>([]);

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
        if (gameStatus === "waiting" || gameStatus === "finished" || gameStatus === "paused" || hasFinishedAll || answering || questions.length === 0 || questionDuration <= 0) return;

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
    }, [currentQuestionIdx, gameStatus, hasFinishedAll, answering, questions.length, questionDuration]);

    // Reiniciar inputs en nueva pregunta
    useEffect(() => {
        setTimeLeft(questionDuration);
        setBlankAnswer("");
        setUserMatches({});

        if (questions.length > 0 && questions[currentQuestionIdx]?.type === 'matching' && questions[currentQuestionIdx]?.matching_pairs) {
            const rights = questions[currentQuestionIdx].matching_pairs!.map(p => p.right);
            setShuffledMatchRight(rights.sort(() => Math.random() - 0.5));
        }
    }, [currentQuestionIdx, questions, questionDuration]);

    if (errorMessage) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6 text-center">
                <div className="bg-red-500/10 border border-red-500/30 p-10 rounded-[3rem] backdrop-blur-xl animate-bounce-short">
                    <div className="text-6xl mb-6">🚫</div>
                    <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">¡Ups! Algo salió mal</h2>
                    <p className="text-red-400 font-bold text-sm leading-relaxed">{errorMessage}</p>
                    <div className="mt-8 flex justify-center">
                        <div className="w-12 h-1 border-t-4 border-red-500/30 border-dashed animate-pulse"></div>
                    </div>
                </div>
            </div>
        );
    }

    useEffect(() => {
        // 1. Recuperar la ID del Jugador del localStorage
        const savedPlayerId = localStorage.getItem("currentPlayerId");
        const savedSecret = localStorage.getItem("playerSecret");
        if (!savedPlayerId) {
            setErrorMessage("No estás autenticado en esta sala. Regresa al inicio e ingresa el PIN.");
            setTimeout(() => { window.location.href = "/"; }, 3000);
            return;
        }
        setPlayerId(savedPlayerId);
        setPlayerSecret(savedSecret);

        // 2. Obtener estado de la partida, preguntas y configuracion de recompensas
        const fetchGame = async () => {
            const { data: game } = await supabase.from("games").select(`
                status, quiz_id, auto_end, game_mode, team_distribution_mode, question_duration,
                quizzes (rewards_enabled, reward_criteria, reward_text, board_path, ludo_teams_count)
            `).eq("id", gameId).single();

            if (game) {
                setGameStatus(game.status);
                setGameMode(game.game_mode as any || "classic");
                if (game.question_duration !== undefined && game.question_duration !== null) {
                    setQuestionDuration(game.question_duration);
                    if (game.question_duration > 0) {
                        setTimeLeft(game.question_duration);
                    }
                }

                const quizData: any = Array.isArray(game.quizzes) ? game.quizzes[0] : game.quizzes;
                if (quizData) {
                    setRewardConfig({
                        enabled: false, // Fuerza desactivado para unificar con el salto de pregunta general
                        criteria: quizData.reward_criteria || 5,
                        text: quizData.reward_text || ""
                    });
                    setLudoTeamsCount(quizData.ludo_teams_count || 4);
                }

                // Obtener preguntas y aleatorizarlas
                const { data: qData } = await supabase.from("questions").select("*").eq("quiz_id", game.quiz_id);
                if (qData) {
                    let shuffled = [...qData].sort(() => Math.random() - 0.5);
                    let boardPath = quizData?.board_path || [];
                    if (typeof boardPath === "string") {
                        try { boardPath = JSON.parse(boardPath); } catch (e) { boardPath = []; }
                    }
                    const mode = (game.game_mode || "classic").toLowerCase();

                    if ((mode === 'classic' || mode === 'race') && (boardPath && boardPath.length > 0)) {
                        shuffled = shuffled.slice(0, boardPath.length);
                        console.log("Slicing questions to board path length:", boardPath.length);
                    }

                    setQuestions(shuffled);
                    setTotalQuestions(shuffled.length || 10);
                }
            }

            // Cargar lista de jugadores para colisiones
            const { data: pList } = await supabase.from("game_players").select("*").eq("game_id", gameId);
            if (pList) setPlayers(pList);

            setLoading(false);
        };

        fetchGame();

        // 3. Escuchar cambios de estado de la partida
        const channel = supabase.channel(`game_updates_${gameId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
                (payload) => {
                    setGameStatus(payload.new.status);
                    if (payload.new.game_mode) setGameMode(payload.new.game_mode);
                }
            )
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setPlayers(prev => [...prev, payload.new]);
                    } else if (payload.eventType === 'UPDATE') {
                        setPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId]);

    // 4. Re-obtener preguntas si el juego pasa a 'active' (Las preguntas no cargan de inicio por las políticas de seguridad de lectura)
    useEffect(() => {
        if (gameStatus === "active" && questions.length === 0) {
            const fetchQuestions = async () => {
                const { data: game } = await supabase.from("games").select(`
                    quiz_id, game_mode, question_duration,
                    quizzes (board_path)
                `).eq("id", gameId).single();

                if (game) {
                    if (game.question_duration !== undefined && game.question_duration !== null) {
                        setQuestionDuration(game.question_duration);
                    }
                    const { data: qData } = await supabase.from("questions").select("*").eq("quiz_id", game.quiz_id);
                    if (qData) {
                        let shuffled = [...qData].sort(() => Math.random() - 0.5);
                        const quizData: any = Array.isArray(game.quizzes) ? game.quizzes[0] : game.quizzes;
                        let boardPath = quizData?.board_path || [];
                        if (typeof boardPath === "string") {
                            try { boardPath = JSON.parse(boardPath); } catch (e) { boardPath = []; }
                        }
                        const mode = (game.game_mode || "classic").toLowerCase();

                        if ((mode === 'classic' || mode === 'race') && (boardPath && boardPath.length > 0)) {
                            shuffled = shuffled.slice(0, boardPath.length);
                        }

                        setQuestions(shuffled);
                    }
                }
            };
            fetchQuestions();
        }
    }, [gameStatus, questions.length, gameId]);

    const handleAnswerSubmit = async (answerPayload: any) => {
        if (answering || gameStatus !== "active") return;
        setAnswering(true);

        const question = questions[currentQuestionIdx];
        let isCorrect = false;
        let skippedThisStep = false;

        if (answerPayload === -1) {
            // timeout
            isCorrect = false;
        } else if (!question.type || question.type === 'multiple_choice' || question.type === 'true_false') {
            isCorrect = answerPayload === question.correct_option_index;
        } else if (question.type === 'fill_in_the_blank') {
            isCorrect = String(answerPayload).trim().toLowerCase() === String(question.correct_answer || "").trim().toLowerCase();
        } else if (question.type === 'matching') {
            if (question.matching_pairs) {
                isCorrect = question.matching_pairs.every(p => answerPayload[p.left] === p.right);
            }
        }

        let fbType: "correct" | "incorrect" | "timeout" = isCorrect ? "correct" : "incorrect";
        if (answerPayload === -1) fbType = "timeout";
        setFeedback(fbType);

        // Hardware Feedback
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(isCorrect ? [100, 50, 100] : [300]);
        }
        playSound(fbType);
        if (playerId) {
            // REGISTRO PARA MAPA DE CALOR: Guardar si esta respuesta fue correcta o no
            supabase.from("game_responses").insert([{
                game_id: gameId,
                player_id: playerId,
                question_id: question.id,
                is_correct: isCorrect
            }]).then(({ error }) => {
                if (error) console.error("Error logging response for heatmap:", error);
            });

            // Actualizar: avanzar/retroceder posición, sumar puntos y rachas
            const { data: pData } = await supabase.from("game_players").select("player_name, current_position, score, correct_answers, incorrect_answers, current_streak").eq("id", playerId).single();
            const { data: gData } = await supabase.from("games").select("game_mode, boss_hp, auto_end, streaks_enabled, question_duration").eq("id", gameId).single();

            if (pData) {
                let nextPos = pData.current_position;
                let newScore = pData.score;
                let newCorrect = pData.correct_answers || 0;
                let newIncorrect = pData.incorrect_answers || 0;

                const mode = gData?.game_mode || "classic";
                let currentBossHp = gData?.boss_hp || 0;
                let newBossHp = currentBossHp;



                if (isCorrect) {
                    if (mode === "classic" || mode === "race" || mode === "ludo") {
                        nextPos += 1;
                    }

                    newScore += 100 + timeLeft * 10;
                    newCorrect += 1;
                } else {
                    if (mode === "classic" || mode === "race" || mode === "ludo") {
                        // Retrocede una posición si se equivoca, mínimo en 0
                        nextPos = Math.max(0, nextPos - 1);
                    }

                    newIncorrect += 1;
                }
                // 1. Actualizar el Jugador (Protegido por secret_token)
                const { error: pError, count } = await supabase.from("game_players")
                    .update({
                        current_position: nextPos,
                        score: newScore,
                        correct_answers: newCorrect,
                        incorrect_answers: newIncorrect
                    }, { count: 'exact' })
                    .eq("id", playerId)
                    .eq("secret_token", playerSecret);

                if (pError || count === 0) {
                    console.error("Error updating player record (Secret mismatch or DB error):", pError, "Rows affected:", count);
                } else {
                    // --- LÓGICA DE "COMER" (KICK MECHANIC) ---
                    // Solo en modo LUDO, si avanzamos (isCorrect) y no estamos en la meta
                    if (mode === 'ludo' && isCorrect && nextPos > 0 && nextPos < totalQuestions) {
                        const checkCollision = async () => {
                            // Obtener coordenadas de todos los jugadores si es Ludo, o solo posiciones si es Carrera
                            const currentPlayers = players.filter(p => p.id !== playerId);

                            for (const other of currentPlayers) {
                                let isCollision = false;

                                if (mode === 'ludo') {
                                    // Helper para obtener coord de Ludo (debe coincidir con GameBoard)
                                    const getLudoCoord = (p: any, pos: number) => {
                                        const commonCircuit = [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6]];
                                        const teamOffsets = [0, 13, 26, 39];
                                        const teamNames = ["Verde", "Rojo", "Amarillo", "Azul"].slice(0, ludoTeamsCount);
                                        const sorted = [...players, { id: playerId, ...pData }].sort((a, b) => a.id.localeCompare(b.id));
                                        const idx = sorted.findIndex(pl => pl.id === p.id);
                                        const teamIdx = idx % ludoTeamsCount;
                                        const offset = teamOffsets[teamIdx];

                                        if (pos === 0) return `base_${teamIdx}`; // Safe at base
                                        if (pos > 52) return `final_${teamIdx}_${pos}`; // Safe at finals

                                        const loopIdx = (pos - 1 + offset) % 52;
                                        return `${commonCircuit[loopIdx][0]},${commonCircuit[loopIdx][1]}`;
                                    };

                                    const myCoord = getLudoCoord({ id: playerId }, nextPos);
                                    const otherCoord = getLudoCoord(other, other.current_position);

                                    // No se puede comer en bases ni en finales
                                    if (myCoord === otherCoord && !myCoord.startsWith('base') && !myCoord.startsWith('final')) {
                                        isCollision = true;
                                    }
                                } else {
                                    // Carrera clásica: si caigo exactamente en la misma casilla
                                    if (other.current_position === nextPos && nextPos !== 0) {
                                        isCollision = true;
                                    }
                                }

                                if (isCollision) {
                                    // ¡BANG! Mandamos al otro al inicio
                                    await supabase.from("game_players").update({ current_position: 0 }).eq("id", other.id);
                                    // Notificar (Opcional: podrías añadir un mensaje en el tablero)
                                    console.log(`¡Jugador ${other.player_name} comido por ${pData.player_name}!`);
                                }
                            }
                        };
                        checkCollision();
                    }

                    // Si terminó todas las preguntas y el autoEnd está activo, cerramos el juego para todos
                    if (currentQuestionIdx >= questions.length - 1 && gData?.auto_end) {
                        await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
                    }
                }
            }
        }

        // Esperar feedback antes de la siguiente pregunta
        setTimeout(() => {
            setFeedback(null);
            setEarnedReward(null);
            setAnswering(false);

            const skipQuestion = isCorrect && skippedThisStep;

            if (skipQuestion && currentQuestionIdx < questions.length - 2) {
                setCurrentQuestionIdx(prev => prev + 2);
            } else if (currentQuestionIdx < questions.length - 1) {
                setCurrentQuestionIdx(prev => prev + 1);
            } else {
                setHasFinishedAll(true);
            }
        }, 50);
    };

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-900 border-4 border-indigo-500 animate-pulse">
            <span className="text-3xl font-black text-indigo-400">Cargando Aventura...</span>
        </div>
    );

    if (gameStatus === "waiting") {
        return (
            <div className={`h-screen w-screen overflow-hidden flex flex-col items-center justify-center p-6 text-center relative transition-all duration-700 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600`}>
                {/* Elementos Decorativos */}
                <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-[40px] opacity-40 animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-40 h-40 bg-pink-400 rounded-full mix-blend-overlay filter blur-[50px] opacity-40 animate-pulse animation-delay-2000"></div>

                <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 sm:p-12 rounded-[3.5rem] z-10 w-full max-w-sm flex flex-col items-center">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce text-4xl">
                        🎮
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
                        ¡Estás Dentro!
                    </h1>

                    <p className="text-lg text-indigo-100 font-medium leading-tight">
                        Prepárate... la batalla comenzará pronto.
                    </p>
                </div>
            </div>
        );
    }

    if (gameStatus === "paused") {
        return (
            <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 to-black flex flex-col items-center justify-center p-6 text-center relative z-50">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="bg-amber-500/10 backdrop-blur-xl border-4 border-amber-500/50 p-10 sm:p-14 rounded-[3.5rem] w-full max-w-sm flex flex-col items-center animate-pulse">
                    <span className="text-8xl mb-6 shadow-black">⏸️</span>
                    <h1 className="text-3xl sm:text-4xl font-black text-amber-400 mb-4 uppercase tracking-widest">
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
                        <div className="bg-yellow-400 text-yellow-900 px-6 py-3 rounded-full font-black text-xl border-4 border-yellow-200">
                            🎁 ¡Premio Desbloqueado: {earnedReward}!
                        </div>
                    </div>
                )}

                <div className="relative z-10 bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-indigo-500/50 p-10 rounded-[3rem] max-w-sm w-full">
                    <span className="text-8xl mb-6 block transform hover:scale-110 transition-transform cursor-pointer">🏆</span>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 uppercase tracking-wider">
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
        "bg-rose-500",      // Rojo/Rosa (A)
        "bg-blue-500",      // Azul (B)
        "bg-amber-500",    // Naranja/Amarillo (C)
        "bg-emerald-500" // Verde (D)
    ];

    const optionIcons = ["🔺", "🔷", "🟡", "🟩"]; // Símbolos visuales intuitivos

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-y-auto relative font-sans custom-scrollbar">

            {/* Header Mini - Progreso */}
            <div className="bg-white px-4 py-3 flex justify-between items-center z-10 sticky top-0 border-b border-gray-100">
                <div className="font-black text-xl text-transparent bg-clip-text bg-indigo-600 tracking-tight">StriveQuiz</div>
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Pregunta</span>
                    <span className="bg-indigo-600 text-white text-xs font-black px-2.5 h-7 flex items-center justify-center rounded-lg">{currentQuestionIdx + 1}/{questions.length}</span>
                </div>
            </div>

            {/* Cronómetro Barra */}
            {questionDuration > 0 && (
                <div className="w-full bg-gray-200 h-2">
                    <div
                        className="h-full transition-all duration-1000 linear"
                        style={{
                            width: `${(timeLeft / questionDuration) * 100}%`,
                            backgroundColor: timeLeft > 10 ? '#10B981' : timeLeft > 5 ? '#F59E0B' : '#EF4444'
                        }}
                    ></div>
                </div>
            )}

            {/* Tarjeta de Pregunta Central */}
            <div className="flex items-center justify-center px-4 py-4 sm:py-6">
                <div className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-10 border-b-4 border-indigo-500 text-center relative overflow-hidden">
                    {questionDuration > 0 && (
                        <div className="absolute top-0 right-0 p-4 font-black text-3xl opacity-10">⏳ {timeLeft}</div>
                    )}
                    <div className="absolute -top-4 -left-4 w-16 h-16 bg-indigo-100 rounded-full blur-xl opacity-60"></div>
                    <h2 className="text-2xl sm:text-3xl md:text-3xl font-extrabold text-gray-900 leading-snug break-words relative z-10 mt-2">
                        {currentQ.question_text}
                    </h2>
                </div>
            </div>

            {/* Botones de Opciones (Grid) o Inputs según tipo */}
            <div className="flex-1 p-3 pb-6 sm:p-6 max-w-5xl mx-auto w-full flex flex-col justify-center">
                {(!currentQ.type || currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full h-full">
                        {currentQ.options.map((opt, i) => {

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
                                    className={`relative focus:outline-none rounded-2xl sm:rounded-3xl font-black text-xl sm:text-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 text-white active:translate-y-2 transform hover:scale-[1.02] ${currentQ.type === 'true_false' ? (i === 0 ? 'bg-emerald-500' : 'bg-rose-500') : optionColors[i % 4]} ${opacityClass}`}
                                >
                                    <span className="absolute top-4 left-5 text-3xl opacity-50">
                                        {currentQ.type === 'true_false' ? (i === 0 ? '✅' : '❌') : optionIcons[i % 4]}
                                    </span>
                                    <span className="mt-4 break-words w-full px-4">
                                        {opt}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}

                {currentQ.type === 'fill_in_the_blank' && (
                    <div className="flex flex-col items-center justify-center h-full w-full max-w-xl mx-auto space-y-6 bg-white/50 p-8 rounded-3xl backdrop-blur-sm border border-white">
                        <input
                            type="text"
                            disabled={answering}
                            value={blankAnswer}
                            onChange={(e) => setBlankAnswer(e.target.value)}
                            placeholder="Escribe tu respuesta aquí..."
                            className="w-full text-center px-6 py-5 rounded-2xl text-2xl font-black text-indigo-900 bg-white border-4 border-indigo-200 focus:border-indigo-500 outline-none transition-all uppercase placeholder-indigo-300"
                        />
                        <button
                            disabled={answering || !blankAnswer.trim()}
                            onClick={() => handleAnswerSubmit(blankAnswer)}
                            className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-2xl active:translate-y-2 transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:active:translate-y-0"
                        >
                            ENVIAR RESPUESTA
                        </button>
                    </div>
                )}

                {currentQ.type === 'matching' && currentQ.matching_pairs && (
                    <div className="flex flex-col w-full max-w-2xl mx-auto bg-white/50 p-4 sm:p-8 rounded-3xl backdrop-blur-sm border border-white space-y-4">
                        <div className="text-center text-sm font-bold text-indigo-600 mb-2 uppercase tracking-widest">Une los conceptos correctos</div>
                        {currentQ.matching_pairs.map((p, i) => (
                            <div key={i} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full">
                                <div className="w-full sm:w-1/2 p-4 rounded-xl bg-indigo-600 text-white font-bold text-center">
                                    {p.left}
                                </div>
                                <span className="text-2xl rotate-90 sm:rotate-0 text-indigo-300 font-bold">↔️</span>
                                <select
                                    className="w-full sm:w-1/2 p-4 rounded-xl bg-amber-100 text-amber-900 border-2 border-amber-300 font-bold cursor-pointer outline-none focus:border-amber-500 appearance-none text-center"
                                    disabled={answering}
                                    value={userMatches[p.left] || ""}
                                    onChange={(e) => setUserMatches({ ...userMatches, [p.left]: e.target.value })}
                                >
                                    <option value="" disabled>-- Selecciona --</option>
                                    {shuffledMatchRight.map((r, j) => (
                                        <option key={j} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                        <button
                            disabled={answering || Object.keys(userMatches).length < currentQ.matching_pairs.length || Object.values(userMatches).some(v => !v)}
                            onClick={() => handleAnswerSubmit(userMatches)}
                            className="mt-6 w-full py-5 rounded-2xl bg-emerald-500 text-white font-black text-2xl active:translate-y-2 transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:active:translate-y-0"
                        >
                            COMPROBAR PAREJAS
                        </button>
                    </div>
                )}
            </div>

            {/* Pantalla Interpuesta de Feedback Rápido (Correcto/Incorrecto) */}
            {feedback && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-100 ${feedback === 'correct' ? 'bg-emerald-500/90' : feedback === 'timeout' ? 'bg-amber-500/90' : 'bg-rose-600/90'
                    }`}>
                    <div className="transform animate-bounce mb-4">
                        {feedback === 'correct' ? (
                            <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center">
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
                    <h2 className="text-5xl font-black text-white uppercase tracking-widest text-center px-4">
                        {feedback === 'correct' ? '¡Genial!' : feedback === 'timeout' ? '¡Tiempo!' : '¡Fallaste!'}
                    </h2>
                </div>
            )}

        </div>
    );
}
