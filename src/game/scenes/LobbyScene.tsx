'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float, MeshReflectorMaterial, Ring } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, SCENE_CONFIGS } from '@/game/store';
import type { GameScene } from '@/game/types';
import Sky from '@/game/components/Sky';
import Ground from '@/game/components/Ground';
import Lighting from '@/game/components/Lighting';
import Portal from '@/game/components/Portal';
import Player from '@/game/components/Player';
import ThirdPersonCamera from '@/game/components/ThirdPersonCamera';

// ===== Portal Configuration =====
const PORTAL_RADIUS = 10;

const portalConfigs: Array<{
  scene: GameScene;
  angleDeg: number;
  icon: string;
}> = [
  { scene: 'obby', angleDeg: 0, icon: '🏃' },
  { scene: 'battle', angleDeg: 72, icon: '⚔️' },
  { scene: 'speedrun', angleDeg: 144, icon: '🏎️' },
  { scene: 'explorer', angleDeg: 216, icon: '🌍' },
  { scene: 'builder', angleDeg: 288, icon: '🏗️' },
];

function getPortalPosition(angleDeg: number): [number, number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [
    Math.sin(rad) * PORTAL_RADIUS,
    1.5,
    Math.cos(rad) * PORTAL_RADIUS,
  ];
}

// ===== Decoration Data =====

const treeData: Array<[number, number, number, number]> = [
  [-8, 0.5, -5, 1.0],
  [-10, 0.5, 3, 0.85],
  [6, 0.5, -10, 1.2],
  [11, 0.5, -3, 0.9],
  [-6, 0.5, 8, 1.1],
  [9, 0.5, 7, 0.75],
  [-11, 0.5, -8, 0.9],
  [3, 0.5, 11, 1.05],
  [-3, 0.5, -11, 0.8],
  [12, 0.5, 1, 0.7],
];

const rockData: Array<[number, number, number, number]> = [
  [-4, 0.3, 6, 0.6],
  [7, 0.25, 4, 0.5],
  [-9, 0.2, -2, 0.7],
  [5, 0.3, -7, 0.45],
  [-7, 0.2, -10, 0.55],
  [10, 0.25, -8, 0.4],
  [-2, 0.3, -8, 0.35],
];

const coinData: Array<[number, number, number]> = [
  [-3, 3, 3],
  [4, 2.5, -4],
  [-6, 2, -6],
  [7, 3.5, 2],
  [-2, 2.8, -5],
  [5, 3, 6],
  [-8, 2.2, 5],
  [3, 3.2, -8],
  [0, 4, -6],
  [-5, 3.8, -1],
];

const rotatingCubeData: Array<[number, number, number, string]> = [
  [-5, 4, -3, '#a855f7'],
  [6, 5, 5, '#f59e0b'],
  [-7, 3.5, 7, '#06b6d4'],
  [8, 4.5, -6, '#ef4444'],
  [0, 6, -7, '#22c55e'],
  [-10, 5, -1, '#ec4899'],
];

const flowerData: Array<[number, number, number, string]> = [
  [-2, 0.05, 3, '#f472b6'],
  [3, 0.05, 2, '#fb923c'],
  [-5, 0.05, -2, '#c084fc'],
  [6, 0.05, -3, '#fbbf24'],
  [-3, 0.05, -7, '#f472b6'],
  [7, 0.05, 6, '#fb923c'],
  [-9, 0.05, 6, '#c084fc'],
  [2, 0.05, -10, '#fbbf24'],
  [8, 0.05, -1, '#f472b6'],
  [-11, 0.05, -4, '#fb923c'],
];

const lanternData: Array<[number, number, number]> = [
  [-6, 0, -6],
  [6, 0, -6],
  [-6, 0, 6],
  [6, 0, 6],
  [0, 0, -12],
  [0, 0, 12],
  [-12, 0, 0],
  [12, 0, 0],
];

const pillarPositions: Array<[number, number, number]> = [
  [13, 0, 13],
  [-13, 0, 13],
  [13, 0, -13],
  [-13, 0, -13],
];

// ===== Sub-Components =====

