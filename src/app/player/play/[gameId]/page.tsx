"use client";

// Vista móvil del Estudiante durante una partida activa
import { useEffect, useState, use, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import BombPlayerView from "@/components/games/bomb/BombPlayerView";

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
    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'bomb'>('classic');
    const [players, setPlayers] = useState<any[]>([]);
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

    // Sistema Anti-Trampas
    const [isBlurred, setIsBlurred] = useState(false);

    // Refs siempre actualizados (evitan stale closures en eventos del navegador)
    const gameStatusRef = useRef("waiting");
    useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
    const playerIdRef = useRef<string | null>(null);
    useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
    const playerSecretRef = useRef<string | null>(null);
    useEffect(() => { playerSecretRef.current = playerSecret; }, [playerSecret]);
    // Evitar llamadas simultáneas a lockPlayer (blur + visibilitychange pueden disparar al mismo tiempo)
    const isLockingRef = useRef(false);

    // Anti-trampas: marcar al alumno como bloqueado en la BD
    const lockPlayer = useCallback(async () => {
        // Mutex: evita llamadas simultáneas (blur + visibilitychange disparan al mismo tiempo)
        if (isLockingRef.current) return;
        isLockingRef.current = true;
        setIsBlurred(true);

        const id = playerIdRef.current || sessionStorage.getItem("currentPlayerId");
        const secret = playerSecretRef.current || sessionStorage.getItem("playerSecret");

        if (id) {
            // Intentar con secret_token primero (más seguro)
            const { count } = await supabase.from("game_players")
                .update({ is_blocked: true }, { count: 'exact' })
                .eq("id", id)
                .eq("secret_token", secret ?? "");

            // Si el secret no coincidió (0 filas afectadas), actualizar solo por id como fallback
            if (!count || count === 0) {
                await supabase.from("game_players")
                    .update({ is_blocked: true })
                    .eq("id", id);
            }
        }

        // Liberar el mutex al terminar (no usar cooldown — si el docente perdona y el alumno
        // vuelve a cambiar de pestaña debe llegar una nueva alerta inmediatamente)
        isLockingRef.current = false;
    }, []);

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

    // Aviso anti-cierre accidental durante partida activa
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (sessionStorage.getItem("isKicked") === "true") return;
            if ((gameStatusRef.current === "active" || gameStatusRef.current === "paused") && !hasFinishedAll) {
                e.preventDefault();
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => { window.removeEventListener("beforeunload", handleBeforeUnload); };
    }, [hasFinishedAll]);

    // Canal de presencia dedicado — el tablero detecta si el alumno cerró el navegador
    // (tab switch, minimizar, actualizar = NO se borran; solo cierre real de navegador)
    useEffect(() => {
        const savedPlayerId = sessionStorage.getItem("currentPlayerId");
        const savedSecret = sessionStorage.getItem("playerSecret");
        if (!savedPlayerId || !savedSecret) return;

        const presenceChannel = supabase.channel(`game_${gameId}`)
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await presenceChannel.track({ player_id: savedPlayerId, secret: savedSecret });
                }
            });

        return () => { supabase.removeChannel(presenceChannel); };
    }, [gameId]);

    // Lógica Anti-Trampas (Blur, Copiar, Menú contextual)
    // Deps vacíos: lockPlayer y gameStatusRef.current siempre son actuales gracias a los refs
    useEffect(() => {
        const handleBlur = () => {
            if (gameStatusRef.current === "active") lockPlayer();
        };
        const handleVisibilityChange = () => {
            if (document.hidden && gameStatusRef.current === "active") lockPlayer();
        };
        const handleCheatAction = (e: Event) => {
            e.preventDefault();
            // Además de bloquear la acción, avisar al docente
            if (gameStatusRef.current === "active") lockPlayer();
        };

        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("contextmenu", handleCheatAction);
        document.addEventListener("copy", handleCheatAction);
        document.addEventListener("cut", handleCheatAction);

        return () => {
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("contextmenu", handleCheatAction);
            document.removeEventListener("copy", handleCheatAction);
            document.removeEventListener("cut", handleCheatAction);
        };
    }, [lockPlayer]);

    // Cronómetro visualmente visual
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



    useEffect(() => {
        // 1. Recuperar la ID del Jugador del localStorage

        const savedPlayerId = sessionStorage.getItem("currentPlayerId");
        const savedSecret = sessionStorage.getItem("playerSecret");
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
                quizzes (board_path)
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
                    }

                    setQuestions(shuffled);
                }
            }

            // Cargar lista de jugadores para colisiones
            const { data: pList } = await supabase.from("game_players").select("*").eq("game_id", gameId);
            if (pList) {
                setPlayers(pList);
                let me = pList.find(p => p.id === savedPlayerId);
                if (!me) {
                    // No está en la lista aún — puede ser retraso de replicación de Supabase.
                    // Hacer una consulta directa antes de expulsar.
                    const { data: directPlayer } = await supabase
                        .from("game_players").select("id, is_blocked").eq("id", savedPlayerId).single();
                    if (!directPlayer) {
                        sessionStorage.removeItem("currentPlayerId");
                        sessionStorage.removeItem("playerSecret");
                        setErrorMessage("Tu sesión se cerró. Por favor, vuelve a ingresar tu nombre.");
                        setTimeout(() => { window.location.href = "/"; }, 3000);
                        return;
                    }
                    me = directPlayer as any;
                }
                if (me?.is_blocked) {
                    setIsBlurred(true);
                }
            }

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
                        // Si fue expulsado (posición negativa), sacarlo de la lista visible
                        if (payload.new.current_position < 0) {
                            setPlayers(prev => prev.filter(p => p.id !== payload.new.id));
                        } else {
                            setPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
                        }

                        const savedPlayerId = sessionStorage.getItem("currentPlayerId");
                        if (payload.new.id === savedPlayerId) {
                            // Si el profe lo asiló lógicamente (es la señal de expulsión forzada si RLS falló)
                            if (payload.new.current_position === -999) {
                                sessionStorage.setItem("isKicked", "true");
                                window.location.href = "/?kicked=true";
                                return;
                            }

                            // Si fue perdonado
                            if (payload.new.is_blocked === false) {
                                setIsBlurred(false);
                            }
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setPlayers(prev => prev.filter(p => p.id !== payload.old.id));

                        const savedPlayerId = sessionStorage.getItem("currentPlayerId");
                        if (payload.old.id === savedPlayerId) {
                            sessionStorage.setItem("isKicked", "true");
                            window.location.href = "/?kicked=true";
                        }
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [gameId]);

    // 4b. Fallback: si el estudiante no recibió el evento Realtime del inicio del juego
    // (lag de red, reconexión, etc.), chequea el DB cada 4 segundos mientras está en "waiting".
    useEffect(() => {
        if (gameStatus !== "waiting") return;

        const interval = setInterval(async () => {
            const { data: game } = await supabase
                .from("games")
                .select("status, game_mode")
                .eq("id", gameId)
                .single();
            if (game && game.status !== "waiting") {
                setGameStatus(game.status);
                if (game.game_mode) setGameMode(game.game_mode as any);
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [gameStatus, gameId]);

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
            // Actualizar: avanzar/retroceder posición, sumar puntos y rachas
            const { data: pData } = await supabase.from("game_players").select("current_position, score, correct_answers, incorrect_answers").eq("id", playerId).single();
            const { data: gData } = await supabase.from("games").select("game_mode, auto_end").eq("id", gameId).single();

            if (pData) {
                let nextPos = pData.current_position;
                let newScore = pData.score;
                let newCorrect = pData.correct_answers || 0;
                let newIncorrect = pData.incorrect_answers || 0;

                const mode = gData?.game_mode || "classic";



                if (isCorrect) {
                    if (mode === "classic" || mode === "race" || mode.startsWith("ludo")) {
                        nextPos += 1;
                    }

                    newScore += 100 + timeLeft * 10;
                    newCorrect += 1;
                } else {
                    if (mode === "classic" || mode === "race" || mode.startsWith("ludo")) {
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
                    setFeedback(null);
                    setAnswering(false);
                    setErrorMessage("⚠️ Error de conexión al guardar tu respuesta. Recarga la página e intenta de nuevo.");
                    return;
                } else {
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
            setAnswering(false);

            if (currentQuestionIdx < questions.length - 1) {
                setCurrentQuestionIdx(prev => prev + 1);
            } else {
                setHasFinishedAll(true);
            }
        }, 1500);
    };

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-900 border-4 border-indigo-500 animate-pulse">
            <span className="text-3xl font-black text-indigo-400">Cargando Aventura...</span>
        </div>
    );

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

    if (gameStatus === "waiting") {
        const myPlayer = players.find(p => p.id === playerId);
        return (
            <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-950 relative">
                {/* Fondo con patrón */}
                <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(16,185,129,0.07) 1px, transparent 0)',
                    backgroundSize: '32px 32px'
                }} />
                {/* Orbes */}
                <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-72 h-72 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.07] relative z-10">
                    <img src="/logotransparente.png" alt="StriveQuiz" className="w-10 h-10 object-contain" />
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Sala de espera</span>
                        <span className="text-white font-black text-base leading-none">🎮 StriveQuiz</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-emerald-400 font-black text-xs">{players.length}</span>
                    </div>
                </div>

                {/* Mi avatar destacado */}
                {myPlayer && (
                    <div className="shrink-0 flex flex-col items-center gap-2 pt-5 pb-3 relative z-10">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-[1.4rem] border-4 border-indigo-500 shadow-[0_0_24px_rgba(99,102,241,0.5)] overflow-hidden bg-slate-800">
                                {myPlayer.avatar_gif_url
                                    ? <img src={myPlayer.avatar_gif_url} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-3xl">😊</div>
                                }
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-indigo-600 border-2 border-slate-950 px-2 py-0.5 rounded-full">
                                <span className="text-white font-black text-[9px] uppercase tracking-wider whitespace-nowrap">Tú</span>
                            </div>
                        </div>
                        <p className="text-white font-black text-lg mt-1">{myPlayer.player_name}</p>
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 rounded-full">
                            <span className="text-emerald-400 text-sm">✅</span>
                            <span className="text-emerald-300 font-bold text-xs uppercase tracking-wider">¡Estás dentro!</span>
                        </div>
                    </div>
                )}

                {/* Separador */}
                <div className="shrink-0 px-5 py-2 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Jugadores conectados</span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                </div>

                {/* Grid de avatares */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 relative z-10">
                    <div className="grid grid-cols-4 gap-3">
                        {players.filter(p => p.id !== playerId).map((p, i) => (
                            <div key={p.id} className="flex flex-col items-center gap-1.5">
                                <div className="w-full aspect-square rounded-2xl border-2 border-white/10 overflow-hidden bg-slate-800/80 shadow-lg">
                                    {p.avatar_gif_url
                                        ? <img src={p.avatar_gif_url} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center text-2xl">
                                            {['🦊', '🐸', '🐼', '🦁', '🐯', '🦊', '🐺', '🦄'][i % 8]}
                                        </div>
                                    }
                                </div>
                                <span className="text-slate-300 font-bold text-[10px] text-center leading-tight truncate w-full text-center">
                                    {p.player_name}
                                </span>
                            </div>
                        ))}
                        {players.length <= 1 && (
                            <div className="col-span-4 py-6 flex flex-col items-center gap-2 opacity-40">
                                <span className="text-3xl">👥</span>
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Esperando más jugadores...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-5 py-4 border-t border-white/[0.07] flex items-center justify-center gap-3 relative z-10">
                    {[0, 150, 300].map(delay => (
                        <div key={delay} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] ml-2">
                        Esperando al profesor
                    </span>
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
        if (gameStatus === "active") {
            return (
                <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-indigo-400 font-black text-xl animate-pulse uppercase tracking-widest">Cargando preguntas...</span>
                    </div>
                </div>
            );
        }
        return <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white font-bold text-center p-8">El profesor no añadió preguntas a este cuestionario. Dile que edite la aventura.</div>
    }

    // JUEGO ACTIVO
    const currentQ = questions[currentQuestionIdx];

    const optionStyles = [
        { bg: "bg-rose-500", border: "border-rose-700", icon: "🔴" },
        { bg: "bg-blue-600", border: "border-blue-800", icon: "🔷" },
        { bg: "bg-yellow-500", border: "border-yellow-700", icon: "⭐" },
        { bg: "bg-emerald-500", border: "border-emerald-700", icon: "🟩" }
    ];

    const bgPattern = "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)";

    const sortedPlayers = [...players].sort((a, b) => {
        if (b.current_position !== a.current_position) {
            return b.current_position - a.current_position;
        }
        return (b.score || 0) - (a.score || 0);
    });

    const miPuesto = sortedPlayers.findIndex(p => p.id === playerId) + 1;

    // Modo bomba: BombPlayerView maneja sus propios estados (active, finished, eliminado)
    if (gameMode === 'bomb' && (gameStatus === 'active' || gameStatus === 'finished') && playerId) {
        return <BombPlayerView gameId={gameId} playerId={playerId} />;
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-[#111827] overflow-y-auto relative font-sans custom-scrollbar select-none" style={{ backgroundImage: bgPattern, backgroundSize: '24px 24px' }}>
            {/* Overlay Anti-Trampas */}
            {isBlurred && (
                <div className="fixed inset-0 z-[9999] bg-gray-950/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl">
                    <div className="bg-red-500/10 border border-red-500/30 p-10 rounded-[3rem] max-w-md shadow-2xl">
                        <span className="text-8xl mb-6 block animate-bounce">🙈</span>
                        <h1 className="text-3xl font-black text-red-500 mb-4 uppercase tracking-widest leading-none">
                            ¡NO HAGAS TRAMPA!
                        </h1>
                        <p className="text-gray-300 font-medium text-lg leading-relaxed mb-8">
                            Ocultamos las preguntas porque detectamos un intento de hacer trampa o uso de otra aplicación. <br /><br />
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

            {/* Header Mini - Progreso */}
            <div className="bg-slate-900 px-4 py-4 flex justify-between items-center z-10 sticky top-0 border-b-4 border-slate-950 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl border-2 border-slate-700 flex items-center justify-center shadow-inner">
                        <span className="text-xl font-black text-white">{miPuesto}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-[10px] font-bold uppercase">POSICIÓN GLOBAL</span>
                        <span className="font-black text-lg text-white tracking-tight leading-none uppercase">{gameMode} Mode</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border-2 border-slate-700">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pregunta</span>
                    <span className="bg-blue-600 text-white text-xs font-black px-2.5 h-6 flex items-center justify-center rounded-md border-b-2 border-blue-800">{currentQuestionIdx + 1}/{questions.length}</span>
                </div>
            </div>

            {/* Cronómetro Barra */}
            {questionDuration > 0 && (
                <div className="w-full bg-slate-900 h-2 flex">
                    <div
                        className="h-full transition-all duration-1000 linear"
                        style={{
                            width: `${(timeLeft / questionDuration) * 100}%`,
                            backgroundColor: timeLeft > 10 ? '#10B981' : timeLeft > 5 ? '#F59E0B' : '#EF4444'
                        }}
                    ></div>
                </div>
            )}

            {/* Widget de Ranking (Mobile: En flujo, Desktop: Flotante fijo) */}
            <div className="relative md:fixed left-0 md:left-2 top-0 md:top-1/2 md:-translate-y-1/2 z-40 bg-white md:bg-white/95 backdrop-blur-sm md:backdrop-blur-md px-4 py-2 md:p-2.5 shadow-sm md:shadow-2xl border-b md:border border-indigo-50 md:border-white/50 w-full md:w-32 lg:w-40 flex flex-row md:flex-col items-center md:items-stretch justify-between md:justify-start gap-2 animate-fadeIn mb-2 md:mb-0">
                <div className="text-[10px] sm:text-xs font-black text-indigo-700 uppercase tracking-wider text-center border-b-0 md:border-b border-indigo-100/50 pb-0 md:pb-1 whitespace-nowrap">
                    🏆 TOP 3
                </div>

                <div className="flex flex-row md:flex-col gap-1.5 flex-1 md:flex-none justify-center md:justify-start items-center">
                    {sortedPlayers.slice(0, 3).map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-lg bg-indigo-50/20 md:bg-indigo-50/50 border border-indigo-100/30">
                            <span className="text-xs sm:text-base">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] sm:text-xs font-bold text-gray-800 truncate py-0.5">{p.player_name || "Anónimo"}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-l md:border-l-0 md:border-t border-indigo-100 pl-2 md:pl-0 md:mt-1 md:pt-1.5 flex flex-row md:flex-col items-center gap-1 md:gap-0">
                    <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-gray-400 font-bold">Puesto</span>
                    <span className="text-sm md:text-2xl font-black text-emerald-600 tracking-tighter">#{miPuesto}</span>
                </div>
            </div>

            {/* Tarjeta de Pregunta Central */}
            <div className="flex items-center justify-center px-4 py-6 sm:py-8 relative">
                {questionDuration > 0 && (
                    <div className="absolute top-1 right-6 z-20 px-4 py-2 bg-slate-800 border-2 border-slate-700 rounded-xl flex items-center gap-2 shadow-lg">
                        <span className="text-xl">⏳</span>
                        <span className={`text-2xl font-black tabular-nums ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}</span>
                    </div>
                )}
                <div className="w-full max-w-4xl bg-white rounded-[2rem] p-6 sm:p-10 border-b-[8px] border-slate-300 shadow-xl text-center relative mt-4">
                    <div className="absolute -top-5 -left-5 w-14 h-14 bg-blue-500 rounded-xl rotate-12 flex items-center justify-center font-black text-white border-b-4 border-blue-700 shadow-lg text-3xl">?</div>
                    <h2 className="text-2xl sm:text-3xl md:text-3xl font-black text-slate-800 leading-snug break-words uppercase tracking-tight">
                        {currentQ.question_text}
                    </h2>
                </div>
            </div>

            {/* Botones de Opciones (Grid) o Inputs según tipo */}
            <div className="flex-1 p-3 pb-6 sm:p-6 max-w-5xl mx-auto w-full flex flex-col justify-center">
                {(!currentQ.type || currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full h-full">
                        {currentQ.options?.map((opt, i) => {

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
                                    className={`relative ${currentQ.type === 'true_false' ? (i === 0 ? optionStyles[3].bg : optionStyles[0].bg) : optionStyles[i % 4].bg} border-b-8 ${currentQ.type === 'true_false' ? (i === 0 ? optionStyles[3].border : optionStyles[0].border) : optionStyles[i % 4].border} rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg active:border-b-0 active:translate-y-2 transition-all duration-100 ${opacityClass}`}
                                >
                                    <span className="text-4xl drop-shadow-md mb-2">
                                        {currentQ.type === 'true_false' ? (i === 0 ? '✅' : '❌') : optionStyles[i % 4].icon}
                                    </span>
                                    <span className="text-white font-black text-xl sm:text-2xl text-center uppercase drop-shadow-md leading-tight break-words w-full">
                                        {opt}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}

                {currentQ.type === 'fill_in_the_blank' && (
                    <div className="flex flex-col flex-1 items-center justify-center gap-4 max-w-xl mx-auto w-full">
                        <input
                            type="text"
                            disabled={answering}
                            value={blankAnswer}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !answering && (e.target as HTMLInputElement).value.trim()) {
                                    handleAnswerSubmit((e.target as HTMLInputElement).value);
                                }
                            }}
                            onChange={(e) => setBlankAnswer(e.target.value)}
                            placeholder="Escribe tu respuesta aquí..."
                            className="bg-slate-900 border-4 border-slate-700 text-white font-black text-2xl p-6 rounded-2xl w-full text-center outline-none focus:border-blue-500 focus:bg-slate-800 transition-colors placeholder-slate-600 uppercase"
                        />
                        <button
                            disabled={answering || !blankAnswer.trim()}
                            onClick={() => handleAnswerSubmit(blankAnswer)}
                            className="w-full py-5 rounded-2xl bg-blue-600 border-b-8 border-blue-800 text-white font-black text-2xl active:translate-y-2 active:border-b-0 transition-all disabled:opacity-50"
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
                            className="mt-6 touch-manipulation w-full py-5 rounded-2xl bg-emerald-500 text-white font-black text-2xl active:translate-y-2 transform transition-all disabled:opacity-50 disabled:active:translate-y-0"
                        >
                            COMPROBAR PAREJAS
                        </button>
                    </div>
                )}
            </div>

            {/* Pantalla Interpuesta de Feedback Rápido (Correcto/Incorrecto) */}
            {feedback && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-0 ${feedback === 'correct' ? 'bg-emerald-500/90' : feedback === 'timeout' ? 'bg-amber-500/90' : 'bg-rose-600/90'
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
