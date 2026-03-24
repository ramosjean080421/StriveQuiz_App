const fs = require('fs');
const path = require('path');

const filePath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\builder\\page.tsx";
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Remove LudoGridPreview component
content = content.replace(/\/\/ --- COMPONENTE DE TABLERO LUDO PROCEDURAL[\s\S]*?const LudoGridPreview = \(\) => {[\s\S]*?<\/div>\s*?\);\s*?};/g, '');

// 2. Clear state variables back to original without "ludo"
content = content.replace(/const \[gameMode, setGameMode\] = useState<"classic" \| "race" \| "memory" \| "roblox" \| "bomb" \| "ludo">\("classic"\);/g, 'const [gameMode, setGameMode] = useState<"classic" | "race" | "memory" | "roblox" | "bomb">("classic");');

// 3. Remove state variables for ludo
content = content.replace(/const \[ludoTeamsCount, setLudoTeamsCount\] = useState[\s\S]*?finals: \{ red: \[\], blue: \[\], green: \[\], yellow: \[\] \}\s*\}\);/g, '');

// 4. Remove hooks in useEffect
content = content.replace(/setLudoTeamsCount\(qData\.ludo_teams_count \|\| 4\);[\s\S]*?setLudoPathData\(qData\.ludo_path_data\);[\s\S]*?}/g, '');

// 5. Simplify handleImageClick
content = content.replace(/if \(gameMode === 'ludo'\) \{[\s\S]*?\} else \{([\s\S]*?)\}/g, (match, p1) => {
    // Only apply if it's inside handleImageClick - we should use a more precise match if possible
    if (match.includes('currentData.bases.push')) {
        return p1.trim();
    }
    return match;
});

// 6. Simplify handleUndo
content = content.replace(/if \(gameMode === 'ludo'\) \{[\s\S]*?\} else \{([\s\S]*?)\}/g, (match, p1) => {
    if (match.includes('currentData.circuit.pop()')) {
        return p1.trim();
    }
    return match;
});

// 7. Remove payload items in handleSaveQuiz if applicable
content = content.replace(/ludo_teams_count: null,\s*ludo_path_data: null,/g, '');

// 8. Remove setLudoPathData from selector
content = content.replace(/setLudoPathData\(\{\s*bases: \[\],\s*circuit: \[\],\s*finals: \{ red: \[\], blue: \[\], green: \[\], yellow: \[\] \}\s*\}\);/g, '');

