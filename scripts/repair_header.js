const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/player/play/[gameId]/page.tsx';
const content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');

const insertIndex = lines.findIndex(l => l.includes('const miPuesto'));
if (insertIndex === -1) {
    console.error("Could not find const miPuesto");
    process.exit(1);
}

const headerBlock = `
    return (
        <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-y-auto relative font-sans custom-scrollbar select-none">
            {/* Header Mini - Progreso */}
            <div className="bg-white px-4 py-3 flex justify-between items-center z-10 sticky top-0 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="font-black text-xl text-transparent bg-clip-text bg-indigo-600 tracking-tight leading-none">StriveQuiz</div>
                    <button 
                        onClick={handleLeaveGame} 
                        className="bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white text-[10px] uppercase font-black px-2.5 py-1 rounded-lg border border-red-500/30 hover:border-red-500 transition-all duration-300 shadow-sm leading-none"
                    >
                        Salir
                    </button>
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Pregunta</span>
                    <span className="bg-indigo-600 text-white text-xs font-black px-2.5 h-7 flex items-center justify-center rounded-lg">{currentQuestionIdx + 1}/{questions.length}</span>
                </div>
            </div>
`;

// Insertamos después de la línea de miPuesto.
// miPuesto suele indexarse en lines[insertIndex], así que insertamos en insertIndex + 1.
lines.splice(insertIndex + 1, 0, headerBlock);

fs.writeFileSync(path, lines.join('\n'));
console.log("Repaired and injected header successfully!");
