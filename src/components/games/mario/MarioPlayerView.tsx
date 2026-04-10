"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface MarioPlayerViewProps {
    gameId: string;
    playerId: string;
    questions: any[];
    isBlurred?: boolean;
    onCheatDetected?: () => void;
}

export default function MarioPlayerView({ gameId, playerId, questions, isBlurred, onCheatDetected }: MarioPlayerViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'win'>('menu');
    const [isPaused, setIsPaused] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const overlayImgRef = useRef<HTMLImageElement>(null);

    // Nuevos estados para soportar todos los tipos de preguntas
    const [blankAnswer, setBlankAnswer] = useState("");
    const [userMatches, setUserMatches] = useState<Record<string, string>>({});
    const [shuffledMatchRight, setShuffledMatchRight] = useState<string[]>([]);

    // Modal de Preguntas
    const [activeQuestion, setActiveQuestion] = useState<any>(null);
    const [activeBlock, setActiveBlock] = useState<any>(null);

    useEffect(() => {
        if (activeQuestion) {
            setBlankAnswer("");
            setUserMatches({});
            if (activeQuestion.type === 'matching' && activeQuestion.matching_pairs) {
                const rights = activeQuestion.matching_pairs.map((p: any) => p.right);
                setShuffledMatchRight(rights.sort(() => Math.random() - 0.5));
            }
        }
    }, [activeQuestion]);

    useEffect(() => {
        const fetchAvatar = async () => {
            const { data } = await supabase.from('game_players').select('avatar_gif_url').eq('id', playerId).single();
            if (data?.avatar_gif_url) setAvatarUrl(data.avatar_gif_url);
        };
        if (playerId) fetchAvatar();
    }, [playerId]);

    useEffect(() => {
        if (isBlurred) {
            setIsPaused(true);
        } else if (gameState === 'playing' && !activeQuestion) {
            setIsPaused(false);
        }
    }, [isBlurred, gameState, activeQuestion]);

    // Anti-trampas interno (solo actúa si está jugando, ignora menús y win screen)
    useEffect(() => {
        if (gameState !== 'playing') return;

        const lock = () => onCheatDetected?.();

        const handleVisibilityChange = () => {
            if (document.hidden) lock();
        };
        const handleCheatAction = (e: Event) => {
            e.preventDefault();
            lock();
        };

        window.addEventListener("blur", lock);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("contextmenu", handleCheatAction);
        document.addEventListener("copy", handleCheatAction);
        document.addEventListener("cut", handleCheatAction);

        return () => {
            window.removeEventListener("blur", lock);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("contextmenu", handleCheatAction);
            document.removeEventListener("copy", handleCheatAction);
            document.removeEventListener("cut", handleCheatAction);
        };
    }, [gameState, onCheatDetected]);





    // Seleccionador de personaje
    const characters = [
        { name: 'Mario', color: '#E52521', overalls: '#2038E0', speed: 0.8, jumpPower: -12, gravity: 0.6 },
        { name: 'Luigi', color: '#00A800', overalls: '#2038E0', speed: 0.75, jumpPower: -13.5, gravity: 0.55 },
        { name: 'Toad', color: '#0000FF', overalls: '#FFFFFF', speed: 1.0, jumpPower: -11, gravity: 0.6 },
        { name: 'Peach', color: '#FFB6C1', overalls: '#FF1493', speed: 0.7, jumpPower: -11.5, gravity: 0.4 },
        { name: 'Wario', color: '#FFCE00', overalls: '#800080', speed: 0.7, jumpPower: -10.5, gravity: 0.7 }
    ];
    const [selectedCharId, setSelectedCharId] = useState(0);

    // Referencias mutables para el game loop
    const gameEngine = useRef<any>({});

    useEffect(() => {
        if (gameState !== 'playing' || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let audioCtx: AudioContext | null = null;
        
        // Cargar el Meme Gigante del jugador
        let headImg: HTMLImageElement | null = null;
        if (avatarUrl) {
            headImg = new Image();
            headImg.src = avatarUrl;
        }

        // Cachear las medidas del canvas para evitar llamar getBoundingClientRect 60 veces por segundo (causante del lag)
        let canvasMetrics = { rect: null as DOMRect | null, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
        function updateCanvasMetrics() {
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const windowAspect = rect.width / rect.height;
            const canvasAspect = canvas.width / canvas.height;
            let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;

            if (windowAspect > canvasAspect) {
                scaleY = rect.height / canvas.height;
                scaleX = scaleY;
                offsetX = (rect.width - canvas.width * scaleX) / 2;
            } else {
                scaleX = rect.width / canvas.width;
                scaleY = scaleX;
                offsetY = (rect.height - canvas.height * scaleY) / 2;
            }
            canvasMetrics = { rect, scaleX, scaleY, offsetX, offsetY };
        }
        updateCanvasMetrics();
        window.addEventListener('resize', updateCanvasMetrics);
        
        function initAudio() {
            if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }

        function playSound(type: string) {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            const now = audioCtx.currentTime;
            
            if (type === 'jump') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
            } else if (type === 'coin') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(987.77, now);
                osc.frequency.setValueAtTime(1318.51, now + 0.05);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
            } else if (type === 'die') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.5);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);
                osc.start(now); osc.stop(now + 0.5);
            } else if (type === 'pipe') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(300, now);
                for(let i=0; i<6; i++) {
                    osc.frequency.setValueAtTime(300 - i*30, now + i*0.05);
                }
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
            }
        }

        const keys: Record<string, boolean> = {
            ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
            KeyA: false, KeyD: false, KeyW: false, KeyS: false, Space: false,
            ShiftLeft: false, ShiftRight: false
        };

        const keydownHandler = (e: KeyboardEvent) => { initAudio(); if (keys.hasOwnProperty(e.code)) keys[e.code] = true; };
        const keyupHandler = (e: KeyboardEvent) => { if (keys.hasOwnProperty(e.code)) keys[e.code] = false; };
        window.addEventListener('keydown', keydownHandler);
        window.addEventListener('keyup', keyupHandler);

        const selChar = characters[selectedCharId];
        let player = {
            x: 50, y: 200, w: 30, h: 40,
            vx: 0, vy: 0, speed: selChar.speed, maxSpeed: 5, runSpeed: 9,
            friction: 0.85, jumpPower: selChar.jumpPower, gravity: selChar.gravity,
            grounded: false, color: selChar.color, overalls: selChar.overalls, lastDir: 1, invulnerable: 0,
            crouching: false, name: selChar.name
        };

        let particles: any[] = [];
        function spawnParticles(x: number, y: number, color: string, count: number) {
            for(let i=0; i<count; i++) {
                particles.push({
                    x: x, y: y,
                    vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 1) * 8,
                    life: Math.random() * 20 + 10, color: color
                });
            }
        }

        // Mapeamos los bloques con las preguntas reales estructuradas al 80/20 Superficie/Submundo
        const realQuestions = questions && questions.length > 0 ? questions : [
            { question_text: "¿Cuánto es 8 x 7?", options: ["54", "56", "62", "48"], correct_option_index: 1 }
        ];

        let genQBlocks = [];
        let genMountains = [];
        let genClouds = [];
        let genBushes = [];
        
        let overQsCount = Math.max(1, Math.ceil(realQuestions.length * 0.8));
        const overQs = realQuestions.slice(0, overQsCount);
        const underQs = realQuestions.slice(overQsCount);
        
        let startX = 400; // Primer cubo superficial
        let overMapLength = Math.max(3000, 600 + overQs.length * 550); 
        let warpEntranceX = startX + Math.floor(overQs.length / 2) * 550 + 200; // Tuberia escondida a medio camino

        for(let i=0; i<overQs.length; i++) {
            let px = startX + i * 550;
            // Si hay un warp justo aquí, movemos el bloque para que no tape el tubo
            if (Math.abs(px - warpEntranceX) < 100) px += 150; 
            
            let py = (i % 2 === 0) ? 230 : 160; 
            genQBlocks.push({ x: px, y: py, w: 40, h: 40, isQuestionBlock: true, used: false, qData: overQs[i] });
            
            if (i % 2 === 0) {
                genMountains.push({ x: px - 250, y: 350, w: 180 + Math.random()*80, h: 100 + Math.random()*50 });
            }
            if (i % 3 === 0) {
                genBushes.push({ x: px + 100, y: 350, scale: 0.8 + Math.random()*0.5 });
            }
        }
        
        // Agregar nubes de fondo
        for(let i=0; i<overMapLength; i+=400) {
            genClouds.push({ x: i, y: 30 + Math.random()*80, scale: 0.6 + Math.random()*0.6 });
        }
        
        // -------- SUBMUNDO SECRETO (20% DE LAS PREGUNTAS) --------
        let genUnderQBlocks = [];
        let underStartX = 300;
        let underMapLength = Math.max(1000, 400 + underQs.length * 400);

        for (let i = 0; i < underQs.length; i++) {
            genUnderQBlocks.push({ x: underStartX + i * 400, y: 200, w: 40, h: 40, isQuestionBlock: true, used: false, qData: underQs[i] });
        }
        // --------------------------------------------------------

        let levels: Record<string, any> = {
            overworld: {
                isCave: false,
                platforms: [
                    { x: -500, y: 350, w: 1500, h: 250 },
                    { x: 1100, y: 350, w: overMapLength + 1000, h: 250 },
                ],
                pipes: [
                     // Tubo inicial decorativo
                    { x: 600, y: 280, w: 60, h: 70, isWarp: false },
                    // Warp al submundo (solo se genera si hay preguntas para el submundo!)
                    ...(underQs.length > 0 ? [{ 
                        x: warpEntranceX, y: 260, w: 70, h: 90, isWarp: true, target: 'underground', destX: 100, destY: 50 
                    }] : []),
                    // Tubo de relleno más adelante
                    { x: startX + Math.floor(overQs.length*0.8)*550 + 200, y: 280, w: 60, h: 70, isWarp: false }
                ],
                clouds: genClouds,
                mountains: genMountains,
                bushes: genBushes,
                qBlocks: genQBlocks,
                flag: { x: Math.max(...genQBlocks.map(b => b.x), warpEntranceX) + 600, y: 50, w: 20, h: 300 }
            },
            underground: {
                isCave: true,
                platforms: [
                    { x: 0, y: 350, w: underMapLength + 500, h: 250 },
                    { x: -50, y: -200, w: 50, h: 600 }, // Pared tapón
                    { x: underMapLength + 450, y: -200, w: 50, h: 600 } // Pared tapón derecha
                ],
                pipes: [
                    // Warp de salida devolviendo al jugador exactamente a la entrada
                    { x: underMapLength + 200, y: 250, w: 70, h: 100, isWarp: true, target: 'overworld', destX: warpEntranceX + 150, destY: 50 },
                ],
                clouds: [], mountains: [], bushes: [],
                qBlocks: genUnderQBlocks,
                flag: null
            }
        };

        let currentActiveLevel = 'overworld';
        let currentLvl = levels[currentActiveLevel];

        function changeLevel(levelName: string, x: number, y: number) {
            playSound('pipe');
            currentActiveLevel = levelName;
            currentLvl = levels[levelName];
            player.x = x;
            player.y = y;
            player.vx = 0;
            player.vy = 0;
            player.crouching = false;
        }

        function triggerQuestion(block: any) {
            if(!block.qData) return;
            setIsPaused(true);
            setActiveBlock(block);
            setActiveQuestion(block.qData);
            // Quitamos teclas al pausar
            for(let key in keys) keys[key] = false;
        }

        function checkCollision(r1: any, r2: any) {
            return r1.x < r2.x + (r2.w || r2.r*2) && r1.x + r1.w > r2.x &&
                   r1.y < r2.y + (r2.h || r2.r*2) && r1.y + r1.h > r2.y;
        }

        // Exportar helpers al mundo React
        gameEngine.current = {
            resumeGame: (correct: boolean) => {
                setIsPaused(false);
                if(correct) {
                    playSound('coin'); 
                    if(activeBlock) spawnParticles(activeBlock.x + 20, activeBlock.y, '#FFCE00', 30);
                } else {
                    playSound('die');
                }
                setActiveQuestion(null);
                setActiveBlock(null);
            }
        };

        function update() {
            // Evaluamos estado desde state the React accediendo mediante un ref o un flag mutado, 
            // pero isPaused de React es asincrono. Usaremos un bypass.
            if(gameEngine.current.isPaused) return;

            if (player.invulnerable > 0) player.invulnerable--;

            let isRunning = keys.ShiftLeft || keys.ShiftRight;
            let currentMaxSpeed = isRunning ? player.runSpeed : player.maxSpeed;
            let currentAccel = isRunning ? 1.5 : player.speed;

            if (keys.ArrowLeft || keys.KeyA) { player.vx -= currentAccel; player.lastDir = -1; }
            if (keys.ArrowRight || keys.KeyD) { player.vx += currentAccel; player.lastDir = 1; }

            player.vx *= player.friction;
            if (player.vx > player.maxSpeed && !isRunning) player.vx = player.maxSpeed;
            if (player.vx < -player.maxSpeed && !isRunning) player.vx = -player.maxSpeed;
            if (Math.abs(player.vx) < 0.1) player.vx = 0;

            player.x += player.vx;

            let allSolids = [...currentLvl.platforms, ...currentLvl.qBlocks, ...(currentLvl.pipes || [])];
            for (let p of allSolids) {
                if (checkCollision(player, p)) {
                    if (player.vx > 0) { player.x = p.x - player.w; player.vx = 0; }
                    else if (player.vx < 0) { player.x = p.x + p.w; player.vx = 0; }
                }
            }

            player.vy += player.gravity;

            if ((keys.ArrowDown || keys.KeyS) && player.grounded) {
                player.crouching = true;
                // Buscar si estamos encima de un Warp pipe
                for (let p of (currentLvl.pipes || [])) {
                    if (p.isWarp && player.x > p.x && player.x + player.w < p.x + p.w && player.y + player.h <= p.y + 10) {
                        changeLevel(p.target, p.destX, p.destY);
                        keys.ArrowDown = false; keys.KeyS = false;
                        break;
                    }
                }
            } else {
                player.crouching = false;
            }

            if ((keys.ArrowUp || keys.KeyW || keys.Space) && player.grounded && !player.crouching) {
                player.vy = player.jumpPower; player.grounded = false; playSound('jump');
            }

            player.y += player.vy;
            player.grounded = false;

            for (let p of allSolids) {
                if (checkCollision(player, p)) {
                    if (player.vy > 0) { 
                        player.y = p.y - player.h; player.vy = 0; player.grounded = true; 
                    } else if (player.vy < 0) { 
                        player.y = p.y + p.h; player.vy = 0;
                        if ((p as any).isQuestionBlock && !(p as any).used) {
                            (p as any).used = true;
                            spawnParticles(p.x + p.w/2, p.y, '#FF9C00', 10);
                            triggerQuestion(p);
                        }
                    }
                }
            }

            // Partículas
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life--;
                if (p.life <= 0) particles.splice(i, 1);
            }

            if (currentLvl.flag && checkCollision(player, currentLvl.flag)) {
                setGameState('win');
            }
            if (player.y > (canvas?.height||400) + 100) {
                setLives(l => l - 1);
                player.x = 50; player.y = 100; player.vy = 0;
                playSound('die');
            }
        }

        function draw() {
            if(!ctx || !canvas) return;
            let cameraX = player.x - canvas.width / 2 + player.w / 2;
            if (cameraX < 0 && !currentLvl.isCave) cameraX = 0; // Detener la cámara al inicio, pero en cueva puede ser flexible

            // Fondo principal basado en el entorno
            if (currentLvl.isCave) {
                ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height); // Fondo de caverna oscuro
            } else {
                let skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
                skyGrad.addColorStop(0, '#3E76F2'); skyGrad.addColorStop(1, '#8AB3FF');
                ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.save();
            ctx.translate(-cameraX, 0);

            // Mountains (Colinas redondeadas clásicas)
            for (let m of currentLvl.mountains) {
                // Fondo de montaña
                let mGrad = ctx.createLinearGradient(m.x, m.y - m.h, m.x, m.y);
                mGrad.addColorStop(0, '#5CF45C'); mGrad.addColorStop(1, '#00A800');
                ctx.beginPath();
                ctx.ellipse(m.x + m.w / 2, m.y, m.w / 2, m.h, 0, Math.PI, Math.PI * 2);
                ctx.closePath();
                ctx.fillStyle = mGrad; ctx.fill();
                ctx.lineWidth = 3; ctx.strokeStyle = '#005500'; ctx.stroke();
                
                // Ojos clásicos de las colinas de Mario
                ctx.fillStyle = '#005500';
                ctx.beginPath(); ctx.ellipse(m.x + m.w / 2 - 12, m.y - m.h / 1.8, 3, 7, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(m.x + m.w / 2 + 12, m.y - m.h / 1.8, 3, 7, 0, 0, Math.PI * 2); ctx.fill();
            }

            // Bushes
            for (let b of currentLvl.bushes) {
                ctx.save();
                ctx.translate(b.x, b.y); ctx.scale(b.scale, b.scale);
                ctx.fillStyle = '#00A800';
                ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI, Math.PI * 2); ctx.arc(20, -10, 20, Math.PI, Math.PI * 2); ctx.arc(40, 0, 15, Math.PI, Math.PI * 2); ctx.closePath();
                ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#005500'; ctx.stroke();
                ctx.restore();
            }

            // Clouds (Move slowly with parallax)
            for (let c of currentLvl.clouds) {
                ctx.save();
                ctx.translate(c.x + (cameraX * 0.5), c.y); // Parallax invertido relativo a la cámara
                ctx.scale(c.scale, c.scale);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath(); ctx.arc(0, 0, 20, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(15, -10, 25, Math.PI, Math.PI * 2); ctx.arc(35, -5, 20, Math.PI, Math.PI * 2); ctx.arc(50, 0, 20, Math.PI * 1.5, Math.PI * 0.5); ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // FlagPole y Bandera
            if (currentLvl.flag) {
                ctx.fillStyle = '#A0A0A0'; ctx.fillRect(currentLvl.flag.x, currentLvl.flag.y, 8, currentLvl.flag.h);
                ctx.fillStyle = '#D8D8D8'; ctx.fillRect(currentLvl.flag.x + 2, currentLvl.flag.y, 3, currentLvl.flag.h);
                ctx.fillStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(currentLvl.flag.x, currentLvl.flag.y, 8, currentLvl.flag.h);
                ctx.fillStyle = '#FFCE00'; ctx.beginPath(); ctx.arc(currentLvl.flag.x + 4, currentLvl.flag.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#2038E0'; ctx.beginPath(); ctx.moveTo(currentLvl.flag.x, currentLvl.flag.y + 15); ctx.lineTo(currentLvl.flag.x - 40, currentLvl.flag.y + 25); ctx.lineTo(currentLvl.flag.x, currentLvl.flag.y + 35); ctx.closePath(); ctx.fill(); ctx.stroke();
            }

            // Pipes (Tuberías)
            for (let p of currentLvl.pipes) {
                let pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
                pipeGrad.addColorStop(0, '#00A800'); pipeGrad.addColorStop(0.5, '#5CF45C'); pipeGrad.addColorStop(1, '#005500');
                
                // Cuerpo
                ctx.fillStyle = pipeGrad; ctx.fillRect(p.x + 2, p.y + 20, p.w - 4, p.h - 20);
                ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeRect(p.x + 2, p.y + 20, p.w - 4, p.h - 20);
                // Cabeza
                ctx.fillRect(p.x - 2, p.y, p.w + 4, 20);
                ctx.strokeRect(p.x - 2, p.y, p.w + 4, 20);
            }

            // Solids (Platforms/Pisos)
            for(let p of currentLvl.platforms) {
                if (currentLvl.isCave) {
                    // Diseño Ladrillos Azules de Caverna
                    ctx.fillStyle = '#003399'; ctx.fillRect(p.x, p.y, p.w, p.h);
                    ctx.strokeStyle = '#001A4D'; ctx.lineWidth = 2;
                    for (let ix = 0; ix < p.w; ix += 30) {
                        for (let iy = 0; iy < p.h; iy += 15) {
                            ctx.strokeRect(p.x + ix + ((iy/15)%2===0?0:15), p.y + iy, 30, 15);
                        }
                    }
                    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeRect(p.x, p.y, p.w, p.h);
                } else {
                    // Diseño Ladrillos Terrestres Clásicos
                    ctx.fillStyle = '#C84C0C'; ctx.fillRect(p.x, p.y, p.w, p.h);
                    ctx.fillStyle = '#00A800'; ctx.fillRect(p.x, p.y, p.w, 15);
                    ctx.fillStyle = '#B33D07'; // Un marrón un poco más oscuro
                    for (let ix = 0; ix < p.w; ix += 30) {
                        for (let iy = 15; iy < p.h; iy += 30) {
                            if ((ix + iy) % 60 === 0) ctx.fillRect(p.x + ix, p.y + iy, 12, 12);
                        }
                    }
                    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeRect(p.x, p.y, p.w, p.h);
                    ctx.beginPath(); ctx.moveTo(p.x, p.y + 15); ctx.lineTo(p.x + p.w, p.y + 15); ctx.stroke();
                }
            }

            // QBlocks (Bloques de Pregunta 3D Style)
            for(let b of currentLvl.qBlocks) {
                if(b.used) {
                    ctx.fillStyle = '#8B4513'; ctx.fillRect(b.x, b.y, b.w, b.h);
                    ctx.strokeStyle = '#5E2805'; ctx.lineWidth = 3; ctx.strokeRect(b.x, b.y, b.w, b.h);
                    // Remache central
                    ctx.fillStyle = '#5E2805'; ctx.fillRect(b.x + b.w / 2 - 2, b.y + b.h / 2 - 2, 4, 4);
                    ctx.fillStyle = '#C27A4E'; ctx.fillRect(b.x, b.y, b.w, 4); ctx.fillRect(b.x, b.y, 4, b.h);
                } else {
                    let flash = Math.floor(Date.now() / 300) % 2 === 0;
                    ctx.fillStyle = flash ? '#FFCE00' : '#FF9C00';
                    ctx.fillRect(b.x, b.y, b.w, b.h);
                    
                    // Relieve 3D (Bordes superiores e izquierdos brillantes, lado oscuro)
                    ctx.fillStyle = '#FFF'; ctx.fillRect(b.x, b.y, b.w, 4); ctx.fillRect(b.x, b.y, 4, b.h);
                    ctx.fillStyle = '#D96E00'; ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4); ctx.fillRect(b.x + b.w - 4, b.y, 4, b.h);
                    
                    // Signo de interrogación interactivo
                    ctx.fillStyle = '#D96E00'; ctx.font = 'bold 26px "Arial Black", sans-serif'; 
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('?', b.x + b.w/2 + 2, b.y + b.h/2 + 2); // Sombra
                    ctx.fillStyle = flash ? '#FFF' : '#FFEAB3'; 
                    ctx.fillText('?', b.x + b.w/2, b.y + b.h/2);
                }
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
            }

            // Player Simple Drawing - Cabeza Cabezona Meme
            let drawY = player.crouching ? player.y + 15 : player.y; // Baja visualmente la cabeza si está agachado

            const headSize = player.w + 20; // Cabeza gigante meme
            const headOffset = (headSize - player.w) / 2;
            
            // Dibujamos el Overol en Canvas
            ctx.fillStyle = player.overalls; 
            ctx.fillRect(player.x, drawY + 25, player.w, player.h - (player.crouching ? 40 : 25));

            if (overlayImgRef.current && canvasMetrics.rect) {
                // Posicionar el GIF animado (DOM element) exactamente sobre el jugador usando las medidas cacheadas
                const { rect, scaleX, scaleY, offsetX, offsetY } = canvasMetrics;
                
                // Aplicamos parallax al x
                const headScreenX = (player.x - cameraX - headOffset) * scaleX + rect.left + offsetX;
                const headScreenY = (drawY - 18) * scaleY + rect.top + offsetY;
                
                overlayImgRef.current.style.transform = `translate(${headScreenX}px, ${headScreenY}px)`;
                overlayImgRef.current.style.width = `${headSize * scaleX}px`;
                overlayImgRef.current.style.height = `${headSize * scaleY}px`;
                overlayImgRef.current.style.display = 'block';
            } else {
                // Fallback de cuadro de colores
                ctx.fillStyle = player.color; ctx.fillRect(player.x, drawY, player.w, player.h/2);
            }

            // Particles
            for(let p of particles) { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); }

            ctx.restore();
        }

        function loop() {
            update();
            draw();
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('keydown', keydownHandler);
            window.removeEventListener('keyup', keyupHandler);
            window.removeEventListener('resize', updateCanvasMetrics);
        };
    }, [gameState, selectedCharId, avatarUrl]); // Reiniciar canvas si cambia de estado a playing o el character/avatar

    // Sincronizar pausa del loop
    useEffect(() => {
        if(gameEngine.current) gameEngine.current.isPaused = isPaused;
    }, [isPaused]);

    const handleAnswerQuestion = async (answerPayload: any) => {
        if(!activeQuestion) return;
        
        let isCorrect = false;
        if (!activeQuestion.type || activeQuestion.type === 'multiple_choice' || activeQuestion.type === 'true_false') {
            isCorrect = answerPayload === activeQuestion.correct_option_index;
        } else if (activeQuestion.type === 'fill_in_the_blank') {
            isCorrect = String(answerPayload).trim().toLowerCase() === String(activeQuestion.correct_answer || "").trim().toLowerCase();
        } else if (activeQuestion.type === 'matching') {
            if (activeQuestion.matching_pairs) {
                isCorrect = activeQuestion.matching_pairs.every((p:any) => answerPayload[p.left] === p.right);
            }
        }
        
        if (isCorrect) {
            setScore(prev => prev + 100);
            gameEngine.current.resumeGame(true);
            
            // Lógica para enviar a Supabase
            const { data: cur } = await supabase.from("game_players").select("score, correct_answers").eq("id", playerId).single();
            await supabase.from("game_players").update({
                score: (cur?.score || 0) + 100,
                correct_answers: (cur?.correct_answers || 0) + 1
            }).eq("id", playerId);

        } else {
            setLives(prev => {
                const newLives = prev - 1;
                if(newLives <= 0) setGameState('gameover');
                return newLives;
            });
            gameEngine.current.resumeGame(false);
            
            // Registrar fallo en base de datos
            const { data: cur } = await supabase.from("game_players").select("incorrect_answers").eq("id", playerId).single();
            await supabase.from("game_players").update({
                incorrect_answers: (cur?.incorrect_answers || 0) + 1
            }).eq("id", playerId);
        }
    };

    if (gameState === 'menu') {
        return (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-gray-900 to-black backdrop-blur-md overflow-hidden">
                {/* Estrellas/Particulas animadas de fondo */}
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(white 2px, transparent 2px)', backgroundSize: '40px 40px' }}></div>
                
                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 uppercase tracking-widest mb-4 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] filter text-center px-4">
                    ¿LISTO PARA CORRER?
                </h1>
                <p className="text-blue-300 flex items-center gap-2 font-bold tracking-[0.3em] uppercase text-sm mb-12">
                    <span>🍄</span> Aventura Plataformas <span>⭐</span>
                </p>

                {/* Avatar Preview Simple */}
                <div className="relative mb-12">
                    <div className="absolute inset-0 bg-yellow-400 blur-xl opacity-20 animate-pulse rounded-full"></div>
                    {avatarUrl ? (
                        <img 
                            src={avatarUrl} 
                            className="w-32 h-32 object-cover rounded-full border-4 border-white shadow-[0_0_30px_rgba(250,204,21,0.5)] relative z-10"
                        />
                    ) : (
                        <div className="w-32 h-32 bg-gray-800 rounded-full border-4 border-white/50 flex items-center justify-center text-4xl shadow-xl relative z-10">🤔</div>
                    )}
                </div>

                <button 
                    onClick={() => setGameState('playing')}
                    className="relative group w-64 h-16">
                    <div className="absolute inset-0 bg-emerald-400 rounded-2xl blur group-hover:blur-md transition-all opacity-50 pulse"></div>
                    <div className="absolute flex items-center justify-center w-full h-full bg-emerald-500 hover:bg-emerald-400 border-b-4 border-emerald-700 text-white text-2xl font-black uppercase tracking-[0.2em] rounded-2xl transition-all active:translate-y-1 active:border-b-0">
                        ¡A JUGAR!
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="relative w-[100vw] h-[100dvh] bg-gray-900 overflow-hidden flex items-center justify-center font-sans">
            <div className="absolute top-4 left-6 text-white font-black text-2xl z-10 drop-shadow-md border-2 border-white/20 bg-black/40 px-4 py-2 rounded-xl">
                SCORE: {score.toString().padStart(6, '0')}
            </div>
            
            <div className="absolute top-4 right-6 text-white font-black text-2xl z-10 drop-shadow-md border-2 border-white/20 bg-black/40 px-4 py-2 rounded-xl flex items-center gap-2">
                <span>❤️</span> x{lives}
            </div>

            <canvas 
                ref={canvasRef} 
                width={1200} 
                height={600} 
                className="w-full h-full bg-[#5C94FC] shadow-[0_0_80px_rgba(0,0,0,0.9)]"
                style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
            />
            
            {/* Superposición pura de DOM para Avatares GIF animados. */}
            <img 
                ref={overlayImgRef} 
                src={avatarUrl || ''} 
                className="absolute top-0 left-0 z-20 object-cover rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.8)] border-[3px] border-white pointer-events-none"
                style={{ display: 'none', willChange: 'transform' }} // Sincronizado dinámicamente desde Window AnimationFrame
            />

            <div className="absolute bottom-6 text-white/50 text-sm font-bold tracking-widest text-center w-full uppercase">
                Controles: WASD / Flechas. Shift para correr.
            </div>

            {/* Modal de Pregunta Interactivo */}
            {activeQuestion && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-blue-900 border-4 border-white rounded-[2rem] p-8 md:p-10 max-w-xl w-full shadow-[0_0_50px_rgba(59,130,246,0.5)] transform animate-bounce-short flex flex-col items-center">
                        
                        {/* Bloque de Pregunta Mario Style */}
                        <div className="relative w-20 h-20 bg-[#FF9C00] border-4 border-[#000] shadow-[inset_-4px_-4px_0_rgba(0,0,0,0.5),inset_4px_4px_0_rgba(255,255,255,0.7)] flex items-center justify-center mb-6">
                            {/* Remaches de las esquinas */}
                            <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-black" />
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-black" />
                            <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-black" />
                            <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-black" />
                            
                            {/* Signo de pregunta */}
                            <span className="text-[#FFEAB3] text-5xl font-black drop-shadow-[3px_3px_0_#D96E00]">?</span>
                        </div>
                        
                        <h2 className="text-2xl font-black text-white text-center mb-8 uppercase tracking-wider leading-snug w-full">
                            {activeQuestion.question_text}
                        </h2>

                        <div className="w-full flex-1">
                            {(!activeQuestion.type || activeQuestion.type === 'multiple_choice' || activeQuestion.type === 'true_false') && (
                                <div className="grid grid-cols-1 gap-3 w-full">
                                    {activeQuestion.options?.map((opt: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => handleAnswerQuestion(i)}
                                            className={`w-full text-left bg-blue-800 hover:bg-blue-700 active:bg-blue-600 border-2 border-blue-400 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-md active:scale-[0.98] ${activeQuestion.type === 'true_false' && (i===0 ? 'bg-emerald-600 border-emerald-400 hover:bg-emerald-500' : 'bg-red-600 border-red-400 hover:bg-red-500')}`}
                                        >
                                            {activeQuestion.type !== 'true_false' && (
                                                <span className="font-black text-blue-300 mr-3">
                                                    {['A', 'B', 'C', 'D'][i]}
                                                </span>
                                            )}
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeQuestion.type === 'fill_in_the_blank' && (
                                <div className="flex flex-col items-center justify-center gap-4 w-full">
                                    <input
                                        type="text"
                                        value={blankAnswer}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                handleAnswerQuestion((e.target as HTMLInputElement).value);
                                            }
                                        }}
                                        onChange={(e) => setBlankAnswer(e.target.value)}
                                        placeholder="Escribe aquí..."
                                        className="bg-blue-950 border-4 border-blue-400 text-white font-black text-xl p-4 rounded-xl w-full text-center outline-none focus:border-yellow-400 transition-colors uppercase"
                                    />
                                    <button
                                        disabled={!blankAnswer.trim()}
                                        onClick={() => handleAnswerQuestion(blankAnswer)}
                                        className="w-full py-4 rounded-xl bg-emerald-500 border-b-4 border-emerald-700 text-white font-black text-xl active:translate-y-1 active:border-b-0 transition-all disabled:opacity-50"
                                    >
                                        RESPONDER
                                    </button>
                                </div>
                            )}

                            {activeQuestion.type === 'matching' && activeQuestion.matching_pairs && (
                                <div className="flex flex-col w-full bg-blue-950 p-4 rounded-2xl border-2 border-blue-400 space-y-3">
                                    {activeQuestion.matching_pairs.map((p:any, i:number) => (
                                        <div key={i} className="flex flex-col sm:flex-row items-center gap-2 w-full">
                                            <div className="w-full sm:w-1/2 p-3 rounded-lg bg-indigo-600 text-white font-bold text-center text-sm">
                                                {p.left}
                                            </div>
                                            <select
                                                className="w-full sm:w-1/2 p-3 rounded-lg bg-amber-100 text-amber-900 border-2 border-amber-300 font-bold cursor-pointer outline-none focus:border-amber-500 appearance-none text-center text-sm"
                                                value={userMatches[p.left] || ""}
                                                onChange={(e) => setUserMatches({ ...userMatches, [p.left]: e.target.value })}
                                            >
                                                <option value="" disabled>-- --- --</option>
                                                {shuffledMatchRight.map((r, j) => (
                                                    <option key={j} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                    <button
                                        disabled={Object.keys(userMatches).length < activeQuestion.matching_pairs.length || Object.values(userMatches).some(v => !v)}
                                        onClick={() => handleAnswerQuestion(userMatches)}
                                        className="mt-4 w-full py-4 rounded-xl bg-emerald-500 border-b-4 border-emerald-700 text-white font-black text-xl active:translate-y-1 active:border-b-0 transition-all disabled:opacity-50"
                                    >
                                        COMPROBAR
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center">
                    <h1 className="text-7xl font-black text-red-500 uppercase tracking-widest animate-pulse mb-4 text-center">GAME OVER</h1>
                    <p className="text-white/50 mb-8 tracking-widest uppercase">Te quedaste sin vidas</p>
                    <button onClick={() => window.location.reload()} className="px-8 py-3 bg-red-600 text-white font-bold uppercase rounded-xl">Intentar de nuevo</button>
                </div>
            )}

            {gameState === 'win' && (
                <div className="absolute inset-0 bg-yellow-400/90 z-50 flex flex-col items-center justify-center backdrop-blur-md">
                    <h1 className="text-6xl sm:text-7xl font-black text-white drop-shadow-md uppercase tracking-widest mb-4 text-center">¡NIVEL COMPLETADO!</h1>
                    <p className="text-yellow-900 font-bold mb-8 tracking-widest uppercase text-xl drop-shadow-sm">Tus puntos: <span className="font-black">{score}</span></p>
                </div>
            )}
        </div>
    );
}
