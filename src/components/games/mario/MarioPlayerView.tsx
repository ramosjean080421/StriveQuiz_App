"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as Ably from "ably";

interface MarioPlayerViewProps {
    gameId: string;
    playerId: string;
    questions: any[];
    isBlurred?: boolean;
    onCheatDetected?: () => void;
    difficulty?: number;
    isGrupal?: boolean;
    theme?: 'overworld' | 'castle';
}

export default function MarioPlayerView({ gameId, playerId, questions, isBlurred, onCheatDetected, difficulty = 1, isGrupal = false, theme = 'overworld' }: MarioPlayerViewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    
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
            } else if (type === 'yoshi_jump') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.linearRampToValueAtTime(600, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
            } else if (type === 'yoshi_spawn') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500, now);
                osc.frequency.linearRampToValueAtTime(800, now + 0.1);
                osc.frequency.linearRampToValueAtTime(600, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
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

        // --- MULTIPLAYER GHOSTS SETUP ---
        const ghostsRef = { current: {} as Record<string, any> };
        const ghostMemes: Record<string, HTMLImageElement> = {};
        let realtimeChannel: Ably.RealtimeChannel | null = null;
        let ablyClient: Ably.Realtime | null = null;
        let syncTimer = 0;

        if (isGrupal && gameId) {
            ablyClient = new Ably.Realtime({ key: process.env.NEXT_PUBLIC_ABLY_KEY! });
            realtimeChannel = ablyClient.channels.get(`mario_sync_${gameId}`);
            realtimeChannel.subscribe('player_move', (msg: Ably.Message) => {
                const gdata = msg.data;
                if (gdata && gdata.id !== playerId) {
                    ghostsRef.current[gdata.id] = { ...ghostsRef.current[gdata.id], ...gdata };
                    if (gdata.avatarUrl && !ghostMemes[gdata.id]) {
                        const img = new Image();
                        img.src = gdata.avatarUrl;
                        ghostMemes[gdata.id] = img;
                    }
                }
            });
        }

        // Cache positions para delta checking de realtime
        let lastSentPos = { x: -1, y: -1, lastDir: 0, crouching: false };


        const keys: Record<string, boolean> = {
            ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
            KeyA: false, KeyD: false, KeyW: false, KeyS: false, Space: false,
            ShiftLeft: false, ShiftRight: false, KeyE: false
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
            crouching: false, name: selChar.name,
            canDoubleJump: false, hasDoubleJumped: false,
            streak: 0, hasYoshi: false, flutterTimer: 0, tongueActive: 0
        };

        let particles: any[] = [];
        let floatingTexts: any[] = [];
        
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
        let genEnemies: any[] = [];
        const diff = difficulty; // 0=Práctica, 1=Normal, 2=Extremo
        
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

        // --- GENERACIÓN DE ENEMIGOS BASADA EN LONGITUD TOTAL DEL MAPA ---
        // 1 goomba por segmento (cada 280px) a lo largo del mapa completo.
        const overEnemyEnd = Math.max(...genQBlocks.map((b: any) => b.x), warpEntranceX) + 500;
        const overEnemySpacing = 280;
        let segIdx = 0;
        for (let ex = 200; ex < overEnemyEnd; ex += overEnemySpacing) {
            // Alternamos dirección para variedad
            const dir = segIdx % 2 === 0 ? -1 : 1;
            genEnemies.push({ type: 'goomba', x: ex + 60, y: 305, w: 45, h: 45, vx: dir * 1, dir });
            // Koopa en segmentos alternos si dificultad >= Normal
            if (diff >= 1 && segIdx % 2 !== 0) {
                genEnemies.push({ type: 'koopa', x: ex + 60, y: 295, w: 40, h: 55, vx: -1.5, dir: -1 });
            }
            // Bill bala cada 3 segmentos si dificultad Extremo
            if (diff >= 2 && segIdx % 3 === 0) {
                genEnemies.push({ type: 'bill', x: ex + overEnemySpacing * 2, y: 180 + (Math.random()*100 - 50), w: 60, h: 45, vx: -4, dir: -1 });
            }
            segIdx++;
        }
        
        // Agregar nubes de fondo
        for(let i=0; i<overMapLength; i+=400) {
            genClouds.push({ x: i, y: 30 + Math.random()*80, scale: 0.6 + Math.random()*0.6 });
        }
        
        // -------- SUBMUNDO SECRETO (20% DE LAS PREGUNTAS) --------
        let genUnderQBlocks = [];
        let genUnderEnemies: any[] = [];
        let underStartX = 300;
        let underMapLength = Math.max(1000, 400 + underQs.length * 400);

        for (let i = 0; i < underQs.length; i++) {
            genUnderQBlocks.push({ x: underStartX + i * 400, y: 200, w: 40, h: 40, isQuestionBlock: true, used: false, qData: underQs[i] });
        }
        // Enemigos del submundo: 1 goomba cada 250px a lo largo de todo el submundo
        for (let ex = underStartX - 50; ex < underMapLength + 100; ex += 250) {
            const dir = Math.floor(ex / 250) % 2 === 0 ? -1 : 1;
            genUnderEnemies.push({ type: 'goomba', x: ex + 60, y: 305, w: 45, h: 45, vx: dir * 1, dir });
        }
        // -------- CASTILLO DE LAVA DE BOWSER --------
        let genCastleQBlocks = [];
        let genCastleEnemies: any[] = [];
        let genLavaPits: any[] = [];
        let genCastlePlatforms: any[] = [];
        let genLavaBubbles: any[] = [];
        
        let castleStartX = 300;
        let minQuestionsLength = 600 + realQuestions.length * 500;
        
        let currentX = -500;
        // Plataforma inicial segura para el jugador (evita que aparezca flotando o sobre un foso)
        let firstPlatW = 1200;
        genCastlePlatforms.push({ x: currentX, y: 350, w: firstPlatW, h: 250 });
        currentX += firstPlatW;

        while (currentX < minQuestionsLength + 1000) {
            let gap = 150 + Math.random() * 150;
            let platW = 400 + Math.random() * 500;
            
            genLavaPits.push({ x: currentX, y: 450, w: gap, h: 150 });
            
            // Un solo Podoboo justo en el centro del charco de lava
            genLavaBubbles.push({ type: 'podoboo', x: currentX + gap/2 - 15, y: 480 + Math.random() * 20, w: 30, h: 40, vx: 0, timer: Math.random() * 200 });

            
            currentX += gap;
            genCastlePlatforms.push({ x: currentX, y: 350, w: platW, h: 250 });
            currentX += platW;
        }
        
        let finalCastleX = currentX - 300; // Colocar la bandera sobre la última plataforma sólida

        
        for (let i = 0; i < realQuestions.length; i++) {
            let px = castleStartX + i * 500; // distribuidos en plataformas
            
            // Si cae en foso de lava, lo movemos
            let isInGap = false;
            for (let pit of genLavaPits) {
                if (px >= pit.x && px <= pit.x + pit.w) { px = pit.x + pit.w + 50; isInGap = true; break; }
            }
            
            genCastleQBlocks.push({ x: px, y: 200, w: 40, h: 40, isQuestionBlock: true, used: false, qData: realQuestions[i] });
            genCastleEnemies.push({ type: 'goomba', x: px + 100, y: 305, w: 45, h: 45, vx: Math.random() > 0.5 ? 1 : -1, dir: 1 });
            if (i % 3 === 0) {
                genCastleEnemies.push({ type: 'drybones', x: px + 250, y: 295, w: 40, h: 55, vx: -1.5, dir: -1 });
            }
        }
        
        // Agregar enemigos fuego al pool
        genCastleEnemies.push(...genLavaBubbles);
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
                enemies: genEnemies,
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
                enemies: genUnderEnemies,
                flag: null
            },
            castle: {
                isCave: false,
                isCastle: true,
                platforms: genCastlePlatforms,
                pipes: [],
                lavaPits: genLavaPits,
                clouds: [], mountains: [], bushes: [],
                qBlocks: genCastleQBlocks,
                enemies: genCastleEnemies,
                flag: { x: finalCastleX, y: 50, w: 80, h: 300 } // Bowser door o hacha
            }
        };

        let currentActiveLevel = theme === 'castle' ? 'castle' : 'overworld';
        let currentLvl = levels[currentActiveLevel];

        // Cache de sólidos (se reconstruye solo al cambiar de nivel, no en cada frame)
        let cachedSolids: any[] = [];
        function rebuildSolidsCache() {
            cachedSolids = [...currentLvl.platforms, ...currentLvl.qBlocks, ...(currentLvl.pipes || [])];
        }
        rebuildSolidsCache();

        function changeLevel(levelName: string, x: number, y: number) {
            playSound('pipe');
            currentActiveLevel = levelName;
            currentLvl = levels[levelName];
            player.x = x;
            player.y = y;
            player.vx = 0;
            player.vy = 0;
            player.crouching = false;
            rebuildSolidsCache(); // Reconstruir cache al cambiar de nivel
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
                    
                    player.streak += 1;
                    if (player.streak >= 3 && !player.hasYoshi) {
                        player.hasYoshi = true;
                        player.streak = 0;
                        playSound('yoshi_spawn');
                        spawnParticles(player.x + 15, player.y + 20, '#00FF00', 50);
                        floatingTexts.push({ text: '¡YOSHI!', x: player.x, y: player.y - 60, color: '#00FF00', life: 80 });
                    }
                } else {
                    playSound('die');
                    player.streak = 0;
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
            if (player.flutterTimer > 0) {
                player.flutterTimer--;
                if (player.flutterTimer <= 0) player.gravity = selChar.gravity; // Restore gravity
            }

            let isRunning = keys.ShiftLeft || keys.ShiftRight;
            let currentMaxSpeed = isRunning ? player.runSpeed : player.maxSpeed;
            let currentAccel = isRunning ? 1.5 : player.speed;

            if (currentLvl.winFlagTimer) {
                currentLvl.winFlagTimer++;
                player.vx = 2; // Animar al jugador caminando hacia el castillo
                player.crouching = false;
                
                if (currentLvl.flag.flagY === undefined) currentLvl.flag.flagY = currentLvl.flag.y + 15;
                if (currentLvl.flag.flagY < currentLvl.flag.y + currentLvl.flag.h - 30) currentLvl.flag.flagY += 3;
                
                if (currentLvl.winFlagTimer > 120) {
                    setGameState('win');
                }
            } else {
                if (keys.ArrowLeft || keys.KeyA) { player.vx -= currentAccel; player.lastDir = -1; }
                if (keys.ArrowRight || keys.KeyD) { player.vx += currentAccel; player.lastDir = 1; }
            }

            player.vx *= player.friction;
            if (player.vx > player.maxSpeed && !isRunning) player.vx = player.maxSpeed;
            if (player.vx < -player.maxSpeed && !isRunning) player.vx = -player.maxSpeed;
            if (Math.abs(player.vx) < 0.1) player.vx = 0;

            player.x += player.vx;

            // Usar cachedSolids en vez de recrear el array cada frame
            for (let p of cachedSolids) {
                if (checkCollision(player, p)) {
                    if (player.vx > 0) { player.x = p.x - player.w; player.vx = 0; }
                    else if (player.vx < 0) { player.x = p.x + p.w; player.vx = 0; }
                }
            }

            player.vy += player.gravity;

            if (!currentLvl.winFlagTimer) {
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

                // Salto simple: al estar en el suelo
                if ((keys.ArrowUp || keys.KeyW || keys.Space) && player.grounded && !player.crouching) {
                    player.vy = player.jumpPower; player.grounded = false;
                    player.canDoubleJump = true; player.hasDoubleJumped = false;
                    playSound(player.hasYoshi ? 'yoshi_jump' : 'jump');
                    keys.ArrowUp = false; keys.KeyW = false; keys.Space = false;
                }
                
                // --- LENGUA YOSHI ---
                if (keys.KeyE && player.hasYoshi && player.tongueActive === 0) {
                    player.tongueActive = 20; //frames de lengua duracion
                    playSound('coin'); 
                    keys.KeyE = false;
                }
                
                if (player.tongueActive > 0) {
                    player.tongueActive--;
                    let tW = (20 - Math.abs(player.tongueActive - 10)) * 6; // Crece hasta 60px y encoge
                    let tongueRect = {
                        x: player.lastDir === 1 ? player.x + player.w : player.x - tW,
                        y: player.y + 10,
                        w: tW,
                        h: 20
                    };
                    
                    for (let e of currentLvl.enemies) {
                        if (!e.dead && !e.beingEaten && !e.collapsed && e.type !== 'podoboo' && checkCollision(tongueRect, e)) {
                            e.beingEaten = true;
                            e.vx = 0; 
                            e.vy = 0;
                        }
                    }
                }
                
                // Doble salto / Flutter jump: al presionar jump mientras está en el aire
                else if ((keys.ArrowUp || keys.KeyW || keys.Space) && !player.grounded && player.canDoubleJump && !player.hasDoubleJumped) {
                    player.hasDoubleJumped = true;
                    player.canDoubleJump = false;
                    
                    if (player.hasYoshi) {
                        player.vy = player.jumpPower * 0.9;
                        player.gravity = selChar.gravity * 0.45; // Flutter hover effect
                        player.flutterTimer = 25;
                        playSound('yoshi_jump');
                        spawnParticles(player.x + 15, player.y + 40, '#FFFFFF', 10);
                    } else {
                        player.vy = player.jumpPower * 0.85; // Ligeramente menos potente
                        playSound('jump');
                        spawnParticles(player.x + 15, player.y + 40, '#FFFFFF', 5);
                    }
                    keys.ArrowUp = false; keys.KeyW = false; keys.Space = false;
                }
            }

            // Resetear doble salto al aterrizar
            if (player.grounded) {
                player.canDoubleJump = true;
                player.hasDoubleJumped = false;
            }

            player.y += player.vy;
            player.grounded = false;

            for (let p of cachedSolids) {
                if (checkCollision(player, p)) {
                    if (player.vy > 0) { 
                        player.y = p.y - player.h; player.vy = 0; player.grounded = true; 
                    } else if (player.vy < 0) { 
                        player.y = p.y + p.h; player.vy = 0;
                        if ((p as any).isQuestionBlock && !(p as any).used) {
                            (p as any).used = true;
                            spawnParticles(p.x + p.w/2, p.y, '#FF9C00', 10);
                            triggerQuestion(p);
                            rebuildSolidsCache(); // el bloque cambió estado, refrescar
                        }
                    }
                }
            }

            // Update y Colisiones Enemigos
            if (currentLvl.enemies) {
                // Radio de activación: solo procesar enemigos cercanos al jugador
                const ACTIVE_RADIUS = 900;
                let hasDead = false;
                for (let e of currentLvl.enemies) {
                    if (e.dead) continue;
                    // Culling espacial: enemigos lejanos se congelan (sin IA ni colisiones)
                    if (Math.abs(e.x - player.x) > ACTIVE_RADIUS) continue;

                    if (e.beingEaten) {
                        // Jalar rápidamente hacia la boca de Yoshi y encoger
                        let mouthX = player.lastDir === 1 ? player.x + player.w : player.x;
                        let mouthY = player.y + 10;
                        e.x += (mouthX - e.x) * 0.4;
                        e.y += (mouthY - e.y) * 0.4;
                        e.w = Math.max(0, e.w - 5); 
                        e.h = Math.max(0, e.h - 5);
                        
                        // Si llega a la boca o desaparece
                        if (Math.abs(e.x - mouthX) < 15 || e.w === 0) {
                            e.dead = true;
                            hasDead = true; 
                            playSound('coin');
                            setScore(prev => prev + 50);
                        }
                        continue;
                    }

                    if (e.type === 'podoboo') {
                        if (e.baseY === undefined) e.baseY = e.y;
                    } else if (e.type !== 'bill') {
                        e.grounded = false;
                        e.vy = (e.vy || 0) + player.gravity;
                    }

                    e.x += e.vx;

                    if (e.type !== 'bill' && e.type !== 'podoboo') {
                        let hitWall = false;
                        for (let p of cachedSolids) {
                            if (checkCollision({ x: e.x, y: e.y + 2, w: e.w, h: e.h - 4 }, p)) {
                                if (e.vx > 0) { e.x = p.x - e.w; hitWall = true; }
                                else if (e.vx < 0) { e.x = p.x + p.w; hitWall = true; }
                            }
                        }
                        if (hitWall) { e.vx *= -1; e.dir *= -1; e.timer = 0; }
                    } else if (e.type === 'bill') {
                        if (e.x < player.x - 600) {
                            e.x = player.x + 800 + Math.random() * 400;
                            e.y = 120 + Math.random() * 100; // Siempre vuela medio/alto, independiente del jugador
                            if (e.y < 50) e.y = 50;
                        }
                    }

                    if (e.type === 'podoboo') {
                        e.y = e.baseY - Math.abs(Math.sin((e.timer || 0) * 0.04)) * 320;
                    } else {
                        e.y += e.vy || 0;
                    }

                    if (e.type !== 'bill' && e.type !== 'podoboo') {
                        for (let p of cachedSolids) {
                            if (checkCollision(e, p)) {
                                if (e.vy > 0) { e.y = p.y - e.h; e.vy = 0; e.grounded = true; }
                                else if (e.vy < 0) { e.y = p.y + p.h; e.vy = 0; }
                            }
                        }
                    }

                    // Detección de caída al vacío (solo cuando está en el suelo)
                    if (e.type !== 'bill' && e.type !== 'podoboo' && e.grounded) {
                        const lookX = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
                        const probeRect = { x: lookX, y: e.y + e.h + 1, w: 8, h: 10 };
                        let groundAhead = false;
                        for (let p of cachedSolids) {
                            if (checkCollision(probeRect, p)) { groundAhead = true; break; }
                        }
                        if (!groundAhead) { e.vx *= -1; e.dir *= -1; e.timer = 0; }
                    }
                    if (e.collapsed) {
                        e.collapseTimer--;
                        if (e.collapseTimer <= 0) {
                            e.collapsed = false;
                            e.vx = e.dir * 1.5;
                        }
                    }

                    if (!e.timer) e.timer = 0;
                    e.timer++;

                    if (!player.invulnerable && checkCollision(player, e) && !e.collapsed) {
                        if (player.vy > 0 && player.y + player.h < e.y + e.h * 0.5 && e.type !== 'podoboo') {
                            if (e.type === 'drybones') {
                                e.collapsed = true;
                                e.collapseTimer = 300;
                                e.vx = 0;
                                player.vy = -8;
                                playSound('jump');
                                setScore(prev => prev + 10);
                                floatingTexts.push({ text: 'CRUNCH!', x: e.x, y: e.y - 10, color: '#FFFFFF', life: 60 });
                            } else {
                                e.dead = true; hasDead = true;
                                player.vy = -10;
                                playSound('jump');
                                setScore(prev => prev + 20);
                                floatingTexts.push({ text: '+20', x: e.x + e.w/2 - 15, y: e.y, life: 60 });
                                for(let j=0; j<15; j++) {
                                    particles.push({ x: e.x + e.w/2, y: e.y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, color: '#FFCE00', life: 30 });
                                }
                            }
                        } else {
                            if (player.hasYoshi) {
                                player.hasYoshi = false;
                                player.streak = 0;
                                player.invulnerable = 60;
                                player.vy = -8;
                                playSound('die'); // Yoshi perdido
                                spawnParticles(player.x, player.y, '#00FF00', 30);
                            } else {
                                player.invulnerable = 60;
                                setScore(prev => {
                                    const newScore = Math.max(0, prev - 80);
                                    floatingTexts.push({ text: '-80', x: player.x, y: player.y - 10, color: '#FF0000', life: 80 });
                                    return newScore;
                                });
                                playSound('die');
                                player.vy = -8;
                                player.vx = -player.lastDir * 5;
                            }
                        }
                    }
                }
                // Filtrar muertos solo si murió alguno este frame
                if (hasDead) currentLvl.enemies = currentLvl.enemies.filter((e:any) => !e.dead);
            }

            if (player.x < 0) player.x = 0;

            // --- MULTIPLAYER GHOST SYNC ---
            if (isGrupal && realtimeChannel) {
                syncTimer++;
                // 1) Reducimos la frecuencia de envío a un 33% 
                // (~15 ticks = de 10 msg/s bajamos a ~4 msg/s)
                if (syncTimer > 60) {
                    syncTimer = 0;
                    
                    // 2) Delta Threshold: No enviar NADA si el jugador está completamente quieto 
                    const dx = Math.abs(player.x - lastSentPos.x);
                    const dy = Math.abs(player.y - lastSentPos.y);
                    const posChanged = dx > 2 || dy > 2; // toleramos vibraciones minúsculas
                    const stateChanged = player.crouching !== lastSentPos.crouching || player.lastDir !== lastSentPos.lastDir;
                    
                    if (posChanged || stateChanged) {
                        lastSentPos = { x: player.x, y: player.y, crouching: player.crouching, lastDir: player.lastDir };
                        realtimeChannel.publish('player_move', {
                            id: playerId,
                            x: player.x,
                            y: player.y,
                            crouching: player.crouching,
                            lastDir: player.lastDir
                        }).catch(() => {});
                    }
                }
            }

            // Partículas
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life--;
                if (p.life <= 0) particles.splice(i, 1);
            }

            // Textos Flotantes
            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                floatingTexts[i].y -= 1.5;
                floatingTexts[i].life--;
                if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
            }

            if (currentLvl.flag && checkCollision(player, currentLvl.flag)) {
                if (!currentLvl.winFlagTimer) currentLvl.winFlagTimer = 1;
            }
            if (player.y > (canvas?.height||400) + 100) {
                // Caída al vacío: respawn, sin penalización, pero en castillo te mata Yoshi
                player.x = 50; player.y = 100; player.vy = 0;
                player.canDoubleJump = false; player.hasDoubleJumped = false;
                if (player.hasYoshi) {
                    player.hasYoshi = false;
                    player.streak = 0;
                }
                playSound('die');
            }
        }

        // Cachear gradiente del cielo para no recrearlo en cada frame
        let skyGradCache: CanvasGradient | null = null;
        let lastCanvasHeight = -1;

        function draw() {
            if(!ctx || !canvas) return;
            let cameraX = player.x - canvas.width / 2 + player.w / 2;
            if (cameraX < 0 && !currentLvl.isCave) cameraX = 0;

            // Viewport para culling (con margen ampliado)
            const vpLeft  = cameraX - 200;
            const vpRight = cameraX + canvas.width + 200;

            // Fondo principal
            if (currentLvl.isCave) {
                ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (currentLvl.isCastle) {
                if (!skyGradCache || canvas.height !== lastCanvasHeight) {
                    skyGradCache = ctx.createLinearGradient(0, 0, 0, canvas.height);
                    skyGradCache.addColorStop(0, '#2b0000'); skyGradCache.addColorStop(1, '#880000');
                    lastCanvasHeight = canvas.height;
                }
                ctx.fillStyle = skyGradCache; ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Castle columns background (parallax)
                ctx.save();
                ctx.fillStyle = '#1a0000';
                for(let c=0; c<canvas.width + 200; c+=300) {
                    let colX = c - (cameraX * 0.3) % 300;
                    ctx.fillRect(colX, 0, 100, canvas.height);
                    ctx.fillStyle = '#110000'; ctx.fillRect(colX, 0, 15, canvas.height); ctx.fillRect(colX + 85, 0, 15, canvas.height);
                    ctx.fillStyle = '#1a0000'; // restore
                }
                ctx.restore();
            } else {
                if (!skyGradCache || canvas.height !== lastCanvasHeight) {
                    skyGradCache = ctx.createLinearGradient(0, 0, 0, canvas.height);
                    skyGradCache.addColorStop(0, '#3E76F2'); skyGradCache.addColorStop(1, '#8AB3FF');
                    lastCanvasHeight = canvas.height;
                }
                ctx.fillStyle = skyGradCache; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.save();
            ctx.translate(-cameraX, 0);

            // Mountains — solo las visibles en cámara
            for (let m of currentLvl.mountains) {
                if (m.x + m.w < vpLeft || m.x - m.w > vpRight) continue;
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

            // Bushes — solo visibles
            for (let b of currentLvl.bushes) {
                if (b.x + 80 < vpLeft || b.x - 80 > vpRight) continue;
                ctx.save();
                ctx.translate(b.x, b.y); ctx.scale(b.scale, b.scale);
                ctx.fillStyle = '#00A800';
                ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI, Math.PI * 2); ctx.arc(20, -10, 20, Math.PI, Math.PI * 2); ctx.arc(40, 0, 15, Math.PI, Math.PI * 2); ctx.closePath();
                ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#005500'; ctx.stroke();
                ctx.restore();
            }

            // Clouds — parallax, visibilidad aproximada
            for (let c of currentLvl.clouds) {
                const cloudScreenX = c.x + (cameraX * 0.5);
                if (cloudScreenX + 120 < vpLeft || cloudScreenX - 120 > vpRight) continue;
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
                
                let renderFlagY = currentLvl.flag.flagY !== undefined ? currentLvl.flag.flagY : currentLvl.flag.y + 15;
                ctx.fillStyle = '#2038E0'; ctx.beginPath(); ctx.moveTo(currentLvl.flag.x, renderFlagY); ctx.lineTo(currentLvl.flag.x - 40, renderFlagY + 10); ctx.lineTo(currentLvl.flag.x, renderFlagY + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
            }

            // Pipes — solo visibles
            for (let p of currentLvl.pipes) {
                if (p.x + p.w < vpLeft || p.x > vpRight) continue;
                let pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
                pipeGrad.addColorStop(0, '#00A800'); pipeGrad.addColorStop(0.5, '#5CF45C'); pipeGrad.addColorStop(1, '#005500');
                
                // Cuerpo
                ctx.fillStyle = pipeGrad; ctx.fillRect(p.x + 2, p.y + 20, p.w - 4, p.h - 20);
                ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeRect(p.x + 2, p.y + 20, p.w - 4, p.h - 20);
                // Cabeza
                ctx.fillRect(p.x - 2, p.y, p.w + 4, 20);
                ctx.strokeRect(p.x - 2, p.y, p.w + 4, 20);
            }

            // Solids — solo visibles (las plataformas son enormes, clampear al viewport)
            for(let p of currentLvl.platforms) {
                const drawX = Math.max(p.x, vpLeft);
                const drawW = Math.min(p.x + p.w, vpRight) - drawX;
                if (drawW <= 0) continue;
                if (currentLvl.isCastle) {
                    ctx.fillStyle = '#6e1d1d'; ctx.fillRect(p.x, p.y, p.w, p.h);
                    ctx.fillStyle = '#4a0c0c';
                    for (let ix = 0; ix < p.w; ix += 40) {
                        for (let iy = 0; iy < p.h; iy += 40) {
                            ctx.strokeRect(p.x + ix, p.y + iy, 40, 40);
                            ctx.fillRect(p.x + ix + 4, p.y + iy + 4, 32, 32);
                        }
                    }
                    ctx.fillStyle = '#2b0000';
                    for (let iRand = 0; iRand < p.w; iRand += 120) {
                        ctx.fillRect(p.x + iRand + 10, p.y + 10, 8, 8);
                    }
                    ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.strokeRect(p.x, p.y, p.w, p.h);
                    // Add lava detail on top
                    ctx.fillStyle = '#FF4500'; ctx.fillRect(p.x, p.y, p.w, 3);
                } else if (currentLvl.isCave) {
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

            // Lava Pits
            if (currentLvl.lavaPits) {
                let lavaAnim = Math.sin(Date.now() / 200) * 5;
                for (let l of currentLvl.lavaPits) {
                    if (l.x + l.w < vpLeft || l.x > vpRight) continue;
                    let lGrad = ctx.createLinearGradient(0, l.y, 0, l.y + l.h);
                    lGrad.addColorStop(0, '#FF4500'); lGrad.addColorStop(1, '#8B0000');
                    ctx.fillStyle = lGrad;
                    // Draw bubbling top
                    ctx.beginPath();
                    ctx.moveTo(l.x, l.y + l.h);
                    ctx.lineTo(l.x, l.y + 10 + lavaAnim);
                    for (let lx = l.x; lx < l.x + l.w; lx += 20) {
                        ctx.lineTo(lx + 10, l.y + (lx % 40 === 0 ? 5 - lavaAnim : 15 + lavaAnim));
                    }
                    ctx.lineTo(l.x + l.w, l.y + l.h);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            // QBlocks — solo visibles
            for(let b of currentLvl.qBlocks) {
                if (b.x + b.w < vpLeft || b.x > vpRight) continue;
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

            // Enemigos — solo los visibles en cámara
            if (currentLvl.enemies) {
                for (let e of currentLvl.enemies) {
                    if (e.x + e.w < vpLeft || e.x > vpRight) continue;
                    if (e.type === 'goomba') {
                        let animTimer = e.timer || 0;
                        let bounce = Math.sin(animTimer * 0.2) * 2.5;
                        ctx.save();
                        ctx.translate(e.x, e.y + bounce);
                        
                        let wPhase = Math.sin(animTimer * 0.3);
                        // Zapatos - Más curvos y grandes
                        ctx.fillStyle = "#222";
                        ctx.beginPath(); ctx.ellipse(e.w*0.25, e.h - 5 + wPhase*2, e.w*0.35, 6, 0, 0, Math.PI*2); ctx.fill();
                        ctx.beginPath(); ctx.ellipse(e.w*0.75, e.h - 5 - wPhase*2, e.w*0.35, 6, 0, 0, Math.PI*2); ctx.fill();
                    
                        // Tallo
                        ctx.fillStyle = "#FFC88F"; 
                        ctx.beginPath(); 
                        if (ctx.roundRect) ctx.roundRect(e.w*0.3, e.h*0.5, e.w*0.4, e.h*0.4, 6);
                        else ctx.rect(e.w*0.3, e.h*0.5, e.w*0.4, e.h*0.4); 
                        ctx.fill();
                        ctx.strokeStyle = "#8A4E1B"; ctx.lineWidth=2; ctx.stroke();
                        
                        // Cabeza - Mejor forma de hongo y gradiente suave
                        let hGrad = ctx.createRadialGradient(e.w*0.3, e.h*0.2, e.w*0.1, e.w*0.5, e.h*0.4, e.w*0.8);
                        hGrad.addColorStop(0, "#E05A00"); hGrad.addColorStop(1, "#542300");
                        ctx.fillStyle = hGrad; 
                        ctx.beginPath();
                        ctx.moveTo(e.w*0.1, e.h*0.65);
                        ctx.bezierCurveTo(-e.w*0.3, e.h*0.1, e.w*1.3, e.h*0.1, e.w*0.9, e.h*0.65);
                        ctx.bezierCurveTo(e.w*0.8, e.h*0.75, e.w*0.2, e.h*0.75, e.w*0.1, e.h*0.65);
                        ctx.fill();
                        ctx.strokeStyle = "#3A1800"; ctx.lineWidth=2; ctx.stroke();
                    
                        // Ojos y Cejas más expresivos
                        ctx.fillStyle = "white";
                        ctx.beginPath(); ctx.ellipse(e.w*0.35, e.h*0.4, e.w*0.1, e.h*0.12, 0, 0, Math.PI*2); ctx.fill();
                        ctx.beginPath(); ctx.ellipse(e.w*0.65, e.h*0.4, e.w*0.1, e.h*0.12, 0, 0, Math.PI*2); ctx.fill();
                    
                        ctx.fillStyle = "black";
                        let ex = e.dir > 0 ? 1.5 : -1.5;
                        ctx.beginPath(); ctx.ellipse(e.w*0.35 + ex, e.h*0.4, e.w*0.04, e.h*0.06, 0, 0, Math.PI*2); ctx.fill();
                        ctx.beginPath(); ctx.ellipse(e.w*0.65 + ex, e.h*0.4, e.w*0.04, e.h*0.06, 0, 0, Math.PI*2); ctx.fill();
                    
                        // Cejas gruesas
                        ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.lineCap = "round";
                        ctx.beginPath(); ctx.moveTo(e.w*0.2, e.h*0.25); ctx.lineTo(e.w*0.4, e.h*0.35); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(e.w*0.8, e.h*0.25); ctx.lineTo(e.w*0.6, e.h*0.35); ctx.stroke();
                    
                        // Colmillos
                        ctx.fillStyle = "white";
                        ctx.beginPath(); ctx.moveTo(e.w*0.35, e.h*0.55); ctx.lineTo(e.w*0.45, e.h*0.68); ctx.lineTo(e.w*0.5, e.h*0.55); ctx.fill();
                        ctx.beginPath(); ctx.moveTo(e.w*0.65, e.h*0.55); ctx.lineTo(e.w*0.55, e.h*0.68); ctx.lineTo(e.w*0.5, e.h*0.55); ctx.fill();
                        ctx.strokeStyle = "#542300"; ctx.lineWidth=1;
                        ctx.beginPath(); ctx.moveTo(e.w*0.35, e.h*0.55); ctx.lineTo(e.w*0.45, e.h*0.68); ctx.lineTo(e.w*0.5, e.h*0.55); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(e.w*0.65, e.h*0.55); ctx.lineTo(e.w*0.55, e.h*0.68); ctx.lineTo(e.w*0.5, e.h*0.55); ctx.stroke();
                    
                        ctx.restore();
                    } else if (e.type === 'drybones') {
                        let animTimer = e.timer || 0;
                        if (e.collapsed) {
                            // Draw pile of bones
                            ctx.save();
                            ctx.translate(e.x + e.w/2, e.y + e.h); // Bottom anchor
                            // A shake animation exactly before reassembling
                            let shake = (e.collapseTimer < 40) ? Math.sin(e.collapseTimer * 0.8) * 3 : 0;
                            ctx.translate(shake, 0);

                            ctx.fillStyle = "#EAEAEA";
                            ctx.strokeStyle = "#444"; ctx.lineWidth = 2;
                            
                            // Skull base
                            ctx.beginPath(); ctx.ellipse(-10, -5, 10, 8, -Math.PI/6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                            // Ribcage 
                            ctx.beginPath(); ctx.ellipse(5, -8, 12, 6, Math.PI/12, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                            // Bone arm 1
                            ctx.beginPath(); ctx.roundRect(-20, -4, 15, 4, 2); ctx.fill(); ctx.stroke();
                            // Bone arm 2
                            ctx.beginPath(); ctx.roundRect(5, -4, 12, 4, 2); ctx.fill(); ctx.stroke();

                            ctx.restore();
                        } else {
                            let bounce = Math.sin(animTimer * 0.25) * 1.5;
                            ctx.save();
                            ctx.translate(e.x + e.w/2, e.y + bounce + e.h/2);
                            ctx.scale(e.dir < 0 ? -1 : 1, 1);
                            ctx.translate(-e.w/2, -e.h/2);
                            
                            // Zapatos grises
                            ctx.fillStyle = "#777";
                            let wPhase = Math.sin(animTimer * 0.4);
                            ctx.beginPath(); ctx.ellipse(e.w*0.3, e.h-5 + wPhase*2, 6, 4, 0, 0, Math.PI*2); ctx.fill();
                            ctx.beginPath(); ctx.ellipse(e.w*0.7, e.h-5 - wPhase*2, 6, 4, 0, 0, Math.PI*2); ctx.fill();
                        
                            // Shell de hueso
                            ctx.fillStyle = "#EAEAEA";
                            ctx.beginPath(); 
                            ctx.moveTo(e.w*0.2, e.h*0.9);
                            ctx.bezierCurveTo(-e.w*0.4, e.h*0.8, -e.w*0.2, e.h*0.2, e.w*0.4, e.h*0.3);
                            ctx.bezierCurveTo(e.w*0.4, e.h*0.8, e.w*0.3, e.h*0.9, e.w*0.2, e.h*0.9);
                            ctx.fill();
                            ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.stroke();
                            
                            // Costillas (cuerpo)
                            ctx.fillStyle = "#AAA"; // Background dark for ribs
                            ctx.beginPath(); 
                            if(ctx.roundRect) ctx.roundRect(e.w*0.3, e.h*0.4, e.w*0.4, e.h*0.5, 5); 
                            else ctx.rect(e.w*0.3, e.h*0.4, e.w*0.4, e.h*0.5);
                            ctx.fill();
                            // Dibujar las costillas horizontales
                            ctx.fillStyle = "#FFF";
                            for(let ry = e.h*0.45; ry < e.h*0.8; ry += 8) {
                                ctx.fillRect(e.w*0.25, ry, e.w*0.5, 4);
                            }

                            // Cabeza blanca y vacía
                            ctx.fillStyle = "#FFF";
                            ctx.beginPath(); ctx.ellipse(e.w*0.7, e.h*0.3, 10, 12, Math.PI/8, 0, Math.PI*2); ctx.fill();
                            ctx.beginPath(); ctx.ellipse(e.w*0.9, e.h*0.3, 10, 8, -Math.PI/6, 0, Math.PI*2); ctx.fill();
                            ctx.stroke(); // Borde
                        
                            // Ojos vacíos negros con brillo rojo amenazante
                            ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(e.w*0.75, e.h*0.25, 4, 6, 0, 0, Math.PI*2); ctx.fill();
                            ctx.fillStyle = "#F00"; ctx.beginPath(); ctx.ellipse(e.w*0.78, e.h*0.25, 1.5, 1.5, 0, 0, Math.PI*2); ctx.fill();
                        
                            ctx.restore();
                        }
                    } else if (e.type === 'koopa') {
                        let animTimer = e.timer || 0;
                        ctx.save();
                        ctx.translate(e.x + e.w/2, e.y + e.h/2);
                        ctx.scale(e.dir < 0 ? -1 : 1, 1);
                        ctx.translate(-e.w/2, -e.h/2);
                    
                        // Cuerpo metálico oscuro con brillo superior
                        let bilGrad = ctx.createLinearGradient(0, 0, 0, e.h);
                        bilGrad.addColorStop(0, "#888"); bilGrad.addColorStop(0.2, "#444"); bilGrad.addColorStop(0.6, "#111"); bilGrad.addColorStop(1, "#000");
                    
                        ctx.fillStyle = bilGrad;
                        ctx.beginPath(); 
                        ctx.moveTo(0, 0); 
                        ctx.lineTo(e.w*0.65, 0); 
                        // Nariz redondeada
                        ctx.bezierCurveTo(e.w*1.1, 0, e.w*1.1, e.h, e.w*0.65, e.h); 
                        ctx.lineTo(0, e.h); 
                        ctx.closePath(); 
                        ctx.fill();
                        ctx.strokeStyle = "#000"; ctx.lineWidth=2; ctx.stroke();
                        
                        // Borde trasero blanco
                        ctx.fillStyle = "#FFF"; ctx.fillRect(0, 0, 6, e.h);
                        ctx.fillStyle = "#CCC"; ctx.fillRect(3, 0, 3, e.h);
                        ctx.strokeRect(0, 0, 6, e.h);
                    
                        // Ojo amenazante más pulido
                        ctx.fillStyle = "#FFF"; 
                        ctx.beginPath(); ctx.ellipse(e.w*0.55, e.h*0.4, 5, 8, Math.PI/10, 0, Math.PI*2); ctx.fill();
                        ctx.fillStyle = "#000"; 
                        ctx.beginPath(); ctx.ellipse(e.w*0.65, e.h*0.4, 2, 4, Math.PI/10, 0, Math.PI*2); ctx.fill();
                    
                        // Ceño fruncido grueso
                        ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.lineCap = "round";
                        ctx.beginPath(); ctx.moveTo(e.w*0.35, e.h*0.2); ctx.lineTo(e.w*0.7, e.h*0.3); ctx.stroke();

                        // Brazo musculoso clásico
                        ctx.fillStyle = "#FFF"; 
                        ctx.beginPath(); ctx.ellipse(e.w*0.4, e.h*0.65, 8, 6, -Math.PI/6, 0, Math.PI*2); ctx.fill();
                        ctx.stroke();
                        
                        // Fuego de propulsión muy animado
                        let fLen = e.w * 0.4 + Math.random() * 25;
                        let fGrad = ctx.createLinearGradient(0, 0, -fLen, 0);
                        fGrad.addColorStop(0, "#FFEA00"); fGrad.addColorStop(0.5, "#FF5500"); fGrad.addColorStop(1, "rgba(255,0,0,0)");
                        ctx.fillStyle = fGrad;
                        ctx.beginPath(); ctx.moveTo(-2, e.h*0.1); ctx.lineTo(-fLen, e.h*0.5); ctx.lineTo(-2, e.h*0.9); ctx.fill();
                    
                        ctx.restore();
                    } else if (e.type === 'podoboo') {
                        ctx.save();
                        ctx.translate(e.x + e.w/2, e.y + e.h/2);
                        
                        let fGrad = ctx.createRadialGradient(0, 5, 5, 0, 0, e.w);
                        fGrad.addColorStop(0, '#FFF500'); fGrad.addColorStop(0.4, '#FF4500'); fGrad.addColorStop(1, 'rgba(255,0,0,0)');
                        ctx.fillStyle = fGrad;
                        ctx.beginPath(); ctx.arc(0, 0, e.w, 0, Math.PI*2); ctx.fill();
                        
                        // Ojos
                        ctx.fillStyle = '#000';
                        ctx.beginPath(); ctx.ellipse(-5, -5, 3, 6, 0, 0, Math.PI*2); ctx.fill();
                        ctx.beginPath(); ctx.ellipse(5, -5, 3, 6, 0, 0, Math.PI*2); ctx.fill();
                        
                        // Particle trail
                        if (Math.random() > 0.5) {
                            particles.push({ x: e.x + e.w/2, y: e.y + e.h, vx: (Math.random()-0.5)*2, vy: Math.random()*2, color: '#FF4500', life: 10 });
                        }
                        
                        ctx.restore();
                    }
                }
            }

            // --- DRAW GHOSTS ---
            if (isGrupal) {
                for (let gid in ghostsRef.current) {
                    const g = ghostsRef.current[gid];
                    if (Math.abs(g.x - cameraX) < 1200) { // Culling optimization
                        ctx.save();
                        ctx.translate(Math.floor(g.x) - cameraX, Math.floor(g.y));
                        if (g.lastDir === -1) { ctx.scale(-1, 1); }
                        
                        ctx.globalAlpha = 0.72; // Fantasmas más visibles
                        
                        let gDrawY = g.crouching ? 15 : 0;
                        const headSize = 36; 
                        const centerX = 15;
                        const centerY = gDrawY - 4;
                        const radius = headSize / 2;

                        // Cuerpo circular (en lugar del overalls cuadrado)
                        ctx.beginPath();
                        ctx.arc(centerX, gDrawY + 32, 10, 0, Math.PI * 2);
                        ctx.fillStyle = g.overalls || '#2038E0';
                        ctx.fill();

                        // Cabeza circular con avatar recortado
                        if (ghostMemes[gid] && ghostMemes[gid].complete) {
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(centerX, centerY + radius, radius, 0, Math.PI * 2);
                            ctx.clip();
                            ctx.drawImage(ghostMemes[gid], centerX - radius, centerY, headSize, headSize);
                            ctx.restore();
                            // Borde del círculo
                            ctx.beginPath();
                            ctx.arc(centerX, centerY + radius, radius, 0, Math.PI * 2);
                            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        } else {
                            // Fallback: círculo de color
                            ctx.beginPath();
                            ctx.arc(centerX, centerY + radius, radius, 0, Math.PI * 2);
                            ctx.fillStyle = g.color || '#E52521';
                            ctx.fill();
                            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }

                        ctx.restore();
                    }
                }
            }

            // Player Simple Drawing - Cabeza Cabezona Meme
            let drawY = player.crouching ? player.y + 15 : player.y; // Baja visualmente la cabeza si está agachado

            if (player.hasYoshi) {
                // Dibujar a Yoshi
                ctx.save();
                ctx.translate(player.x + player.w/2, drawY + player.h); // Anclaje en base
                if (player.lastDir === -1) ctx.scale(-1, 1);
                
                // Cuerpo de Yoshi verde
                ctx.fillStyle = '#00D100'; 
                ctx.beginPath(); ctx.ellipse(-5, -15, 12, 16, 0, 0, Math.PI*2); ctx.fill();
                // Montura roja
                ctx.fillStyle = '#FF0000'; ctx.beginPath(); ctx.ellipse(-5, -25, 10, 5, 0, 0, Math.PI*2); ctx.fill();
                // Cola
                ctx.fillStyle = '#00D100'; ctx.beginPath(); ctx.moveTo(-15, -10); ctx.lineTo(-25, -5); ctx.lineTo(-12, 0); ctx.fill();
                // Brazo
                ctx.fillStyle = '#00D100'; ctx.beginPath(); ctx.ellipse(2, -15, 4, 8, Math.PI/4, 0, Math.PI*2); ctx.fill();
                // Zapatos Naranjas
                ctx.fillStyle = '#FF7A00'; ctx.beginPath(); ctx.ellipse(-8, 0, 8, 5, 0, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(5, 0, 8, 5, 0, 0, Math.PI*2); ctx.fill();
                // Cabeza animada por flutter
                let headY = (player.flutterTimer > 0) ? -35 : -28;
                ctx.fillStyle = '#00D100'; ctx.beginPath(); ctx.ellipse(12, headY, 14, 12, 0, 0, Math.PI*2); ctx.fill();
                // Mejilla blanca
                ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.ellipse(15, headY+5, 10, 8, 0, 0, Math.PI*2); ctx.fill();
                // Nariz grande
                ctx.fillStyle = '#00D100'; ctx.beginPath(); ctx.ellipse(20, headY-2, 10, 12, 0, 0, Math.PI*2); ctx.fill();
                // Ojos
                ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.ellipse(12, headY-12, 6, 8, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(14, headY-12, 2, 4, 0, 0, Math.PI*2); ctx.fill();
                // Púas rojas
                ctx.fillStyle = '#FF0000'; ctx.beginPath(); ctx.moveTo(0, headY-5); ctx.lineTo(-8, headY-10); ctx.lineTo(-2, headY); ctx.fill();

                // LENGUA
                if (player.tongueActive > 0) {
                    let tW = (20 - Math.abs(player.tongueActive - 10)) * 6;
                    ctx.fillStyle = '#FF4D4D';
                    ctx.beginPath();
                    if(ctx.roundRect) ctx.roundRect(22, headY - 8, tW, 8, 4);
                    else ctx.rect(22, headY - 8, tW, 8);
                    ctx.fill();
                    ctx.fillStyle = '#FFF';
                    ctx.fillRect(25, headY - 6, Math.max(0, tW - 10), 2);
                }

                ctx.restore();
                
                // Elevar al jugador porque está montando
                drawY -= 15;
            }

            const headSize = player.hasYoshi ? player.w + 5 : player.w + 20; // Cabeza reducida pero visible en Yoshi
            const headOffset = (headSize - player.w) / 2;
            
            // Dibujamos el Overol en Canvas solo si no está en Yoshi
            if (!player.hasYoshi) {
                ctx.fillStyle = player.overalls; 
                ctx.fillRect(player.x, drawY + 25, player.w, player.h - (player.crouching ? 40 : 25));
            }

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

            // Textos flotantes
            ctx.save();
            for(let t of floatingTexts) {
                let op = Math.max(0, Math.min(1, t.life / 60));
                ctx.globalAlpha = op;
                ctx.fillStyle = t.color || '#FFFFFF';
                ctx.font = '900 24px "Inter", sans-serif'; 
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#000000';
                ctx.strokeText(t.text, t.x, t.y); 
                ctx.fillText(t.text, t.x, t.y);
            }
            ctx.restore();

            ctx.restore();

            // Efecto HUD de sangre al recibir daño (completamente integrado al canvas sin costosas llamadas DOM)
            if (player.invulnerable > 30) {
                let dmgIntensity = ((player.invulnerable - 30) / 30) * 0.4;
                ctx.fillStyle = `rgba(255, 0, 0, ${dmgIntensity})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height); 
            }
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
            if (realtimeChannel) {
                realtimeChannel.unsubscribe();
                realtimeChannel = null;
            }
            if (ablyClient) {
                ablyClient.close();
                ablyClient = null;
            }
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
            setScore(prev => prev + 200);
            gameEngine.current.resumeGame(true);
            
            // Lógica para enviar a Supabase
            const { data: cur } = await supabase.from("game_players").select("score, correct_answers").eq("id", playerId).single();
            await supabase.from("game_players").update({
                score: (cur?.score || 0) + 200,
                correct_answers: (cur?.correct_answers || 0) + 1
            }).eq("id", playerId);

        } else {
            // Penalización fija: -80pts por respuesta incorrecta (mínimo 0)
            setScore(prev => Math.max(0, prev - 80));
            gameEngine.current.resumeGame(false);
            
            // Registrar fallo y actualizar score en base de datos
            const { data: cur } = await supabase.from("game_players").select("score, incorrect_answers").eq("id", playerId).single();
            const newDbScore = Math.max(0, (cur?.score || 0) - 80);
            await supabase.from("game_players").update({
                score: newDbScore,
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
            <div className="absolute top-4 left-6 text-white font-black text-2xl z-10 drop-shadow-md border-2 border-white/20 bg-black/40 px-4 py-2 rounded-xl flex items-center gap-2">
                <span>⚡</span> <span className="text-yellow-300">{score.toString().padStart(6, '0')}</span> <span className="text-xs font-bold text-white/50">pts</span>
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
                Controles: WASD / Flechas. Shift correr. Presiona E para sacar la lengua de Yoshi.
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
                <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-8 text-center">
                    <h1 className="text-7xl font-black text-red-500 uppercase tracking-widest animate-pulse mb-4">GAME OVER</h1>
                    <p className="text-white/50 mb-8 tracking-widest uppercase text-xl">Te quedaste sin vidas</p>
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
