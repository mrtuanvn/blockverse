'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/game/store';
import { getInputState, initKeyboardInput } from '@/game/hooks/useInputState';
import Sky from '@/game/components/Sky';
import Lighting from '@/game/components/Lighting';
import CollectibleItem from '@/game/components/CollectibleItem';

// ===== Constants =====
const TRACK_LENGTH = 200;
const TRACK_WIDTH = 8;
const WALL_HEIGHT = 1.5;
const AUTO_RUN_SPEED = 8;
const JUMP_FORCE = 8;
const SIDE_SPEED = 6;

// ===== Obstacle Data =====
interface ObstacleData {
  type: 'wall' | 'ramp' | 'gap' | 'spinner' | 'moving_wall';
  z: number;
  gapSide?: 'left' | 'right' | 'center';
  gapWidth?: number;
  moveRange?: number;
  moveSpeed?: number;
  spinSpeed?: number;
}

interface CoinData {
  id: string;
  position: [number, number, number];
}

interface BoostPadData {
  id: string;
  z: number;
  x: number;
}

// ===== Track Configuration =====
const OBSTACLES: ObstacleData[] = [
  // Section 1 (z=10-40): Easy walls with clear gaps
  { type: 'wall', z: 15, gapSide: 'left', gapWidth: 2.5 },
  { type: 'wall', z: 25, gapSide: 'right', gapWidth: 2.5 },
  { type: 'ramp', z: 32 },
  { type: 'wall', z: 38, gapSide: 'center', gapWidth: 2.5 },

  // Section 2 (z=40-80): Introducing gaps and spinners
  { type: 'gap', z: 48 },
  { type: 'wall', z: 55, gapSide: 'left', gapWidth: 2.2 },
  { type: 'spinner', z: 62, spinSpeed: 2 },
  { type: 'gap', z: 68 },
  { type: 'wall', z: 75, gapSide: 'right', gapWidth: 2.2 },
  { type: 'ramp', z: 78 },

  // Section 3 (z=80-120): Moving walls + combos
  { type: 'moving_wall', z: 85, moveRange: 2.5, moveSpeed: 2 },
  { type: 'wall', z: 92, gapSide: 'center', gapWidth: 2.0 },
  { type: 'spinner', z: 98, spinSpeed: 2.5 },
  { type: 'gap', z: 103 },
  { type: 'moving_wall', z: 110, moveRange: 2.8, moveSpeed: 2.5 },
  { type: 'wall', z: 117, gapSide: 'left', gapWidth: 2.0 },

  // Section 4 (z=120-160): Harder combos
  { type: 'spinner', z: 125, spinSpeed: 3 },
  { type: 'ramp', z: 130 },
  { type: 'gap', z: 135 },
  { type: 'wall', z: 140, gapSide: 'right', gapWidth: 1.8 },
  { type: 'moving_wall', z: 145, moveRange: 3, moveSpeed: 3 },
  { type: 'spinner', z: 150, spinSpeed: 3.5 },
  { type: 'wall', z: 155, gapSide: 'center', gapWidth: 1.8 },

  // Section 5 (z=160-195): Maximum difficulty
  { type: 'gap', z: 162 },
  { type: 'spinner', z: 167, spinSpeed: 4 },
  { type: 'moving_wall', z: 172, moveRange: 3, moveSpeed: 3.5 },
  { type: 'wall', z: 178, gapSide: 'left', gapWidth: 1.6 },
  { type: 'ramp', z: 182 },
  { type: 'spinner', z: 186, spinSpeed: 4.5 },
  { type: 'moving_wall', z: 191, moveRange: 3.2, moveSpeed: 4 },
  { type: 'wall', z: 196, gapSide: 'right', gapWidth: 1.6 },
];

const GAP_POSITIONS = new Set(OBSTACLES.filter(o => o.type === 'gap').map(o => o.z));

const BOOST_PADS: BoostPadData[] = [
  { id: 'boost-1', z: 12, x: 0 },
  { id: 'boost-2', z: 30, x: -1 },
  { id: 'boost-3', z: 52, x: 1 },
  { id: 'boost-4', z: 72, x: 0 },
  { id: 'boost-5', z: 90, x: -1.5 },
  { id: 'boost-6', z: 108, x: 1.5 },
  { id: 'boost-7', z: 128, x: 0 },
  { id: 'boost-8', z: 148, x: -1 },
  { id: 'boost-9', z: 168, x: 1 },
  { id: 'boost-10', z: 188, x: 0 },
];