function Tree({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.4, 1.2, 0.4]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
      {/* Lower leaves */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <coneGeometry args={[1.2, 2.2, 6]} />
        <meshStandardMaterial color="#22c55e" roughness={0.8} />
      </mesh>
      {/* Upper leaves */}
      <mesh position={[0, 2.9, 0]} castShadow>
        <coneGeometry args={[0.8, 1.6, 6]} />
        <meshStandardMaterial color="#16a34a" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Rock({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial
        color="#6b7280"
        roughness={0.95}
        metalness={0.1}
      />
    </mesh>
  );
}

function Coin({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = t * 2;
    ref.current.rotation.x = Math.sin(t * 1.5) * 0.3;
    ref.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.2;
  });

  return (
    <mesh ref={ref} position={position} castShadow>
      <octahedronGeometry args={[0.25, 0]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={0.5}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}

function RotatingCube({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.5;
    ref.current.rotation.y = t * 0.7;
    ref.current.rotation.z = t * 0.3;
    ref.current.position.y = position[1] + Math.sin(t + position[0]) * 0.3;
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={ref} position={position} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
    </Float>
  );
}

function LobbyTitle() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = 8 + Math.sin(t * 0.8) * 0.5;
  });

  return (
    <group ref={groupRef} position={[0, 8, 0]}>
      <Text
        fontSize={1.5}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#92400e"
      >
        BLOCKVERSE
      </Text>
      <Text
        position={[0, -1.3, 0]}
        fontSize={0.35}
        color="#fde68a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#78350f"
      >
        Choose Your Adventure
      </Text>
    </group>
  );
}

function FenceSegment({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation as unknown as THREE.Euler}>
      {/* Post left */}
      <mesh position={[-0.9, 0.4, 0]} castShadow>
        <boxGeometry args={[0.15, 0.8, 0.15]} />
        <meshStandardMaterial color="#a16207" roughness={0.9} />
      </mesh>
      {/* Post right */}
      <mesh position={[0.9, 0.4, 0]} castShadow>
        <boxGeometry args={[0.15, 0.8, 0.15]} />
        <meshStandardMaterial color="#a16207" roughness={0.9} />
      </mesh>
      {/* Top rail */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[2, 0.08, 0.08]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.85} />
      </mesh>
      {/* Bottom rail */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[2, 0.06, 0.06]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.85} />
      </mesh>
    </group>
  );
}

function WaterPlane() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.15 + Math.sin(t * 0.5) * 0.05;
  });

  return (
    <mesh
      ref={ref}
      position={[0, -5, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[200, 200]} />
      <MeshReflectorMaterial
        mirror={0.4}
        blur={[300, 100]}
        resolution={512}
        mixBlur={1}
        mixStrength={0.8}
        roughness={0.8}
        depthScale={0.6}
        color="#1e40af"
        metalness={0.2}
      />
    </mesh>
  );
}

function Flower({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = Math.sin(t * 0.5 + position[0] * 2) * 0.1;
    ref.current.position.y = position[1] + Math.sin(t * 1.5 + position[2]) * 0.02;
  });

  return (
    <group ref={ref} position={position}>
      {/* Petals */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.08, 0, Math.sin(angle) * 0.08]}
          >
            <sphereGeometry args={[0.06, 4, 4]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
      {/* Center */}
      <mesh>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      {/* Stem */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.01, 0.015, 0.18, 4]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
    </group>
  );
}

function Lantern({ position }: { position: [number, number, number] }) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!lightRef.current) return;
    const t = state.clock.getElapsedTime();
    lightRef.current.intensity = 2 + Math.sin(t * 2 + position[0]) * 0.5;
  });

  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 2, 6]} />
        <meshStandardMaterial color="#78716c" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lantern cap */}
      <mesh position={[0, 2.45, 0]} castShadow>
        <coneGeometry args={[0.35, 0.2, 4]} />
        <meshStandardMaterial color="#a16207" roughness={0.7} />
      </mesh>
      {/* Lantern body */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[0.35, 0.45, 0.35]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={0.6}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Lantern base */}
      <mesh position={[0, 1.88, 0]}>
        <boxGeometry args={[0.25, 0.05, 0.25]} />
        <meshStandardMaterial color="#a16207" roughness={0.7} />
      </mesh>
      {/* Light */}
      <pointLight
        ref={lightRef}
        position={[0, 2.15, 0]}
        color="#fbbf24"
        intensity={2}
        distance={8}
        decay={2}
      />
    </group>
  );
}

