'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/game/store';
import Sky from '@/game/components/Sky';
import Lighting from '@/game/components/Lighting';
import Ground from '@/game/components/Ground';
import Player from '@/game/components/Player';
import ThirdPersonCamera from '@/game/components/ThirdPersonCamera';
import CollectibleItem from '@/game/components/CollectibleItem';
import type { Collectible, Enemy } from '@/game/types';

// ============================================================
// DATA DEFINITIONS
// ============================================================

// ---- World Layout ----
// Forest (center):   x[-20,20]   z[-20,20]
// Desert (east):     x[ 20,50]   z[-15,15]
// Snow   (north):    x[-15,15]   z[-50,-20]
// Lava   (south):    x[-15,15]   z[ 20,50]
// Village (west):    x[-50,-20]  z[-15,15]

// ---- Trees (20+ in forest area) ----
const TREE_DATA: Array<[number, number, number, number]> = [
  [-12, 0, -12, 1.1],
  [-8, 0, -15, 0.9],
  [-3, 0, -10, 1.3],
  [5, 0, -14, 1.0],
  [10, 0, -8, 1.2],
  [15, 0, -12, 0.85],
  [-15, 0, -5, 1.0],
  [-10, 0, 0, 1.15],
  [-5, 0, 5, 1.25],
  [2, 0, 8, 0.95],
  [8, 0, 3, 1.05],
  [14, 0, 7, 1.1],
  [-14, 0, 10, 0.9],
  [-7, 0, 14, 1.2],
  [0, 0, 16, 1.0],
  [12, 0, -2, 1.3],
  [-16, 0, -16, 1.0],
  [16, 0, -16, 0.8],
  [16, 0, 14, 1.15],
  [-4, 0, -18, 1.0],
  [6, 0, 12, 0.9],
  [-18, 0, 2, 1.1],
];

// ---- Rocks (15+ scattered) ----
const ROCK_DATA: Array<[number, number, number, number]> = [
  [-6, 0, -7, 0.7],
  [3, 0, -3, 0.55],
  [11, 0, -5, 0.65],
  [-9, 0, 6, 0.5],
  [7, 0, 10, 0.75],
  [-3, 0, 12, 0.6],
  [14, 0, -14, 0.55],
  [-11, 0, -3, 0.7],
  [0, 0, -6, 0.45],
  [25, 0, -8, 0.8],
  [30, 0, 5, 0.65],
  [38, 0, -3, 0.7],
  [-5, 0, -30, 0.6],
  [8, 0, -35, 0.75],
  [-8, 0, -40, 0.55],
  [5, 0, 30, 0.65],
  [-10, 0, 35, 0.7],
];

// ---- Cacti (desert) ----
const CACTUS_DATA: Array<[number, number, number, number]> = [
  [24, 0, -8, 1.0],
  [28, 0, 5, 1.2],
  [33, 0, -4, 0.9],
  [38, 0, 8, 1.1],
  [42, 0, -6, 1.0],
  [36, 0, 0, 0.85],
  [30, 0, -10, 1.05],
  [45, 0, 3, 0.95],
];

// ---- Ice Pillars (snow) ----
const ICE_PILLAR_DATA: Array<[number, number, number, number]> = [
  [-8, 0, -30, 1.2],
  [0, 0, -35, 1.0],
  [8, 0, -28, 1.3],
  [-5, 0, -42, 0.9],
  [10, 0, -38, 1.1],
  [-12, 0, -36, 1.0],
  [5, 0, -45, 0.85],
];

// ---- Snowmen (snow) ----
const SNOWMAN_DATA: Array<[number, number, number]> = [
  [-3, 0, -32],
  [6, 0, -40],
  [-10, 0, -44],
];

// ---- Houses (village, 5) ----
const HOUSE_DATA: Array<[number, number, number, number, string]> = [
  [-30, 0, -8, 1.0, '#d97706'],
  [-38, 0, 2, 0.9, '#dc2626'],
  [-28, 0, 8, 1.1, '#2563eb'],
  [-42, 0, -4, 0.85, '#7c3aed'],
  [-35, 0, -12, 1.0, '#059669'],
];

// ---- Towers (3) ----
const TOWER_DATA: Array<[number, number, number, number]> = [
  [-10, 0, -18, 1.0],
  [18, 0, -18, 1.0],
  [-18, 0, 0, 1.0],
];

// ---- Bridges (2) ----
const BRIDGE_DATA: Array<{
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
}> = [
  { position: [20, 0.5, 0], rotation: [0, 0, 0], length: 4 },
  { position: [0, 0.5, -20], rotation: [0, Math.PI / 2, 0], length: 4 },
];

// ---- Fence Segments (village) ----
const FENCE_DATA: Array<[number, number, number, number]> = [
  [-25, 0, -14, 0],
  [-27, 0, -14, 0],
  [-29, 0, -14, 0],
  [-31, 0, -14, 0],
  [-25, 0, 12, 0],
  [-27, 0, 12, 0],
  [-29, 0, 12, 0],
  [-31, 0, 12, 0],
  [-44, 0, -6, Math.PI / 2],
  [-44, 0, -4, Math.PI / 2],
  [-44, 0, -2, Math.PI / 2],
];

// ---- Water Ponds (forest) ----
const POND_DATA: Array<[number, number, number, number, number]> = [
  [-8, 0.05, 4, 6, 4],
  [10, 0.05, -4, 5, 3],
];

// ---- Campfires (village) ----
const CAMPFIRE_DATA: Array<[number, number, number]> = [
  [-26, 0, 4],
  [-36, 0, 10],
];

// ---- Signposts (area borders) ----
const SIGN_DATA: Array<[number, number, number, string]> = [
  [19, 0, 0, 'Desert ->'],
  [-19, 0, 0, '<- Village'],
  [0, 0, -19, 'Snow ->'],
  [0, 0, 19, 'Lava ->'],
  [15, 0, 15, 'Lava ->'],
  [15, 0, -15, 'Snow ->'],
  [-15, 0, 15, 'Lava ->'],
  [-15, 0, -15, 'Forest'],
];

// ---- Lava Pools (lava area) ----
const LAVA_POOL_DATA: Array<[number, number, number, number, number]> = [
  [0, 0.1, 30, 5, 4],
  [-8, 0.1, 38, 4, 3],
  [7, 0.1, 42, 3, 5],
  [10, 0.1, 35, 3, 3],
];