const COINS: CoinData[] = [
  // Ground coins along the track
  { id: 'coin-1', position: [0, 1.2, 5] },
  { id: 'coin-2', position: [-1, 1.2, 10] },
  { id: 'coin-3', position: [1, 1.2, 18] },
  { id: 'coin-4', position: [0, 1.2, 22] },
  { id: 'coin-5', position: [-1.5, 1.2, 28] },
  // Coins near ramp at z=32
  { id: 'coin-6', position: [0, 3.5, 33] },
  { id: 'coin-7', position: [0, 5, 34] },
  // More ground coins
  { id: 'coin-8', position: [1.5, 1.2, 42] },
  { id: 'coin-9', position: [0, 1.2, 50] },
  { id: 'coin-10', position: [-1, 1.2, 58] },
  // Air coins requiring jumps
  { id: 'coin-11', position: [0, 4, 65] },
  { id: 'coin-12', position: [-1, 4.5, 66] },
  { id: 'coin-13', position: [1, 4, 67] },
  { id: 'coin-14', position: [0, 1.2, 73] },
  { id: 'coin-15', position: [1.5, 1.2, 80] },
  // Coins on ramp at z=78
  { id: 'coin-16', position: [0, 3, 79] },
  { id: 'coin-17', position: [0, 5, 80] },
  // Mid-section coins
  { id: 'coin-18', position: [-2, 1.2, 88] },
  { id: 'coin-19', position: [2, 1.2, 95] },
  { id: 'coin-20', position: [0, 5, 102] },
  { id: 'coin-21', position: [-1, 5.5, 103] },
  { id: 'coin-22', position: [1, 1.2, 112] },
  { id: 'coin-23', position: [0, 1.2, 120] },
  // High air coins
  { id: 'coin-24', position: [0, 6, 132] },
  { id: 'coin-25', position: [1, 6.5, 133] },
  { id: 'coin-26', position: [-1, 1.2, 142] },
  { id: 'coin-27', position: [0, 1.2, 152] },
  { id: 'coin-28', position: [1.5, 1.2, 165] },
  { id: 'coin-29', position: [-1.5, 7, 184] },
  { id: 'coin-30', position: [0, 1.2, 193] },
];

// ===== Compute gap sections (z ranges where ground is missing) =====
function getGapRanges(): Array<{ start: number; end: number; length: number }> {
  const gaps: Array<{ start: number; end: number; length: number }> = [];
  for (const obs of OBSTACLES) {
    if (obs.type === 'gap') {
      const len = obs.z % 5 < 2 ? 3 : obs.z % 5 < 4 ? 4 : 5;
      gaps.push({ start: obs.z - len / 2, end: obs.z + len / 2, length: len });
    }
  }
  return gaps;
}

const GAP_RANGES = getGapRanges();

// ===== Check if a z position is inside a gap =====
function isInGap(z: number): boolean {
  return GAP_RANGES.some(g => z >= g.start && z <= g.end);
}

// ===== Generate ground segments (avoiding gaps) =====
function generateGroundSegments(): Array<{ startZ: number; length: number }> {
  const segments: Array<{ startZ: number; length: number }> = [];
  const sortedGaps = [...GAP_RANGES].sort((a, b) => a.start - b.start);
  let currentZ = 0;

  for (const gap of sortedGaps) {
    if (gap.start > currentZ) {
      segments.push({ startZ: currentZ, length: gap.start - currentZ });
    }
    currentZ = gap.end;
  }
  if (currentZ < TRACK_LENGTH + 20) {
    segments.push({ startZ: currentZ, length: TRACK_LENGTH + 20 - currentZ });
  }
  return segments;
}

const GROUND_SEGMENTS = generateGroundSegments();

// ===== Checkpoint positions =====
const CHECKPOINTS = [0, 40, 80, 120, 160];

// ===== WallObstacle Component =====
function WallObstacle({ z, gapSide = 'left', gapWidth = 2.5 }: { z: number; gapSide?: 'left' | 'right' | 'center'; gapWidth?: number }) {
  const halfTrack = TRACK_WIDTH / 2;
  const wallThickness = 0.6;
  const halfGap = gapWidth / 2;

  let leftWall: { x: number; width: number } | null = null;
  let rightWall: { x: number; width: number } | null = null;

  if (gapSide === 'left') {
    // Gap on the left side
    const gapEnd = -halfTrack + gapWidth;
    leftWall = null;
    rightWall = { x: gapEnd / 2 + halfTrack / 2, width: halfTrack * 2 - gapWidth };
  } else if (gapSide === 'right') {
    // Gap on the right side
    leftWall = { x: -(halfTrack - gapWidth / 2), width: halfTrack * 2 - gapWidth };
    rightWall = null;
  } else {
    // Gap in center
    leftWall = { x: -(halfTrack - gapWidth / 2) / 2 - gapWidth / 4 - 0.5, width: halfTrack - halfGap - 0.5 };
    rightWall = { x: (halfTrack - gapWidth / 2) / 2 + gapWidth / 4 + 0.5, width: halfTrack - halfGap - 0.5 };
  }

  return (
    <group position={[0, WALL_HEIGHT / 2, z]}>
      {leftWall && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[leftWall.width / 2, WALL_HEIGHT / 2, wallThickness / 2]} position={[leftWall.x, 0, 0]} />
          <mesh position={[leftWall.x, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[leftWall.width, WALL_HEIGHT, wallThickness]} />
            <meshStandardMaterial color="#dc2626" roughness={0.4} metalness={0.1} />
          </mesh>
        </RigidBody>
      )}
      {rightWall && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[rightWall.width / 2, WALL_HEIGHT / 2, wallThickness / 2]} position={[rightWall.x, 0, 0]} />
          <mesh position={[rightWall.x, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[rightWall.width, WALL_HEIGHT, wallThickness]} />
            <meshStandardMaterial color="#dc2626" roughness={0.4} metalness={0.1} />
          </mesh>
        </RigidBody>
      )}
      {/* Warning stripes on top */}
      {leftWall && (
        <mesh position={[leftWall.x, WALL_HEIGHT / 2 + 0.05, 0]}>
          <boxGeometry args={[leftWall.width, 0.1, wallThickness + 0.1]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
        </mesh>
      )}
      {rightWall && (
        <mesh position={[rightWall.x, WALL_HEIGHT / 2 + 0.05, 0]}>
          <boxGeometry args={[rightWall.width, 0.1, wallThickness + 0.1]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
        </mesh>
      )}
    </group>
  );
}

