const fs = require('fs');

const filepath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\game\\new\\page.tsx";
let content = fs.readFileSync(filepath, 'utf-8');
let norm = content.replace(/\r\n/g, '\n');

// 1. Restore states and remove playMode state triggers
const stateSearch = `    const [autoEnd, setAutoEnd] = useState(false);
    const [playMode, setPlayMode] = useState<'evaluacion' | 'didactico'>('evaluacion');`;

const stateReplace = `    const [autoEnd, setAutoEnd] = useState(false);
    const [enableGameTimer, setEnableGameTimer] = useState(false);
    const [enableQuestionTimer, setEnableQuestionTimer] = useState(true);`;

if (norm.includes(stateSearch)) {
    norm = norm.replace(stateSearch, stateReplace);
}

// 2. Remove playMode Toggle layout wrapper block completely
const removeSearch = `                    {/* Selector de Modo de Juego */}
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

if (norm.includes(removeSearch)) {
    norm = norm.replace(removeSearch, "");
}

// 3. Rewrite gameDuration with modular setup trigger toggle
const gameSearch = `                    {/* Duración de la Partida (Sólo si NO es Auto-finalizar) */}
                    {!autoEnd && playMode === 'evaluacion' && (
                        <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-2">
                            <label className="block text-left text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">
                                ⏳ Duración de la Partida (Minutos)
                            </label>
                            <input 
                                type="number" 
                                min="1" 
                                max="120"
                                value={gameDuration === 0 ? "" : gameDuration}
                                onChange={(e) => setGameDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    )}`;

const gameReplace = `                    {/* Duración de la Partida (Sólo si NO es Auto-finalizar) */}
                    {!autoEnd && (
                        <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-3">
                            <div onClick={() => setEnableGameTimer(!enableGameTimer)} className="flex items-center justify-between cursor-pointer px-1">
                                <span className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest">⏳ Activar Tiempo de Partida</span>
                                <div className={\`w-12 h-6 rounded-full p-1 flex items-center transition-colors \${enableGameTimer ? 'bg-indigo-500' : 'bg-gray-800'}\`}>
                                    <div className={\`w-4 h-4 bg-white rounded-full transition-transform \${enableGameTimer ? 'translate-x-6' : 'translate-x-0'}\`} />
                                </div>
                            </div>
                            {enableGameTimer && (
                                <input 
                                    type="number" 
                                    min="1" max="120"
                                    value={gameDuration === 0 ? "" : gameDuration}
                                    placeholder="Ingresa los minutos..."
                                    onChange={(e) => setGameDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            )}
                        </div>
                    )}`;

if (norm.includes(gameSearch)) {
    norm = norm.replace(gameSearch, gameReplace);
}

// 4. Rewrite questionDuration with modular trigger toggle setup
const questionSearch = `                    {/* Duración de la Pregunta (Para Todos) */}
                    {playMode === 'evaluacion' && (
                    <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-2">
                        <label className="block text-left text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">
                            ⏱️ Tiempo por Pregunta (Segundos)
                        </label>
                        <input 
                            type="number" 
                            min="5" 
                            max="120"
                            value={questionDuration === 0 ? "" : questionDuration}
                            onChange={(e) => setQuestionDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    )}`;

const questionReplace = `                    {/* Duración de la Pregunta */}
                    <div className="p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 space-y-3">
                        <div onClick={() => setEnableQuestionTimer(!enableQuestionTimer)} className="flex items-center justify-between cursor-pointer px-1">
                            <span className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest">⏱️ Activar Tiempo por Pregunta</span>
                            <div className={\`w-12 h-6 rounded-full p-1 flex items-center transition-colors \${enableQuestionTimer ? 'bg-indigo-500' : 'bg-gray-800'}\`}>
                                <div className={\`w-4 h-4 bg-white rounded-full transition-transform \${enableQuestionTimer ? 'translate-x-6' : 'translate-x-0'}\`} />
                            </div>
                        </div>
                        {enableQuestionTimer && (
                            <input 
                                type="number" 
                                min="5" max="120"
                                value={questionDuration === 0 ? "" : questionDuration}
                                placeholder="Ingresa los segundos..."
                                onChange={(e) => setQuestionDuration(e.target.value === "" ? 0 : Number(e.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-black focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        )}
                    </div>`;

if (norm.includes(questionSearch)) {
    norm = norm.replace(questionSearch, questionReplace);
}

// 5. Update insertData payload
const insertSearch = `            let insertData: any = {
                quiz_id: quizId,
                pin: pin,
                status: "waiting",
                auto_end: autoEnd,
                streaks_enabled: streaksEnabled,
                game_mode: gameMode,
                game_duration: (playMode === 'evaluacion' && !autoEnd) ? gameDuration : null,
                question_duration: playMode === 'evaluacion' ? questionDuration : 0
            };`;

const insertReplace = `            let insertData: any = {
                quiz_id: quizId,
                pin: pin,
                status: "waiting",
                auto_end: autoEnd,
                streaks_enabled: streaksEnabled,
                game_mode: gameMode,
                game_duration: (enableGameTimer && !autoEnd) ? gameDuration : null,
                question_duration: enableQuestionTimer ? questionDuration : 0
            };`;

if (norm.includes(insertSearch)) {
    norm = norm.replace(insertSearch, insertReplace);
}

fs.writeFileSync(filepath, norm.replace(/\n/g, '\r\n'));
console.log("Done refactoring modes into transparent setting toggles");
        
