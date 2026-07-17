'use client';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/game/store';
import Sky from '@/game/components/Sky';
import Lighting from '@/game/components/Lighting';
import Player from '@/game/components/Player';
import ThirdPersonCamera from '@/game/components/ThirdPersonCamera';
import CollectibleItem from '@/game/components/CollectibleItem';
import ParticleEffect from '@/game/components/ParticleEffect';

// ===== Platform Data Types =====

interface PlatformData {
  id: number;
  pos: [number, number, number];
  size: [number, number, number];
  type: 'static' | 'moving' | 'falling' | 'bouncy' | 'ice' | 'narrow';
  color: string;
  moveAxis?: 'x' | 'y' | 'z';
  moveRange?: number;
  moveSpeed?: number;
}

// ===== 35 Platforms: winding path from z=0 to z=120, x between -8 and +8 =====

const PLATFORM_DATA: PlatformData[] = [
  // === Section 1 (0-4): Static green — easy intro ===
  { id: 0, pos: [0, 0, 0], size: [5, 1, 5], type: 'static', color: '#22c55e' },
  { id: 1, pos: [4, 0.5, 4], size: [3, 1, 3], type: 'static', color: '#22c55e' },
  { id: 2, pos: [7, 1, 8], size: [3, 1, 3], type: 'static', color: '#22c55e' },
  { id: 3, pos: [3, 0.5, 12], size: [3, 1, 3], type: 'static', color: '#22c55e' },
  { id: 4, pos: [-1, 0, 16], size: [3, 1, 3], type: 'static', color: '#22c55e' },

  // === Section 2 (5-9): Mix static + moving orange ===
  { id: 5, pos: [-5, 0.5, 19], size: [3, 1, 3], type: 'static', color: '#22c55e' },
  { id: 6, pos: [-8, 1, 23], size: [3, 1, 3], type: 'moving', color: '#f97316', moveAxis: 'x', moveRange: 3, moveSpeed: 1 },
  { id: 7, pos: [-4, 0.5, 27], size: [3, 1, 3], type: 'moving', color: '#f97316', moveAxis: 'x', moveRange: 4, moveSpeed: 1.2 },
  { id: 8, pos: [1, 1, 30], size: [3, 1, 3], type: 'static', color: '#22c55e' },
  { id: 9, pos: [5, 0.5, 34], size: [3, 1, 3], type: 'moving', color: '#f97316', moveAxis: 'z', moveRange: 2, moveSpeed: 0.8 },

  // === Section 3 (10-14): Falling red + bouncy cyan ===
  { id: 10, pos: [2, 0.5, 38], size: [2.5, 1, 2.5], type: 'falling', color: '#ef4444' },
  { id: 11, pos: [-2, 1.5, 42], size: [2.5, 1, 2.5], type: 'bouncy', color: '#06b6d4' },
  { id: 12, pos: [-6, 0.5, 45], size: [2.5, 1, 2.5], type: 'falling', color: '#ef4444' },
  { id: 13, pos: [-3, 2, 49], size: [2.5, 1, 2.5], type: 'bouncy', color: '#06b6d4' },
  { id: 14, pos: [1, 0, 52], size: [3, 1, 3], type: 'static', color: '#22c55e' },

  // === Section 4 (15-19): Narrow beams yellow + ice lightblue ===
  { id: 15, pos: [4, 0.5, 55], size: [0.3, 1, 4], type: 'narrow', color: '#eab308' },
  { id: 16, pos: [4, 1, 59], size: [0.3, 1, 4], type: 'narrow', color: '#eab308' },
  { id: 17, pos: [1, 0.5, 62], size: [3, 1, 3], type: 'ice', color: '#7dd3fc' },
  { id: 18, pos: [-3, 0.5, 65], size: [3, 1, 3], type: 'ice', color: '#7dd3fc' },
  { id: 19, pos: [-6, 1, 68], size: [0.3, 1, 4], type: 'narrow', color: '#eab308' },

  // === Section 5 (20-24): Harder moving + falling combos ===
  { id: 20, pos: [-3, 0.5, 72], size: [2.5, 1, 2.5], type: 'moving', color: '#f97316', moveAxis: 'x', moveRange: 4, moveSpeed: 1.5 },
  { id: 21, pos: [1, 1, 75], size: [2.5, 1, 2.5], type: 'falling', color: '#ef4444' },
  { id: 22, pos: [5, 0.5, 79], size: [2.5, 1, 2.5], type: 'moving', color: '#f97316', moveAxis: 'y', moveRange: 2, moveSpeed: 1 },
  { id: 23, pos: [2, 1.5, 83], size: [2.5, 1, 2.5], type: 'falling', color: '#ef4444' },
  { id: 24, pos: [-2, 0.5, 86], size: [2, 1, 2], type: 'moving', color: '#f97316', moveAxis: 'x', moveRange: 5, moveSpeed: 1.8 },

  // === Section 6 (25-29): Mix of all types, harder gaps ===
  { id: 25, pos: [-6, 0.5, 90], size: [2, 1, 2], type: 'ice', color: '#7dd3fc' },
  { id: 26, pos: [-2, 1, 93], size: [0.3, 1, 4], type: 'narrow', color: '#eab308' },
  { id: 27, pos: [3, 0.5, 96], size: [2, 1, 2], type: 'falling', color: '#ef4444' },
  { id: 28, pos: [7, 1.5, 99], size: [2, 1, 2], type: 'bouncy', color: '#06b6d4' },
  { id: 29, pos: [4, 0.5, 102], size: [2, 1, 2], type: 'moving', color: '#f97316', moveAxis: 'x', moveRange: 3, moveSpeed: 2 },

  // === Section 7 (30-34): Ultimate challenge + finish platform ===
  { id: 30, pos: [0, 1, 106], size: [2, 1, 2], type: 'falling', color: '#ef4444' },
  { id: 31, pos: [-4, 1.5, 109], size: [2, 1, 2], type: 'moving', color: '#f97316', moveAxis: 'y', moveRange: 3, moveSpeed: 1.5 },
  { id: 32, pos: [-7, 0.5, 112], size: [0.3, 1, 4], type: 'narrow', color: '#eab308' },
  { id: 33, pos: [-3, 2, 115], size: [2, 1, 2], type: 'bouncy', color: '#06b6d4' },
  { id: 34, pos: [0, 0, 120], size: [6, 1, 6], type: 'static', color: '#ffd700' },
];

