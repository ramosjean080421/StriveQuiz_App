const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\player\\play\\[gameId]\\page.tsx";

let content = fs.readFileSync(filepath, 'utf-8');

// Normalize line endings to \n for replacement
const normalizedContent = content.replace(/\r\n/g, '\n');

const search1 = `        const fetchGame = async () => {
            const { data: game } = await supabase.from("games").select("status, quiz_id, auto_end, streaks_enabled, game_mode, team_distribution_mode").eq("id", gameId).single();
            if (game) {
                setGameStatus(game.status);
                setGameMode(game.game_mode as any || "classic");
                setStreaksEnabled(game.streaks_enabled !== false); // Default true

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
                    setTotalQuestions(qData.length || 10);
                }
                
                // Cargar ludo_teams_count si existe
                const { data: quizMeta } = await supabase.from("quizzes").select("ludo_teams_count").eq("id", game.quiz_id).single();
                if (quizMeta) setLudoTeamsCount(quizMeta.ludo_teams_count || 4);
            }`;

const replace1 = `        const fetchGame = async () => {
            const { data: game } = await supabase.from("games").select(\`
                status, quiz_id, auto_end, streaks_enabled, game_mode, team_distribution_mode,
                quizzes (rewards_enabled, reward_criteria, reward_text, board_path, ludo_teams_count)
            \`).eq("id", gameId).single();

            if (game) {
                setGameStatus(game.status);
                setGameMode(game.game_mode as any || "classic");
                setStreaksEnabled(game.streaks_enabled !== false);

                const quizData: any = Array.isArray(game.quizzes) ? game.quizzes[0] : game.quizzes;
                if (quizData) {
                    setRewardConfig({
                        enabled: quizData.rewards_enabled || false,
                        criteria: quizData.reward_criteria || 5,
                        text: quizData.reward_text || ""
                    });
                    setLudoTeamsCount(quizData.ludo_teams_count || 4);
                }

                // Obtener preguntas y aleatorizarlas
                const { data: qData } = await supabase.from("questions").select("*").eq("quiz_id", game.quiz_id);
                if (qData) {
                    let shuffled = [...qData].sort(() => Math.random() - 0.5);
                    const boardPath = quizData?.board_path as any[] || [];
                    const mode = game.game_mode || "classic";
                    
                    if ((mode === 'classic' || mode === 'race') && boardPath.length > 0) {
                        shuffled = shuffled.slice(0, boardPath.length);
                    }
                    
                    setQuestions(shuffled);
                    setTotalQuestions(shuffled.length || 10);
                }
            }`;

const search2 = `    useEffect(() => {
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
    }, [gameStatus, questions.length, gameId]);`;

const replace2 = `    useEffect(() => {
        if (gameStatus === "active" && questions.length === 0) {
            const fetchQuestions = async () => {
                const { data: game } = await supabase.from("games").select(\`
                    quiz_id, game_mode,
                    quizzes (board_path)
                \`).eq("id", gameId).single();

                if (game) {
                    const { data: qData } = await supabase.from("questions").select("*").eq("quiz_id", game.quiz_id);
                    if (qData) {
                        let shuffled = [...qData].sort(() => Math.random() - 0.5);
                        const quizData: any = Array.isArray(game.quizzes) ? game.quizzes[0] : game.quizzes;
                        const boardPath = quizData?.board_path as any[] || [];
                        const mode = game.game_mode || "classic";
                        
                        if ((mode === 'classic' || mode === 'race') && boardPath.length > 0) {
                            shuffled = shuffled.slice(0, boardPath.length);
                        }
                        
                        setQuestions(shuffled);
                    }
                }
            };
            fetchQuestions();
        }
    }, [gameStatus, questions.length, gameId]);`;

let updated = normalizedContent;

if (updated.indexOf(search1) === -1) {
    console.log("Search 1 not found");
} else {
    updated = updated.replace(search1, replace1);
    console.log("Search 1 replaced");
}

if (updated.indexOf(search2) === -1) {
    console.log("Search 2 not found");
} else {
    updated = updated.replace(search2, replace2);
    console.log("Search 2 replaced");
}

fs.writeFileSync(filepath, updated.replace(/\n/g, '\r\n'));
console.log("Done");
