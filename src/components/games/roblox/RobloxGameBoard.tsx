"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, Billboard, Environment, Sky, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { supabase } from "@/lib/supabaseClient";

type Player = {
    id: string;
    game_id: string;
    player_name: string;
    avatar_gif_url: string;
    current_position: number;
    score: number;
    is_blocked?: boolean;
};

interface RobloxGameBoardProps {
    gameId: string;
    players: Player[];
    totalQuestions: number;
}

// Generates an Obby island trajectory
const getIslandPosition = (index: number) => {
    // A long wavy race track moving deep into the screen (negative Z axis)
    const spacingZ = -6;
    // Wavy pattern along the X axis
    const wobbleX = Math.sin(index * 0.5) * 6;
    // Slowly ascend to avoid the rising lava
    const heightY = index * 0.3;
    
    return new THREE.Vector3(wobbleX, heightY, index * spacingZ);
};

// Colors mapping for Roblox style
const avatarColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#88ff00'];

const PlayerAvatar = ({ player, index, totalQuestions }: { player: Player, index: number, totalQuestions: number }) => {
    const groupRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Mesh>(null);
    const rightArmRef = useRef<THREE.Mesh>(null);
    const leftLegRef = useRef<THREE.Mesh>(null);
    const rightLegRef = useRef<THREE.Mesh>(null);
    const targetPosRef = useRef(new THREE.Vector3());
    
    useEffect(() => {
        const safePos = Math.max(0, Math.min(player.current_position, totalQuestions));
        const basePos = getIslandPosition(safePos);
        
        console.log(`[Avatar ${player.player_name}] Pos:${player.current_position} Total:${totalQuestions} Safe:${safePos}`);

        // Offset determinístico para que los jugadores en la misma isla no se superpongan (excepto inicio/meta)
        if (safePos > 0 && safePos < totalQuestions) {
            const angle = index * 2.3999; // Golden ratio approx para dispersión
            const radius = 0.6 + (Math.abs(Math.sin(index)) * 0.8);
            const offset = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
            targetPosRef.current.copy(basePos).add(offset);
        } else {
            targetPosRef.current.copy(basePos);
        }
    }, [player.current_position, totalQuestions, index, player.player_name]);
    
    // Smooth movement mapping (lerp)
    useFrame((state, delta) => {
        if (groupRef.current) {
            const curPos = groupRef.current.position;
            const target = targetPosRef.current;
            const dist = curPos.distanceTo(new THREE.Vector3(target.x, curPos.y, target.z));
            
            // Si está muy lejos, salta alto (Roblox jump effect)
            const isMoving = dist > 0.1;
            const jumpOffset = isMoving ? Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 1.5 : 0;
            
            // Lerp de posición general
            groupRef.current.position.lerp(new THREE.Vector3(target.x, target.y + 1.2 + jumpOffset, target.z), delta * 6);
            
            // Animación de brazos y piernas ("Roblox Walk")
            if (isMoving && leftArmRef.current && rightArmRef.current && leftLegRef.current && rightLegRef.current) {
                 const walkCycle = Math.sin(state.clock.elapsedTime * 18) * 0.8;
                 leftArmRef.current.rotation.x = walkCycle;
                 rightArmRef.current.rotation.x = -walkCycle;
                 leftLegRef.current.rotation.x = -walkCycle;
                 rightLegRef.current.rotation.x = walkCycle;
                 
                 // Rotar hacia donde camina
                 const targetRotation = Math.atan2(target.x - curPos.x, curPos.z - target.z);
                 groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, delta * 10);
            } else if (leftArmRef.current && rightArmRef.current && leftLegRef.current && rightLegRef.current) {
                 // Regresar brazos a lugar
                 leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0, delta * 10);
                 rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, delta * 10);
                 leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, delta * 10);
                 rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, delta * 10);
                 
                 // En la meta celebran dando vueltas
                 if (player.current_position >= totalQuestions) {
                      groupRef.current.rotation.y += delta * 2;
                      leftArmRef.current.rotation.x = Math.PI; // Brazos arriba!
                      rightArmRef.current.rotation.x = Math.PI;
                 } else {
                      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, delta * 4);
                 }
            }
        }
    });

    const torsoColor = avatarColors[index % avatarColors.length];

    return (
        <group ref={groupRef}>
            {/* Roblox Noob Avatar */}
            <group position={[0, 0, 0]} scale={[0.6, 0.6, 0.6]} castShadow>
                {/* Cabeza Amarilla */}
                <mesh position={[0, 1.2, 0]} castShadow>
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                    <meshStandardMaterial color="#fcd34d" roughness={0.4} />
                    {/* Ojitos */}
                    <mesh position={[-0.1, 0.1, 0.26]}>
                        <boxGeometry args={[0.08, 0.08, 0.01]} />
                        <meshBasicMaterial color="black" />
                    </mesh>
                    <mesh position={[0.1, 0.1, 0.26]}>
                        <boxGeometry args={[0.08, 0.08, 0.01]} />
                        <meshBasicMaterial color="black" />
                    </mesh>
                    {/* Boca redonda (OOF) */}
                    <mesh position={[0, -0.1, 0.26]}>
                        <boxGeometry args={[0.15, 0.1, 0.01]} />
                        <meshBasicMaterial color="black" />
                    </mesh>
                </mesh>
                {/* Torso (Color del Jugador) */}
                <mesh position={[0, 0.45, 0]} castShadow>
                    <boxGeometry args={[1, 1, 0.5]} />
                    <meshStandardMaterial color={torsoColor} roughness={0.2} metalness={0.1} />
                </mesh>
                {/* Brazo Izquierdo (ajustamos el punto de pivote anidándolo en un grupo) */}
                <group position={[-0.7, 0.95, 0]} ref={leftArmRef}>
                    <mesh position={[0, -0.5, 0]} castShadow>
                        <boxGeometry args={[0.4, 1, 0.4]} />
                        <meshStandardMaterial color="#fcd34d" roughness={0.4} />
                    </mesh>
                </group>
                {/* Brazo Derecho */}
                <group position={[0.7, 0.95, 0]} ref={rightArmRef}>
                    <mesh position={[0, -0.5, 0]} castShadow>
                        <boxGeometry args={[0.4, 1, 0.4]} />
                        <meshStandardMaterial color="#fcd34d" roughness={0.4} />
                    </mesh>
                </group>
                {/* Pierna Izquierda */}
                <group position={[-0.25, -0.05, 0]} ref={leftLegRef}>
                    <mesh position={[0, -0.5, 0]} castShadow>
                        <boxGeometry args={[0.4, 1, 0.4]} />
                        <meshStandardMaterial color="#4ade80" roughness={0.6} />
                    </mesh>
                </group>
                {/* Pierna Derecha */}
                <group position={[0.25, -0.05, 0]} ref={rightLegRef}>
                    <mesh position={[0, -0.5, 0]} castShadow>
                        <boxGeometry args={[0.4, 1, 0.4]} />
                        <meshStandardMaterial color="#4ade80" roughness={0.6} />
                    </mesh>
                </group>
            </group>
            
            {/* Text tag (Billboarded so it always faces camera) */}
            <Billboard position={[0, 1.5, 0]}>
                <Text
                    fontSize={0.4}
                    color="white"
                    outlineWidth={0.04}
                    outlineColor="black"
                    anchorX="center"
                    anchorY="middle"
                    fontWeight="bold"
                >
                    {player.player_name} ({player.current_position})
                </Text>
            </Billboard>
        </group>
    );
};