// ===== RampObstacle Component =====
function RampObstacle({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[TRACK_WIDTH / 2, 0.25, 2.5]} position={[0, 1.25, 0]} rotation={[-Math.PI / 6, 0, 0]} />
        <mesh position={[0, 1.25, 0]} rotation={[-Math.PI / 6, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[TRACK_WIDTH, 0.5, 5]} />
          <meshStandardMaterial color="#22c55e" roughness={0.5} metalness={0.1} />
        </mesh>
        {/* Arrow indicators */}
        <mesh position={[0, 0.01, -2.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1.5]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>
    </group>
  );
}

// ===== SpinnerObstacle Component =====
function SpinnerObstacle({ z, spinSpeed = 2 }: { z: number; spinSpeed?: number }) {
  const barRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (barRef.current) {
      barRef.current.rotation.z += spinSpeed * delta;
    }
  });

  return (
    <group position={[0, 1.2, z]}>
      {/* Center pole */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.2, 1.2, 0.2]} position={[0, 0, 0]} />
        <mesh castShadow>
          <boxGeometry args={[0.4, 2.4, 0.4]} />
          <meshStandardMaterial color="#6b7280" metalness={0.5} roughness={0.3} />
        </mesh>
      </RigidBody>
      {/* Rotating bar */}
      <group ref={barRef}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[TRACK_WIDTH / 2 + 0.5, 0.25, 0.25]} position={[0, 0, 0]} />
          <mesh castShadow>
            <boxGeometry args={[TRACK_WIDTH + 1, 0.5, 0.5]} />
            <meshStandardMaterial color="#dc2626" emissive="#991b1b" emissiveIntensity={0.2} roughness={0.3} metalness={0.3} />
          </mesh>
          {/* End caps */}
          <mesh position={[-(TRACK_WIDTH / 2 + 0.5), 0, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[TRACK_WIDTH / 2 + 0.5, 0, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.5} />
          </mesh>
        </RigidBody>
      </group>
    </group>
  );
}

// ===== MovingWall Component =====
function MovingWall({ z, moveRange = 2.5, moveSpeed = 2 }: { z: number; moveRange?: number; moveSpeed?: number }) {
  const wallRef = useRef<any>(null);

  useFrame((state) => {
    if (wallRef.current) {
      const t = state.clock.getElapsedTime() * moveSpeed;
      const xOffset = Math.sin(t) * moveRange;
      wallRef.current.setTranslation(
        { x: xOffset, y: WALL_HEIGHT / 2, z },
        true
      );
    }
  });

  return (
    <RigidBody
      ref={wallRef}
      type="kinematicPosition"
      colliders={false}
      position={[0, WALL_HEIGHT / 2, z]}
    >
      <CuboidCollider args={[1.8, WALL_HEIGHT / 2, 0.5]} position={[0, 0, 0]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.6, WALL_HEIGHT, 1]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Warning lights */}
      <mesh position={[0, WALL_HEIGHT / 2 + 0.1, 0]}>
        <boxGeometry args={[3.8, 0.15, 1.1]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
      </mesh>
    </RigidBody>
  );
}

// ===== BoostPad Component =====
function BoostPad({ z, x }: { z: number; x: number }) {
  const padRef = useRef<THREE.Mesh>(null);
  const activated = useRef(false);

  useFrame((state) => {
    if (padRef.current) {
      const pulse = 0.8 + Math.sin(state.clock.getElapsedTime() * 5) * 0.2;
      padRef.current.material.emissiveIntensity = 0.5 + Math.sin(state.clock.getElapsedTime() * 6) * 0.3;
    }
  });

  const handleCollision = useCallback((other: any) => {
    const collidingName = other?.rigidBodyObject?.name || other?.other?.rigidBodyObject?.name;
    if (collidingName === 'player-body' && !activated.current) {
      activated.current = true;
      const rb = other?.rigidBodyObject?.userData?.rb || other?.other?.rigidBodyObject;
      if (rb && typeof rb.applyImpulse === 'function') {
        rb.applyImpulse({ x: 0, y: 2, z: 15 }, true);
      }
      setTimeout(() => { activated.current = false; }, 1000);
    }
  }, []);

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[x, 0.06, z]}
      onCollisionEnter={handleCollision}
      sensor
    >
      <CuboidCollider args={[1.5, 0.05, 1.5]} sensor />
      <mesh ref={padRef as any} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.8}
          transparent
          opacity={0.8}
        />
      </mesh>
      {/* Arrow indicators */}
      <mesh position={[0, 0.02, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 0.6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 0.8, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>
    </RigidBody>
  );
}