// ===== Collectibles: 20 coins + 5 gems =====

const COLLECTIBLES = [
  // Coins (20) — placed on platforms or in gaps
  { id: 'obby-coin-1', type: 'coin' as const, position: [4, 2.5, 4] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-2', type: 'coin' as const, position: [5.5, 2, 10] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-3', type: 'coin' as const, position: [3, 2.5, 12] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-4', type: 'coin' as const, position: [-5, 2.5, 19] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-5', type: 'coin' as const, position: [-6.5, 2.5, 25] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-6', type: 'coin' as const, position: [1, 2.5, 30] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-7', type: 'coin' as const, position: [2, 2.5, 38] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-8', type: 'coin' as const, position: [-4.5, 2.5, 43.5] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-9', type: 'coin' as const, position: [-3, 3.5, 49] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-10', type: 'coin' as const, position: [1, 2, 52] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-11', type: 'coin' as const, position: [4, 2.5, 57] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-12', type: 'coin' as const, position: [1, 2.5, 62] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-13', type: 'coin' as const, position: [-6, 3, 70] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-14', type: 'coin' as const, position: [-3, 2.5, 72] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-15', type: 'coin' as const, position: [1, 3, 75] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-16', type: 'coin' as const, position: [5, 3, 79] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-17', type: 'coin' as const, position: [-6, 2.5, 90] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-18', type: 'coin' as const, position: [-2, 3, 93] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-19', type: 'coin' as const, position: [3, 2.5, 96] as [number, number, number], value: 1, collected: false },
  { id: 'obby-coin-20', type: 'coin' as const, position: [4, 2.5, 102] as [number, number, number], value: 1, collected: false },

  // Gems (5) — placed at harder sections
  { id: 'obby-gem-1', type: 'gem' as const, position: [-8, 3, 23] as [number, number, number], value: 10, collected: false },
  { id: 'obby-gem-2', type: 'gem' as const, position: [4, 3, 59] as [number, number, number], value: 10, collected: false },
  { id: 'obby-gem-3', type: 'gem' as const, position: [-2, 3, 86] as [number, number, number], value: 10, collected: false },
  { id: 'obby-gem-4', type: 'gem' as const, position: [7, 3.5, 99] as [number, number, number], value: 10, collected: false },
  { id: 'obby-gem-5', type: 'gem' as const, position: [-3, 4, 115] as [number, number, number], value: 10, collected: false },
];