const JumpPads = ({ start, end }: { start: THREE.Vector3, end: THREE.Vector3 }) => {
    const pads = [];
    // Crear 3 plataformas intermedias en forma de arco
    for(let i=1; i<=3; i++) {
        const fraction = i / 4;
        const padPos = start.clone().lerp(end, fraction);
        // Elevamos ligeramente el centro para hacer una curva de salto perfecta
        padPos.y += Math.sin(fraction * Math.PI) * 0.5 - 0.5; 
        pads.push(padPos);
    }
    
    return (
        <group>
            {pads.map((p, i) => (
                <Float key={i} speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
                    <mesh position={p} castShadow receiveShadow>
                        <boxGeometry args={[1.2, 0.2, 1.2]} />
                        <meshStandardMaterial color={["#ef4444", "#3b82f6", "#10b981", "#f59e0b"][i % 4]} roughness={0.3} metalness={0.1} />
                    </mesh>
                </Float>
            ))}
        </group>
    );
};

const ObbyIsland = ({ index, isEnd = false }: { index: number, isEnd?: boolean }) => {
    const pos = getIslandPosition(index);
    const meshRef = useRef<THREE.Group>(null);
    
    // Patrones y tipos de obstáculo
    const isSpinner = index % 3 === 0 && !isEnd && index !== 0;

    useFrame((state, delta) => {
        if (isSpinner && meshRef.current) {
            meshRef.current.rotation.y += delta * 1.5;
        }
    });

    return (
        <group position={[pos.x, pos.y, pos.z]}>
            <Float speed={isEnd ? 0.5 : 2} rotationIntensity={isSpinner ? 0 : 0.05} floatIntensity={0.2}>
                <group ref={meshRef}>
                    {isEnd ? (
                        // META FINAL: Podio dorado enorme con arcos de llegada
                        <group>
                            <mesh position={[0, -1, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[6, 5, 2, 12]} />
                                <meshStandardMaterial color="#fcd34d" metalness={0.8} roughness={0.2} />
                            </mesh>
                            {/* Pilares de llegada */}
                            <mesh position={[-4, 2, -2]} castShadow>
                                <cylinderGeometry args={[0.2, 0.2, 8]} />
                                <meshStandardMaterial color="white" />
                            </mesh>
                            <mesh position={[4, 2, -2]} castShadow>
                                <cylinderGeometry args={[0.2, 0.2, 8]} />
                                <meshStandardMaterial color="white" />
                            </mesh>
                            {/* Cartel Red de Meta */}
                            <mesh position={[0, 4.5, -2]}>
                                <boxGeometry args={[8.5, 1.5, 0.2]} />
                                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
                            </mesh>
                            <Text position={[0, 4.5, -1.88]} fontSize={0.8} color="white" fontWeight="black" outlineWidth={0.03}>
                                FINISH
                            </Text>
                        </group>
                    ) : (
                        // ISLA NORMAL: Compuesta de tierra flotante y pasto neón
                        <group>
                            {/* Base Rocosa/Tierra */}
                            <mesh position={[0, -1, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[2.8, 2.2, 2, 8]} />
                                <meshStandardMaterial color="#57534e" roughness={0.9} />
                            </mesh>
                            {/* Tope de césped/neón */}
                            <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[3.1, 3.1, 0.3, 16]} />
                                <meshStandardMaterial 
                                    color={index === 0 ? '#10b981' : (isSpinner ? '#ec4899' : '#3b82f6')} 
                                    roughness={0.6} 
                                    emissive={isSpinner ? '#ec4899' : '#000000'}
                                    emissiveIntensity={isSpinner ? 0.2 : 0}
                                />
                            </mesh>
                            {/* Banderín en islas intermedias */}
                            {index !== 0 && (
                                <group position={[-2.2, 1.5, -2.2]} rotation={[0, Math.PI/4, 0]}>
                                    <mesh castShadow>
                                        <cylinderGeometry args={[0.05, 0.05, 3]} />
                                        <meshStandardMaterial color="#94a3b8" metalness={0.6} />
                                    </mesh>
                                    <mesh position={[0.6, 1, 0]} castShadow>
                                        <boxGeometry args={[1.2, 0.8, 0.05]} />
                                        <meshStandardMaterial color="#f59e0b" />
                                    </mesh>
                                    <Text position={[0.6, 1, 0.03]} fontSize={0.4} color="white" fontWeight="bold">
                                        Q{index}
                                    </Text>
                                </group>
                            )}
                        </group>
                    )}
                    
                    {/* Etiqueta Pegada al Suelo */}
                    <Text
                        position={[0, isEnd ? 0.01 : 0.26, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        fontSize={isEnd ? 3 : 2}
                        color="white"
                        fillOpacity={0.9}
                        fontWeight="black"
                        outlineWidth={0.05}
                        outlineColor="black"
                    >
                        {isEnd ? '🏆' : index === 0 ? 'START' : index}
                    </Text>
                </group>
            </Float>
        </group>
    );
};

export default function RobloxGameBoard({ gameId, players, totalQuestions }: RobloxGameBoardProps) {
    const islands = useMemo(() => Array.from({ length: totalQuestions + 1 }).map((_, i) => i), [totalQuestions]);
    const [hiddenCheaters, setHiddenCheaters] = useState<string[]>([]);
    const [localForgivenOrders, setLocalForgivenOrders] = useState<string[]>([]);
    
    // Render the podium ranking sidebar
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    return (
        <div className="w-full h-full flex flex-col md:flex-row bg-[#0a0a0a] relative overflow-hidden font-sans">
            {/* 3D Viewport */}
            <div className="flex-1 h-full relative">
                <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }}>
                    <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} turbidity={10} rayleigh={2} mieCoefficient={0.005} mieDirectionalG={0.8} />
                    <ambientLight intensity={0.4} />
                    <directionalLight
                        position={[10, 20, 10]}
                        intensity={1.5}
                        castShadow
                        shadow-mapSize={[2048, 2048]}
                    />
                    
                    {/* The Void (Distorted Lava layer) */}
                    <mesh position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[200, 200, 64, 64]} />
                        <MeshDistortMaterial
                            color="#ff4500"
                            emissive="#ff0000"
                            emissiveIntensity={0.8}
                            roughness={0.2}
                            metalness={0.8}
                            distort={0.4}
                            speed={2}
                        />
                    </mesh>

                    {/* Magic Sparkles around the islands */}
                    <Sparkles count={500} scale={[25, 10, totalQuestions * 6]} position={[0, 5, -(totalQuestions * 3)]} color="#fcd34d" size={4} speed={0.4} opacity={0.5} />

                    {/* Generate paths (Jump pads) between islands */}
                    {islands.map((i) => {
                        if (i === 0) return null;
                        const start = getIslandPosition(i - 1);
                        const end = getIslandPosition(i);
                        return <JumpPads key={`path-${i}`} start={start} end={end} />
                    })}

                    {/* Generate islands up to finish line */}
                    {islands.map((i) => (
                        <ObbyIsland key={i} index={i} isEnd={i === totalQuestions} />
                    ))}

                    {/* Generate Players */}
                    {players.filter(p => !hiddenCheaters.includes(p.id)).map((p, idx) => (
                        <PlayerAvatar key={p.id} player={p} index={idx} totalQuestions={totalQuestions} />
                    ))}

                    <OrbitControls makeDefault target={[0, (totalQuestions*0.3)/2, -(totalQuestions*3)]} />
                    <Environment preset="city" />
                </Canvas>

                {/* ALERTA DE ALUMNOS BLOQUEADOS (TRAMPA DETECTADA) */}
                {players.filter(p => p.is_blocked && !hiddenCheaters.includes(p.id) && !localForgivenOrders.includes(p.id)).length > 0 && (
                    <div className="absolute top-4 right-4 z-[9999] pointer-events-none flex flex-col gap-3 w-80">
                        {players.filter(p => p.is_blocked && !hiddenCheaters.includes(p.id) && !localForgivenOrders.includes(p.id)).map(cheater => (
                            <div key={cheater.id} className="pointer-events-auto bg-red-600/95 backdrop-blur-xl border-2 border-red-500 p-4 rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.4)] flex flex-col animate-fade-in transition-all duration-300 transform scale-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="text-3xl drop-shadow-md animate-bounce" style={{animationDuration: '2s'}}>🚨</div>
                                    <div className="text-left text-white leading-tight">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-red-200">Abandono</h3>
                                        <p className="font-bold text-sm">
                                            <span className="text-white bg-black/30 px-1.5 py-0.5 rounded-md mr-1">{cheater.player_name}</span> 
                                            salió.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full">
                                    <button 
                                        onClick={async () => {
                                            // OPTIMISTIC UPDATE: se oculta al instante temporalmente de la UI
                                            setLocalForgivenOrders(prev => [...prev, cheater.id]);
                                            await supabase.from("game_players").update({ is_blocked: false }).eq("id", cheater.id);
                                            // Limpiar el estado temporal después de 2s, porque para entonces DB ya mandó el update falso
                                            setTimeout(() => {
                                                setLocalForgivenOrders(prev => prev.filter(id => id !== cheater.id));
                                            }, 2000);
                                        }}
                                        className="flex-1 bg-white text-red-700 font-black px-2 py-1.5 rounded-lg text-xs hover:bg-red-50 transition-colors shadow-md active:scale-95"
                                    >
                                        PERDONAR
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            // Update state locally immediately
                                            setHiddenCheaters(prev => [...prev, cheater.id]);
                                            
                                            if (cheater.id) {
                                                // 1. Forzar señal letal de update al alumno antes del borrado
                                                await supabase.from("game_players").update({ current_position: -999, is_blocked: true }).eq("id", cheater.id);
                                                // 2. Destruir registro
                                                await supabase.from("game_players").delete().eq("id", cheater.id);
                                            }
                                        }}
                                        className="flex-1 bg-black/40 hover:bg-black/60 text-white font-black px-2 py-1.5 rounded-lg text-xs transition-colors border border-white/20 active:scale-95"
                                    >
                                        EXPULSAR
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Overlaid UI Title */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] filter drop-shadow-lg">Strive Obby</h2>
                    <p className="text-white font-bold drop-shadow-md">¡El Suelo es Lava!</p>
                </div>
            </div>

            {/* Sidebar Leaderboard */}
            <div className="w-full md:w-80 h-full bg-slate-900 border-l-4 border-slate-700 flex flex-col z-20">
                <div className="bg-slate-800 p-4 border-b-4 border-slate-900">
                    <h3 className="text-2xl font-black text-white uppercase tracking-widest">🏆 Leaderboard</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {sortedPlayers.map((p, idx) => (
                        <div key={p.id} className="bg-slate-800 p-3 rounded-xl border-2 border-slate-700 flex items-center gap-3">
                            <span className="text-2xl font-black text-slate-500">#{idx + 1}</span>
                            <img src={p.avatar_gif_url} alt="avatar" className="w-10 h-10 rounded-lg border-2 border-slate-600 object-cover" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white truncate text-sm">{p.player_name}</p>
                                <div className="w-full bg-slate-900 h-2 rounded-full mt-1 overflow-hidden">
                                     <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(Math.max(0, p.current_position) / totalQuestions) * 100}%` }}></div>
                                </div>
                            </div>
                            <span className="text-xs font-black text-blue-400">{p.score}</span>
                        </div>
                    ))}
                </div>
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            `}</style>
        </div>
    );
}
