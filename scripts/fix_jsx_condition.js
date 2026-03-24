const fs = require('fs');

const filePath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\builder\\page.tsx";
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const divIndex = lines.findIndex(line => line.includes('Sección 3: Instrucciones / Controles de Ruta'));
if (divIndex !== -1) {
    // Find the condition starting point, usually 5-6 lines after that comment index
    const conditionIndex = lines.findIndex((line, i) => i > divIndex && line.includes('{gameMode === \'memory\' ? ('));
    if (conditionIndex !== -1) {
        console.log("Found glitch at index:", conditionIndex);
        
        const restoredCondition = [
            "                        {gameMode === 'memory' ? (",
            "                            <div className=\"bg-amber-50 p-4 rounded-xl border border-amber-200\">",
            "                                <p className=\"text-xs text-amber-800 font-bold leading-relaxed\">",
            "                                    🧠 <strong>Modo Memoria:</strong> Pon a prueba tu retentiva. Al iniciar el juego se creará un tablero con cartas de preguntas y respuestas. ¡El alumno tendrá que encontrar todas las parejas antes de que se acabe el tiempo para ganar la máxima puntuación!",
            "                                </p>",
            "                            </div>",
            "                        ) : gameMode === 'roblox' ? (",
            "                            <div className=\"bg-red-50 p-4 rounded-xl border border-red-200\">",
            "                                <p className=\"text-xs text-red-800 font-bold leading-relaxed\">",
            "                                    🏝️ <strong>Modo Obby (Roblox):</strong> Tus alumnos jugarán en un entorno 3D, saltando de isla en isla. Tú verás la vista isométrica y ellos un teclado estilizado.",
            "                                </p>",
            "                            </div>",
            "                        ) : boardPath.length === 0 ? (",
            "                            <p className=\"text-xs text-indigo-700/80 dark:text-indigo-300 leading-relaxed font-medium bg-white/50 dark:bg-slate-700/50 p-3 rounded-xl border border-indigo-100 dark:border-slate-600\">",
            "                                Haz clic en el mapa para trazar los pasos. <strong>¡Tu primer clic será el inicio!</strong>",
            "                            </p>",
            "                        ) : (",
            "                            <div className=\"space-y-3\">",
            "                                <div className=\"flex items-center justify-between text-xs font-bold text-indigo-800 dark:text-indigo-300 bg-white/60 dark:bg-slate-700/60 px-3 py-2 rounded-xl border border-indigo-100 dark:border-slate-600\">",
            "                                    <span>Casillas:</span>",
            "                                    <span className=\"text-sm bg-indigo-600 text-white px-2.5 py-0.5 rounded-full\">{boardPath.length}</span>",
            "                                </div>",
            "                                <div className=\"grid grid-cols-2 gap-2 mt-2\">",
            "                                    <button onClick={handleUndo} className=\"p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs\">↩️ Deshacer</button>",
            "                                    <button onClick={() => setBoardPath([])} className=\"p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs\">🧨 Limpiar</button>",
            "                                </div>",
            "                            </div>"
        ];
        
        // lines[conditionIndex] is exactly line 379
        // lines[conditionIndex + 22] is lines[401] which has lines[conditionIndex+22] as the close part
        // We know indices 378 up to line 401 inclusive, let's find the `)}` exactly that matches the condition.
        let closeIndex = lines.findIndex((line, i) => i > conditionIndex && line.trim() === ')}');
        if (closeIndex !== -1) {
            console.log("Replacing from " + conditionIndex + " to " + closeIndex);
            lines.splice(conditionIndex, (closeIndex - conditionIndex + 1), ...restoredCondition);
            console.log("Restored JSX Condition correctly");
        } else {
            console.log("End of condition not found!");
        }
    } else {
        console.log("Condition start '{gameMode === \\'memory\\' ? (' not found!");
    }
} else {
    console.log("Section 3 not found");
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log("JSX Repair complete");
