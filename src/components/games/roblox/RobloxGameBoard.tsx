"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, Billboard, Environment, Grid, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { supabase } from "@/lib/supabaseClient";
import confetti from 'canvas-confetti';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

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

const getIslandPosition = (index: number, isSpiral: boolean) => {
    if (isSpiral) {
        // Radio inicial 7, incremento 2.2 por isla, ángulo 72° → distancia mínima ~9.7 u entre centros
        // (diámetro de isla = 6.3, gap resultante ~3.4 u)
        const radius = 7 + index * 2.2;
        const angle  = index * (Math.PI / 2.5); // 72° por paso
        const heightY = index * 2.2;
        return new THREE.Vector3(Math.cos(angle) * radius, heightY, Math.sin(angle) * radius);
    } else {
        const columns = 5;
        const spacing = 10; // espaciado mayor que el diámetro de isla (3.15*2=6.3) para que no se toquen
        const row = Math.floor(index / columns);
        const col = row % 2 === 0 ? (index % columns) : (columns - 1 - (index % columns));
        const offsetX = (col - (columns - 1) / 2) * spacing; // centrado correcto
        const offsetZ = -row * spacing;
        return new THREE.Vector3(offsetX, 0, offsetZ); // plano, sin elevación progresiva
    }
};

// ─── CONFIGURACIONES DE AVATAR ──────────────────────────────────────────────

const TORSO_COLORS  = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#f97316','#06b6d4','#ef4444','#84cc16','#14b8a6','#a855f7'];
const LEG_COLORS    = ['#1e1b4b','#831843','#064e3b','#1e3a8a','#4c1d95','#7c2d12','#164e63','#14532d','#3b0764','#7f1d1d'];
const SKIN_TONES    = ['#fcd34d','#fbbf24','#fde68a','#f3c26c','#e9b96a'];
const HAT_COLORS    = ['#fbbf24','#ef4444','#8b5cf6','#10b981','#3b82f6','#f97316','#ec4899','#ffffff'];
const CAPE_COLORS   = ['#dc2626','#7c3aed','#0891b2','#15803d','#d97706','#db2777'];

function getAvatarConfig(index: number) {
    // Determinístico por índice, único por jugador
    const seed = index * 7919; // primo para dispersión
    const pick = (arr: any[], n: number) => arr[Math.abs(n) % arr.length];
    return {
        torso:    pick(TORSO_COLORS,  seed),
        legs:     pick(LEG_COLORS,    seed * 3),
        skin:     pick(SKIN_TONES,    seed * 5),
        hatColor: pick(HAT_COLORS,    seed * 11),
        capeColor:pick(CAPE_COLORS,   seed * 13),
        hatType:  Math.abs(seed)     % 4,  // 0=ninguno, 1=corona, 2=casco, 3=sombrero
        hasCape:  Math.abs(seed * 7) % 3 === 0,
        hasBackpack: Math.abs(seed * 11) % 4 === 0,
        hasAntenna: Math.abs(seed * 17) % 5 === 0,
    };
}

// ─── ACCESORIOS ─────────────────────────────────────────────────────────────

const Crown = ({ color }: { color: string }) => (
    <group position={[0, 0.32, 0]}>
        <mesh><cylinderGeometry args={[0.28, 0.24, 0.12, 8]} /><meshStandardMaterial color={color} metalness={0.9} roughness={0.1} /></mesh>
        {[0, 1, 2, 3, 4].map(i => (
            <mesh key={i} position={[Math.cos(i * Math.PI * 2 / 5) * 0.22, 0.1, Math.sin(i * Math.PI * 2 / 5) * 0.22]}>
                <coneGeometry args={[0.04, 0.14, 4]} /><meshStandardMaterial color={color} metalness={0.9} roughness={0.1} emissive={color} emissiveIntensity={0.4} />
            </mesh>
        ))}
    </group>
);

const Helmet = ({ color }: { color: string }) => (
    <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.3, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} />
    </mesh>
);

