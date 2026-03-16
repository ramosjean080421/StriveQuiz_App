const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\game\\new\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

// 1. Add playMode state
const stateSearch = `    const [autoEnd, setAutoEnd] = useState(false);`;
const stateReplace = `    const [autoEnd, setAutoEnd] = useState(false);
    const [playMode, setPlayMode] = useState<'evaluacion' | 'didactico'>('evaluacion');`;

if (norm.includes(stateSearch)) {
    norm = norm.replace(stateSearch, stateReplace);
}

// 2. Inject Toggle in UI
const layoutSearch = `<div className={\`space-y-4 mb-10 transition-opacity duration-300 \${dataLoaded ? 'opacity-100' : 'opacity-0'}\`}>`;
const layoutReplace = `<div className={\`space-y-4 mb-10 transition-opacity duration-300 \${dataLoaded ? 'opacity-100' : 'opacity-0'}\`}>
                    
                    {/* Selector de Modo de Juego */}
                    <div className="flex gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mb-6">
                        <button
                            type="button"
                            onClick={() => setPlayMode('evaluacion')}
                            className={\`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 \${playMode === 'evaluacion' ? 'bg-indigo-600 text-white shadow-lg scale-100' : 'text-gray-400 hover:bg-white/5 scale-95'}\`}
                        >
                            📊 MODO EVALUATIVO
                        </button>
                        <button
                            type="button"
                            onClick={() => setPlayMode('didactico')}
                            className={\`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 \${playMode === 'didactico' ? 'bg-purple-600 text-white shadow-lg scale-100' : 'text-gray-400 hover:bg-white/5 scale-95'}\`}
                        >
                            🧩 MODO DIDÁCTICO
                        </button>
                    </div>`;

if (norm.includes(layoutSearch)) {
    norm = norm.replace(layoutSearch, layoutReplace);
}

// 3. Hide Duration Inputs if didactico
const gameDurationSearch = `                    {/* Duración de la Partida (Sólo si NO es Auto-finalizar) */}
                    {!autoEnd && (`;
const gameDurationReplace = `                    {/* Duración de la Partida (Sólo si NO es Auto-finalizar) */}
                    {!autoEnd && playMode === 'evaluacion' && (`;

if (norm.includes(gameDurationSearch)) {
    norm = norm.replace(gameDurationSearch, gameDurationReplace);
}

const questionDurationSearch = `                    {/* Duración de la Pregunta (Para Todos) */}
                    <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-2">`;
const questionDurationReplace = `                    {/* Duración de la Pregunta (Para Todos) */}
                    {playMode === 'evaluacion' && (
                    <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-2">`;

if (norm.includes(questionDurationSearch)) {
    norm = norm.replace(questionDurationSearch, questionDurationReplace);
    // Add missing closing bracket at end of questionDuration box
    const endSearch = `                        />
                    </div>`;
    const endReplace = `                        />
                    </div>
                    )}`;
    if (norm.includes(endSearch)) {
        norm = norm.replace(endSearch, endReplace);
    }
}

// 4. Update the insertData Payload
const insertSearch = `            let insertData: any = {
                quiz_id: quizId,
                pin: pin,
                status: "waiting",
                auto_end: autoEnd,
                streaks_enabled: streaksEnabled,
                game_mode: gameMode,
                game_duration: !autoEnd ? gameDuration : null,
                question_duration: questionDuration
            };`;

const insertReplace = `            let insertData: any = {
                quiz_id: quizId,
                pin: pin,
                status: "waiting",
                auto_end: autoEnd,
                streaks_enabled: streaksEnabled,
                game_mode: gameMode,
                game_duration: (playMode === 'evaluacion' && !autoEnd) ? gameDuration : null,
                question_duration: playMode === 'evaluacion' ? questionDuration : 0
            };`;

if (norm.includes(insertSearch)) {
    norm = norm.replace(insertSearch, insertReplace);
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done preparing room switch modes UI configuration");
        
