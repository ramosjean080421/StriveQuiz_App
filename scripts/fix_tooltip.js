const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/game/[gameId]/board/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `{canControl && (
                                <button onClick={startGame} disabled={playerCount < 1} className="group relative px-8 py-3.5 bg-green-500 hover:bg-green-600 rounded-xl font-black shadow-lg text-lg transition-all hover:scale-[1.03] active:scale-95 border-2 border-green-400 overflow-hidden disabled:bg-gray-700 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:scale-100"
                                >
                                    <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1s_forwards]"></div>
                                    <span className="relative z-10 flex items-center gap-2">
                                        <span className="text-2xl">🚀</span> INICIAR
                                    </span>
                                </button>
                            )}`;

const replacement = `{canControl && (
                                <div className="relative group/tooltip">
                                    <button onClick={startGame} disabled={playerCount < 1} className="group relative px-8 py-3.5 bg-green-500 hover:bg-green-600 rounded-xl font-black shadow-lg text-lg transition-all hover:scale-[1.03] active:scale-95 border-2 border-green-400 overflow-hidden disabled:bg-gray-700 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:scale-100"
                                    >
                                        <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1s_forwards]"></div>
                                        <span className="relative z-10 flex items-center gap-2">
                                            <span className="text-2xl">🚀</span> INICIAR
                                        </span>
                                    </button>
                                    
                                    {playerCount < 1 && (
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover\/tooltip:opacity-100 transition-all duration-300 bg-slate-900/90 backdrop-blur-md text-white font-bold text-xs px-4 py-2 rounded-2xl shadow-2xl whitespace-nowrap pointer-events-none border border-white/10 flex items-center gap-1.5 animate-fade-in">
                                            <span className="text-base">💡</span> Debe haber mínimo 1 jugador
                                        </div>
                                    )}
                                </div>
                            )}`;

if (content.includes('onClick={startGame} disabled={playerCount < 1}')) {
    content = content.replace(target, replacement);
    console.log("Injected tooltip layout wrapper.");
} else {
    console.error("Could not find Target content to replace.");
}

fs.writeFileSync(path, content);
console.log("Tooltip successfully applied!");