const Sombrero = ({ color }: { color: string }) => (
    <group position={[0, 0.28, 0]}>
        <mesh><cylinderGeometry args={[0.18, 0.18, 0.3, 8]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        <mesh position={[0, -0.15, 0]}><cylinderGeometry args={[0.42, 0.42, 0.06, 12]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
    </group>
);

const Cape = ({ color }: { color: string }) => (
    <mesh position={[0, 0.4, -0.28]}>
        <boxGeometry args={[0.7, 0.9, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.5} side={THREE.DoubleSide} />
    </mesh>
);

const Backpack = ({ color }: { color: string }) => (
    <mesh position={[0, 0.4, -0.32]}>
        <boxGeometry args={[0.45, 0.5, 0.2]} />
        <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
);

const Antenna = () => (
    <group position={[0.1, 0.34, 0]}>
        <mesh><cylinderGeometry args={[0.025, 0.025, 0.28, 5]} /><meshStandardMaterial color="#94a3b8" metalness={0.8} /></mesh>
        <mesh position={[0, 0.18, 0]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} /></mesh>
    </group>
);

// ─── AVATAR ─────────────────────────────────────────────────────────────────

const PlayerAvatar = ({ player, index, absTotal }: { player: Player; index: number; absTotal: number }) => {
    const groupRef   = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef= useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef= useRef<THREE.Group>(null);
    const targetPosRef = useRef(new THREE.Vector3());

    // Animación de muerte: -1 = inactivo, 0..1 = progreso de la animación
    const deathAnimRef = useRef<number>(-1);
    const prevPositionRef = useRef<number>(player.current_position);

    const isSpiral = absTotal < 0;
    const realTotal = Math.abs(absTotal);
    const cfg = useMemo(() => getAvatarConfig(index), [index]);

    useEffect(() => {
        const prev = prevPositionRef.current;
        const curr = player.current_position;
        prevPositionRef.current = curr;

        // Detectar retroceso → disparar animación de muerte
        if (curr < prev) {
            deathAnimRef.current = 0;
        }

        const safePos = Math.max(0, Math.min(curr, realTotal));
        const basePos = getIslandPosition(safePos, isSpiral);
        if (safePos > 0 && safePos < realTotal) {
            const angle  = index * 2.3999;
            const radius = 0.6 + Math.abs(Math.sin(index)) * 0.8;
            targetPosRef.current.copy(basePos).add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        } else {
            targetPosRef.current.copy(basePos);
        }
    }, [player.current_position, realTotal, index, isSpiral]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        const cur = groupRef.current.position;
        const tgt = targetPosRef.current;

        const la = leftArmRef.current;
        const ra = rightArmRef.current;
        const ll = leftLegRef.current;
        const rl = rightLegRef.current;

        // ── Animación de muerte (OOF) ──────────────────────────────────────────
        if (deathAnimRef.current >= 0) {
            const t = deathAnimRef.current;
            deathAnimRef.current += delta * 1.8; // duración ~0.55s

            // Fase 1 (t < 0.5): girar rápido + saltar hacia arriba
            // Fase 2 (t >= 0.5): caer al vacío
            if (t < 0.5) {
                groupRef.current.rotation.y += delta * 22;
                groupRef.current.position.y = THREE.MathUtils.lerp(cur.y, tgt.y + 4, delta * 12);
            } else {
                groupRef.current.rotation.y += delta * 10;
                groupRef.current.position.y = THREE.MathUtils.lerp(cur.y, tgt.y - 6, delta * 14);
                // Brazos y piernas en posición de caída
                if (la && ra && ll && rl) {
                    la.rotation.x = THREE.MathUtils.lerp(la.rotation.x, -Math.PI / 2, delta * 10);
                    ra.rotation.x = THREE.MathUtils.lerp(ra.rotation.x, -Math.PI / 2, delta * 10);
                    ll.rotation.x = THREE.MathUtils.lerp(ll.rotation.x,  Math.PI / 3, delta * 10);
                    rl.rotation.x = THREE.MathUtils.lerp(rl.rotation.x,  Math.PI / 3, delta * 10);
                }
            }

            if (deathAnimRef.current >= 1) {
                // Teleportar instantáneo a la isla destino y terminar animación
                groupRef.current.position.set(tgt.x, tgt.y + 1.2, tgt.z);
                deathAnimRef.current = -1;
            }
            return; // skip lógica normal mientras la animación corre
        }
        // ── Fin animación de muerte ────────────────────────────────────────────

        const dist = cur.distanceTo(new THREE.Vector3(tgt.x, cur.y, tgt.z));
        const isMoving = dist > 0.1;
        const jumpOffset = isMoving ? Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 1.5 : 0;

        groupRef.current.position.lerp(new THREE.Vector3(tgt.x, tgt.y + 1.2 + jumpOffset, tgt.z), delta * 6);

        if (!la || !ra || !ll || !rl) return;

        if (isMoving) {
            const walk = Math.sin(state.clock.elapsedTime * 18) * 0.8;
            la.rotation.x = walk; ra.rotation.x = -walk;
            ll.rotation.x = -walk; rl.rotation.x = walk;
            const targetRot = Math.atan2(tgt.x - cur.x, cur.z - tgt.z);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRot, delta * 10);
        } else {
            la.rotation.x = THREE.MathUtils.lerp(la.rotation.x, 0, delta * 10);
            ra.rotation.x = THREE.MathUtils.lerp(ra.rotation.x, 0, delta * 10);
            ll.rotation.x = THREE.MathUtils.lerp(ll.rotation.x, 0, delta * 10);
            rl.rotation.x = THREE.MathUtils.lerp(rl.rotation.x, 0, delta * 10);

            if (player.current_position >= realTotal) {
                groupRef.current.rotation.y += delta * 2;
                la.rotation.x = Math.PI; ra.rotation.x = Math.PI; // ¡Brazos arriba!
            } else {
                groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, delta * 4);
            }
        }
    });

    return (
        <group ref={groupRef}>
            <group scale={[0.58, 0.58, 0.58]}>
                {/* Cabeza */}
                <mesh position={[0, 1.2, 0]} castShadow>
                    <boxGeometry args={[0.55, 0.55, 0.55]} />
                    <meshStandardMaterial color={cfg.skin} roughness={0.4} />
                    {/* Ojos */}
                    {[-0.12, 0.12].map((x, i) => (
                        <mesh key={i} position={[x, 0.1, 0.28]}>
                            <boxGeometry args={[0.09, 0.1, 0.01]} />
                            <meshBasicMaterial color="#1e293b" />
                        </mesh>
                    ))}
                    {/* Boca */}
                    <mesh position={[0, -0.1, 0.28]}>
                        <boxGeometry args={[0.18, 0.07, 0.01]} />
                        <meshBasicMaterial color="#1e293b" />
                    </mesh>
                </mesh>

                {/* Accesorios de cabeza */}
                <group position={[0, 1.2, 0]}>
                    {cfg.hatType === 1 && <Crown color={cfg.hatColor} />}
                    {cfg.hatType === 2 && <Helmet color={cfg.hatColor} />}
                    {cfg.hatType === 3 && <Sombrero color={cfg.hatColor} />}
                    {cfg.hasAntenna && <Antenna />}
                </group>

                {/* Torso */}
                <mesh position={[0, 0.45, 0]} castShadow>
                    <boxGeometry args={[1.05, 1.05, 0.52]} />
                    <meshStandardMaterial color={cfg.torso} roughness={0.2} metalness={0.15} />
                </mesh>

                {/* Capa */}
                {cfg.hasCape && <group position={[0, 0.45, 0]}><Cape color={cfg.capeColor} /></group>}
                {/* Mochila */}
                {cfg.hasBackpack && <group position={[0, 0.45, 0]}><Backpack color={cfg.torso} /></group>}

                {/* Brazo Izquierdo */}
                <group position={[-0.75, 0.95, 0]} ref={leftArmRef}>
                    <mesh position={[0, -0.5, 0]} castShadow>
                        <boxGeometry args={[0.42, 1.05, 0.42]} />
                        <meshStandardMaterial color={cfg.skin} roughness={0.4} />
                    </mesh>
                </group>
                {/* Brazo Derecho */}
                <group position={[0.75, 0.95, 0]} ref={rightArmRef}>
                    <mesh position={[0, -0.5, 0]} castShadow>
                        <boxGeometry args={[0.42, 1.05, 0.42]} />
                        <meshStandardMaterial color={cfg.skin} roughness={0.4} />
                    </mesh>
                </group>
                {/* Pierna Izquierda */}
                <group position={[-0.27, -0.05, 0]} ref={leftLegRef}>
                    <mesh position={[0, -0.52, 0]} castShadow>
                        <boxGeometry args={[0.42, 1.05, 0.42]} />
                        <meshStandardMaterial color={cfg.legs} roughness={0.7} />
                    </mesh>
                </group>
                {/* Pierna Derecha */}
                <group position={[0.27, -0.05, 0]} ref={rightLegRef}>
                    <mesh position={[0, -0.52, 0]} castShadow>
                        <boxGeometry args={[0.42, 1.05, 0.42]} />
                        <meshStandardMaterial color={cfg.legs} roughness={0.7} />
                    </mesh>
                </group>
            </group>

            {/* Nombre flotante */}
            <Billboard position={[0, 1.9, 0]}>
                <Text fontSize={0.36} color="white" outlineWidth={0.05} outlineColor="#000" anchorX="center" anchorY="middle" fontWeight="bold">
                    {player.player_name}
                </Text>
                <Text position={[0, -0.48, 0]} fontSize={0.26} color="#a5b4fc" outlineWidth={0.03} outlineColor="#000" anchorX="center" anchorY="middle">
                    Isla {player.current_position}
                </Text>
            </Billboard>
        </group>
    );
};

