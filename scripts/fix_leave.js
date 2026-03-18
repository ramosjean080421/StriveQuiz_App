const fs = require('fs');

const path = 'c:/Users/Jean/.gemini/antigravity/scratch/PrismaQuiz-app/src/app/player/play/[gameId]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove handleLeaveGame
const handleLeaveRegex = /const handleLeaveGame = async \(\) => \{[\s\S]*?\};\s*/;
if (handleLeaveRegex.test(content)) {
    content = content.replace(handleLeaveRegex, '');
    console.log("Removed handleLeaveGame method.");
}

// 2. Remove Button from Layout
const buttonRegex = /<button\s*onClick=\{handleLeaveGame\}[\s\S]*?<\/button>/;
if (buttonRegex.test(content)) {
    content = content.replace(buttonRegex, '');
    console.log("Removed Salir button from UI Header.");
}

// 3. Connect sendBeacon inside beforeunload effect
const targetEffect = `    // Sistema anti cerrado accidental
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if ((gameStatus === "active" || gameStatus === "paused") && !hasFinishedAll) {
                e.preventDefault();
                e.returnValue = ""; // Standard para navegadores modernos
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [gameStatus, hasFinishedAll]);`;

const replacementEffect = `    // Sistema anti cerrado accidental + descarga en base de datos
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if ((gameStatus === "active" || gameStatus === "paused") && !hasFinishedAll) {
                e.preventDefault();
                e.returnValue = ""; // Standard para navegadores modernos
            }
        };
        
        const handleUnload = () => {
             const savedPlayerId = localStorage.getItem("currentPlayerId");
             const savedSecret = localStorage.getItem("playerSecret");
             if (savedPlayerId && savedSecret) {
                  // sendBeacon es síncrono y se ejecuta en background tras el cierre
                  const data = JSON.stringify({ id: savedPlayerId, secret: savedSecret });
                  navigator.sendBeacon('/api/leave_player', data);
             }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("pagehide", handleUnload); // Para móviles y cierres limpios
        window.addEventListener("unload", handleUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("pagehide", handleUnload);
            window.removeEventListener("unload", handleUnload);
        };
    }, [gameStatus, hasFinishedAll]);`;

if (content.includes('// Sistema anti cerrado accidental')) {
    content = content.replace(targetEffect, replacementEffect);
    console.log("Injected sendBeacon listener on Close Tab.");
}

fs.writeFileSync(path, content);
console.log("Leave logic fully fixed!");