function CornerPillar({ position }: { position: [number, number, number] }) {
  const orbRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!orbRef.current) return;
    const t = state.clock.getElapsedTime();
    orbRef.current.position.y = 2.2 + Math.sin(t * 1.5) * 0.15;
    const mat = orbRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.4 + Math.sin(t * 2) * 0.2;
  });

  return (
    <group position={position}>
      {/* Pillar base */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.3, 1]} />
        <meshStandardMaterial color="#78716c" roughness={0.9} />
      </mesh>
      {/* Pillar shaft */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.35, 1.8, 6]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.6} />
      </mesh>
      {/* Pillar top */}
      <mesh position={[0, 2.05, 0]} castShadow>
        <boxGeometry args={[0.8, 0.15, 0.8]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.7} />
      </mesh>
      {/* Glowing orb */}
      <mesh ref={orbRef} position={[0, 2.2, 0]} castShadow>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={0.4}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      {/* Orb point light */}
      <pointLight
        position={[0, 2.2, 0]}
        color="#fbbf24"
        intensity={3}
        distance={6}
        decay={2}
      />
    </group>
  );
}

function PathStones({ angleDeg }: { angleDeg: number }) {
  const rad = (angleDeg * Math.PI) / 180;
  const radii = [3, 5, 7, 9];

  return (
    <>
      {radii.map((r, i) => (
        <mesh
          key={i}
          position={[Math.sin(rad) * r, 0.05, Math.cos(rad) * r]}
          receiveShadow
          rotation={[-Math.PI / 2, 0, rad]}
        >
          <circleGeometry args={[0.25 - i * 0.02, 6]} />
          <meshStandardMaterial color="#a8a29e" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

function AmbientParticles() {
  const count = 40;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const setRef = (el: THREE.Mesh | null, idx: number) => {
    refs.current[idx] = el;
  };

  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 28,
        y: 1.5 + Math.random() * 8,
        z: (Math.random() - 0.5) * 28,
        speed: 0.3 + Math.random() * 0.7,
        offset: Math.random() * Math.PI * 2,
        size: 0.02 + Math.random() * 0.04,
      })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = particles[i];
      mesh.position.y = p.y + Math.sin(t * p.speed + p.offset) * 0.8;
      mesh.position.x = p.x + Math.sin(t * p.speed * 0.5 + p.offset) * 0.3;
      mesh.rotation.y = t * p.speed;
    });
  });

  return (
    <>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => setRef(el, i)}
          position={[p.x, p.y, p.z]}
        >
          <sphereGeometry args={[p.size, 4, 4]} />
          <meshBasicMaterial
            color="#fef3c7"
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
    </>
  );
}