// ===== Checkpoint Positions (every 10 platforms) =====

const CHECKPOINT_POSITIONS: Array<{ index: number; pos: [number, number, number] }> = [
  { index: 9, pos: [5, 1.5, 34] },
  { index: 19, pos: [-6, 2, 68] },
  { index: 29, pos: [4, 1.5, 102] },
];

// ===== Decorative Floating Cubes =====

const DECORATIVE_CUBES: Array<{ pos: [number, number, number]; color: string; size: number; speed: number }> = [
  { pos: [-10, 8, 5], color: '#a855f7', size: 0.6, speed: 0.5 },
  { pos: [12, 10, 15], color: '#f59e0b', size: 0.5, speed: 0.7 },
  { pos: [-8, 12, 30], color: '#06b6d4', size: 0.4, speed: 0.6 },
  { pos: [10, 9, 45], color: '#ef4444', size: 0.7, speed: 0.4 },
  { pos: [-12, 11, 55], color: '#22c55e', size: 0.5, speed: 0.8 },
  { pos: [8, 13, 70], color: '#ec4899', size: 0.6, speed: 0.5 },
  { pos: [-10, 8, 85], color: '#8b5cf6', size: 0.4, speed: 0.9 },
  { pos: [11, 10, 95], color: '#f97316', size: 0.5, speed: 0.6 },
  { pos: [-7, 14, 110], color: '#14b8a6', size: 0.6, speed: 0.7 },
  { pos: [9, 9, 118], color: '#fbbf24', size: 0.5, speed: 0.5 },
  { pos: [-5, 15, 20], color: '#f472b6', size: 0.3, speed: 1.0 },
  { pos: [6, 7, 40], color: '#a78bfa', size: 0.4, speed: 0.6 },
  { pos: [-11, 10, 60], color: '#34d399', size: 0.5, speed: 0.8 },
  { pos: [13, 12, 80], color: '#fb923c', size: 0.3, speed: 0.5 },
  { pos: [-9, 11, 100], color: '#60a5fa', size: 0.4, speed: 0.7 },
  { pos: [5, 16, 50], color: '#c084fc', size: 0.35, speed: 0.9 },
];

// ===== PlatformRenderer Component =====

