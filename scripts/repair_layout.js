const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/game/[gameId]/board/page.tsx';
const content = fs.readFileSync(path, 'utf8');

// Buscaremos el bloque que quedó mocho.
// El error borró desde const url = \`${window.location.origin}/?pin=\${pin}\`; hasta el final del header o botones.
// Vamos a reconstruir el bloque de "Controles del Profesor" completo basándonos en Step 541.

const targetBroken = `                            <button
                                onClick={async () => {
                                    const newStatus = gameStatus === "active" ? "paused" : "active";`;

const correctBlock = `                    {gameStatus === "waiting" && (
                        <>
                            <button
                                onClick={() => {
                                    const url = \`\${window.location.origin}/?pin=\${pin}\`;
                                    navigator.clipboard.writeText(url);
                                    showToast("¡Enlace de invitación copiado!", "success");
                                }}
                                className="px-5 py-3 bg-[#4a5568] hover:bg-[#2d3748] rounded-2xl font-bold text-xs transition-all text-white border border-white/10 flex items-center gap-2 shadow-lg"
                            >
                                <span>🔗</span> Copiar Link de Invitación
                            </button>

                            {canControl && (
                                <div className="relative group/tooltip">
                                    <button onClick={startGame} disabled={playerCount < 1} className="group relative px-8 py-3.5 bg-green-500 hover:bg-green-600 rounded-xl font-black shadow-lg text-lg transition-all hover:scale-[1.03] active:scale-95 border-2 border-green-400 overflow-hidden disabled:bg-gray-700 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:scale-100 w-full"
                                    >
                                        <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full group-hover:animate-[shimmer_1s_forwards]"></div>
                                        <span className="relative z-10 flex items-center gap-2">
                                            <span className="text-2xl">🚀</span> INICIAR
                                        </span>
                                    </button>
                                    
                                    {playerCount < 1 && (
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/tooltip:opacity-100 transition-all duration-300 bg-slate-900/95 backdrop-blur-md text-white font-black text-[11px] px-4 py-2.5 rounded-2xl shadow-2xl whitespace-nowrap pointer-events-none border border-white/10 flex items-center gap-1.5 animate-bounce-short z-30">
                                            <span className="text-sm">💡</span> Debe haber mínimo 1 jugador
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {(gameStatus === "active" || gameStatus === "paused") && canControl && (
                        <>
                            <button
                                onClick={async () => {
                                    const newStatus = gameStatus === "active" ? "paused" : "active";`;

if (content.includes(targetBroken)) {
    const fullTarget = `                    {gameStatus === "waiting" && (
                        <>
                            <button
                                onClick={async () => {
                                    const newStatus = gameStatus === "active" ? "paused" : "active";`;
    // Wait, the target content became malformed.
    // Let's just SEARCH for the precise index to replace !
}

// Alternativa: Reconstruir desde el inicio de Controles del Profesor hasta the button.
const startSearch = `{/* Controles del Profesor */}`;
const endSearch = `const newStatus = gameStatus === "active" ? "paused" : "active";`;

const startIdx = content.indexOf(startSearch);
const endIdx = content.indexOf(endSearch);

if (startIdx !== -1 && endIdx !== -1) {
    console.log("Indices found:", startIdx, endIdx);
    const before = content.substring(0, startIdx + startSearch.length);
    const after = content.substring(endIdx);
    
    // El bloque que va en el medio
    const middle = `\n                <div className="flex items-center space-x-3 sm:space-x-4">\n` + correctBlock;
    
    fs.writeFileSync(path, before + middle + after);
    console.log("Repaired file layout successfully!");
} else {
    console.error("Could not find repair anchors.");
}