function SpawnPad() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15;
  });

  return (
    <mesh
      ref={ref}
      position={[0, 0.02, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <ringGeometry args={[1.5, 2, 32]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={0.3}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function IslandPlatform() {
  return (
    <RigidBody type="fixed" name="island-platform">
      <CuboidCollider args={[15, 0.5, 15]} position={[0, 0, 0]} />

      {/* Main grass surface */}
      <mesh position={[0, -0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[30, 1, 30]} />
        <meshStandardMaterial color="#4ade80" roughness={0.9} />
      </mesh>

      {/* Dirt layer */}
      <mesh position={[0, -1.15, 0]} receiveShadow>
        <boxGeometry args={[28, 0.4, 28]} />
        <meshStandardMaterial color="#92400e" roughness={1} />
      </mesh>

      {/* Stone layer */}
      <mesh position={[0, -1.55, 0]} receiveShadow>
        <boxGeometry args={[26, 0.3, 26]} />
        <meshStandardMaterial color="#78716c" roughness={0.95} />
      </mesh>

      {/* Bottom taper */}
      <mesh position={[0, -1.9, 0]} receiveShadow>
        <boxGeometry args={[22, 0.4, 22]} />
        <meshStandardMaterial color="#57534e" roughness={0.95} />
      </mesh>
    </RigidBody>
  );
}

function FenceRing() {
  const segmentCount = 12;
  const segments: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
  }> = [];

  for (let i = 0; i < segmentCount; i++) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const x = Math.sin(angle) * 14.5;
    const z = Math.cos(angle) * 14.5;
    const rotY = -angle + Math.PI / 2;
    segments.push({ position: [x, 0, z], rotation: [0, rotY, 0] });
  }

  return (
    <>
      {segments.map((seg, i) => (
        <FenceSegment
          key={`fence-${i}`}
          position={seg.position}
          rotation={seg.rotation}
        />
      ))}
    </>
  );
}

// ===== Main Lobby Environment =====

function LobbyEnvironment() {
  // Use the game store to get notification (ensures store import is used)
  const setNotification = useGameStore((s) => s.setNotification);

  // Set welcome notification on first render
  useMemo(() => {
    setNotification('Welcome to BlockVerse! Walk to a portal to play.');
  }, [setNotification]);

  return (
    <>
      {/* Fog for atmosphere */}
      <fog attach="fog" args={['#c7d2fe', 40, 90]} />

      {/* ===== ISLAND ===== */}
      <IslandPlatform />

      {/* ===== SAFETY GROUND (far below) ===== */}
      <group position={[0, -25, 0]}>
        <Ground size={200} color="#1e3a5f" />
      </group>

      {/* ===== WATER ===== */}
      <WaterPlane />

      {/* ===== SPAWN PAD ===== */}
      <SpawnPad />
      <Ring
        args={[0.5, 1.2, 32]}
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#fde68a"
          emissive="#fbbf24"
          emissiveIntensity={0.2}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </Ring>

      {/* ===== PORTALS ===== */}
      {portalConfigs.map(({ scene, angleDeg, icon }) => (
        <Portal
          key={scene}
          scene={scene}
          position={getPortalPosition(angleDeg)}
          color={SCENE_CONFIGS[scene].color}
          icon={icon}
        />
      ))}

      {/* ===== PATH STONES (leading to each portal) ===== */}
      {portalConfigs.map(({ angleDeg }) => (
        <PathStones key={`path-${angleDeg}`} angleDeg={angleDeg} />
      ))}

      {/* ===== TITLE ===== */}
      <LobbyTitle />

      {/* ===== TREES ===== */}
      {treeData.map(([x, y, z, s], i) => (
        <Tree key={`tree-${i}`} position={[x, y, z]} scale={s} />
      ))}

      {/* ===== ROCKS ===== */}
      {rockData.map(([x, y, z, s], i) => (
        <Rock key={`rock-${i}`} position={[x, y, z]} scale={s} />
      ))}

      {/* ===== COINS ===== */}
      {coinData.map((pos, i) => (
        <Coin key={`coin-${i}`} position={pos} />
      ))}

      {/* ===== ROTATING CUBES ===== */}
      {rotatingCubeData.map(([x, y, z, color], i) => (
        <RotatingCube key={`cube-${i}`} position={[x, y, z]} color={color} />
      ))}

      {/* ===== FLOWERS ===== */}
      {flowerData.map(([x, y, z, color], i) => (
        <Flower key={`flower-${i}`} position={[x, y, z]} color={color} />
      ))}

      {/* ===== LANTERNS ===== */}
      {lanternData.map(([x, y, z], i) => (
        <Lantern key={`lantern-${i}`} position={[x, y, z]} />
      ))}

      {/* ===== CORNER PILLARS ===== */}
      {pillarPositions.map((pos, i) => (
        <CornerPillar key={`pillar-${i}`} position={pos} />
      ))}

      {/* ===== FENCES ===== */}
      <FenceRing />

      {/* ===== AMBIENT PARTICLES ===== */}
      <AmbientParticles />

      {/* ===== EXTRA GROUND DETAILS ===== */}
      {/* Grass patches */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2 + Math.random() * 12;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        return (
          <mesh key={`grass-${i}`} position={[x, 0.01, z]}>
            <boxGeometry args={[0.15, 0.15, 0.15]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#16a34a' : '#4ade80'}
              roughness={1}
            />
          </mesh>
        );
      })}

      {/* Small mushrooms near some trees */}
      {treeData.slice(0, 5).map(([x, , z], i) => (
        <group
          key={`mushroom-${i}`}
          position={[x + (i % 2 === 0 ? 0.8 : -0.7), 0.05, z + 0.5]}
        >
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.12, 6]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.08, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ===== Main Scene Export =====

export default function LobbyScene() {
  return (
    <>
      <Sky />
      <Lighting />
      <Player position={[0, 2, 0]} />
      <ThirdPersonCamera />
      <LobbyEnvironment />
    </>
  );
}