function PlatformRenderer({ data }: { data: PlatformData }) {
  const rbRef = useRef<RapierRigidBody>(null);
  const triggered = useRef(false);
  const fallTimer = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const originalY = data.pos[1];
  const hasFallen = useRef(false);

  // Moving platform animation
  useFrame((state, delta) => {
    if (data.type === 'moving' && rbRef.current) {
      const t = state.clock.getElapsedTime() * (data.moveSpeed || 1);
      const offset = Math.sin(t) * (data.moveRange || 2);
      let x = data.pos[0];
      let y = data.pos[1];
      let z = data.pos[2];
      if (data.moveAxis === 'x') x += offset;
      else if (data.moveAxis === 'y') y += offset;
      else if (data.moveAxis === 'z') z += offset;
      rbRef.current.setTranslation({ x, y, z }, true);
    }

    // Falling platform animation
    if (data.type === 'falling' && rbRef.current && triggered.current) {
      fallTimer.current += delta;
      if (fallTimer.current > 1) {
        const elapsed = fallTimer.current - 1;
        const newY = originalY - elapsed * 20;
        rbRef.current.setTranslation({ x: data.pos[0], y: newY, z: data.pos[2] }, true);
        if (newY < originalY - 25) {
          hasFallen.current = true;
        }
      }
    }
  });

  const handleFallingCollision = useCallback(
    (payload: { other: { rigidBodyObject?: THREE.Object3D | null; rigidBody?: RapierRigidBody | null } }) => {
      if (triggered.current || hasFallen.current) return;
      const collidingName = payload.other.rigidBodyObject?.name;
      if (collidingName === 'player-body') {
        triggered.current = true;
      }
    },
    []
  );

  const handleBouncyCollision = useCallback(
    (payload: { other: { rigidBodyObject?: THREE.Object3D | null; rigidBody?: RapierRigidBody | null } }) => {
      const collidingName = payload.other.rigidBodyObject?.name;
      if (collidingName === 'player-body') {
        payload.other.rigidBody?.applyImpulse({ x: 0, y: 12, z: 0 }, true);
      }
    },
    []
  );

  const halfExtents: [number, number, number] = [
    data.size[0] / 2,
    data.size[1] / 2,
    data.size[2] / 2,
  ];

  // Determine material props based on type
  const isIce = data.type === 'ice';
  const isBouncy = data.type === 'bouncy';
  const isNarrow = data.type === 'narrow';
  const isFalling = data.type === 'falling';

  const materialProps: Record<string, unknown> = {
    color: data.color,
    roughness: isIce ? 0.1 : isBouncy ? 0.4 : 0.7,
    metalness: isIce ? 0.3 : isBouncy ? 0.2 : 0.1,
    ...(isIce ? { transparent: true, opacity: 0.6 } : {}),
    ...(isBouncy ? { emissive: '#06b6d4', emissiveIntensity: 0.15 } : {}),
    ...(isFalling ? { emissive: '#ef4444', emissiveIntensity: 0.1 } : {}),
  };

  // Bouncy platforms have a spring-like visual indicator on top
  const bouncyIndicator = isBouncy ? (
    <mesh position={[0, data.size[1] / 2 + 0.05, 0]}>
      <boxGeometry args={[data.size[0] * 0.8, 0.1, data.size[2] * 0.8]} />
      <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.4} />
    </mesh>
  ) : null;

  // Falling platforms have a crack visual indicator
  const fallingIndicator = isFalling ? (
    <>
      <mesh position={[data.size[0] * 0.2, data.size[1] / 2 + 0.02, 0]}>
        <boxGeometry args={[0.3, 0.05, data.size[2] * 0.6]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      <mesh position={[-data.size[0] * 0.15, data.size[1] / 2 + 0.02, data.size[2] * 0.1]}>
        <boxGeometry args={[data.size[0] * 0.5, 0.05, 0.2]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
    </>
  ) : null;

  // Narrow platforms have edge glow strips
  const narrowIndicator = isNarrow ? (
    <>
      <mesh position={[0, data.size[1] / 2 + 0.02, 0]}>
        <boxGeometry args={[0.35, 0.05, data.size[2]]} />
        <meshStandardMaterial color="#fde047" emissive="#eab308" emissiveIntensity={0.3} />
      </mesh>
    </>
  ) : null;

  // Render based on type
  if (data.type === 'static' || data.type === 'narrow') {
    return (
      <group>
        <RigidBody type="fixed" name={`platform-${data.id}`} position={data.pos}>
          <CuboidCollider args={halfExtents} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={data.size} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {narrowIndicator}
        </RigidBody>
      </group>
    );
  }

  if (data.type === 'ice') {
    return (
      <group>
        <RigidBody type="fixed" name={`platform-${data.id}`} position={data.pos}>
          <CuboidCollider args={halfExtents} friction={0.05} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={data.size} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
        </RigidBody>
        {/* Ice shimmer particles */}
        <IceShimmer position={data.pos} size={data.size} />
      </group>
    );
  }

  if (data.type === 'moving') {
    return (
      <group>
        <RigidBody
          ref={rbRef}
          type="kinematicPosition"
          name={`platform-${data.id}`}
          position={data.pos}
        >
          <CuboidCollider args={halfExtents} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={data.size} />
            <meshStandardMaterial {...materialProps} emissive="#f97316" emissiveIntensity={0.15} />
          </mesh>
        </RigidBody>
      </group>
    );
  }

  if (data.type === 'falling') {
    return (
      <group>
        <RigidBody
          ref={rbRef}
          type="kinematicPosition"
          name={`platform-${data.id}`}
          position={data.pos}
          onCollisionEnter={handleFallingCollision}
        >
          <CuboidCollider args={halfExtents} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={data.size} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {fallingIndicator}
        </RigidBody>
      </group>
    );
  }

  if (data.type === 'bouncy') {
    return (
      <group>
        <RigidBody
          type="fixed"
          name={`platform-${data.id}`}
          position={data.pos}
          restitution={1.5}
          onCollisionEnter={handleBouncyCollision}
        >
          <CuboidCollider args={halfExtents} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={data.size} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {bouncyIndicator}
        </RigidBody>
      </group>
    );
  }

  return null;
}

// ===== Ice Shimmer Effect =====

function IceShimmer({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.15 + Math.sin(t * 2 + position[0]) * 0.1;
  });

  return (
    <mesh ref={ref} position={[position[0], position[1] + size[1] / 2 + 0.03, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size[0] * 0.9, size[2] * 0.9]} />
      <meshStandardMaterial
        color="#e0f2fe"
        emissive="#bae6fd"
        emissiveIntensity={0.3}
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ===== Checkpoint Component =====

function CheckpointComponent({ position, index }: { position: [number, number, number]; index: number }) {
  const pillarRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const { scene } = useThree();
  const lastCheckpoint = useRef(-1);
  const setNotification = useGameStore((s) => s.setNotification);
  const checkpointReached = useRef(false);

  useFrame((state) => {
    if (!pillarRef.current || !ringRef.current || !lightRef.current) return;
    const t = state.clock.getElapsedTime();

    // Animate the ring rotation
    ringRef.current.rotation.y = t * 1.5;

    // Animate the light pulsing
    lightRef.current.intensity = 3 + Math.sin(t * 2) * 1;

    // Check player distance for checkpoint activation
    const playerObj = scene.getObjectByName('player-body');
    if (playerObj) {
      const playerPos = new THREE.Vector3();
      playerObj.getWorldPosition(playerPos);
      const checkpointVec = new THREE.Vector3(position[0], position[1], position[2]);
      const dist = playerPos.distanceTo(checkpointVec);

      if (dist < 3 && !checkpointReached.current) {
        checkpointReached.current = true;
        lastCheckpoint.current = index;
        setNotification(`Checkpoint ${Math.floor(index / 10) + 1} reached!`);
      }
    }
  });

  return (
    <group ref={pillarRef} position={position}>
      {/* Main pillar */}
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 4, 6]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#16a34a"
          emissiveIntensity={0.4}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {/* Glowing orb on top */}
      <mesh position={[0, 4.3, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#22c55e"
          emissiveIntensity={0.8}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Rotating ring */}
      <mesh ref={ringRef} position={[0, 3, 0]}>
        <torusGeometry args={[0.6, 0.05, 8, 24]} />
        <meshStandardMaterial
          color="#86efac"
          emissive="#22c55e"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Base ring on ground */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.8, 24]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#16a34a"
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Point light */}
      <pointLight
        ref={lightRef}
        position={[0, 3, 0]}
        color="#22c55e"
        intensity={3}
        distance={10}
        decay={2}
      />

      {/* Checkpoint label */}
      <Text
        position={[0, 5.2, 0]}
        fontSize={0.5}
        color="#4ade80"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#166534"
      >
        {`CP ${Math.floor(index / 10) + 1}`}
      </Text>
    </group>
  );
}