// ---- Lava Cracks (lines) ----
const LAVA_CRACK_DATA: Array<[number, number, number, number, number]> = [
  [-3, 0.06, 25, 12, 0.3],
  [5, 0.06, 32, 0.3, 8],
  [-10, 0.06, 40, 8, 0.25],
  [3, 0.06, 45, 0.25, 6],
  [-6, 0.06, 35, 10, 0.2],
];

// ---- 20 Coins ----
const COIN_POSITIONS: Array<[number, number, number]> = [
  // Forest area (6 coins)
  [0, 1.5, 0],
  [-8, 1.5, -5],
  [5, 1.5, 10],
  [12, 4.5, -8],        // on top of tree
  [-15, 1.5, 3],
  [3, 1.5, -12],
  // Desert area (4 coins)
  [28, 1.5, 0],
  [35, 1.5, -5],
  [42, 1.5, 6],
  [25, 1.5, 10],
  // Snow area (4 coins)
  [0, 1.5, -30],
  [-8, 1.5, -38],
  [10, 1.5, -35],
  [5, 1.5, -45],
  // Lava area (3 coins) - dangerous
  [0, 1.5, 28],
  [-7, 1.5, 38],
  [8, 1.5, 42],
  // Village area (3 coins)
  [-28, 4.5, -8],        // on top of house
  [-38, 1.5, 2],
  [-35, 1.5, -12],
];

// ---- 5 Rare Gems (hard-to-reach) ----
const GEM_POSITIONS: Array<[number, number, number]> = [
  [-10, 14, -18],        // top of tower
  [18, 14, -18],         // top of tower
  [-18, 14, 0],          // top of tower
  [45, 3.5, 0],          // top of tall cactus in desert
  [-3, 1.5, -46],        // deep in snow area
];

// ---- 5 Treasure Chests ----
const CHEST_DATA: Array<[number, number, number, number]> = [
  [8, 0.6, -10, 200],     // hidden behind forest trees
  [40, 0.6, -2, 300],     // deep in desert
  [0, 0.6, -42, 250],     // deep in snow
  [-5, 0.6, 40, 400],     // near lava (dangerous)
  [-42, 0.6, 6, 500],     // deep in village
];

// ---- 8 Patrol Enemies ----
const ENEMY_DATA: Array<{
  id: string;
  patrolCenter: [number, number, number];
  patrolRange: number;
  patrolAxis: 'x' | 'z';
  speed: number;
}> = [
  { id: 'enemy-1', patrolCenter: [5, 0.6, 5], patrolRange: 6, patrolAxis: 'x', speed: 2.5 },
  { id: 'enemy-2', patrolCenter: [-10, 0.6, -8], patrolRange: 5, patrolAxis: 'z', speed: 2.0 },
  { id: 'enemy-3', patrolCenter: [30, 0.6, 5], patrolRange: 8, patrolAxis: 'x', speed: 3.0 },
  { id: 'enemy-4', patrolCenter: [5, 0.6, -32], patrolRange: 6, patrolAxis: 'z', speed: 2.5 },
  { id: 'enemy-5', patrolCenter: [-5, 0.6, 35], patrolRange: 7, patrolAxis: 'x', speed: 2.8 },
  { id: 'enemy-6', patrolCenter: [-32, 0.6, 0], patrolRange: 5, patrolAxis: 'z', speed: 2.2 },
  { id: 'enemy-7', patrolCenter: [15, 0.6, 0], patrolRange: 6, patrolAxis: 'x', speed: 2.6 },
  { id: 'enemy-8', patrolCenter: [0, 0.6, -40], patrolRange: 5, patrolAxis: 'x', speed: 3.0 },
];

// ============================================================
// SUB-COMPONENTS
// ============================================================

// ---- Forest Tree ----
function ForestTree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25 * scale, 1.5 * scale, 0.25 * scale]} position={[0, 1.5 * scale, 0]} />
      </RigidBody>
      {/* Trunk */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.5, 3, 0.5]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
      {/* Lower foliage */}
      <mesh position={[0, 3.6, 0]} castShadow>
        <coneGeometry args={[2, 3, 6]} />
        <meshStandardMaterial color="#22c55e" roughness={0.8} />
      </mesh>
      {/* Upper foliage */}
      <mesh position={[0, 5.2, 0]} castShadow>
        <coneGeometry args={[1.4, 2.2, 6]} />
        <meshStandardMaterial color="#16a34a" roughness={0.8} />
      </mesh>
      {/* Top foliage */}
      <mesh position={[0, 6.4, 0]} castShadow>
        <coneGeometry args={[0.8, 1.4, 6]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ---- Bush ----
function Bush({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshStandardMaterial color="#16a34a" roughness={0.9} />
      </mesh>
      <mesh position={[0.3, 0.25, 0.2]} castShadow>
        <sphereGeometry args={[0.35, 5, 4]} />
        <meshStandardMaterial color="#22c55e" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---- Desert Cactus ----
function DesertCactus({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const height = 3 * scale;
  return (
    <group position={position} scale={scale}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25 * scale, height / 2, 0.25 * scale]} position={[0, height / 2, 0]} />
      </RigidBody>
      {/* Main body */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, height, 6]} />
        <meshStandardMaterial color="#22c55e" roughness={0.7} />
      </mesh>
      {/* Left arm */}
      <group position={[-0.35, height * 0.5, 0]}>
        <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.15, 0.18, 0.8, 5]} />
          <meshStandardMaterial color="#16a34a" roughness={0.7} />
        </mesh>
        <mesh position={[-0.6, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.18, 0.8, 5]} />
          <meshStandardMaterial color="#16a34a" roughness={0.7} />
        </mesh>
      </group>
      {/* Right arm */}
      <group position={[0.35, height * 0.6, 0]}>
        <mesh position={[0.25, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.12, 0.15, 0.6, 5]} />
          <meshStandardMaterial color="#15803d" roughness={0.7} />
        </mesh>
        <mesh position={[0.5, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.15, 0.6, 5]} />
          <meshStandardMaterial color="#15803d" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// ---- Ice Pillar ----
function IcePillar({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.2 + Math.sin(t * 1.5 + position[0]) * 0.1;
  });
  return (
    <group position={position} scale={scale}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5 * scale, 2 * scale, 0.5 * scale]} position={[0, 2 * scale, 0]} />
      </RigidBody>
      <mesh ref={ref} position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.6, 4, 6]} />
        <meshStandardMaterial
          color="#e0f2fe"
          emissive="#7dd3fc"
          emissiveIntensity={0.2}
          transparent
          opacity={0.8}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}

