const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/player/play/[gameId]/page.tsx';
const content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');

// 1. Encontrar y borrar el duplicado mal hecho en lineas 135-150
const duplicateStart = lines.findIndex(l => l.includes('const handleUnload = () =>'));
const duplicateEnd = lines.findIndex(l => l.includes("window.addEventListener('unload', handleUnload)"));

if (duplicateStart !== -1 && duplicateEnd !== -1 && duplicateStart > 100) {
    console.log(`Found duplicate from index ${duplicateStart} to ${duplicateEnd}`);
    // Borramos desde duplicateStart hasta duplicateEnd
    lines.splice(duplicateStart, duplicateEnd - duplicateStart + 1);
    console.log("Deleted duplicate handleUnload from lower effect.");
}

// 2. Modificar el efecto del tope (antiguo Sistema anti cerrado accidental)
const topEffectStart = lines.findIndex(l => l.includes('// Sistema anti cerrado accidental'));
const topEffectEnd = lines.findIndex((l, i) => i > topEffectStart && l.includes('}, [gameStatus, hasFinishedAll]);'));

if (topEffectStart !== -1 && topEffectEnd !== -1) {
    const newEffect = `    // Sistema anti cerrado accidental + descarga descarga datos
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if ((gameStatus === "active" || gameStatus === "paused") && !hasFinishedAll) {
                e.preventDefault();
                e.returnValue = ""; 
            }
        };

        const handleUnload = () => {
             const savedPlayerId = localStorage.getItem("currentPlayerId");
             const savedSecret = localStorage.getItem("playerSecret");
             if (savedPlayerId && savedSecret) {
                  const data = JSON.stringify({ id: savedPlayerId, secret: savedSecret });
                  fetch('/api/leave_player', {
                      method: 'POST',
                      keepalive: true,
                      headers: { 'Content-Type': 'application/json' },
                      body: data
                  });
             }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("pagehide", handleUnload);
        window.addEventListener("unload", handleUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("pagehide", handleUnload);
            window.removeEventListener("unload", handleUnload);
        };
    }, [gameStatus, hasFinishedAll]);`;

    lines.splice(topEffectStart, topEffectEnd - topEffectStart + 1, newEffect);
    console.log("Injected updated composite effect at top.");
}

fs.writeFileSync(path, lines.join('\n'));
console.log("Composite Unload fully deployed!");