// ===== Finish Line Component =====

function FinishLine({ position }: { position: [number, number, number] }) {
  const { scene } = useThree();
  const leftPillarRef = useRef<THREE.Mesh>(null);
  const rightPillarRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const hasWon = useRef(false);
  const setScore = useGameStore((s) => s.setScore);
  const submitScore = useGameStore((s) => s.submitScore);
  const setNotification = useGameStore((s) => s.setNotification);
  const endGame = useGameStore((s) => s.endGame);

  const pillarHeight = 5;
  const archWidth = 6;
  const pillarRadius = 0.3;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Animate star rotation and floating
    if (starRef.current) {
      starRef.current.rotation.y = t * 2;
      starRef.current.rotation.z = t * 0.5;
      starRef.current.position.y = position[1] + pillarHeight + 1 + Math.sin(t * 2) * 0.2;
    }

    // Animate beam glow
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(t * 3) * 0.2;
    }

    // Check if player reached finish
    if (hasWon.current) return;

    const playerObj = scene.getObjectByName('player-body');
    if (playerObj) {
      const playerPos = new THREE.Vector3();
      playerObj.getWorldPosition(playerPos);
      const finishVec = new THREE.Vector3(position[0], position[1] + 1, position[2]);
      const dist = playerPos.distanceTo(finishVec);

      if (dist < 4) {
        hasWon.current = true;

        // Calculate score: time-based + coin bonus
        const gameState = useGameStore.getState();
        const timePenalty = Math.floor(gameState.game.timeElapsed) * 50;
        const coinBonus = gameState.game.coins * 50;
        const scoreBonus = gameState.game.score;
        const finalScore = Math.max(100, 10000 - timePenalty + coinBonus + scoreBonus);

        setScore(finalScore);
        submitScore('obby', finalScore, gameState.game.timeElapsed);
        setNotification('You Win!');
        setTimeout(() => {
          endGame();
        }, 500);
      }
    }
  });

  const goldMaterial = (
    <meshStandardMaterial
      color="#ffd700"
      emissive="#f59e0b"
      emissiveIntensity={0.4}
      roughness={0.3}
      metalness={0.7}
    />
  );

  return (
    <group position={position}>
      {/* Left pillar */}
      <mesh
        ref={leftPillarRef}
        position={[-archWidth / 2, pillarHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[pillarRadius * 2, pillarHeight, pillarRadius * 2]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#f59e0b"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Left pillar capital */}
      <mesh position={[-archWidth / 2, pillarHeight + 0.25, 0]} castShadow>
        <boxGeometry args={[pillarRadius * 2.5, 0.5, pillarRadius * 2.5]} />
        {goldMaterial}
      </mesh>

      {/* Right pillar */}
      <mesh
        ref={rightPillarRef}
        position={[archWidth / 2, pillarHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[pillarRadius * 2, pillarHeight, pillarRadius * 2]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#f59e0b"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Right pillar capital */}
      <mesh position={[archWidth / 2, pillarHeight + 0.25, 0]} castShadow>
        <boxGeometry args={[pillarRadius * 2.5, 0.5, pillarRadius * 2.5]} />
        {goldMaterial}
      </mesh>

      {/* Crossbeam (横梁) */}
      <mesh
        ref={beamRef}
        position={[0, pillarHeight + 0.5, 0]}
        castShadow
      >
        <boxGeometry args={[archWidth + pillarRadius * 2, 0.4, 0.4]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#fbbf24"
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Second decorative beam */}
      <mesh position={[0, pillarHeight + 0.1, 0]} castShadow>
        <boxGeometry args={[archWidth + pillarRadius, 0.15, 0.5]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#f59e0b"
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>

      {/* Star on top */}
      <mesh ref={starRef} position={[0, pillarHeight + 1, 0]} castShadow>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color="#fef08a"
          emissive="#fbbf24"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>

      {/* Finish text */}
      <Text
        position={[0, pillarHeight + 2.2, 0]}
        fontSize={0.8}
        color="#ffd700"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#92400e"
      >
        {'FINISH'}
      </Text>

      {/* Finish area lights */}
      <pointLight
        position={[-archWidth / 2, pillarHeight / 2, 0]}
        color="#ffd700"
        intensity={5}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[archWidth / 2, pillarHeight / 2, 0]}
        color="#ffd700"
        intensity={5}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[0, pillarHeight + 1, 0]}
        color="#fef08a"
        intensity={4}
        distance={12}
        decay={2}
      />

      {/* Ground glow ring */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 3.5, 32]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#f59e0b"
          emissiveIntensity={0.3}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ===== Decorative Floating Cube =====

function DecorativeCube({ pos, color, size, speed }: { pos: [number, number, number]; color: string; size: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * speed * 0.5;
    ref.current.rotation.y = t * speed * 0.7;
    ref.current.rotation.z = t * speed * 0.3;
    ref.current.position.y = pos[1] + Math.sin(t * speed + pos[0] * 0.5) * 0.5;
    ref.current.position.x = pos[0] + Math.sin(t * speed * 0.3) * 0.3;
  });

  return (
    <Float speed={speed * 2} rotationIntensity={0.3} floatIntensity={0.3}>
      <mesh ref={ref} position={pos} castShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          metalness={0.5}
          roughness={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  );
}

// ===== Start Platform Sign =====

function StartSign() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 2.5 + Math.sin(t * 1.5) * 0.3;
  });

  return (
    <group ref={ref} position={[0, 2.5, -2]}>
      <Text
        fontSize={0.6}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#92400e"
      >
        {'OBBY RUNNER'}
      </Text>
      <Text
        position={[0, -0.8, 0]}
        fontSize={0.3}
        color="#fef3c7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#78350f"
      >
        {'Reach the golden arch!'}
      </Text>
    </group>
  );
}

// ===== Void Below Indicator =====

function VoidBelow() {
  return (
    <group position={[0, -30, 60]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 300]} />
        <meshStandardMaterial
          color="#0a0a1a"
          emissive="#1a0a2e"
          emissiveIntensity={0.1}
          roughness={1}
        />
      </mesh>
    </group>
  );
}

