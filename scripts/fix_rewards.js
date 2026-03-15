const fs = require('fs');

// 1. Fix Builder - Remove Rewards Section
const builderPath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\builder\\page.tsx";
let builderContent = fs.readFileSync(builderPath, 'utf-8');

// Normalize for replacement
let builderNorm = builderContent.replace(/\r\n/g, '\n');

const builderSearch1 = `                    {/* Sección 2.5: Sistema de Recompensas */}
                    <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                <span className="text-lg">🎁</span> Sistema de Recompensas
                            </label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={rewardsEnabled} onChange={() => setRewardsEnabled(!rewardsEnabled)} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>

                        {rewardsEnabled && (
                            <div className="space-y-4 mt-4 p-4 border-2 border-dashed border-purple-200 rounded-xl bg-purple-50">
                                <div>
                                    <label className="block text-xs font-bold text-purple-900 mb-1">Racha requerida (Ej. 5 correctas seguidas)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={rewardCriteria}
                                        onChange={(e) => setRewardCriteria(Number(e.target.value))}
                                        className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-900 mb-1">Premio a mostrar en pantalla</label>
                                    <input
                                        type="text"
                                        value={rewardText}
                                        onChange={(e) => setRewardText(e.target.value)}
                                        placeholder="Ej. +10 Puntos ClassDojo"
                                        className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>`;

if (builderNorm.includes(builderSearch1)) {
    builderNorm = builderNorm.replace(builderSearch1, "");
    console.log("Builder UI modified: rewards removed");
} else {
    console.log("Search 1 builder UI not found");
}

const builderSearch2 = `                rewards_enabled: rewardsEnabled,
                reward_criteria: rewardCriteria,
                reward_text: rewardText`;

if (builderNorm.includes(builderSearch2)) {
    builderNorm = builderNorm.replace(builderSearch2, `                rewards_enabled: false,
                reward_criteria: 5,
                reward_text: ""`);
}

fs.writeFileSync(builderPath, builderNorm.replace(/\n/g, '\r\n'));



// 2. Fix Play Area - Skip Logic
const playPath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\player\\play\\[gameId]\\page.tsx";
let playContent = fs.readFileSync(playPath, 'utf-8');

let playNorm = playContent.replace(/\r\n/g, '\n');

// Update nextPos increment on streak
const streakSearch = `                    // Bonus de movimiento por racha de 4 (Universal: Classic, Race)
                    // Si las rachas están habilitadas y NO es modo Ludo, salta +3 extra
                    if (mode !== 'ludo' && dbStreaksEnabled && streaksEnabled && newStreak > 0 && newStreak % 4 === 0) {
                        nextPos += 3;
                        console.log("¡BONO DE RACHA! +3 casillas extra.");
                    }`;

const streakReplace = `                    // Bonus de movimiento por racha de 5 (Modo Classic/Race)
                    // Salto de 2 casillas en total (+1 extra al sumar normal) y se salta una pregunta
                    if (mode !== 'ludo' && dbStreaksEnabled && streaksEnabled && newStreak > 0 && newStreak % 5 === 0) {
                        nextPos += 1; 
                        console.log("¡BONO DE RACHA! +1 casilla extra y salto de pregunta.");
                    }`;

if (playNorm.includes(streakSearch)) {
    playNorm = playNorm.replace(streakSearch, streakReplace);
    console.log("Play streak advanced logic modified");
}

const timeoutSearch = `            if (currentQuestionIdx < questions.length - 1) {
                setCurrentQuestionIdx(prev => prev + 1);
            } else {
                setHasFinishedAll(true);
            }`;

const timeoutReplace = `            const skipQuestion = isCorrect && mode !== 'ludo' && dbStreaksEnabled && streaksEnabled && newStreak > 0 && newStreak % 5 === 0;

            if (skipQuestion && currentQuestionIdx < questions.length - 2) {
                setCurrentQuestionIdx(prev => prev + 2);
            } else if (currentQuestionIdx < questions.length - 1) {
                setCurrentQuestionIdx(prev => prev + 1);
            } else {
                setHasFinishedAll(true);
            }`;

if (playNorm.includes(timeoutSearch)) {
    playNorm = playNorm.replace(timeoutSearch, timeoutReplace);
    console.log("Play timeout skip index added");
}

fs.writeFileSync(playPath, playNorm.replace(/\n/g, '\r\n'));
console.log("Both files updated.");