// 9. Remove Quantity of Teams section
content = content.replace(/\{\/\* Nueva sección: [\s\S]*?\{gameMode === 'ludo' && \([\s\S]*?<\/\w+>\s*\)\}\s*/g, '');

// 10. Update Selector de Escenario map condition
content = content.replace(/gameMode !== 'ludo' &&\s*/g, '');

// 11. Update Map filter
content = content.replace(/&& !m\.name\.toUpperCase\(\)\.includes\("LUDO"\)/g, '');

// 12. Update Instrucciones condition in title
content = content.replace(/gameMode === 'ludo' \? 'Configuración Mapa' : 'Trazar Ruta'/g, "'Trazar Ruta'");

// 13. Update Instrucciones contents
content = content.replace(/\{gameMode === 'ludo' \|\| gameMode === 'memory' \? \([\s\S]*?Modo Ludo Automático:[\s\S]*?<\/\w+>\s*\) : \s*/g, '{gameMode === \'memory\' ? (\n');
// Wait, this one above could be flaky depending on closing tags. Let's do it with split-lines or safer approach.

// Let's do a pure string split line manipulation for the tricky JSX parts.
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    // line 512: Instrucciones title condition
    if (lines[i].includes("gameMode === 'ludo' ? 'Configuración Mapa' : 'Trazar Ruta'")) {
        lines[i] = lines[i].replace("gameMode === 'ludo' ? 'Configuración Mapa' : 'Trazar Ruta'", "'Trazar Ruta'");
    }
    // line 568: Footer condition for ludo
    if (lines[i].includes("{gameMode === 'ludo' && (")) {
        lines[i] = "";
        lines[i+1] = "";
        lines[i+2] = "";
        lines[i+3] = "";
        lines[i+4] = ""; // remove the <p> block
    }
    // line 515: Instrucciones contents
    if (lines[i].includes("{gameMode === 'ludo' || gameMode === 'memory' ? (")) {
        lines[i] = lines[i].replace("{gameMode === 'ludo' || gameMode === 'memory' ? (", "{gameMode === 'memory' ? (");
        // Remove the inner branch that has Ludo Automático
        // Let's replace the whole block manually
    }
}

content = lines.join('\n');

// Specific simple string replacements
content = content.replace(`{gameMode === 'ludo' || gameMode === 'memory' ? (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                <p className="text-xs text-amber-800 font-bold leading-relaxed">
                                    {gameMode === 'memory' ? (
                                        <>🧠 <strong>Modo Memoria:</strong> Pon a prueba tu retentiva. Al iniciar el juego se creará un tablero con cartas de preguntas y respuestas. ¡El alumno tendrá que encontrar todas las parejas antes de que se acabe el tiempo para ganar la máxima puntuación!</>
                                    ) : (
                                        <>✨ <strong>Modo Ludo Automático:</strong> El tablero se generará por código siguiendo las reglas clásicas. No necesitas trazar ninguna ruta manualmente. ¡Todo está listo para jugar!</>
                                    )}
                                </p>
                            </div>
                        )`, `{gameMode === 'memory' ? (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                <p className="text-xs text-amber-800 font-bold leading-relaxed">
                                    🧠 <strong>Modo Memoria:</strong> Pon a prueba tu retentiva. Al iniciar el juego se creará un tablero con cartas de preguntas y respuestas. ¡El alumno tendrá que encontrar todas las parejas antes de que se acabe el tiempo para ganar la máxima puntuación!
                                </p>
                            </div>
                        )`);

content = content.replace(`{gameMode === 'ludo' ? (
                    <div className="relative z-10 w-full flex flex-col items-center gap-6 animate-fade-in-up">
                        <LudoGridPreview />
                        <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-6 py-3 rounded-2xl flex items-center gap-3">
                            <span className="text-2xl animate-bounce">🎲</span>
                            <span className="text-white font-black uppercase tracking-widest text-sm">Previsualización de Mapa Procedural</span>
                        </div>
                    </div>
                ) : gameMode === 'memory' ? (`, `{gameMode === 'memory' ? (`);

content = content.replace(`{/* SVG para dibujar líneas (Ruta) */}
                            {/* SVG de Rutas (Ludo segments) */}
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible">
                                <filter id="glow"><feGaussianBlur stdDeviation="2" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                {(() => {
                                    if ((gameMode as string) === 'ludo') {
                                        const lines: any[] = [];
                                        const drawArr = (arr: any[], color: string) => {
                                            for (let i = 1; i < arr.length; i++) {
                                                lines.push(<line key={\`\${color}-\${i}\`} x1={\`\${arr[i - 1].x}%\`} y1={\`\${arr[i - 1].y}%\`} x2={\`\${arr[i].x}%\`} y2={\`\${arr[i].y}%\`} stroke={color} strokeWidth="4" strokeDasharray="5,5" filter="url(#glow)" opacity="0.6" />);
                                            }
                                        };
                                        drawArr(ludoPathData.circuit, 'white');
                                        drawArr(ludoPathData.finals.red, '#ef4444');
                                        drawArr(ludoPathData.finals.blue, '#3b82f6');
                                        drawArr(ludoPathData.finals.green, '#10b981');
                                        drawArr(ludoPathData.finals.yellow, '#fbbf24');
                                        return lines;
                                    } else {
                                        return boardPath.map((coord, i) => {
                                            if (i === 0) return null;
                                            const prev = boardPath[i - 1];
                                            return <line key={\`line-\${i}\`} x1={\`\${prev.x}%\`} y1={\`\${prev.y}%\`} x2={\`\${coord.x}%\`} y2={\`\${coord.y}%\`} stroke="white" strokeWidth="6" strokeDasharray="12,12" filter="url(#glow)" opacity="0.8" />;
                                        });
                                    }
                                })()}
                            </svg>`, `{/* SVG para dibujar líneas (Ruta) */}
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible">
                                <filter id="glow"><feGaussianBlur stdDeviation="2" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                {boardPath.map((coord, i) => {
                                    if (i === 0) return null;
                                    const prev = boardPath[i - 1];
                                    return <line key={\`line-\${i}\`} x1={\`\${prev.x}%\`} y1={\`\${prev.y}%\`} x2={\`\${coord.x}%\`} y2={\`\${coord.y}%\`} stroke="white" strokeWidth="6" strokeDasharray="12,12" filter="url(#glow)" opacity="0.8" />;
                                })}
                            </svg>`);

// Fix the last layout ternary
content = content.replace(`{/* Casillas Renderizadas */}
                            {(gameMode as string) === 'ludo' ? (
                                <>
                                    {ludoPathData.bases.map((c: any, i: number) => {
                                        const colors = ["bg-red-500", "bg-blue-600", "bg-emerald-600", "bg-amber-500"];
                                        return <div key={\`base-\${i}\`} className={\`absolute w-12 h-12 -ml-6 -mt-6 rounded-2xl border-4 border-white z-20 shadow-xl \${colors[i]} flex items-center justify-center text-xl\`} style={{ left: \`\${c.x}%\`, top: \`\${c.y}%\` }}>🏠</div>
                                    })}
                                    {ludoPathData.circuit.map((c: any, i: number) => (
                                        <div key={\`circ-\${i}\`} className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-white/20 border-2 border-white/50 z-10 flex items-center justify-center text-[8px] font-black text-white" style={{ left: \`\${c.x}%\`, top: \`\${c.y}%\` }}>{i}</div>
                                    ))}
                                    {Object.entries(ludoPathData.finals).map(([color, points]: [string, any]) =>
                                        points.map((c: any, i: number) => {
                                            const bg = color === 'red' ? 'bg-red-500/50' : color === 'blue' ? 'bg-blue-500/50' : color === 'green' ? 'bg-emerald-500/50' : 'bg-amber-500/50';
                                            return <div key={\`final-\${color}-\${i}\`} className={\`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full \${bg} border border-white/30 z-10 flex items-center justify-center text-[8px] font-black text-white\`} style={{ left: \`\${c.x}%\`, top: \`\${c.y}%\` }}>🎯</div>
                                        })
                                    )}
                                </>
                            ) : (`, `{/* Casillas Renderizadas */}
                            (`);

// Need to remove the trailing bracket for the ternary if we removed the condition
content = content.replace(`                                })
                            )}
                        </div>`, `                                })
                            )}
                        </div>`);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Clean up finished");
