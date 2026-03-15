const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\player\\play\\[gameId]\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
const norm = content.replace(/\r\n/g, '\n');

// 1. Add questionDuration state declaration
const stateSearch = `    const [timeLeft, setTimeLeft] = useState(20);`;
const stateReplace = `    const [timeLeft, setTimeLeft] = useState(20);
    const [questionDuration, setQuestionDuration] = useState(20);`;

let stepContent = norm;
if (stepContent.includes(stateSearch)) {
    stepContent = stepContent.replace(stateSearch, stateReplace);
    console.log("State set.");
}

// 2. Add question_duration to fetches (initial and restart)
// Initial fetch
const fetchSearch1 = `            const { data: game } = await supabase.from("games").select(\`
                status, quiz_id, auto_end, streaks_enabled, game_mode, team_distribution_mode,
                quizzes (rewards_enabled, reward_criteria, reward_text, board_path, ludo_teams_count)`;

const fetchReplace1 = `            const { data: game } = await supabase.from("games").select(\`
                status, quiz_id, auto_end, streaks_enabled, game_mode, team_distribution_mode, question_duration,
                quizzes (rewards_enabled, reward_criteria, reward_text, board_path, ludo_teams_count)`;

if (stepContent.includes(fetchSearch1)) {
    stepContent = stepContent.replace(fetchSearch1, fetchReplace1);
}

// Submitting fetch
const fetchSearch2 = `const { data: gData } = await supabase.from("games").select("game_mode, boss_hp, auto_end, streaks_enabled").eq("id", gameId).single();`;
const fetchReplace2 = `const { data: gData } = await supabase.from("games").select("game_mode, boss_hp, auto_end, streaks_enabled, question_duration").eq("id", gameId).single();`;

if (stepContent.includes(fetchSearch2)) {
    stepContent = stepContent.replace(fetchSearch2, fetchReplace2);
}

// 3. Set local state inside fetchGame
const loadSearch = `                setGameStatus(game.status);
                setGameMode(game.game_mode as any || "classic");
                setStreaksEnabled(game.streaks_enabled !== false);`;

const loadReplace = `                setGameStatus(game.status);
                setGameMode(game.game_mode as any || "classic");
                setStreaksEnabled(game.streaks_enabled !== false);
                if (game.question_duration) {
                    setQuestionDuration(game.question_duration);
                    setTimeLeft(game.question_duration);
                }`;

if (stepContent.includes(loadSearch)) {
    stepContent = stepContent.replace(loadSearch, loadReplace);
}

// 4. Update the Reiniciar input in nueva pregunta
const resetSearch = `    useEffect(() => {
        setTimeLeft(20);
        setBlankAnswer("");`;

const resetReplace = `    useEffect(() => {
        setTimeLeft(questionDuration);
        setBlankAnswer("");`;

if (stepContent.includes(resetSearch)) {
    stepContent = stepContent.replace(resetSearch, resetReplace);
}

// 5. Update size sizing layout bar
const sizingSearch = `width: \`\${(timeLeft / 20) * 100}%\`,`;
const sizingReplace = `width: \`\${(timeLeft / questionDuration) * 100}%\`,`;

if (stepContent.includes(sizingSearch)) {
    stepContent = stepContent.replace(sizingSearch, sizingReplace);
    console.log("Layout bar adjusted.");
}

fs.writeFileSync(filepath, stepContent.replace(/\n/g, '\r\n'));
console.log("Done updating questions timer");