// ===== CheckpointArch Component =====
function CheckpointArch({ z, label }: { z: number; label: string }) {
  return (
    <group position={[0, 0, z]}>
      {/* Left pillar */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.4, 4, 0.4]} position={[-TRACK_WIDTH / 2 - 0.8, 4, 0]} />
        <mesh position={[-TRACK_WIDTH / 2 - 0.8, 4, 0]} castShadow>
          <boxGeometry args={[0.8, 8, 0.8]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.4} />
        </mesh>
      </RigidBody>
      {/* Right pillar */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.4, 4, 0.4]} position={[TRACK_WIDTH / 2 + 0.8, 4, 0]} />
        <mesh position={[TRACK_WIDTH / 2 + 0.8, 4, 0]} castShadow>
          <boxGeometry args={[0.8, 8, 0.8]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.4} />
        </mesh>
      </RigidBody>
      {/* Cross beam */}
      <mesh position={[0, 8, 0]} castShadow>
        <boxGeometry args={[TRACK_WIDTH + 2.4, 1, 1]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.15} roughness={0.4} />
      </mesh>
      {/* Banner */}
      <mesh position={[0, 7, 0.6]}>
        <planeGeometry args={[TRACK_WIDTH - 2, 1.5]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, 7, 0.7]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {label}
      </Text>
    </group>
  );
}

// ===== FinishLine Component =====
function FinishLine() {
  const z = TRACK_LENGTH;
  const patternSize = 1;

  return (
    <group position={[0, 0, z]}>
      {/* Checkered floor */}
      {Array.from({ length: Math.ceil(TRACK_WIDTH / patternSize) }).map((_, col) =>
        Array.from({ length: 2 }).map((_, row) => {
          const isBlack = (col + row) % 2 === 0;
          return (
            <mesh
              key={`check-${col}-${row}`}
              position={[-TRACK_WIDTH / 2 + col * patternSize + patternSize / 2, 0.05, row * patternSize - patternSize / 2]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[patternSize, patternSize]} />
              <meshStandardMaterial color={isBlack ? '#1a1a1a' : '#f5f5f5'} />
            </mesh>
          );
        })
      )}
      {/* Grand arch */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, 6, 0.8]} position={[-TRACK_WIDTH / 2 - 1.5, 6, 0]} />
        <mesh position={[-TRACK_WIDTH / 2 - 1.5, 6, 0]} castShadow>
          <boxGeometry args={[1.6, 12, 1.6]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.2} metalness={0.3} roughness={0.3} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, 6, 0.8]} position={[TRACK_WIDTH / 2 + 1.5, 6, 0]} />
        <mesh position={[TRACK_WIDTH / 2 + 1.5, 6, 0]} castShadow>
          <boxGeometry args={[1.6, 12, 1.6]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.2} metalness={0.3} roughness={0.3} />
        </mesh>
      </RigidBody>
      {/* Top beam */}
      <mesh position={[0, 12, 0]} castShadow>
        <boxGeometry args={[TRACK_WIDTH + 4.6, 1.5, 1.5]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.3} metalness={0.4} roughness={0.2} />
      </mesh>
      {/* FINISH text */}
      <Text
        position={[0, 12, 1]}
        fontSize={1.5}
        color="#1a1a1a"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        FINISH
      </Text>
      {/* Decorative banner */}
      <mesh position={[0, 10.5, 0.8]}>
        <planeGeometry args={[TRACK_WIDTH, 2]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, 10.5, 0.9]}
        fontSize={0.8}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        🏆 SPEED RUN CHAMPION 🏆
      </Text>
    </group>
  );
}