// ─── PLATAFORMAS DE SALTO ────────────────────────────────────────────────────

const JumpPads = ({ start, end, theme }: { start: THREE.Vector3; end: THREE.Vector3; theme: string }) => {
    const themeColors: Record<string, string[]> = {
        jungle: ['#16a34a','#15803d','#14532d'],
        ice:    ['#60a5fa','#93c5fd','#bfdbfe'],
        neon:   ['#8b5cf6','#a855f7','#ec4899'],
        lava:   ['#ef4444','#f97316','#fbbf24'],
    };
    const colors = themeColors[theme] || themeColors.neon;
    const pads: THREE.Vector3[] = [];
    for (let i = 1; i <= 3; i++) {
        const f = i / 4;
        const p = start.clone().lerp(end, f);
        p.y += Math.sin(f * Math.PI) * 0.5 - 0.5;
        pads.push(p);
    }
    return (
        <group>
            {pads.map((p, i) => (
                <Float key={i} speed={2.5} floatIntensity={0.3}>
                    <mesh position={p} castShadow receiveShadow>
                        <boxGeometry args={[1.3, 0.22, 1.3]} />
                        <meshStandardMaterial color={colors[i % colors.length]} roughness={0.2} metalness={0.3} emissive={colors[i % colors.length]} emissiveIntensity={0.15} />
                    </mesh>
                </Float>
            ))}
        </group>
    );
};