// ===== Section Labels =====

function SectionLabel({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = position[1] + Math.sin(t * 0.8 + position[2] * 0.1) * 0.2;
  });

  return (
    <group ref={ref} position={position}>
      <Text
        fontSize={0.35}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {text}
      </Text>
    </group>
  );
}

// ===== ObbyWorld Component =====

function ObbyWorld() {
  const { scene } = useThree();
  const setTime = useGameStore((s) => s.setTime);
  const isPaused = useGameStore((s) => s.game.isPaused);
  const isGameOver = useGameStore((s) => s.game.isGameOver);
  const [collectedItems, setCollectedItems] = useState<Set<string>>(new Set());

  const timeRef = useRef(0);
  const timerAccum = useRef(0);
  const lastCheckpoint = useRef<[number, number, number]>([0, 3, 0]);

  // Timer: increment timeElapsed using useFrame
  useFrame((_, delta) => {
    if (!isPaused && !isGameOver) {
      timeRef.current += delta;
      timerAccum.current += delta;
      // Update store time every ~100ms to avoid excessive re-renders
      if (timerAccum.current >= 0.1) {
        timerAccum.current = 0;
        setTime(Math.round(timeRef.current * 10) / 10);
      }
    }
  });

  // Handle collectible collection
  const handleCollect = useCallback((item: { id: string; type: string; position: [number, number, number]; value: number; collected: boolean }) => {
    setCollectedItems((prev) => new Set(prev).add(item.id));
  }, []);

  // Finish line position
  const finishPosition: [number, number, number] = [0, 0.5, 120];

  // Section label data
  const sectionLabels = useMemo(() => [
    { position: [-3, 4, 10] as [number, number, number], text: 'Easy Start', color: '#86efac' },
    { position: [6, 4, 27] as [number, number, number], text: 'Moving Platforms!', color: '#fdba74' },
    { position: [-4, 5, 43] as [number, number, number], text: 'Watch Out Below!', color: '#fca5a5' },
    { position: [4, 4, 58] as [number, number, number], text: 'Narrow & Icy!', color: '#bae6fd' },
    { position: [-4, 5, 79] as [number, number, number], text: 'Harder Combos!', color: '#fdba74' },
    { position: [4, 5, 96] as [number, number, number], text: 'Mixed Madness!', color: '#f9a8d4' },
    { position: [-3, 6, 112] as [number, number, number], text: 'FINAL CHALLENGE!', color: '#fde047' },
  ], []);

  return (
    <>
      {/* Fog for atmosphere */}
      <fog attach="fog" args={['#1a1a2e', 30, 80]} />

      {/* Void below — dark abyss */}
      <VoidBelow />

      {/* Start sign */}
      <StartSign />

      {/* Section labels */}
      {sectionLabels.map((label, i) => (
        <SectionLabel key={`section-label-${i}`} position={label.position} text={label.text} color={label.color} />
      ))}

      {/* Render all 35 platforms */}
      {PLATFORM_DATA.map((platform) => (
        <PlatformRenderer key={`platform-${platform.id}`} data={platform} />
      ))}

      {/* Render collectibles */}
      {COLLECTIBLES.map((item) => (
        <CollectibleItem
          key={item.id}
          id={item.id}
          type={item.type}
          position={item.position}
          value={item.value}
          collected={collectedItems.has(item.id)}
          onCollect={handleCollect}
        />
      ))}

      {/* Checkpoints every 10 platforms */}
      {CHECKPOINT_POSITIONS.map((cp) => (
        <CheckpointComponent
          key={`checkpoint-${cp.index}`}
          position={cp.pos}
          index={cp.index}
        />
      ))}

      {/* Finish line golden arch */}
      <FinishLine position={finishPosition} />

      {/* Decorative floating cubes */}
      {DECORATIVE_CUBES.map((cube, i) => (
        <DecorativeCube
          key={`deco-cube-${i}`}
          pos={cube.pos}
          color={cube.color}
          size={cube.size}
          speed={cube.speed}
        />
      ))}

      {/* Side guide rails (subtle visual markers along the path) */}
      <GuideRails />

      {/* Ambient particles along the course */}
      <ObbyParticles />
    </>
  );
}