// ---- Snowman ----
function Snowman({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.6, 8, 6]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <sphereGeometry args={[0.45, 8, 6]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.1, 2.18, 0.26]}>
        <boxGeometry args={[0.06, 0.06, 0.04]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.1, 2.18, 0.26]}>
        <boxGeometry args={[0.06, 0.06, 0.04]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>
      {/* Nose (carrot) */}
      <mesh position={[0, 2.08, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.25, 5]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      {/* Hat */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.05, 6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

// ---- House ----
function House({ position, scale = 1, wallColor }: { position: [number, number, number]; scale?: number; wallColor?: string }) {
  const color = wallColor || '#d97706';
  const roofHeight = 2 * scale;
  const roofWidth = 4 * scale;
  const wallHeight = 2.5 * scale;
  const wallWidth = 3.5 * scale;
  const wallDepth = 3 * scale;

  return (
    <group position={position} scale={scale}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[wallWidth / 2, wallHeight / 2, wallDepth / 2]} position={[0, wallHeight / 2, 0]} />
        <CuboidCollider args={[0.3, roofHeight / 2, wallDepth / 2 + 0.1]} position={[roofWidth / 2 - 0.3, wallHeight + roofHeight / 2, 0]} />
        <CuboidCollider args={[0.3, roofHeight / 2, wallDepth / 2 + 0.1]} position={[-(roofWidth / 2 - 0.3), wallHeight + roofHeight / 2, 0]} />
      </RigidBody>
      {/* Walls */}
      <mesh position={[0, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallWidth, wallHeight, wallDepth]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Roof - left slope */}
      <mesh
        position={[-roofWidth / 4, wallHeight + roofHeight / 2, 0]}
        rotation={[0, 0, -Math.PI / 6]}
        castShadow
      >
        <boxGeometry args={[roofWidth / 2 / Math.cos(Math.PI / 6), roofHeight, wallDepth + 0.4]} />
        <meshStandardMaterial color="#991b1b" roughness={0.7} />
      </mesh>
      {/* Roof - right slope */}
      <mesh
        position={[roofWidth / 4, wallHeight + roofHeight / 2, 0]}
        rotation={[0, 0, Math.PI / 6]}
        castShadow
      >
        <boxGeometry args={[roofWidth / 2 / Math.cos(Math.PI / 6), roofHeight, wallDepth + 0.4]} />
        <meshStandardMaterial color="#991b1b" roughness={0.7} />
      </mesh>
      {/* Roof ridge */}
      <mesh position={[0, wallHeight + roofHeight - 0.1, 0]} castShadow>
        <boxGeometry args={[0.2, 0.2, wallDepth + 0.6]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.65, wallDepth / 2 + 0.01]}>
        <boxGeometry args={[0.7, 1.3, 0.05]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* Window left */}
      <mesh position={[-1, 1.5, wallDepth / 2 + 0.01]}>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
        <meshStandardMaterial color="#bfdbfe" emissive="#93c5fd" emissiveIntensity={0.2} />
      </mesh>
      {/* Window right */}
      <mesh position={[1, 1.5, wallDepth / 2 + 0.01]}>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
        <meshStandardMaterial color="#bfdbfe" emissive="#93c5fd" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

// ---- Tower ----
function Tower({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const s = scale;
  return (
    <group position={position} scale={s}>
      <RigidBody type="fixed" colliders={false}>
        {/* Main shaft collider */}
        <CuboidCollider args={[1, 7, 1]} position={[0, 7, 0]} />
        {/* Top platform collider */}
        <CuboidCollider args={[1.5, 0.3, 1.5]} position={[0, 14.15, 0]} />
        {/* Step colliders for climbing */}
        {[-0.9, -0.3, 0.3, 0.9].map((xOff, i) => (
          <CuboidCollider
            key={i}
            args={[0.5, 0.15, 0.6]}
            position={[xOff, 2 + i * 3, 0.5]}
          />
        ))}
      </RigidBody>
      {/* Tower base */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 1, 3]} />
        <meshStandardMaterial color="#78716c" roughness={0.9} />
      </mesh>
      {/* Tower shaft */}
      <mesh position={[0, 7, 0]} castShadow>
        <boxGeometry args={[2, 12, 2]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.85} />
      </mesh>
      {/* Crenellations (top) */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(angle) * 1.5, 14.5, Math.cos(angle) * 1.5]} castShadow>
            <boxGeometry args={[0.6, 0.8, 0.6]} />
            <meshStandardMaterial color="#78716c" roughness={0.9} />
          </mesh>
        );
      })}
      {/* Top platform */}
      <mesh position={[0, 14, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 0.3, 3.5]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.8} />
      </mesh>
      {/* Steps (alternating sides for climbing) */}
      {[-0.9, -0.3, 0.3, 0.9].map((xOff, i) => (
        <mesh key={`step-${i}`} position={[xOff, 2 + i * 3, 0.5]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.2, 0.8]} />
          <meshStandardMaterial color="#92400e" roughness={0.9} />
        </mesh>
      ))}
      {/* Flag pole */}
      <mesh position={[0, 16.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 4, 4]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {/* Flag */}
      <mesh position={[0.4, 17.8, 0]}>
        <boxGeometry args={[0.8, 0.5, 0.03]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

// ---- Bridge ----
function Bridge({ position, rotation, length }: { position: [number, number, number]; rotation: [number, number, number]; length: number }) {
  const isRotated = rotation[1] !== 0;
  return (
    <group position={position} rotation={rotation as unknown as THREE.Euler}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[length / 2, 0.2, 1.2]} position={[0, 0, 0]} />
      </RigidBody>
      {/* Planks */}
      {Array.from({ length: Math.floor(length / 0.8) }, (_, i) => (
        <mesh
          key={i}
          position={[(i - length / 1.6) * 0.8, 0.05, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.7, 0.12, 1.1]} />
          <meshStandardMaterial color="#92400e" roughness={0.95} />
        </mesh>
      ))}
      {/* Rails */}
      <mesh position={[0, 0.5, -0.55]} castShadow>
        <boxGeometry args={[length, 0.1, 0.1]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0.55]} castShadow>
        <boxGeometry args={[length, 0.1, 0.1]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* Posts */}
      <mesh position={[-length / 2 + 0.3, 0.4, -0.55]} castShadow>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[length / 2 - 0.3, 0.4, -0.55]} castShadow>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[-length / 2 + 0.3, 0.4, 0.55]} castShadow>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[length / 2 - 0.3, 0.4, 0.55]} castShadow>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---- Fence Segment ----