// ===== TrackGround Component =====
function TrackGround() {
  return (
    <group>
      {GROUND_SEGMENTS.map((seg, i) => (
        <RigidBody key={`ground-${i}`} type="fixed" colliders={false}>
          <CuboidCollider args={[TRACK_WIDTH / 2, 0.25, seg.length / 2]} position={[0, -0.25, seg.startZ + seg.length / 2]} />
          <mesh position={[0, -0.25, seg.startZ + seg.length / 2]} receiveShadow>
            <boxGeometry args={[TRACK_WIDTH, 0.5, seg.length]} />
            <meshStandardMaterial color="#6b7280" roughness={0.8} />
          </mesh>
        </RigidBody>
      ))}

      {/* Lane markings - dashed center line */}
      {GROUND_SEGMENTS.flatMap((seg) => {
        const dashes: Array<{ z: number }> = [];
        for (let z = seg.startZ + 1; z < seg.startZ + seg.length; z += 3) {
          if (!isInGap(z)) {
            dashes.push({ z });
          }
        }
        return dashes.map((d, i) => (
          <mesh key={`dash-${seg.startZ}-${i}`} position={[0, 0.01, d.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, 1.5]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        ));
      })}

      {/* Side edge lines */}
      {GROUND_SEGMENTS.map((seg, i) => (
        <group key={`edges-${i}`}>
          <mesh position={[-TRACK_WIDTH / 2 + 0.1, 0.01, seg.startZ + seg.length / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, seg.length]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[TRACK_WIDTH / 2 - 0.1, 0.01, seg.startZ + seg.length / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, seg.length]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}

      {/* Side walls with colored stripes */}
      {GROUND_SEGMENTS.map((seg, i) => {
        const stripeCount = Math.floor(seg.length / 4);
        return (
          <group key={`walls-${i}`}>
            {/* Left wall */}
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.25, 1, seg.length / 2]} position={[-TRACK_WIDTH / 2 - 0.25, 1, seg.startZ + seg.length / 2]} />
              <mesh position={[-TRACK_WIDTH / 2 - 0.25, 1, seg.startZ + seg.length / 2]}>
                <boxGeometry args={[0.5, 2, seg.length]} />
                <meshStandardMaterial color="#dc2626" roughness={0.6} />
              </mesh>
            </RigidBody>
            {/* Right wall */}
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.25, 1, seg.length / 2]} position={[TRACK_WIDTH / 2 + 0.25, 1, seg.startZ + seg.length / 2]} />
              <mesh position={[TRACK_WIDTH / 2 + 0.25, 1, seg.startZ + seg.length / 2]}>
                <boxGeometry args={[0.5, 2, seg.length]} />
                <meshStandardMaterial color="#2563eb" roughness={0.6} />
              </mesh>
            </RigidBody>
            {/* Colored stripe decorations on left wall */}
            {Array.from({ length: stripeCount }).map((_, s) => {
              const zPos = seg.startZ + s * 4 + 2;
              if (isInGap(zPos)) return null;
              return (
                <mesh key={`lstripe-${i}-${s}`} position={[-TRACK_WIDTH / 2 - 0.51, 1.5, zPos]}>
                  <boxGeometry args={[0.02, 0.4, 2]} />
                  <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.2} />
                </mesh>
              );
            })}
            {/* Colored stripe decorations on right wall */}
            {Array.from({ length: stripeCount }).map((_, s) => {
              const zPos = seg.startZ + s * 4 + 2;
              if (isInGap(zPos)) return null;
              return (
                <mesh key={`rstripe-${i}-${s}`} position={[TRACK_WIDTH / 2 + 0.51, 1.5, zPos]}>
                  <boxGeometry args={[0.02, 0.4, 2]} />
                  <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.2} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// ===== AudienceStands Component =====
function AudienceStands() {
  const standPositions = [
    { z: 20, side: -1 },
    { z: 60, side: 1 },
    { z: 100, side: -1 },
    { z: 140, side: 1 },
    { z: 180, side: -1 },
  ];

  return (
    <group>
      {standPositions.map((stand, i) => (
        <group key={`stand-${i}`} position={[stand.side * (TRACK_WIDTH / 2 + 5), 0, stand.z]}>
          {/* Tier 1 */}
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[3, 0.5, 6]} position={[0, 0.25, 0]} />
            <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
              <boxGeometry args={[6, 1, 12]} />
              <meshStandardMaterial color="#9ca3af" roughness={0.7} />
            </mesh>
          </RigidBody>
          {/* Tier 2 */}
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[3, 0.5, 6]} position={[0, 1.25, 0]} />
            <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
              <boxGeometry args={[6, 1, 12]} />
              <meshStandardMaterial color="#6b7280" roughness={0.7} />
            </mesh>
          </RigidBody>
          {/* Tier 3 */}
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[2.5, 0.5, 6]} position={[0, 2.25, 0]} />
            <mesh position={[0, 2.25, 0]} castShadow receiveShadow>
              <boxGeometry args={[5, 1, 12]} />
              <meshStandardMaterial color="#4b5563" roughness={0.7} />
            </mesh>
          </RigidBody>
          {/* Crowd dots (simple representation) */}
          {Array.from({ length: 12 }).map((_, ci) => (
            <mesh key={`crowd-${i}-${ci}`} position={[-1.5 + ci * 0.3, 2.8, -2.5 + (ci % 3) * 2.5]}>
              <boxGeometry args={[0.3, 0.5, 0.3]} />
              <meshStandardMaterial
                color={['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'][ci % 6]}
                roughness={0.8}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ===== Decorative Trees and Lamps =====
function EnvironmentDecor() {
  const trees = [
    { x: -8, z: 8 }, { x: 9, z: 15 }, { x: -9, z: 35 },
    { x: 10, z: 45 }, { x: -10, z: 70 }, { x: 9, z: 85 },
    { x: -9, z: 115 }, { x: 10, z: 130 }, { x: -8, z: 155 },
    { x: 9, z: 175 }, { x: -10, z: 190 },
  ];

  const lamps = Array.from({ length: 20 }).map((_, i) => ({
    x: i % 2 === 0 ? -TRACK_WIDTH / 2 - 2 : TRACK_WIDTH / 2 + 2,
    z: i * 10 + 5,
  }));

  return (
    <group>
      {/* Trees */}
      {trees.map((tree, i) => (
        <group key={`tree-${i}`} position={[tree.x, 0, tree.z]}>
          {/* Trunk */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 3, 6]} />
            <meshStandardMaterial color="#92400e" roughness={0.9} />
          </mesh>
          {/* Foliage */}
          <mesh position={[0, 3.5, 0]} castShadow>
            <coneGeometry args={[1.2, 2.5, 6]} />
            <meshStandardMaterial color="#16a34a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 4.5, 0]} castShadow>
            <coneGeometry args={[0.9, 2, 6]} />
            <meshStandardMaterial color="#22c55e" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Lamps */}
      {lamps.map((lamp, i) => (
        <group key={`lamp-${i}`} position={[lamp.x, 0, lamp.z]}>
          {/* Pole */}
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 4, 6]} />
            <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Light fixture */}
          <mesh position={[0, 4.1, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} />
          </mesh>
          <pointLight position={[0, 4, 0]} intensity={0.5} distance={8} color="#fbbf24" />
        </group>
      ))}

      {/* Start banner */}
      <group position={[0, 0, -3]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.4, 5, 0.4]} position={[-TRACK_WIDTH / 2 - 0.8, 5, 0]} />
          <mesh position={[-TRACK_WIDTH / 2 - 0.8, 5, 0]} castShadow>
            <boxGeometry args={[0.8, 10, 0.8]} />
            <meshStandardMaterial color="#06b6d4" roughness={0.4} />
          </mesh>
        </RigidBody>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.4, 5, 0.4]} position={[TRACK_WIDTH / 2 + 0.8, 5, 0]} />
          <mesh position={[TRACK_WIDTH / 2 + 0.8, 5, 0]} castShadow>
            <boxGeometry args={[0.8, 10, 0.8]} />
            <meshStandardMaterial color="#06b6d4" roughness={0.4} />
          </mesh>
        </RigidBody>
        <mesh position={[0, 10, 0]} castShadow>
          <boxGeometry args={[TRACK_WIDTH + 2.4, 1.2, 1]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.2} />
        </mesh>
        <Text
          position={[0, 10, 0.6]}
          fontSize={1}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          🏁 SPEED RUN 🏁
        </Text>
      </group>
    </group>
  );
}

// ===== SpeedRunPlayer Component (auto-running player) =====
function SpeedRunPlayer({ playerRef }: { playerRef: React.RefObject<any> }) {
  const isOnFloor = useRef(false);
  const lastJump = useRef(false);
  const game = useGameStore((s) => s.game);
  const setTime = useGameStore((s) => s.setTime);
  const setScore = useGameStore((s) => s.setScore);
  const endGame = useGameStore((s) => s.endGame);
  const addCoins = useGameStore((s) => s.addCoins);
  const submitScore = useGameStore((s) => s.submitScore);
  const setNotification = useGameStore((s) => s.setNotification);
  const startTime = useRef<number>(Date.now());
  const hasFinished = useRef(false);
  const coinCount = useRef(0);
  const apiRef = useRef<any>(null);

  const loseLife = useGameStore((s) => s.loseLife);

  useEffect(() => {
    startTime.current = Date.now();
    hasFinished.current = false;
    coinCount.current = 0;
  }, []);

  useFrame((state, delta) => {
    if (!apiRef.current || !playerRef.current) {
      // Store API ref from the RigidBody
      const rbGroup = playerRef.current as any;
      if (rbGroup && rbGroup.setTranslation) {
        apiRef.current = rbGroup;
      }
      return;
    }
    const api = apiRef.current;
    const rbPos = api.translation();
    const rbVel = api.linvel();

    // Store ref for camera
    if (playerRef.current) {
      (playerRef.current as any).position = new THREE.Vector3(rbPos.x, rbPos.y, rbPos.z);
    }

    // Fall detection - respawn
    if (rbPos.y < -15) {
      loseLife();
      api.setTranslation({ x: 0, y: 2, z: Math.max(0, rbPos.z - 10) }, true);
      api.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    // Floor detection
    isOnFloor.current = Math.abs(rbVel.y) < 0.5 && rbPos.y < 2;

    // Auto-run forward (+z direction)
    let targetVelZ = AUTO_RUN_SPEED;
    let targetVelX = 0;

    // ─── Read from shared input state (works for both keyboard + touch) ───
    const input = getInputState();
    targetVelX = input.moveX * SIDE_SPEED;

    // Brake: pull back on joystick
    if (input.moveZ > 0.3) {
      targetVelZ = 2;
    }

    // Smooth lateral movement
    const lerpFactor = 1 - Math.pow(0.01, delta);
    const currentX = rbVel.x;
    const newVelX = THREE.MathUtils.lerp(currentX, targetVelX, lerpFactor * 2);

    api.setLinvel(
      { x: newVelX, y: rbVel.y, z: targetVelZ },
      true
    );

    // Jump (edge-triggered)
    const wantJump = input.jump || input.moveZ < -0.3;
    if (wantJump && !lastJump.current && isOnFloor.current) {
      api.setLinvel({ x: rbVel.x, y: JUMP_FORCE, z: rbVel.z }, true);
    }
    lastJump.current = wantJump;

    // Update timer
    const elapsed = (Date.now() - startTime.current) / 1000;
    setTime(elapsed);

    // Check finish line
    if (rbPos.z >= TRACK_LENGTH && !hasFinished.current) {
      hasFinished.current = true;
      const finalTime = elapsed;
      const score = Math.max(0, Math.floor(10000 - finalTime * 100 + coinCount.current * 50));
      setScore(score);
      setNotification(`🏁 Finished! Time: ${finalTime.toFixed(1)}s | Coins: ${coinCount.current} | Score: ${score}`);
      endGame();
      submitScore('speedrun', score, finalTime);
    }
  });

  // Expose method for coins to call
  useEffect(() => {
    (playerRef as any).current = {
      get position() {
        return apiRef.current ? new THREE.Vector3(
          apiRef.current.translation().x,
          apiRef.current.translation().y,
          apiRef.current.translation().z
        ) : new THREE.Vector3(0, 2, 0);
      },
      addCoin: () => { coinCount.current++; },
      setTranslation: (pos: { x: number; y: number; z: number }, wake: boolean) => {
        apiRef.current?.setTranslation(pos, wake);
      },
      setLinvel: (vel: { x: number; y: number; z: number }, wake: boolean) => {
        apiRef.current?.setLinvel(vel, wake);
      },
      applyImpulse: (impulse: { x: number; y: number; z: number }, wake: boolean) => {
        apiRef.current?.applyImpulse(impulse, wake);
      },
    };
  }, [playerRef]);

  return (
    <RigidBody
      ref={apiRef}
      name="player-body"
      type="dynamic"
      position={[0, 2, 0]}
      enabledRotations={[false, false, false]}
      linearDamping={2}
      mass={1}
      lockRotations
      colliders={false}
      onCollisionEnter={() => {
        isOnFloor.current = true;
      }}
    >
      <CuboidCollider args={[0.3, 0.9, 0.3]} position={[0, 0.9, 0]} />
      <group>
        {/* Head */}
        <group position={[0, 1.65, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
          {/* Eyes */}
          <mesh position={[-0.1, 0.05, 0.26]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0.1, 0.05, 0.26]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          {/* Mouth */}
          <mesh position={[0, -0.1, 0.26]}>
            <boxGeometry args={[0.15, 0.03, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        </group>
        {/* Torso */}
        <group position={[0, 1.0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.8, 0.3]} />
            <meshStandardMaterial color="#06b6d4" />
          </mesh>
        </group>
        {/* Left Arm */}
        <group position={[-0.425, 1.2, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        </group>
        {/* Right Arm */}
        <group position={[0.425, 1.2, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        </group>
        {/* Left Leg */}
        <group position={[-0.15, 0.4, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
        </group>
        {/* Right Leg */}
        <group position={[0.15, 0.4, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}

// ===== SpeedRunCamera Component =====
function SpeedRunCamera({ targetRef }: { targetRef: React.RefObject<any> }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const target = targetRef.current;
    if (!target) return;

    const targetPos = target.position instanceof THREE.Vector3
      ? target.position
      : new THREE.Vector3(0, 2, 0);

    // Camera behind and above the player
    const desiredPos = new THREE.Vector3(
      targetPos.x * 0.3,
      targetPos.y + 6,
      targetPos.z - 12
    );

    const lerpFactor = 1 - Math.pow(0.02, delta);
    camera.position.lerp(desiredPos, lerpFactor);

    const lookTarget = new THREE.Vector3(
      targetPos.x * 0.5,
      targetPos.y + 1,
      targetPos.z + 15
    );
    camera.lookAt(lookTarget);
  });

  return null;
}

// ===== HUD Overlay (HTML-based 3D text) =====
function GameHUD() {
  const timeElapsed = useGameStore((s) => s.game.timeElapsed);
  const score = useGameStore((s) => s.game.score);
  const coins = useGameStore((s) => s.game.coins);
  const isGameOver = useGameStore((s) => s.game.isGameOver);
  const notification = useGameStore((s) => s.game.notification);

  const [lastCheckpoint, setLastCheckpoint] = useState(0);
  const [distancePct, setDistancePct] = useState(0);
  const lastCheckpointRef = useRef(0);

  useFrame(() => {
    // Determine last checkpoint passed
    const playerZ = playerPositionRef.current.z;
    for (let i = CHECKPOINTS.length - 1; i >= 0; i--) {
      if (playerZ >= CHECKPOINTS[i] && CHECKPOINTS[i] > lastCheckpointRef.current) {
        lastCheckpointRef.current = CHECKPOINTS[i];
        setLastCheckpoint(CHECKPOINTS[i]);
        break;
      }
    }
    setDistancePct(Math.min(100, Math.floor((playerZ / TRACK_LENGTH) * 100)));
  });

  return (
    <group position={[0, 12, 0]}>
      {/* Timer - follows camera roughly */}
      <Text
        position={[-3.5, 2, -8]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="left"
        anchorY="top"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {`⏱ ${timeElapsed.toFixed(1)}s`}
      </Text>

      {/* Coins */}
      <Text
        position={[-3.5, 1.3, -8]}
        fontSize={0.4}
        color="#fbbf24"
        anchorX="left"
        anchorY="top"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {`🪙 ${coins}`}
      </Text>

      {/* Distance indicator */}
      <Text
        position={[1, 2, -8]}
        fontSize={0.4}
        color="#06b6d4"
        anchorX="right"
        anchorY="top"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {`${distancePct}%`}
      </Text>

      {/* Checkpoint display */}
      <Text
        position={[0, -1, -8]}
        fontSize={0.35}
        color="#f59e0b"
        anchorX="center"
        anchorY="top"
        outlineWidth={0.04}
        outlineColor="#000000"
      >
        {`Checkpoint: ${lastCheckpoint}/${CHECKPOINTS[CHECKPOINTS.length - 1]}`}
      </Text>

      {/* Game over notification */}
      {isGameOver && (
        <Text
          position={[0, 0, -6]}
          fontSize={0.8}
          color="#22c55e"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.06}
          outlineColor="#000000"
        >
          {notification || 'Race Complete! Press R to restart'}
        </Text>
      )}

      {/* Running notification */}
      {!isGameOver && notification && (
        <Text
          position={[0, -2, -7]}
          fontSize={0.4}
          color="#fbbf24"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {notification}
        </Text>
      )}
    </group>
  );
}

// Shared player position ref for HUD and camera
const playerPositionRef = { current: new THREE.Vector3(0, 2, 0) };

// ===== SpeedRunCoin Component (tracks coin collection for scoring) =====
function SpeedRunCoin({ data }: { data: CoinData }) {
  const [collected, setCollected] = useState(false);
  const addCoins = useGameStore((s) => s.addCoins);

  const handleCollect = useCallback(() => {
    if (!collected) {
      setCollected(true);
      addCoins(1);
    }
  }, [collected, addCoins]);

  return (
    <CollectibleItem
      id={data.id}
      type="coin"
      position={data.position}
      value={1}
      collected={collected}
      onCollect={handleCollect}
    />
  );
}

// ===== Main SpeedRunScene =====
export default function SpeedRunScene() {
  const playerRef = useRef<any>(null);
  const { rapier } = useRapier();

  // Update player position ref each frame
  useFrame(() => {
    const api = playerRef.current;
    if (api && api.position) {
      playerPositionRef.current.copy(api.position);
    }
  });

  return (
    <>
      {/* Environment */}
      <Sky preset="day" />
      <Lighting />
      <fog attach="fog" args={['#c9d6df', 80, 220]} />

      {/* Track */}
      <TrackGround />

      {/* Obstacles */}
      {OBSTACLES.map((obs, i) => {
        switch (obs.type) {
          case 'wall':
            return (
              <WallObstacle
                key={`obs-${i}`}
                z={obs.z}
                gapSide={obs.gapSide}
                gapWidth={obs.gapWidth}
              />
            );
          case 'ramp':
            return <RampObstacle key={`obs-${i}`} z={obs.z} />;
          case 'spinner':
            return (
              <SpinnerObstacle
                key={`obs-${i}`}
                z={obs.z}
                spinSpeed={obs.spinSpeed}
              />
            );
          case 'moving_wall':
            return (
              <MovingWall
                key={`obs-${i}`}
                z={obs.z}
                moveRange={obs.moveRange}
                moveSpeed={obs.moveSpeed}
              />
            );
          case 'gap':
            // Gaps are handled by missing ground sections
            return null;
          default:
            return null;
        }
      })}

      {/* Boost Pads */}
      {BOOST_PADS.map((pad) => (
        <BoostPad key={pad.id} z={pad.z} x={pad.x} />
      ))}

      {/* Checkpoint Arches */}
      {CHECKPOINTS.map((cp, i) => (
        <CheckpointArch
          key={`cp-${i}`}
          z={cp}
          label={i === 0 ? 'START' : `CP ${i}`}
        />
      ))}

      {/* Coins */}
      {COINS.map((coin) => (
        <SpeedRunCoin key={coin.id} data={coin} />
      ))}

      {/* Finish Line */}
      <FinishLine />

      {/* Environment Decorations */}
      <AudienceStands />
      <EnvironmentDecor />

      {/* Player */}
      <SpeedRunPlayer playerRef={playerRef} />

      {/* Camera */}
      <SpeedRunCamera targetRef={playerRef} />

      {/* HUD */}
      <GameHUD />
    </>
  );
}