// ===== Guide Rails =====

function GuideRails() {
  const railPositions = useMemo(() => {
    const rails: Array<{ pos: [number, number, number]; length: number }> = [];
    for (let z = 0; z <= 120; z += 15) {
      rails.push({ pos: [-14, 3, z], length: 12 });
      rails.push({ pos: [14, 3, z], length: 12 });
    }
    return rails;
  }, []);

  return (
    <>
      {railPositions.map((rail, i) => (
        <mesh key={`rail-${i}`} position={rail.pos}>
          <boxGeometry args={[0.1, 0.1, rail.length]} />
          <meshStandardMaterial
            color="#6b7280"
            emissive="#4b5563"
            emissiveIntensity={0.2}
            transparent
            opacity={0.3}
          />
        </mesh>
      ))}
    </>
  );
}

// ===== Ambient Particles Along Course =====

function ObbyParticles() {
  const count = 60;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const setRef = useCallback((el: THREE.Mesh | null, idx: number) => {
    refs.current[idx] = el;
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 30,
        y: 2 + Math.random() * 12,
        z: Math.random() * 130,
        speed: 0.2 + Math.random() * 0.6,
        offset: Math.random() * Math.PI * 2,
        size: 0.03 + Math.random() * 0.05,
        color: ['#fef3c7', '#e0f2fe', '#fce7f3', '#d1fae5', '#fde68a'][Math.floor(Math.random() * 5)],
      })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = particles[i];
      mesh.position.y = p.y + Math.sin(t * p.speed + p.offset) * 0.6;
      mesh.position.x = p.x + Math.sin(t * p.speed * 0.4 + p.offset) * 0.4;
      mesh.rotation.y = t * p.speed * 0.5;
    });
  });

  return (
    <>
      {particles.map((p, i) => (
        <mesh
          key={`obby-particle-${i}`}
          ref={(el) => setRef(el, i)}
          position={[p.x, p.y, p.z]}
        >
          <sphereGeometry args={[p.size, 4, 4]} />
          <meshBasicMaterial color={p.color} transparent opacity={0.5} />
        </mesh>
      ))}
    </>
  );
}

// ===== Main ObbyScene Export =====

export default function ObbyScene() {
  return (
    <>
      <Sky />
      <Lighting />
      <Player position={[0, 3, 0]} />
      <ThirdPersonCamera />
      <ObbyWorld />
    </>
  );
}