function FenceSegment({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[-0.9, 0.4, 0]} castShadow>
        <boxGeometry args={[0.12, 0.8, 0.12]} />
        <meshStandardMaterial color="#a16207" roughness={0.9} />
      </mesh>
      <mesh position={[0.9, 0.4, 0]} castShadow>
        <boxGeometry args={[0.12, 0.8, 0.12]} />
        <meshStandardMaterial color="#a16207" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[2, 0.08, 0.08]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[2, 0.06, 0.06]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ---- Water Pond ----
function WaterPond({ position, width, depth }: { position: [number, number, number]; width: number; depth: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.15 + Math.sin(t * 0.8 + position[0]) * 0.05;
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color="#3b82f6"
        emissive="#1d4ed8"
        emissiveIntensity={0.15}
        transparent
        opacity={0.7}
        roughness={0.2}
        metalness={0.3}
      />
    </mesh>
  );
}

// ---- Campfire ----
function Campfire({ position }: { position: [number, number, number] }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const setParticleRef = useCallback((el: THREE.Mesh | null, idx: number) => {
    particleRefs.current[idx] = el;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (lightRef.current) {
      lightRef.current.intensity = 3 + Math.sin(t * 4) * 1 + Math.random() * 0.5;
    }
    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const speed = 1.5 + i * 0.3;
      const offset = i * 1.3;
      mesh.position.y = 0.5 + ((t * speed + offset) % 1.5);
      mesh.position.x = Math.sin(t * 2 + i) * 0.15;
      mesh.position.z = Math.cos(t * 2.5 + i) * 0.15;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - ((t * speed + offset) % 1.5) / 1.5);
    });
  });

  return (
    <group position={position}>
      {/* Stones ring */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.4, 0.1, Math.sin(angle) * 0.4]} castShadow>
            <dodecahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#6b7280" roughness={0.95} />
          </mesh>
        );
      })}
      {/* Logs */}
      <mesh position={[-0.15, 0.15, 0]} rotation={[0, 0.3, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.5, 5]} />
        <meshStandardMaterial color="#78350f" roughness={0.95} />
      </mesh>
      <mesh position={[0.15, 0.15, 0]} rotation={[0, -0.3, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.5, 5]} />
        <meshStandardMaterial color="#78350f" roughness={0.95} />
      </mesh>
      {/* Light */}
      <pointLight ref={lightRef} position={[0, 0.8, 0]} color="#f97316" intensity={3} distance={10} decay={2} />
      {/* Fire particles */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => setParticleRef(el, i)}
          position={[0, 0.5, 0]}
        >
          <boxGeometry args={[0.08, 0.12, 0.08]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#f97316' : '#fbbf24'} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Signpost ----
function Signpost({ position, label }: { position: [number, number, number]; label: string }) {
  return (
    <group position={position}>
      {/* Post */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.1, 2.4, 0.1]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
      {/* Sign board */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <boxGeometry args={[1.4, 0.5, 0.08]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.85} />
      </mesh>
      {/* Text */}
      <Text
        position={[0, 2.0, 0.05]}
        fontSize={0.2}
        color="#1c1917"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

// ---- Lava Pool ----
function LavaPool({ position, width, depth }: { position: [number, number, number]; width: number; depth: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.8 + Math.sin(t * 2 + position[0]) * 0.3;
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color="#dc2626"
        emissive="#ef4444"
        emissiveIntensity={0.8}
        transparent
        opacity={0.9}
        roughness={0.3}
      />
    </mesh>
  );
}

// ---- Lava Crack ----
function LavaCrack({ position, length, width }: { position: [number, number, number]; length: number; width: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.5 + Math.sin(t * 3 + position[0] + position[2]) * 0.3;
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[length, width]} />
      <meshStandardMaterial
        color="#991b1b"
        emissive="#ef4444"
        emissiveIntensity={0.5}
        roughness={0.5}
      />
    </mesh>
  );
}

// ---- Lava Fire Particles ----
function LavaFireParticle({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const offset = useRef(Math.random() * Math.PI * 2);
  const speed = useRef(0.8 + Math.random() * 0.6);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const cycle = (t * speed.current + offset.current) % 2;
    ref.current.position.y = position[1] + cycle * 1.5;
    ref.current.position.x = position[0] + Math.sin(t * 1.5 + offset.current) * 0.3;
    ref.current.position.z = position[2] + Math.cos(t * 2 + offset.current) * 0.3;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 1 - cycle / 2);
    const scale = Math.max(0.05, 0.12 * (1 - cycle / 2));
    ref.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#f97316" transparent opacity={1} />
    </mesh>
  );
}

// ---- Treasure Chest ----
function TreasureChest({
  id,
  position,
  reward,
  onOpen,
}: {
  id: string;
  position: [number, number, number];
  reward: number;
  onOpen: (id: string, reward: number) => void;
}) {
  const [isOpened, setIsOpened] = useState(false);
  const [isNearby, setIsNearby] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<(THREE.Mesh | null)[]>([]);
  const setParticleRef = useCallback((el: THREE.Mesh | null, idx: number) => {
    particlesRef.current[idx] = el;
  }, []);
  const burstTime = useRef(-1);

  useFrame((state) => {
    // Check proximity to player using rapier
    // We'll approximate by using the player position from the scene
    if (isOpened && burstTime.current >= 0) {
      const t = state.clock.getElapsedTime();
      const elapsed = t - burstTime.current;
      if (elapsed < 2) {
        particlesRef.current.forEach((mesh, i) => {
          if (!mesh) return;
          const angle = (i / 12) * Math.PI * 2;
          const dist = elapsed * 3;
          const height = elapsed * 2 - elapsed * elapsed * 0.5;
          mesh.position.set(
            Math.cos(angle) * dist,
            Math.max(0, height),
            Math.sin(angle) * dist
          );
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, 1 - elapsed / 2);
        });
      } else {
        particlesRef.current.forEach((mesh) => {
          if (mesh) (mesh as THREE.Mesh).visible = false;
        });
      }
    }

    // Animate lid open
    if (isOpened && lidRef.current) {
      lidRef.current.rotation.x = Math.min(lidRef.current.rotation.x + 0.05, -Math.PI / 2);
    }

    // Glow effect
    if (groupRef.current && !isOpened) {
      const t = state.clock.getElapsedTime();
      const glowMesh = groupRef.current.children[0] as THREE.Mesh;
      if (glowMesh?.material) {
        const mat = glowMesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15;
      }
    }
  });

  // Handle E key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' && isNearby && !isOpened) {
        setIsOpened(true);
        burstTime.current = state?.clock?.getElapsedTime?.() ?? Date.now() / 1000;
        onOpen(id, reward);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNearby, isOpened, id, reward, onOpen]);

  return (
    <group position={position}>
      <RigidBody
        type="fixed"
        name={`chest-${id}`}
        colliders={false}
        sensor
        onIntersectionEnter={() => setIsNearby(true)}
        onIntersectionExit={() => setIsNearby(false)}
      >
        <CuboidCollider args={[1.2, 1, 1.2]} sensor position={[0, 0.6, 0]} />
      </RigidBody>
      <group ref={groupRef}>
        {/* Base */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[1, 0.7, 0.7]} />
          <meshStandardMaterial
            color="#92400e"
            emissive="#fbbf24"
            emissiveIntensity={0.3}
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
        {/* Gold trim - bottom */}
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[1.05, 0.08, 0.75]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Gold trim - middle */}
        <mesh position={[0, 0.5, 0.36]}>
          <boxGeometry args={[1.05, 0.06, 0.02]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.5, -0.36]}>
          <boxGeometry args={[1.05, 0.06, 0.02]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Lock */}
        <mesh position={[0, 0.45, 0.36]}>
          <boxGeometry args={[0.12, 0.12, 0.05]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Lid */}
        <mesh ref={lidRef} position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[1, 0.05, 0.72]} />
          <meshStandardMaterial
            color="#78350f"
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
        {/* Gold trim on lid */}
        <mesh position={[0, 0.73, 0]}>
          <boxGeometry args={[1.05, 0.03, 0.74]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Interaction prompt */}
        {isNearby && !isOpened && (
          <Text
            position={[0, 1.5, 0]}
            fontSize={0.25}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {`Press [E] (+${reward} coins)`}
          </Text>
        )}
      </group>
      {/* Burst particles (hidden until opened) */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => setParticleRef(el, i)}
          position={[0, 0.7, 0]}
          visible={false}
        >
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Patrol Enemy ----
function PatrolEnemy({
  data,
  onPlayerContact,
}: {
  data: { id: string; patrolCenter: [number, number, number]; patrolRange: number; patrolAxis: 'x' | 'z'; speed: number };
  onPlayerContact: (enemyId: string) => void;
}) {
  const ref = useRef<any>(null);
  const groupRef = useRef<THREE.Group>(null);
  const isChasing = useRef(false);
  const time = useRef(0);
  const contactCooldown = useRef(0);

  useFrame((state, delta) => {
    if (!ref.current || !groupRef.current) return;
    const rb = ref.current;
    const t = state.clock.getElapsedTime();

    // Find player position from the rapier world
    let playerPos: { x: number; z: number } | null = null;
    try {
      const bodies = rb.world().rigidBodies();
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const name = body.name();
        if (name === 'player-body') {
          const pos = body.translation();
          playerPos = { x: pos.x, z: pos.z };
          break;
        }
      }
    } catch {
      // world access may not be available
    }

    const cx = data.patrolCenter[0];
    const cz = data.patrolCenter[2];
    const currentPos = rb.translation();

    // Check if player is in chase range
    if (playerPos) {
      const dx = playerPos.x - currentPos.x;
      const dz = playerPos.z - currentPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      isChasing.current = dist < 8;
    }

    let targetX = cx + Math.sin(t * data.speed * 0.5) * data.patrolRange;
    let targetZ = cz + Math.cos(t * data.speed * 0.5) * data.patrolRange;

    if (isChasing.current && playerPos) {
      targetX = playerPos.x;
      targetZ = playerPos.z;
    }

    // Move toward target
    const dirX = targetX - currentPos.x;
    const dirZ = targetZ - currentPos.z;
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (dirLen > 0.1) {
      const moveSpeed = isChasing.current ? data.speed * 1.8 : data.speed;
      rb.setLinvel(
        { x: (dirX / dirLen) * moveSpeed, y: currentPos.y < 0.3 ? 2 : 0, z: (dirZ / dirLen) * moveSpeed },
        true
      );
      // Face direction
      const angle = Math.atan2(dirX, dirZ);
      groupRef.current.rotation.y = angle;
    }

    // Contact cooldown
    if (contactCooldown.current > 0) {
      contactCooldown.current -= delta;
    }
  });

  return (
    <RigidBody
      ref={ref}
      type="dynamic"
      position={data.patrolCenter}
      enabledRotations={[false, false, false]}
      lockRotations
      mass={1}
      colliders={false}
      name={`enemy-${data.id}`}
      onCollisionEnter={(other) => {
        if (contactCooldown.current > 0) return;
        const collidingName = (other as any).other?.rigidBodyObject?.name
          || (other as any).rigidBodyObject?.name
          || (other as any).colliderObject?.name;
        if (collidingName === 'player-body') {
          onPlayerContact(data.id);
          contactCooldown.current = 1.5;
        }
      }}
    >
      <CuboidCollider args={[0.5, 0.5, 0.5]} position={[0, 0.5, 0]} />
      <group ref={groupRef} position={[0, 0, 0]}>
        {/* Body */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#dc2626"
            emissiveIntensity={0.2}
            roughness={0.6}
          />
        </mesh>
        {/* Left eye */}
        <mesh position={[-0.15, 0.6, 0.41]}>
          <boxGeometry args={[0.15, 0.18, 0.04]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.15, 0.6, 0.43]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
        {/* Right eye */}
        <mesh position={[0.15, 0.6, 0.41]}>
          <boxGeometry args={[0.15, 0.18, 0.04]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.15, 0.6, 0.43]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
        {/* Angry eyebrows */}
        <mesh position={[-0.15, 0.72, 0.42]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.2, 0.04, 0.02]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.15, 0.72, 0.42]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.2, 0.04, 0.02]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
      </group>
    </RigidBody>
  );
}

