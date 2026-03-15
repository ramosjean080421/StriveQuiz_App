const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\game\\[gameId]\\board\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

// 1. Add States
const stateSearch = `    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'ludo'>('classic');`;
const stateReplace = `    const [gameMode, setGameMode] = useState<'classic' | 'race' | 'ludo'>('classic');
    const [gameDuration, setGameDuration] = useState(0); 
    const [timeLeftSession, setTimeLeftSession] = useState(0);`;

if (norm.includes(stateSearch)) {
    norm = norm.replace(stateSearch, stateReplace);
}

// 2. Add question_duration and game_duration to fetching
const fetchSearch = `.select("pin, status, game_mode, quiz_id")`;
const fetchReplace = `.select("pin, status, game_mode, quiz_id, game_duration, auto_end")`;

if (norm.includes(fetchSearch)) {
    norm = norm.replace(fetchSearch, fetchReplace);
}

// 3. Set values inside fetchGameAndPerms
const setValsSearch = `                setPin(game.pin);
                setGameStatus(game.status);
                setGameMode(game.game_mode as 'classic' | 'race' | 'ludo' || 'classic');`;

const setValsReplace = `                setPin(game.pin);
                setGameStatus(game.status);
                setGameMode(game.game_mode as 'classic' | 'race' | 'ludo' || 'classic');
                if (game.game_duration && game.game_duration > 0 && !game.auto_end) {
                    setGameDuration(game.game_duration);
                    if (game.status === "active") {
                        setTimeLeftSession(game.game_duration * 60);
                    }
                }`;

if (norm.includes(setValsSearch)) {
    norm = norm.replace(setValsSearch, setValsReplace);
}

// 4. Update startGame to initialize timer
const startSearch = `    const startGame = async () => {
        const newStatus = "active";
        await supabase.from("games").update({ status: newStatus }).eq("id", gameId);`;

const startReplace = `    const startGame = async () => {
        const newStatus = "active";
        await supabase.from("games").update({ status: newStatus }).eq("id", gameId);
        if (gameDuration > 0) {
            setTimeLeftSession(gameDuration * 60);
        }`;

if (norm.includes(startSearch)) {
    norm = norm.replace(startSearch, startReplace);
}

// 5. Layout insertion timer next to Pin
const layoutSearch = `                    <div className="bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-2 rounded-xl shadow-lg border border-white/20 transform -rotate-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-0.5 leading-none">CÓDIGO:</p>
                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-widest drop-shadow-md">
                            {pin}
                        </h1>
                    </div>`;

const layoutReplace = `                    <div className="bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-2 rounded-xl shadow-lg border border-white/20 transform -rotate-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-0.5 leading-none">CÓDIGO:</p>
                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-widest drop-shadow-md">
                            {pin}
                        </h1>
                    </div>

                    {/* Master Timer Session */}
                    {gameStatus === "active" && timeLeftSession > 0 && (
                        <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-5 py-2 rounded-xl border border-indigo-400/30 backdrop-blur-md flex flex-col items-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-0.5">TIEMPO RESTANTE</p>
                            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-200">
                                {Math.floor(timeLeftSession / 60)}:{(timeLeftSession % 60).toString().padStart(2, '0')}
                            </h2>
                        </div>
                    )}`

if (norm.includes(layoutSearch)) {
    norm = norm.replace(layoutSearch, layoutReplace);
}

// 6. Append full decrement loop hooks to lines 100 index
const useSearch = `    }, [gameId]);`;
const useReplace = `    }, [gameId]);

    useEffect(() => {
        if (gameStatus !== "active" || timeLeftSession <= 0) return;

        const timer = setInterval(() => {
            setTimeLeftSession(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    finishGame(); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameStatus, timeLeftSession]);`;

if (norm.includes(useSearch)) {
    norm = norm.replace(useSearch, useReplace);
    console.log("Timer hooks added.");
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done updating board views master timer");