// ─── DECORACIONES DE ISLA ───────────────────────────────────────────────────

const Tree = ({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) => (
    <group position={[x, 0.25, z]}>
        <mesh castShadow><cylinderGeometry args={[0.09 * scale, 0.13 * scale, 0.65 * scale, 6]} /><meshStandardMaterial color="#78350f" roughness={0.9} /></mesh>
        <mesh position={[0, 0.6 * scale, 0]} castShadow><sphereGeometry args={[0.44 * scale, 8, 6]} /><meshStandardMaterial color="#16a34a" roughness={0.75} /></mesh>
        <mesh position={[0, 0.88 * scale, 0]} castShadow><sphereGeometry args={[0.28 * scale, 7, 5]} /><meshStandardMaterial color="#15803d" roughness={0.7} /></mesh>
    </group>
);

const Crystal = ({ x, z, color, h = 0.7 }: { x: number; z: number; color: string; h?: number }) => (
    <Float speed={1.5} floatIntensity={0.15}>
        <group position={[x, 0.3, z]}>
            <mesh castShadow><coneGeometry args={[0.14, h, 6]} /><meshStandardMaterial color={color} metalness={0.85} roughness={0.05} emissive={color} emissiveIntensity={0.35} /></mesh>
            <mesh position={[0, -h * 0.42, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.1, h * 0.45, 6]} /><meshStandardMaterial color={color} metalness={0.85} roughness={0.05} emissive={color} emissiveIntensity={0.2} /></mesh>
        </group>
    </Float>
);

const Rock = ({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) => (
    <mesh position={[x, 0.08 * scale, z]} rotation={[0.2, 0.5, 0.1]} castShadow>
        <dodecahedronGeometry args={[0.28 * scale, 0]} />
        <meshStandardMaterial color="#6b7280" roughness={0.95} metalness={0.05} />
    </mesh>
);

const Torch = ({ x, z }: { x: number; z: number }) => (
    <group position={[x, 0.4, z]}>
        <mesh castShadow><cylinderGeometry args={[0.05, 0.06, 0.8, 6]} /><meshStandardMaterial color="#92400e" roughness={0.9} /></mesh>
        <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#fbbf24" emissive="#f97316" emissiveIntensity={1.2} /></mesh>
        <pointLight position={[0, 0.55, 0]} color="#f97316" intensity={1.5} distance={3} decay={2} />
    </group>
);

const IcePillar = ({ x, z }: { x: number; z: number }) => (
    <group position={[x, 0.4, z]}>
        <mesh castShadow><cylinderGeometry args={[0.15, 0.2, 0.9, 6]} /><meshStandardMaterial color="#bfdbfe" metalness={0.4} roughness={0.1} opacity={0.85} transparent /></mesh>
        <mesh position={[0, 0.65, 0]}><coneGeometry args={[0.15, 0.4, 6]} /><meshStandardMaterial color="#93c5fd" metalness={0.5} roughness={0.05} emissive="#60a5fa" emissiveIntensity={0.3} /></mesh>
    </group>
);

const NeonPillar = ({ x, z, color }: { x: number; z: number; color: string }) => (
    <group position={[x, 0.4, z]}>
        <mesh castShadow><boxGeometry args={[0.22, 1, 0.22]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.1} metalness={0.6} /></mesh>
        <pointLight position={[0, 0.6, 0]} color={color} intensity={1.2} distance={2.5} decay={2} />
    </group>
);

// ─── ISLA ───────────────────────────────────────────────────────────────────

function getIslandTheme(index: number, total: number, isSpinner: boolean): string {
    if (isSpinner) return 'lava';
    if (index === 0) return 'start';
    const p = index / total;
    if (p < 0.35) return 'jungle';
    if (p < 0.68) return 'ice';
    return 'neon';
}

const THEME_GRASS: Record<string, string> = {
    start: '#10b981',
    jungle:'#15803d',
    ice:   '#bfdbfe',
    neon:  '#7c3aed',
    lava:  '#dc2626',
};
const THEME_DIRT: Record<string, string> = {
    start: '#3d2f1e',
    jungle:'#44403c',
    ice:   '#1e3a8a',
    neon:  '#1e1b4b',
    lava:  '#7c2d12',
};

const ObbyIsland = ({ index, isEnd = false, isSpiral = false, totalIslands }: { index: number; isEnd?: boolean; isSpiral?: boolean; totalIslands: number }) => {
    const pos = getIslandPosition(index, isSpiral);
    const spinnerRef = useRef<THREE.Group>(null);
    const isSpinner = index % 3 === 0 && !isEnd && index !== 0;
    const theme = isEnd ? 'end' : getIslandTheme(index, totalIslands, isSpinner);
    const grassColor = isEnd ? '#fbbf24' : THEME_GRASS[theme] ?? '#3b82f6';
    const dirtColor  = isEnd ? '#92400e' : THEME_DIRT[theme] ?? '#1e1b4b';

    useFrame((_, delta) => {
        if (isSpinner && spinnerRef.current) spinnerRef.current.rotation.y += delta * 1.4;
    });

    return (
        <group position={[pos.x, pos.y, pos.z]}>
            <Float speed={isEnd ? 0.4 : 1.8} rotationIntensity={isSpinner ? 0 : 0.04} floatIntensity={0.18}>
                <group ref={isSpinner ? spinnerRef : undefined}>
                    {isEnd ? (
                        /* ─── META FINAL ─── */
                        <group>
                            {/* Plataforma dorada */}
                            <mesh position={[0, -1, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[7, 6, 2.2, 16]} />
                                <meshStandardMaterial color="#b45309" metalness={0.9} roughness={0.05} />
                            </mesh>
                            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[7.1, 7.1, 0.35, 16]} />
                                <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.04} emissive="#f59e0b" emissiveIntensity={0.12} />
                            </mesh>
                            {/* Columnas de llegada */}
                            {[[-5, -2.5],[5, -2.5]].map(([cx, cz], i) => (
                                <group key={i} position={[cx, 0, cz]}>
                                    <mesh castShadow><cylinderGeometry args={[0.3, 0.35, 9, 8]} /><meshStandardMaterial color="#f1f5f9" metalness={0.3} roughness={0.2} /></mesh>
                                    <mesh position={[0, 4.7, 0]}><sphereGeometry args={[0.5, 8, 8]} /><meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} metalness={0.8} /></mesh>
                                    <pointLight position={[0, 4.7, 0]} color="#fbbf24" intensity={2} distance={6} />
                                </group>
                            ))}
                            {/* Cartel FINISH */}
                            <mesh position={[0, 5, -2.5]}>
                                <boxGeometry args={[11, 1.8, 0.25]} />
                                <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.4} metalness={0.5} />
                            </mesh>
                            <Text position={[0, 5, -2.35]} fontSize={0.95} color="white" fontWeight="black" outlineWidth={0.05} outlineColor="#000">
                                🏆  FINISH  🏆
                            </Text>
                            {/* Estrellas de brillo */}
                            <Sparkles count={60} scale={[14, 4, 8]} position={[0, 3, 0]} color="#fbbf24" size={5} speed={0.6} opacity={0.8} />
                        </group>
                    ) : (
                        /* ─── ISLA NORMAL ─── */
                        <group>
                            {/* Base rocosa */}
                            <mesh position={[0, -1.1, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[2.7, 2.0, 2.2, 9]} />
                                <meshStandardMaterial color={dirtColor} roughness={0.95} />
                            </mesh>
                            {/* Tope temático */}
                            <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[3.15, 3.15, 0.32, 16]} />
                                <meshStandardMaterial color={grassColor} roughness={0.6} emissive={isSpinner ? '#ef4444' : grassColor} emissiveIntensity={isSpinner ? 0.3 : 0.04} />
                            </mesh>

                            {/* ── Decoraciones por tema ── */}
                            {theme === 'start' && <>
                                <Tree x={-1.6} z={1.2} scale={1.1} />
                                <Tree x={1.7} z={-1.1} scale={0.9} />
                                <Rock x={0.8} z={1.6} scale={0.8} />
                                <Torch x={-1.8} z={-1.6} />
                            </>}

                            {theme === 'jungle' && <>
                                <Tree x={-1.7} z={1.0} scale={1.0} />
                                <Tree x={1.5} z={1.3} scale={0.85} />
                                <Tree x={-1.0} z={-1.8} scale={0.75} />
                                <Torch x={1.8} z={-1.4} />
                                <Rock x={0.5} z={1.8} scale={0.7} />
                            </>}

                            {theme === 'ice' && <>
                                <Crystal x={-1.5} z={0.9} color="#93c5fd" h={0.9} />
                                <Crystal x={1.6} z={-1.0} color="#60a5fa" h={0.7} />
                                <Crystal x={0.3} z={2.0} color="#bfdbfe" h={0.6} />
                                <IcePillar x={-2.0} z={-1.5} />
                                <Rock x={1.8} z={1.6} scale={0.9} />
                            </>}

                            {theme === 'neon' && <>
                                <NeonPillar x={-1.8} z={0.8} color="#8b5cf6" />
                                <NeonPillar x={1.7} z={-1.2} color="#ec4899" />
                                <Crystal x={0.5} z={2.1} color="#a855f7" h={1.0} />
                                <Crystal x={-0.6} z={-2.0} color="#ec4899" h={0.8} />
                            </>}

                            {theme === 'lava' && <>
                                <Crystal x={-1.4} z={0.7} color="#ef4444" h={0.9} />
                                <Crystal x={1.5} z={-0.9} color="#f97316" h={0.7} />
                                <pointLight position={[0, 1.5, 0]} color="#f97316" intensity={3} distance={5} decay={2} />
                            </>}

                            {/* Banderín con número de isla */}
                            {index !== 0 && (
                                <group position={[-2.4, 1.6, -2.2]} rotation={[0, Math.PI / 5, 0]}>
                                    <mesh castShadow><cylinderGeometry args={[0.05, 0.05, 2.8, 5]} /><meshStandardMaterial color="#94a3b8" metalness={0.6} /></mesh>
                                    <mesh position={[0.65, 1.05, 0]} castShadow>
                                        <boxGeometry args={[1.3, 0.85, 0.06]} />
                                        <meshStandardMaterial color={grassColor} emissive={grassColor} emissiveIntensity={0.3} />
                                    </mesh>
                                    <Text position={[0.65, 1.05, 0.04]} fontSize={0.42} color="white" fontWeight="bold" outlineWidth={0.03} outlineColor="#000">
                                        Q{index}
                                    </Text>
                                </group>
                            )}
                        </group>
                    )}

                    {/* Número de isla en el suelo */}
                    <Text
                        position={[0, isEnd ? 0.42 : 0.29, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        fontSize={isEnd ? 2.8 : 1.6}
                        color="white"
                        fillOpacity={0.95}
                        fontWeight="black"
                        outlineWidth={0.07}
                        outlineColor="#000000"
                    >
                        {isEnd ? '★' : index === 0 ? 'GO!' : index}
                    </Text>
                </group>
            </Float>
        </group>
    );
};

// ─── BOARD PRINCIPAL ────────────────────────────────────────────────────────

const MEDAL = ['🥇', '🥈', '🥉'];
const PLAYER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#f97316','#06b6d4','#ef4444','#84cc16'];

export default function RobloxGameBoard({ gameId, players, totalQuestions }: RobloxGameBoardProps) {
    const isSpiral = totalQuestions < 0;
    const absTotal = Math.abs(totalQuestions);
    const islands = useMemo(() => Array.from({ length: absTotal + 1 }).map((_, i) => i), [absTotal]);
    const [hiddenCheaters, setHiddenCheaters]       = useState<string[]>([]);
    const [localForgivenOrders, setLocalForgivenOrders] = useState<string[]>([]);
    const controlsRef = useRef<OrbitControlsImpl>(null);

    // FIX: ordenar por posición primero, luego puntos
    const sortedPlayers = [...players].sort((a, b) =>
        b.current_position - a.current_position || b.score - a.score
    );

    const playersAtFinish = players.filter(p => !hiddenCheaters.includes(p.id) && p.current_position >= absTotal).length;
    // FIX: confetti solo cuando aumenta el conteo
    const confettiFiredRef = useRef(0);
    useEffect(() => {
        if (playersAtFinish > confettiFiredRef.current) {
            confettiFiredRef.current = playersAtFinish;
            confetti({ particleCount: 220, spread: 150, origin: { y: 0.35 }, colors: ['#fbbf24','#6366f1','#10b981','#ec4899','#3b82f6'], zIndex: 9999 });
        }
    }, [playersAtFinish]);

    // Tema de jump pads según progreso de isla
    const getJumpTheme = (i: number) => getIslandTheme(i, absTotal, i % 3 === 0 && i !== 0 && i !== absTotal);

    return (
        <div className="w-full h-full flex flex-col md:flex-row bg-[#060a14] relative overflow-hidden font-sans">

            {/* 3D Viewport */}
            <div className="flex-1 h-full relative">
                <Canvas shadows camera={{ position: [0, 15, 20], fov: 50 }}>
                    <color attach="background" args={["#080f1e"]} />
                    <ambientLight intensity={0.45} />
                    <directionalLight position={[20, 35, 20]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-bottom={-60} shadow-camera-top={60} shadow-camera-left={-60} shadow-camera-right={60} />

                    {/* Suelo */}
                    <mesh position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[600, 600]} />
                        <meshStandardMaterial color="#020617" roughness={0.08} />
                    </mesh>
                    <Grid infiniteGrid fadeDistance={120} sectionColor="#6366f1" cellColor="#1e1b4b" position={[0, -4.9, 0]} sectionSize={5.5} cellThickness={0.4} />

                    {/* Sparkles globales */}
                    <Sparkles count={700} scale={[28, 12, Math.ceil(absTotal / 5) * 12]} position={[0, 5, isSpiral ? 0 : -(Math.ceil(absTotal / 5) * 5)]} color="#a78bfa" size={3.2} speed={0.3} opacity={0.4} />

                    {/* Plataformas de salto temáticas */}
                    {islands.map((i) => {
                        if (i === 0) return null;
                        const start = getIslandPosition(i - 1, isSpiral);
                        const end   = getIslandPosition(i, isSpiral);
                        return <JumpPads key={`path-${i}`} start={start} end={end} theme={getJumpTheme(i)} />;
                    })}

                    {/* Islas */}
                    {islands.map((i) => (
                        <ObbyIsland key={i} index={i} isEnd={i === absTotal} isSpiral={isSpiral} totalIslands={absTotal} />
                    ))}

                    {/* Avatares únicos */}
                    {players.filter(p => !hiddenCheaters.includes(p.id)).map((p, idx) => (
                        <PlayerAvatar key={p.id} player={p} index={idx} absTotal={totalQuestions} />
                    ))}

                    <OrbitControls
                        ref={controlsRef}
                        makeDefault
                        enableDamping
                        dampingFactor={0.05}
                        panSpeed={0.5}
                        rotateSpeed={0.4}
                        zoomSpeed={0.8}
                        maxDistance={160}
                        maxPolarAngle={Math.PI / 2 - 0.05}
                        target={isSpiral
                            ? [0, (absTotal * 2.2) / 2, 0]
                            : [0, 0, -(Math.floor(absTotal / 5) * 10) / 2]
                        }
                    />
                    <Environment preset="night" />
                </Canvas>

                {/* Botones de cámara */}
                <div className="absolute bottom-6 left-6 z-40 flex flex-col gap-2">
                    <button
                        onClick={() => {
                            if (!controlsRef.current) return;
                            const rows = Math.ceil(absTotal / 5);
                            const centerZ = -(rows * 10) / 2;
                            controlsRef.current.target.set(0, isSpiral ? (absTotal * 1.5) / 2 : 0, isSpiral ? 0 : centerZ);
                            const cam = controlsRef.current.object;
                            if (isSpiral) { const r = 7 + absTotal * 2.2; const h = absTotal * 2.2; cam.position.set(r * 1.4, h * 1.1 + 20, r * 1.6); }
                            else { const depth = rows * 10; cam.position.set(0, Math.max(35, depth * 0.7), Math.max(30, centerZ + depth * 0.6)); }
                            controlsRef.current.update();
                        }}
                        className="bg-slate-800/90 hover:bg-slate-700 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-slate-900/50 backdrop-blur-md flex items-center gap-2 border border-slate-600/40 transition-all active:scale-95 text-sm"
                    >
                        <span>🗺️</span> Ver todo el mapa
                    </button>
                    <button
                        onClick={() => {
                            if (!controlsRef.current || sortedPlayers.length === 0) return;
                            const lider = sortedPlayers[0];
                            const pos = getIslandPosition(Math.max(0, Math.min(lider.current_position, absTotal)), isSpiral);
                            controlsRef.current.target.set(pos.x, pos.y, pos.z);
                            controlsRef.current.object.position.set(pos.x, pos.y + 10, pos.z + 15);
                            controlsRef.current.update();
                        }}
                        className="bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-indigo-900/50 backdrop-blur-md flex items-center gap-2 border border-indigo-400/30 transition-all active:scale-95 text-sm"
                    >
                        <span>👑</span> Enfocar líder
                    </button>
                </div>

                {/* Alertas de trampa */}
                {players.filter(p => p.is_blocked && !hiddenCheaters.includes(p.id) && !localForgivenOrders.includes(p.id)).length > 0 && (
                    <div className="absolute top-20 right-4 z-[9999] flex flex-col gap-3 w-72">
                        {players.filter(p => p.is_blocked && !hiddenCheaters.includes(p.id) && !localForgivenOrders.includes(p.id)).map(cheater => (
                            <div key={cheater.id} className="bg-slate-900/98 backdrop-blur-xl border border-red-500/40 p-4 rounded-2xl shadow-2xl shadow-red-900/20 flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xl shrink-0">🚨</div>
                                    <div>
                                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Abandono detectado</p>
                                        <p className="font-black text-white text-sm">{cheater.player_name}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={async () => { setLocalForgivenOrders(prev => [...prev, cheater.id]); await supabase.from("game_players").update({ is_blocked: false }).eq("id", cheater.id); setTimeout(() => setLocalForgivenOrders(prev => prev.filter(id => id !== cheater.id)), 2000); }} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-3 py-2 rounded-xl text-xs transition-all active:scale-95">✅ Perdonar</button>
                                    <button onClick={async () => { setHiddenCheaters(prev => [...prev, cheater.id]); await supabase.from("game_players").update({ current_position: -999, is_blocked: true }).eq("id", cheater.id); await supabase.from("game_players").delete().eq("id", cheater.id); }} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black px-3 py-2 rounded-xl text-xs transition-all active:scale-95">🚫 Expulsar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Título */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <div className="flex items-center gap-2.5 mb-0.5">
                        <span className="text-3xl drop-shadow-lg">🏝️</span>
                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 uppercase tracking-widest drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                            Strive Obby
                        </h2>
                    </div>
                    <p className="text-indigo-300/70 font-bold text-xs drop-shadow-md pl-1">
                        {isSpiral ? '🌀 Espiral' : '⚡ Clásico'} · {absTotal} islas · {players.length} jugadores
                    </p>
                </div>
            </div>

            {/* ─── SIDEBAR LEADERBOARD PREMIUM ─── */}
            <div className="w-full md:w-72 h-full bg-slate-950 border-l border-slate-800/60 flex flex-col z-20">

                {/* Header */}
                <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-base">🏆</div>
                            <h3 className="text-base font-black text-white uppercase tracking-widest">Ranking</h3>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-400">EN VIVO</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span>{players.length} jugadores</span>
                        {playersAtFinish > 0 && <span className="text-amber-400">{playersAtFinish} en meta ✅</span>}
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {sortedPlayers.map((p, idx) => {
                        const isFinished  = p.current_position >= absTotal;
                        // FIX: usar absTotal para barra de progreso
                        const progressPct = absTotal > 0 ? Math.min(100, (Math.max(0, p.current_position) / absTotal) * 100) : 0;
                        const playerColor = PLAYER_COLORS[players.findIndex(pl => pl.id === p.id) % PLAYER_COLORS.length];
                        const isLeader    = idx === 0 && !isFinished;

                        return (
                            <div
                                key={p.id}
                                className={`relative px-3 py-3 border-b border-slate-800/50 flex items-center gap-3 transition-all ${
                                    isFinished ? 'bg-amber-500/8' : isLeader ? 'bg-indigo-500/8' : ''
                                }`}
                            >
                                {/* Barra de fondo de progreso sutil */}
                                <div
                                    className="absolute inset-0 pointer-events-none opacity-[0.06]"
                                    style={{ background: `linear-gradient(to right, ${playerColor} ${progressPct}%, transparent ${progressPct}%)` }}
                                />

                                {/* Posición */}
                                <div className="w-8 flex items-center justify-center shrink-0 z-10">
                                    {isFinished
                                        ? <span className="text-lg">✅</span>
                                        : idx < 3
                                            ? <span className="text-lg">{MEDAL[idx]}</span>
                                            : <span className="text-sm font-black text-slate-600">#{idx + 1}</span>
                                    }
                                </div>

                                {/* Avatar GIF del jugador */}
                                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border-2 z-10" style={{ borderColor: isFinished ? '#fbbf24' : playerColor }}>
                                    <img src={p.avatar_gif_url} alt="" className="w-full h-full object-cover" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 z-10">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className={`font-black text-xs truncate ${isLeader ? 'text-indigo-300' : isFinished ? 'text-amber-300' : 'text-white'}`}>
                                            {isLeader && <span className="mr-1">👑</span>}
                                            {p.player_name}
                                        </p>
                                        <span className="text-[10px] font-black tabular-nums ml-1 shrink-0" style={{ color: isFinished ? '#fbbf24' : playerColor }}>
                                            {p.current_position}/{absTotal}
                                        </span>
                                    </div>
                                    {/* Barra de progreso */}
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{ width: `${progressPct}%`, backgroundColor: isFinished ? '#fbbf24' : playerColor }}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-600 font-bold mt-0.5 tabular-nums">{p.score} pts</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6366f1; }
            `}</style>
        </div>
    );
}