// ---- Garden Patch ----
function GardenPatch({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Soil */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 2]} />
        <meshStandardMaterial color="#78350f" roughness={1} />
      </mesh>
      {/* Crops */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = (i % 3 - 1) * 0.8;
        const z = Math.floor(i / 3 - 0.5) * 0.8;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.05, 0.4, 0.05]} />
              <meshStandardMaterial color="#16a34a" />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.1, 5, 4]} />
              <meshStandardMaterial color="#22c55e" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---- Floating Rock (decorative) ----
function FloatingRock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.3;
    ref.current.position.y = position[1] + Math.sin(t * 0.8 + position[0]) * 0.3;
  });
  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={ref} position={position} scale={scale} castShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color="#a8a29e"
          emissive="#78716c"
          emissiveIntensity={0.1}
          roughness={0.8}
        />
      </mesh>
    </Float>
  );
}

// ---- Area Ground ----
function AreaGround({
  position,
  size,
  color,
  colliderOffsetY = 0,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  colliderOffsetY?: number;
}) {
  return (
    <RigidBody type="fixed" name="explorer-ground">
      <CuboidCollider
        args={[size[0] / 2, 0.15, size[1] / 2]}
        position={[position[0], colliderOffsetY, position[2]]}
      />
      <mesh
        position={[position[0], -0.2, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}

// ---- HUD Overlay (HTML) ----
function ExplorerHUD({
  coinsCollected,
  chestsOpened,
  gemsCollected,
  timeElapsed,
  playerPos,
  isVictory,
  totalScore,
  onRestart,
}: {
  coinsCollected: number;
  chestsOpened: number;
  gemsCollected: number;
  timeElapsed: number;
  playerPos: { x: number; z: number };
  isVictory: boolean;
  totalScore: number;
  onRestart: () => void;
}) {
  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
      {/* Top HUD bar */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 16,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        padding: '8px 20px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 14,
        pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#fbbf24', fontSize: 18 }}>🪙</span>
          <span>Coin: {coinsCollected}/20</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#92400e', fontSize: 18 }}>📦</span>
          <span>Chest: {chestsOpened}/5</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#22d3ee', fontSize: 18 }}>💎</span>
          <span>Gem: {gemsCollected}/5</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#f8fafc', fontSize: 18 }}>⏱️</span>
          <span>{formatTime(timeElapsed)}</span>
        </div>
      </div>

      {/* Minimap */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 120,
        height: 120,
        background: 'rgba(0,0,0,0.5)',
        borderRadius: 8,
        border: '2px solid rgba(255,255,255,0.2)',
        overflow: 'hidden',
      }}>
        {/* Biome indicators */}
        <div style={{
          position: 'absolute',
          left: '30%', top: '30%',
          width: '40%', height: '40%',
          background: 'rgba(34,197,94,0.3)',
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute',
          left: '70%', top: '25%',
          width: '30%', height: '30%',
          background: 'rgba(251,191,36,0.3)',
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute',
          left: '25%', top: 0,
          width: '30%', height: '30%',
          background: 'rgba(226,232,240,0.3)',
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute',
          left: '25%', top: '70%',
          width: '30%', height: '30%',
          background: 'rgba(220,38,38,0.3)',
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute',
          left: 0, top: '25%',
          width: '30%', height: '30%',
          background: 'rgba(134,239,172,0.3)',
          borderRadius: 2,
        }} />
        {/* Player dot */}
        <div style={{
          position: 'absolute',
          left: `${50 + (playerPos.x / 50) * 50}%`,
          top: `${50 + (playerPos.z / 50) * 50}%`,
          width: 6,
          height: 6,
          background: '#ef4444',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 4px #ef4444',
        }} />
        {/* Labels */}
        <div style={{ position: 'absolute', left: '38%', top: '45%', fontSize: 7, color: '#fff', opacity: 0.6 }}>F</div>
        <div style={{ position: 'absolute', left: '75%', top: '35%', fontSize: 7, color: '#fff', opacity: 0.6 }}>D</div>
        <div style={{ position: 'absolute', left: '35%', top: '8%', fontSize: 7, color: '#fff', opacity: 0.6 }}>S</div>
        <div style={{ position: 'absolute', left: '35%', top: '78%', fontSize: 7, color: '#fff', opacity: 0.6 }}>L</div>
        <div style={{ position: 'absolute', left: '8%', top: '35%', fontSize: 7, color: '#fff', opacity: 0.6 }}>V</div>
      </div>

      {/* Controls hint */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontFamily: 'monospace',
        lineHeight: 1.6,
      }}>
        <div>WASD - Move</div>
        <div>SPACE - Jump</div>
        <div>MOUSE - Look</div>
        <div>E - Open Chest</div>
      </div>

      {/* Victory Screen */}
      {isVictory && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          pointerEvents: 'auto',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: 20,
            padding: '40px 60px',
            textAlign: 'center',
            border: '2px solid #fbbf24',
            boxShadow: '0 0 60px rgba(251,191,36,0.3)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fbbf24', marginBottom: 16, fontFamily: 'sans-serif' }}>
              VICTORY!
            </div>
            <div style={{ fontSize: 16, color: '#e2e8f0', marginBottom: 8, fontFamily: 'sans-serif' }}>
              You explored the entire world!
            </div>
            <div style={{ fontSize: 20, color: '#f8fafc', marginBottom: 4, fontFamily: 'monospace' }}>
              Total Score: <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{totalScore}</span>
            </div>
            <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 24, fontFamily: 'monospace' }}>
              Time: {formatTime(timeElapsed)}
            </div>
            <button
              onClick={onRestart}
              style={{
                background: '#fbbf24',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: 8,
                padding: '12px 32px',
                fontSize: 16,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'sans-serif',
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN SCENE
// ============================================================

export default function ExplorerScene() {
  const [collectedCoins, setCollectedCoins] = useState<Set<string>>(new Set());
  const [collectedGems, setCollectedGems] = useState<Set<string>>(new Set());
  const [openedChests, setOpenedChests] = useState<Set<string>>(new Set());
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isVictory, setIsVictory] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 });
  const [rawScore, setRawScore] = useState(0);
  const [hudKey, setHudKey] = useState(0);

  const totalScore = rawScore + collectedGems.size * 50;

  const addScore = useGameStore((s) => s.addScore);
  const addCoins = useGameStore((s) => s.addCoins);
  const takeDamage = useGameStore((s) => s.takeDamage);
  const setNotification = useGameStore((s) => s.setNotification);
  const addCombo = useGameStore((s) => s.addCombo);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isVictory) {
        setTimeElapsed((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isVictory]);

  // Check victory condition
  const shouldShowVictory = collectedCoins.size >= 20 && openedChests.size >= 5 && !isVictory;

  useEffect(() => {
    if (shouldShowVictory) {
      const timer = setTimeout(() => setIsVictory(true), 500);
      return () => clearTimeout(timer);
    }
  }, [shouldShowVictory]);

  // Build collectible items
  const collectibles: Collectible[] = [
    ...COIN_POSITIONS.map((pos, i) => ({
      id: `coin-${i}`,
      type: 'coin' as const,
      position: pos,
      value: 1,
      collected: collectedCoins.has(`coin-${i}`),
    })),
    ...GEM_POSITIONS.map((pos, i) => ({
      id: `gem-${i}`,
      type: 'gem' as const,
      position: pos,
      value: 5,
      collected: collectedGems.has(`gem-${i}`),
    })),
  ];

  const handleCollect = useCallback((item: Collectible) => {
    if (item.type === 'coin') {
      setCollectedCoins((prev) => new Set(prev).add(item.id));
      addScore(10);
      addCoins(1);
      addCombo();
      setNotification(`+1 Coin! (${collectedCoins.size + 1}/20)`);
      setRawScore((s) => s + 10);
    } else if (item.type === 'gem') {
      setCollectedGems((prev) => new Set(prev).add(item.id));
      addScore(50);
      addCombo();
      setNotification(`💎 Rare Gem! +50 points! (${collectedGems.size + 1}/5)`);
    }
    setHudKey((k) => k + 1);
  }, [addScore, addCoins, addCombo, setNotification, collectedCoins.size, collectedGems.size]);

  const handleChestOpen = useCallback((id: string, reward: number) => {
    setOpenedChests((prev) => new Set(prev).add(id));
    addScore(reward);
    addCoins(reward);
    setNotification(`📦 Treasure Chest! +${reward} coins!`);
    setRawScore((s) => s + reward);
    setHudKey((k) => k + 1);
  }, [addScore, addCoins, setNotification]);

  const handleEnemyContact = useCallback((enemyId: string) => {
    takeDamage(20);
    setNotification(`💥 Hit by enemy! -20 HP`);
    // Drop 10 coins on "death" concept - add coins to player
    addCoins(10);
    setRawScore((s) => s + 10);
    setNotification(`💀 Defeated ${enemyId}! +10 coins`);
  }, [takeDamage, addCoins, setNotification]);

  const handleRestart = useCallback(() => {
    setCollectedCoins(new Set());
    setCollectedGems(new Set());
    setOpenedChests(new Set());
    setTimeElapsed(0);
    setIsVictory(false);
    setRawScore(0);
    setHudKey((k) => k + 1);
  }, []);

  // Bush positions
  const bushPositions: Array<[number, number, number]> = [
    [-5, 0, -3], [7, 0, 6], [-13, 0, 8], [3, 0, 15], [-8, 0, -14],
    [12, 0, 10], [-2, 0, 8], [9, 0, -10], [-16, 0, -10], [1, 0, -5],
  ];

  // Garden patches
  const gardenPositions: Array<[number, number, number]> = [
    [-30, 0, 6],
    [-40, 0, -2],
  ];

  // Floating rocks
  const floatingRockData: Array<[number, number, number, number]> = [
    [0, 8, 0, 0.5],
    [35, 6, 0, 0.4],
    [0, 7, -35, 0.45],
    [0, 5, 35, 0.4],
    [-35, 6, 0, 0.5],
  ];

  // Lava fire particle positions
  const lavaFirePositions: Array<[number, number, number]> = [
    [1, 0.2, 30], [-1, 0.2, 31], [0.5, 0.2, 29],
    [-7, 0.2, 37], [-9, 0.2, 39], [-7.5, 0.2, 38],
    [8, 0.2, 43], [6, 0.2, 41], [7.5, 0.2, 42],
    [11, 0.2, 36], [9, 0.2, 34], [10.5, 0.2, 35],
  ];

  return (
    <>
      {/* Physics world tracking component */}
      <PlayerTracker onPositionUpdate={setPlayerPos} />

      {/* Environment */}
      <Sky preset="day" />
      <fog attach="fog" args={['#c7d2fe', 50, 120]} />
      <Lighting />

      {/* ===== BIOME GROUNDS ===== */}
      {/* Forest - center */}
      <AreaGround position={[0, 0, 0]} size={[40, 40]} color="#22c55e" />
      {/* Desert - east */}
      <AreaGround position={[35, 0, 0]} size={[30, 30]} color="#fbbf24" />
      {/* Snow - north */}
      <AreaGround position={[0, 0, -35]} size={[30, 30]} color="#e2e8f0" />
      {/* Lava - south */}
      <AreaGround position={[0, 0, 35]} size={[30, 30]} color="#1c1917" />
      {/* Village - west */}
      <AreaGround position={[-35, 0, 0]} size={[30, 30]} color="#86efac" />

      {/* Extended ground for gaps */}
      <AreaGround position={[20, 0, -10]} size={[10, 20]} color="#4ade80" />
      <AreaGround position={[-20, 0, -10]} size={[10, 20]} color="#4ade80" />
      <AreaGround position={[10, 0, -20]} size={[20, 10]} color="#4ade80" />
      <AreaGround position={[-10, 0, -20]} size={[20, 10]} color="#4ade80" />
      <AreaGround position={[10, 0, 20]} size={[20, 10]} color="#4ade80" />
      <AreaGround position={[-10, 0, 20]} size={[20, 10]} color="#4ade80" />

      {/* ===== BRIDGES ===== */}
      {BRIDGE_DATA.map((b, i) => (
        <Bridge key={`bridge-${i}`} position={b.position} rotation={b.rotation} length={b.length} />
      ))}

      {/* ===== FOREST AREA ===== */}
      {/* Trees */}
      {TREE_DATA.map(([x, y, z, s], i) => (
        <ForestTree key={`tree-${i}`} position={[x, y, z]} scale={s} />
      ))}
      {/* Bushes */}
      {bushPositions.map((pos, i) => (
        <Bush key={`bush-${i}`} position={pos} />
      ))}
      {/* Water Ponds */}
      {POND_DATA.map(([x, y, z, w, d], i) => (
        <WaterPond key={`pond-${i}`} position={[x, y, z]} width={w} depth={d} />
      ))}

      {/* ===== DESERT AREA ===== */}
      {/* Cacti */}
      {CACTUS_DATA.map(([x, y, z, s], i) => (
        <DesertCactus key={`cactus-${i}`} position={[x, y, z]} scale={s} />
      ))}

      {/* ===== SNOW AREA ===== */}
      {/* Ice Pillars */}
      {ICE_PILLAR_DATA.map(([x, y, z, s], i) => (
        <IcePillar key={`ice-${i}`} position={[x, y, z]} scale={s} />
      ))}
      {/* Snowmen */}
      {SNOWMAN_DATA.map(([x, y, z], i) => (
        <Snowman key={`snowman-${i}`} position={[x, y, z]} />
      ))}

      {/* ===== LAVA AREA ===== */}
      {/* Lava Pools */}
      {LAVA_POOL_DATA.map(([x, y, z, w, d], i) => (
        <LavaPool key={`lava-${i}`} position={[x, y, z]} width={w} depth={d} />
      ))}
      {/* Lava Cracks */}
      {LAVA_CRACK_DATA.map(([x, y, z, l, w], i) => (
        <LavaCrack key={`crack-${i}`} position={[x, y, z]} length={l} width={w} />
      ))}
      {/* Fire Particles */}
      {lavaFirePositions.map(([x, y, z], i) => (
        <LavaFireParticle key={`fire-p-${i}`} position={[x, y, z]} />
      ))}
      {/* Lava point lights */}
      <pointLight position={[0, 2, 30]} color="#ef4444" intensity={5} distance={15} decay={2} />
      <pointLight position={[-8, 2, 38]} color="#f97316" intensity={4} distance={12} decay={2} />
      <pointLight position={[7, 2, 42]} color="#ef4444" intensity={4} distance={12} decay={2} />

      {/* ===== VILLAGE AREA ===== */}
      {/* Houses */}
      {HOUSE_DATA.map(([x, y, z, s, c], i) => (
        <House key={`house-${i}`} position={[x, y, z]} scale={s} wallColor={c} />
      ))}
      {/* Fences */}
      {FENCE_DATA.map(([x, y, z, r], i) => (
        <FenceSegment key={`fence-${i}`} position={[x, y, z]} rotationY={r} />
      ))}
      {/* Gardens */}
      {gardenPositions.map((pos, i) => (
        <GardenPatch key={`garden-${i}`} position={pos} />
      ))}
      {/* Campfires */}
      {CAMPFIRE_DATA.map(([x, y, z], i) => (
        <Campfire key={`campfire-${i}`} position={[x, y, z]} />
      ))}

      {/* ===== STRUCTURES (shared) ===== */}
      {/* Rocks */}
      {ROCK_DATA.map(([x, y, z, s], i) => (
        <mesh key={`rock-${i}`} position={[x, y + s * 0.3, z]} scale={s} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#6b7280" roughness={0.95} metalness={0.1} />
        </mesh>
      ))}
      {/* Towers */}
      {TOWER_DATA.map(([x, y, z, s], i) => (
        <Tower key={`tower-${i}`} position={[x, y, z]} scale={s} />
      ))}
      {/* Floating Rocks */}
      {floatingRockData.map(([x, y, z, s], i) => (
        <FloatingRock key={`float-rock-${i}`} position={[x, y, z]} scale={s} />
      ))}

      {/* ===== SIGNPOSTS ===== */}
      {SIGN_DATA.map(([x, y, z, label], i) => (
        <Signpost key={`sign-${i}`} position={[x, y, z]} label={label} />
      ))}

      {/* ===== COLLECTIBLES ===== */}
      {collectibles.map((item) => (
        <CollectibleItem
          key={item.id}
          {...item}
          onCollect={handleCollect}
        />
      ))}

      {/* ===== TREASURE CHESTS ===== */}
      {CHEST_DATA.map(([x, y, z, reward], i) => (
        <TreasureChest
          key={`chest-${i}`}
          id={`chest-${i}`}
          position={[x, y, z]}
          reward={reward}
          onOpen={handleChestOpen}
        />
      ))}

      {/* ===== ENEMIES ===== */}
      {ENEMY_DATA.map((enemy) => (
        <PatrolEnemy
          key={enemy.id}
          data={enemy}
          onPlayerContact={handleEnemyContact}
        />
      ))}

      {/* ===== PLAYER ===== */}
      <Player position={[0, 2, 0]} />
      <ThirdPersonCamera />

      {/* ===== HUD OVERLAY ===== */}
      <ExplorerHUD
        key={hudKey}
        coinsCollected={collectedCoins.size}
        chestsOpened={openedChests.size}
        gemsCollected={collectedGems.size}
        timeElapsed={timeElapsed}
        playerPos={playerPos}
        isVictory={isVictory}
        totalScore={totalScore}
        onRestart={handleRestart}
      />
    </>
  );
}

// ============================================================
// PLAYER POSITION TRACKER
// ============================================================

function PlayerTracker({ onPositionUpdate }: { onPositionUpdate: (pos: { x: number; z: number }) => void }) {
  const { world } = useRapier();

  useFrame(() => {
    try {
      const bodies = world.raw().bodies();
      for (let i = 0; i < bodies.len(); i++) {
        const body = bodies.at(i);
        const name = body.name();
        if (name === 'player-body') {
          const pos = body.translation();
          onPositionUpdate({ x: pos.x, z: pos.z });
          return;
        }
      }
    } catch {
      // Rapier not ready yet
    }
  });

  return null;
}