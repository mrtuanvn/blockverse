'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/game/store';
import { getInputState } from '@/game/hooks/useInputState';
import Sky from '@/game/components/Sky';
import Lighting from '@/game/components/Lighting';
import Player from '@/game/components/Player';
import ThirdPersonCamera from '@/game/components/ThirdPersonCamera';
import CollectibleItem from '@/game/components/CollectibleItem';
import ParticleEffect from '@/game/components/ParticleEffect';
import type { Enemy } from '@/game/types';

// ═══════════════════════════════════════════════════════════════════
// MODULE-LEVEL SHARED STATE
// ═══════════════════════════════════════════════════════════════════

const playerWorld = {
  position: new THREE.Vector3(0, 2, 0),
  prevPosition: new THREE.Vector3(0, 2, 0),
  facingAngle: 0,
};

const punchHitSet = new Set<string>();

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

type WavePhase = 'waiting' | 'waveIntro' | 'fighting' | 'waveBreak' | 'victory' | 'defeat';

type PowerUpKind = 'heart' | 'speed' | 'shield';

interface BattleProjectileData {
  id: string;
  position: [number, number, number];
  target: THREE.Vector3;
  speed: number;
  damage: number;
}

interface PowerUpData {
  id: string;
  type: PowerUpKind;
  position: [number, number, number];
  collected: boolean;
}

interface PlayerEffects {
  speedBoost: boolean;
  shieldActive: boolean;
  speedTimer: number;
  shieldTimer: number;
}

// ═══════════════════════════════════════════════════════════════════
// WAVE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const ARENA_HALF = 19;
const SPAWN_POSITIONS: [number, number, number][] = [
  [-15, 1, -15], [-15, 1, -5], [-15, 1, 5], [-15, 1, 15],
  [15, 1, -15], [15, 1, -5], [15, 1, 5], [15, 1, 15],
  [-5, 1, -15], [5, 1, -15], [-5, 1, 15], [5, 1, 15],
  [0, 1, -15], [0, 1, 15], [-15, 1, 0], [15, 1, 0],
  [-10, 1, -10], [10, 1, -10], [-10, 1, 10], [10, 1, 10],
];

function generateWaveEnemies(waveIndex: number): Enemy[] {
  const enemies: Enemy[] = [];
  let spawnIdx = 0;
  const pos = () => SPAWN_POSITIONS[spawnIdx++ % SPAWN_POSITIONS.length];

  const melee = (hp: number, spd: number, dmg: number) => ({
    id: `wave${waveIndex}_melee_${enemies.length}`,
    type: 'melee' as const,
    position: pos(),
    health: hp,
    maxHealth: hp,
    speed: spd,
    damage: dmg,
    color: '#dc2626',
    size: 1,
    patrolRange: 5,
  });

  const ranged = (hp: number, spd: number, dmg: number) => ({
    id: `wave${waveIndex}_ranged_${enemies.length}`,
    type: 'ranged' as const,
    position: pos(),
    health: hp,
    maxHealth: hp,
    speed: spd,
    damage: dmg,
    color: '#2563eb',
    size: 1,
    patrolRange: 6,
  });

  const boss = (hp: number, spd: number, dmg: number, sz: number) => ({
    id: `wave${waveIndex}_boss_${enemies.length}`,
    type: 'boss' as const,
    position: [0, 1, -12] as [number, number, number],
    health: hp,
    maxHealth: hp,
    speed: spd,
    damage: dmg,
    color: '#7c3aed',
    size: sz,
    patrolRange: 8,
  });

  switch (waveIndex) {
    case 0:
      for (let i = 0; i < 3; i++) enemies.push(melee(50, 1, 10));
      break;
    case 1:
      for (let i = 0; i < 4; i++) enemies.push(melee(50, 1, 10));
      enemies.push(ranged(40, 0.8, 15));
      break;
    case 2:
      for (let i = 0; i < 5; i++) enemies.push(melee(55, 1.1, 10));
      for (let i = 0; i < 2; i++) enemies.push(ranged(45, 0.8, 15));
      break;
    case 3:
      for (let i = 0; i < 6; i++) enemies.push(melee(60, 1.2, 12));
      for (let i = 0; i < 3; i++) enemies.push(ranged(50, 0.9, 15));
      enemies.push(boss(200, 0.6, 25, 1.6));
      break;
    case 4:
      enemies.push(boss(500, 0.5, 30, 2));
      for (let i = 0; i < 4; i++) enemies.push(melee(60, 1.2, 12));
      break;
  }

  return enemies;
}

// ═══════════════════════════════════════════════════════════════════
// ARENA DECORATION DATA
// ═══════════════════════════════════════════════════════════════════

const PILLAR_POSITIONS: [number, number, number][] = [
  [-10, 0, -10], [10, 0, -10], [-10, 0, 10], [10, 0, 10],
  [-5, 0, 5], [5, 0, -5],
];

const PLATFORM_DATA: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [
  { pos: [-16, 2.5, -16], size: [4, 0.5, 4], color: '#78716c' },
  { pos: [16, 3, 16], size: [3, 0.5, 3], color: '#78716c' },
  { pos: [0, 3.5, -16], size: [5, 0.5, 3], color: '#78716c' },
  { pos: [-16, 2, 16], size: [3, 0.5, 3], color: '#78716c' },
];

const TORCH_POSITIONS: [number, number, number][] = [
  [-19.2, 5, -15], [-19.2, 5, 0], [-19.2, 5, 15],
  [19.2, 5, -15], [19.2, 5, 0], [19.2, 5, 15],
  [-15, 5, -19.2], [0, 5, -19.2], [15, 5, -19.2],
  [-15, 5, 19.2], [0, 5, 19.2], [15, 5, 19.2],
];

const SKULL_POSITIONS: [number, number, number, number][] = [
  [-19.2, 6.5, -10, 0], [19.2, 6.5, -10, Math.PI],
  [-19.2, 6.5, 10, 0], [19.2, 6.5, 10, Math.PI],
  [-10, 6.5, -19.2, Math.PI / 2], [10, 6.5, -19.2, -Math.PI / 2],
  [-10, 6.5, 19.2, -Math.PI / 2], [10, 6.5, 19.2, Math.PI / 2],
];

const CRACK_POSITIONS: [number, number, number, number, number][] = [
  [-5, 0.02, -8, 3, 0.4],
  [7, 0.02, 3, 2.5, 0.3],
  [-12, 0.02, 5, 2, 0.5],
  [3, 0.02, 12, 3.5, 0.3],
  [-8, 0.02, -2, 1.8, 0.25],
  [12, 0.02, -6, 2.2, 0.35],
];

// ═══════════════════════════════════════════════════════════════════
// PLAYER TRACKER — reads player position from scene graph
// ═══════════════════════════════════════════════════════════════════

function PlayerTracker() {
  const { world: _rapierWorld } = useRapier();

  useFrame(({ scene }) => {
    const obj = scene.getObjectByName('player-body');
    if (obj) {
      playerWorld.prevPosition.copy(playerWorld.position);
      playerWorld.position.copy(obj.position);
      const dx = playerWorld.position.x - playerWorld.prevPosition.x;
      const dz = playerWorld.position.z - playerWorld.prevPosition.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.02) {
        playerWorld.facingAngle = Math.atan2(dx, dz);
      }
    }
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// BATTLE ENEMY — full AI, eyes, health bar, ranged attacks
// ═══════════════════════════════════════════════════════════════════

interface BattleEnemyProps extends Enemy {
  onDeath: (id: string) => void;
  onShoot: (startPos: [number, number, number], target: THREE.Vector3, speed: number, damage: number, isBossSpread?: boolean) => void;
}

function BattleEnemy({
  id,
  type,
  position,
  health: initHealth,
  maxHealth,
  speed,
  damage,
  color,
  size,
  patrolRange,
  onDeath,
  onShoot,
}: BattleEnemyProps) {
  const bodyRef = useRef<any>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hp, setHp] = useState(initHealth);
  const [dead, setDead] = useState(false);
  const [particles, setParticles] = useState(false);

  const takeDamage = useGameStore((s) => s.takeDamage);
  const addScore = useGameStore((s) => s.addScore);
  const addCombo = useGameStore((s) => s.addCombo);
  const setNotification = useGameStore((s) => s.setNotification);

  const originX = position[0];
  const originZ = position[2];
  const shootTimer = useRef(0);
  const dmgCooldown = useRef(0);
  const facingDir = useRef(1);
  const leftPupilRef = useRef<THREE.Mesh>(null);
  const rightPupilRef = useRef<THREE.Mesh>(null);
  const aliveRef = useRef(true);

  // Listen for punch hits
  const checkPunch = useCallback(() => {
    if (!aliveRef.current) return;
    if (punchHitSet.has(id)) {
      punchHitSet.delete(id);
      setHp((h) => {
        const next = h - 25;
        if (next <= 0) {
          aliveRef.current = false;
          setDead(true);
          setParticles(true);
          const pts = type === 'boss' ? 500 : type === 'ranged' ? 150 : 100;
          addScore(pts);
          addCombo();
          setNotification(`${type === 'boss' ? 'BOSS' : 'Enemy'} defeated! +${pts}`);
          setTimeout(() => onDeath(id), 600);
          return 0;
        }
        return next;
      });
    }
  }, [id, type, onDeath, addScore, addCombo, setNotification]);

  // Collision with player — deal damage
  const handlePlayerCollision = useCallback(
    (other: any) => {
      if (!aliveRef.current) return;
      let collidingName: string | undefined;
      if (other?.rigidBodyObject) collidingName = other.rigidBodyObject.name;
      if (other?.other?.rigidBodyObject) collidingName = other.other.rigidBodyObject.name;
      if (collidingName === 'player-body' && dmgCooldown.current <= 0) {
        const shieldActive = (window as any).__battleShieldActive === true;
        if (!shieldActive) {
          takeDamage(damage);
          dmgCooldown.current = 1.0;
        }
      }
    },
    [damage, takeDamage],
  );

  useFrame((state, delta) => {
    if (dead || !bodyRef.current || !groupRef.current) return;

    checkPunch();

    const t = state.clock.getElapsedTime();
    const rb = bodyRef.current;
    const rbPos = rb.translation();
    const rbVel = rb.linvel();

    // Damage cooldown tick
    dmgCooldown.current = Math.max(0, dmgCooldown.current - delta);

    // Calculate distance to player
    const dx = playerWorld.position.x - rbPos.x;
    const dz = playerWorld.position.z - rbPos.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    let targetX: number;
    let targetZ: number;

    if (type === 'melee' || type === 'boss') {
      // Chase if within range
      if (distToPlayer < 8) {
        targetX = playerWorld.position.x;
        targetZ = playerWorld.position.z;
      } else {
        const patrolOffset = Math.sin(t * speed * 0.3) * patrolRange;
        targetX = originX + patrolOffset;
        targetZ = originZ;
      }

      const moveX = targetX - rbPos.x;
      const moveZ = targetZ - rbPos.z;
      const moveDist = Math.sqrt(moveX * moveX + moveZ * moveZ);

      if (moveDist > 0.3) {
        const nx = (moveX / moveDist) * speed;
        const nz = (moveZ / moveDist) * speed;
        rb.setLinvel({ x: nx, y: rbVel.y, z: nz }, true);
        facingDir.current = moveX > 0 ? 1 : -1;
        groupRef.current.rotation.y = facingDir.current > 0 ? 0 : Math.PI;
      } else {
        rb.setLinvel({ x: 0, y: rbVel.y, z: 0 }, true);
      }
    } else if (type === 'ranged') {
      // Ranged: chase to 5 units, then stop and shoot
      if (distToPlayer > 10) {
        // Patrol
        const patrolOffset = Math.sin(t * speed * 0.3) * patrolRange;
        targetX = originX + patrolOffset;
        targetZ = originZ;
      } else if (distToPlayer > 4) {
        // Approach to firing distance
        targetX = playerWorld.position.x;
        targetZ = playerWorld.position.z;
      } else {
        targetX = rbPos.x;
        targetZ = rbPos.z;
      }

      const moveX = targetX - rbPos.x;
      const moveZ = targetZ - rbPos.z;
      const moveDist = Math.sqrt(moveX * moveX + moveZ * moveZ);

      if (moveDist > 0.3) {
        const nx = (moveX / moveDist) * speed;
        const nz = (moveZ / moveDist) * speed;
        rb.setLinvel({ x: nx, y: rbVel.y, z: nz }, true);
        facingDir.current = moveX > 0 ? 1 : -1;
        groupRef.current.rotation.y = facingDir.current > 0 ? 0 : Math.PI;
      } else {
        rb.setLinvel({ x: 0, y: rbVel.y, z: 0 }, true);
      }

      // Shoot every 2 seconds if in range
      if (distToPlayer < 12) {
        shootTimer.current += delta;
        if (shootTimer.current >= 2) {
          shootTimer.current = 0;
          onShoot(
            [rbPos.x, rbPos.y + size * 0.6, rbPos.z],
            playerWorld.position.clone(),
            8,
            damage,
            false,
          );
        }
      }
    }

    // Boss: shoot 3 projectiles in a spread
    if (type === 'boss') {
      shootTimer.current += delta;
      if (shootTimer.current >= 2 && distToPlayer < 15) {
        shootTimer.current = 0;
        onShoot(
          [rbPos.x, rbPos.y + size * 0.6, rbPos.z],
          playerWorld.position.clone(),
          6,
          damage,
          true,
        );
      }
    }

    // Update pupil positions based on facing direction
    if (leftPupilRef.current) {
      leftPupilRef.current.position.x = -size * 0.18 + facingDir.current * 0.02;
    }
    if (rightPupilRef.current) {
      rightPupilRef.current.position.x = size * 0.18 + facingDir.current * 0.02;
    }

    // Bobbing
    groupRef.current.position.y = Math.sin(t * 3) * 0.05;

    // Keep Y in bounds
    if (rbPos.y < 0.5) {
      rb.setTranslation({ x: rbPos.x, y: 1, z: rbPos.z }, true);
      rb.setLinvel({ x: rbVel.x, y: 0, z: rbVel.z }, true);
    }
    // Clamp to arena
    const clampedX = Math.max(-ARENA_HALF + 1, Math.min(ARENA_HALF - 1, rbPos.x));
    const clampedZ = Math.max(-ARENA_HALF + 1, Math.min(ARENA_HALF - 1, rbPos.z));
    if (Math.abs(rbPos.x - clampedX) > 0.5 || Math.abs(rbPos.z - clampedZ) > 0.5) {
      rb.setTranslation({ x: clampedX, y: rbPos.y, z: clampedZ }, true);
    }
  });

  const healthPct = maxHealth > 0 ? hp / maxHealth : 0;
  const barW = Math.max(0, healthPct) * (size * 1.6);
  const barColor = healthPct > 0.5 ? '#22c55e' : healthPct > 0.25 ? '#f59e0b' : '#ef4444';

  if (dead && !particles) return null;

  const eyeScale = size * 0.14;
  const pupilScale = size * 0.07;
  const eyeY = size * 0.65;
  const eyeZ = size * 0.4 + 0.01;

  return (
    <>
      {particles && (
        <ParticleEffect
          position={[position[0], position[1] + size, position[2]]}
          color={color}
          count={type === 'boss' ? 25 : 15}
          speed={type === 'boss' ? 5 : 4}
          size={0.15}
        />
      )}
      {!dead && (
        <RigidBody
          ref={bodyRef}
          type="dynamic"
          position={position}
          enabledRotations={[false, false, false]}
          linearDamping={5}
          lockRotations
          colliders={false}
          name={`enemy-${id}`}
          onCollisionEnter={handlePlayerCollision}
        >
          <CuboidCollider args={[size / 2, size / 2, size / 2]} position={[0, size / 2, 0]} />
          <group ref={groupRef}>
            {/* Health Bar */}
            <group position={[0, size + 0.6, 0]}>
              <mesh>
                <boxGeometry args={[size * 1.6, 0.14, 0.06]} />
                <meshBasicMaterial color="#1a1a2e" />
              </mesh>
              <mesh position={[-((size * 1.6) - barW) / 2, 0, 0.002]}>
                <boxGeometry args={[barW, 0.1, 0.06]} />
                <meshBasicMaterial color={barColor} />
              </mesh>
            </group>

            {/* Body */}
            <mesh position={[0, size / 2, 0]} castShadow>
              <boxGeometry args={[size, size, size * 0.8]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>

            {/* Boss Crown */}
            {type === 'boss' && (
              <group position={[0, size + 0.15, 0]}>
                <mesh>
                  <boxGeometry args={[size * 0.8, 0.25, size * 0.8]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.6} roughness={0.3} />
                </mesh>
                {[-0.35, 0, 0.35].map((ox, i) => (
                  <mesh key={i} position={[size * ox, 0.2, 0]}>
                    <boxGeometry args={[0.1, 0.25, 0.1]} />
                    <meshStandardMaterial color="#fbbf24" metalness={0.6} roughness={0.3} />
                  </mesh>
                ))}
              </group>
            )}

            {/* Eyes */}
            <group position={[0, eyeY, eyeZ]}>
              <mesh position={[-size * 0.18, 0, 0]}>
                <boxGeometry args={[eyeScale * 2, eyeScale * 2, 0.02]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh ref={leftPupilRef} position={[-size * 0.18, 0, 0.015]}>
                <boxGeometry args={[pupilScale * 2, pupilScale * 2, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
              <mesh position={[size * 0.18, 0, 0]}>
                <boxGeometry args={[eyeScale * 2, eyeScale * 2, 0.02]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh ref={rightPupilRef} position={[size * 0.18, 0, 0.015]}>
                <boxGeometry args={[pupilScale * 2, pupilScale * 2, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
              {/* Angry Eyebrows */}
              <mesh position={[-size * 0.18, eyeScale * 1.3, 0]} rotation={[0, 0, 0.35]}>
                <boxGeometry args={[eyeScale * 2.5, 0.04, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
              <mesh position={[size * 0.18, eyeScale * 1.3, 0]} rotation={[0, 0, -0.35]}>
                <boxGeometry args={[eyeScale * 2.5, 0.04, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
            </group>

            {/* Mouth */}
            <mesh position={[0, size * 0.3, size * 0.4 + 0.01]}>
              <boxGeometry args={[size * 0.3, size * 0.08, 0.02]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
          </group>
        </RigidBody>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROJECTILE — red cube that homes toward player
// ═══════════════════════════════════════════════════════════════════

function Projectile({
  data,
  onHitPlayer,
  onExpire,
}: {
  data: BattleProjectileData;
  onHitPlayer: (damage: number) => void;
  onExpire: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const velocity = useRef(new THREE.Vector3());
  const elapsed = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const start = new THREE.Vector3(...data.position);
    const dir = new THREE.Vector3().subVectors(data.target, start).normalize();
    velocity.current.copy(dir).multiplyScalar(data.speed);
  }, [data]);

  useFrame((_, delta) => {
    if (!meshRef.current || done.current) return;

    meshRef.current.position.x += velocity.current.x * delta;
    meshRef.current.position.y += velocity.current.y * delta;
    meshRef.current.position.z += velocity.current.z * delta;

    // Slight gravity
    velocity.current.y -= 0.5 * delta;

    elapsed.current += delta;

    // Check hit player
    const projPos = meshRef.current.position;
    const dist = projPos.distanceTo(playerWorld.position);
    if (dist < 1.0) {
      done.current = true;
      onHitPlayer(data.damage);
      return;
    }

    // Auto-destroy after 5 seconds
    if (elapsed.current >= 5) {
      done.current = true;
      onExpire(data.id);
      return;
    }

    // Out of arena bounds
    if (
      Math.abs(projPos.x) > ARENA_HALF + 5 ||
      Math.abs(projPos.z) > ARENA_HALF + 5 ||
      projPos.y < -5
    ) {
      done.current = true;
      onExpire(data.id);
    }
  });

  return (
    <mesh ref={meshRef} position={data.position} castShadow>
      <boxGeometry args={[0.25, 0.25, 0.25]} />
      <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.8} roughness={0.3} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PUNCH HITBOX — sensor that detects enemies on melee attack
// ═══════════════════════════════════════════════════════════════════

function PunchHitbox({
  active,
  origin,
  angle,
}: {
  active: boolean;
  origin: [number, number, number];
  angle: number;
}) {
  const hitboxPos: [number, number, number] = [
    origin[0] + Math.sin(angle) * 1.5,
    origin[1],
    origin[2] + Math.cos(angle) * 1.5,
  ];

  if (!active) return null;

  return (
    <group>
      <RigidBody
        type="fixed"
        position={hitboxPos}
        sensor
        name="punch-hitbox"
        onIntersectionEnter={(other: any) => {
          const name =
            other?.rigidBodyObject?.name ||
            other?.other?.rigidBodyObject?.name ||
            other?.colliderObject?.name ||
            '';
          if (name.startsWith('enemy-')) {
            const enemyId = name.replace('enemy-', '');
            punchHitSet.add(enemyId);
          }
        }}
      >
        <CuboidCollider args={[0.8, 0.8, 0.8]} sensor />
      </RigidBody>
      {/* Visual punch effect */}
      <mesh position={hitboxPos}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.4} />
      </mesh>
      {/* Punch trail */}
      <mesh
        position={[
          origin[0] + Math.sin(angle) * 0.9,
          origin[1],
          origin[2] + Math.cos(angle) * 0.9,
        ]}
      >
        <boxGeometry args={[0.3, 0.3, 0.8]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BATTLE POWER-UP — heart, speed, shield
// ═══════════════════════════════════════════════════════════════════

function BattlePowerUp({
  data,
  onCollect,
}: {
  data: PowerUpData;
  onCollect: (id: string, type: PowerUpKind) => void;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const [collected, setCollected] = useState(false);

  useFrame((state) => {
    if (!meshRef.current || collected) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.position.y = data.position[1] + Math.sin(t * 2.5) * 0.2 + 0.5;
    meshRef.current.rotation.y = t * 2;
    const pulse = 1 + Math.sin(t * 4) * 0.1;
    meshRef.current.scale.setScalar(pulse);
  });

  const config = {
    heart: { color: '#ef4444', emissive: '#dc2626', size: 0.4 },
    speed: { color: '#22d3ee', emissive: '#06b6d4', size: 0.35 },
    shield: { color: '#a855f7', emissive: '#9333ea', size: 0.4 },
  }[data.type];

  if (collected) return null;

  return (
    <RigidBody
      type="fixed"
      position={[data.position[0], data.position[1] + 0.5, data.position[2]]}
      sensor
      name={`powerup-${data.id}`}
      onIntersectionEnter={(other: any) => {
        const name =
          other?.rigidBodyObject?.name ||
          other?.other?.rigidBodyObject?.name ||
          other?.colliderObject?.name ||
          '';
        if (name === 'player-body') {
          setCollected(true);
          onCollect(data.id, data.type);
        }
      }}
    >
      <CuboidCollider args={[0.5, 0.5, 0.5]} sensor />
      <group ref={meshRef} position={[data.position[0], data.position[1] + 0.5, data.position[2]]}>
        <mesh castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={config.color}
            emissive={config.emissive}
            emissiveIntensity={0.5}
            transparent
            opacity={0.9}
          />
        </mesh>
        {data.type === 'heart' && (
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
        )}
        {data.type === 'shield' && (
          <mesh position={[0, 0.6, 0]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.5, 0.6, 0.05]} />
            <meshBasicMaterial color="#e9d5ff" transparent opacity={0.5} />
          </mesh>
        )}
        {data.type === 'speed' && (
          <>
            <mesh position={[-0.25, 0, 0]}>
              <boxGeometry args={[0.1, 0.4, 0.1]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
            </mesh>
            <mesh position={[0.15, -0.1, 0]}>
              <boxGeometry args={[0.1, 0.25, 0.1]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
            </mesh>
          </>
        )}
        <pointLight color={config.color} intensity={0.5} distance={3} />
      </group>
    </RigidBody>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ARENA LAYOUT — floor, walls, pillars, platforms
// ═══════════════════════════════════════════════════════════════════

function ArenaLayout() {
  return (
    <group>
      {/* ═══ FLOOR ═══ */}
      <RigidBody type="fixed" name="arena-floor" friction={1.2} restitution={0}>
        <CuboidCollider args={[20, 0.25, 20]} position={[0, -0.25, 0]} />
        <mesh position={[0, -0.25, 0]} receiveShadow>
          <boxGeometry args={[40, 0.5, 40]} />
          <meshStandardMaterial color="#6b7280" roughness={0.9} metalness={0.1} />
        </mesh>
      </RigidBody>

      {/* Floor grid lines */}
      {Array.from({ length: 9 }, (_, i) => i - 4).map((i) => (
        <mesh key={`gx${i}`} position={[i * 4, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 40]} />
          <meshBasicMaterial color="#4b5563" transparent opacity={0.4} />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, i) => i - 4).map((i) => (
        <mesh key={`gz${i}`} position={[0, 0.01, i * 4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[40, 0.06]} />
          <meshBasicMaterial color="#4b5563" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* ═══ CRACKED FLOOR ═══ */}
      {CRACK_POSITIONS.map(([x, y, z, w, h], i) => (
        <mesh key={`crack${i}`} position={[x, y, z]} rotation={[-Math.PI / 2, Math.random() * 0.5, 0]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color="#374151" transparent opacity={0.5} />
        </mesh>
      ))}

      {/* ═══ WALLS ═══ */}
      {/* North wall (z = -20) */}
      <RigidBody type="fixed" name="wall-north">
        <CuboidCollider args={[20.5, 4, 0.5]} position={[0, 4, -20.5]} />
        <mesh position={[0, 4, -20.5]} receiveShadow castShadow>
          <boxGeometry args={[41, 8, 1]} />
          <meshStandardMaterial color="#57534e" roughness={0.85} />
        </mesh>
      </RigidBody>
      {/* South wall (z = 20) */}
      <RigidBody type="fixed" name="wall-south">
        <CuboidCollider args={[20.5, 4, 0.5]} position={[0, 4, 20.5]} />
        <mesh position={[0, 4, 20.5]} receiveShadow castShadow>
          <boxGeometry args={[41, 8, 1]} />
          <meshStandardMaterial color="#57534e" roughness={0.85} />
        </mesh>
      </RigidBody>
      {/* West wall (x = -20) */}
      <RigidBody type="fixed" name="wall-west">
        <CuboidCollider args={[0.5, 4, 20.5]} position={[-20.5, 4, 0]} />
        <mesh position={[-20.5, 4, 0]} receiveShadow castShadow>
          <boxGeometry args={[1, 8, 41]} />
          <meshStandardMaterial color="#57534e" roughness={0.85} />
        </mesh>
      </RigidBody>
      {/* East wall (x = 20) */}
      <RigidBody type="fixed" name="wall-east">
        <CuboidCollider args={[0.5, 4, 20.5]} position={[20.5, 4, 0]} />
        <mesh position={[20.5, 4, 0]} receiveShadow castShadow>
          <boxGeometry args={[1, 8, 41]} />
          <meshStandardMaterial color="#57534e" roughness={0.85} />
        </mesh>
      </RigidBody>

      {/* Wall top trim */}
      {[
        [0, 8.1, -20.5, 41, 0.3, 1.2],
        [0, 8.1, 20.5, 41, 0.3, 1.2],
        [-20.5, 8.1, 0, 1.2, 0.3, 41],
        [20.5, 8.1, 0, 1.2, 0.3, 41],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={`trim${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#44403c" roughness={0.9} />
        </mesh>
      ))}

      {/* ═══ PILLARS ═══ */}
      {PILLAR_POSITIONS.map(([x, y, z], i) => (
        <group key={`pillar${i}`}>
          <RigidBody type="fixed" name={`pillar-${i}`}>
            <CuboidCollider args={[0.6, 4, 0.6]} position={[x, 4, z]} />
            <mesh position={[x, 4, z]} castShadow receiveShadow>
              <boxGeometry args={[1.2, 8, 1.2]} />
              <meshStandardMaterial color="#78716c" roughness={0.8} />
            </mesh>
            {/* Pillar base */}
            <mesh position={[x, 0.25, z]}>
              <boxGeometry args={[1.6, 0.5, 1.6]} />
              <meshStandardMaterial color="#57534e" roughness={0.9} />
            </mesh>
            {/* Pillar capital */}
            <mesh position={[x, 8.15, z]}>
              <boxGeometry args={[1.5, 0.3, 1.5]} />
              <meshStandardMaterial color="#57534e" roughness={0.9} />
            </mesh>
          </RigidBody>
        </group>
      ))}

      {/* ═══ ELEVATED PLATFORMS ═══ */}
      {PLATFORM_DATA.map((plat, i) => (
        <RigidBody key={`platform${i}`} type="fixed" name={`platform-${i}`}>
          <CuboidCollider
            args={[plat.size[0] / 2, plat.size[1] / 2, plat.size[2] / 2]}
            position={plat.pos}
          />
          <mesh position={plat.pos} receiveShadow castShadow>
            <boxGeometry args={plat.size} />
            <meshStandardMaterial color={plat.color} roughness={0.7} />
          </mesh>
          {/* Platform edge trim */}
          <mesh position={[plat.pos[0], plat.pos[1] - plat.size[1] / 2 - 0.1, plat.pos[2]]}>
            <boxGeometry args={[plat.size[0] + 0.2, 0.2, plat.size[2] + 0.2]} />
            <meshStandardMaterial color="#44403c" roughness={0.9} />
          </mesh>
          {/* Ramps for accessibility */}
          <mesh position={[plat.pos[0] + plat.size[0] / 2 + 0.8, plat.pos[1] / 2, plat.pos[2]]}
            rotation={[0, 0, -Math.atan2(plat.pos[1], 1.6)]}>
            <boxGeometry args={[2, 0.15, plat.size[2] * 0.8]} />
            <meshStandardMaterial color="#6b7280" roughness={0.8} />
          </mesh>
        </RigidBody>
      ))}

      {/* ═══ TORCHES ═══ */}
      {TORCH_POSITIONS.map(([x, y, z], i) => (
        <group key={`torch${i}`}>
          {/* Torch bracket */}
          <mesh position={[x > 0 ? x - 0.6 : x + 0.6, y - 1.5, z]}>
            <boxGeometry args={[0.15, 0.8, 0.15]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
          {/* Torch body */}
          <mesh position={[x > 0 ? x - 0.6 : x + 0.6, y - 0.9, z]}>
            <boxGeometry args={[0.25, 0.4, 0.25]} />
            <meshStandardMaterial color="#92400e" roughness={0.8} />
          </mesh>
          {/* Flame glow */}
          <mesh position={[x > 0 ? x - 0.6 : x + 0.6, y - 0.5, z]}>
            <boxGeometry args={[0.15, 0.35, 0.15]} />
            <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={2} transparent opacity={0.9} />
          </mesh>
          {/* Point light */}
          <pointLight
            position={[x > 0 ? x - 0.6 : x + 0.6, y - 0.3, z]}
            color="#f97316"
            intensity={1.5}
            distance={8}
            decay={2}
          />
        </group>
      ))}

      {/* ═══ SKULL DECORATIONS ═══ */}
      {SKULL_POSITIONS.map(([x, y, z, rot], i) => (
        <group key={`skull${i}`} position={[x, y, z]} rotation={[0, rot, 0]}>
          {/* Skull head */}
          <mesh>
            <boxGeometry args={[0.35, 0.4, 0.3]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.9} />
          </mesh>
          {/* Left eye socket */}
          <mesh position={[-0.08, 0.05, 0.16]}>
            <boxGeometry args={[0.1, 0.1, 0.02]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          {/* Right eye socket */}
          <mesh position={[0.08, 0.05, 0.16]}>
            <boxGeometry args={[0.1, 0.1, 0.02]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          {/* Nose */}
          <mesh position={[0, -0.05, 0.16]}>
            <boxGeometry args={[0.06, 0.08, 0.02]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          {/* Jaw */}
          <mesh position={[0, -0.15, 0.14]}>
            <boxGeometry args={[0.25, 0.06, 0.02]} />
            <meshBasicMaterial color="#d1d5db" />
          </mesh>
          {/* Teeth */}
          {[-0.06, -0.02, 0.02, 0.06].map((tx, ti) => (
            <mesh key={ti} position={[tx, -0.15, 0.16]}>
              <boxGeometry args={[0.03, 0.04, 0.02]} />
              <meshBasicMaterial color="#f9fafb" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WAVE TEXT DISPLAY — 3D floating text
// ═══════════════════════════════════════════════════════════════════

function WaveTextDisplay({ text, visible }: { text: string; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const opacityVal = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (visible) {
      opacityVal.current = Math.min(1, opacityVal.current + delta * 3);
    } else {
      opacityVal.current = Math.max(0, opacityVal.current - delta * 3);
    }
    groupRef.current.visible = opacityVal.current > 0.01 || visible;
    // Update Text fillOpacity via traversal
    groupRef.current.traverse((child) => {
      if ((child as any).fillOpacity !== undefined) {
        (child as any).fillOpacity = opacityVal.current;
      }
    });
  });

  return (
    <group ref={groupRef} visible={false}>
      <Text
        position={[0, 12, 0]}
        fontSize={3}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
        outlineWidth={0.08}
        outlineColor="#92400e"
        font={undefined}
      >
        {text}
      </Text>
    </group>
  );
}

function VictoryDisplay({ score, visible }: { score: number; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const opacityVal = useRef(0);
  const scaleVal = useRef(0.5);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (visible) {
      opacityVal.current = Math.min(1, opacityVal.current + delta * 2);
      scaleVal.current = Math.min(1, scaleVal.current + delta * 2);
    }
    groupRef.current.scale.setScalar(scaleVal.current);
    groupRef.current.traverse((child) => {
      if ((child as any).fillOpacity !== undefined) {
        (child as any).fillOpacity = opacityVal.current;
      }
    });
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={[0, 10, 0]} scale={0.5}>
      <Text
        position={[0, 2, 0]}
        fontSize={4}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
        outlineWidth={0.1}
        outlineColor="#92400e"
        font={undefined}
      >
        VICTORY!
      </Text>
      <Text
        position={[0, -0.5, 0]}
        fontSize={1.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
        font={undefined}
      >
        {`Score: ${Math.floor(score)}`}
      </Text>
      <Text
        position={[0, -2, 0]}
        fontSize={1}
        color="#a3a3a3"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
        font={undefined}
      >
        Score submitted to leaderboard!
      </Text>
    </group>
  );
}

function DefeatDisplay({ visible }: { visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const opacityVal = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (visible) {
      opacityVal.current = Math.min(1, opacityVal.current + delta * 2);
    }
    groupRef.current.traverse((child) => {
      if ((child as any).fillOpacity !== undefined) {
        (child as any).fillOpacity = opacityVal.current;
      }
    });
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={[0, 10, 0]}>
      <Text
        position={[0, 1, 0]}
        fontSize={4}
        color="#ef4444"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
        outlineWidth={0.1}
        outlineColor="#7f1d1d"
        font={undefined}
      >
        DEFEATED
      </Text>
      <Text
        position={[0, -1.5, 0]}
        fontSize={1.2}
        color="#a3a3a3"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0}
        font={undefined}
      >
        Press R to restart
      </Text>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHIELD VISUAL — glowing sphere around player when shield active
// ═══════════════════════════════════════════════════════════════════

function ShieldVisual({ active }: { active: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current || !active) return;
    meshRef.current.position.copy(playerWorld.position);
    meshRef.current.position.y += 1;
    meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
    const pulse = 1 + Math.sin(state.clock.getElapsedTime() * 4) * 0.05;
    meshRef.current.scale.setScalar(pulse);
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2.2, 2]} />
      <meshBasicMaterial color="#a855f7" transparent opacity={0.15} wireframe />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN BATTLE SCENE
// ═══════════════════════════════════════════════════════════════════

export default function BattleScene() {
  // Store selectors
  const {
    game,
    startGame,
    endGame,
    addScore,
    setTime,
    takeDamage: storeTakeDamage,
    heal,
    setNotification,
    setScore,
    addCombo,
    resetCombo,
    submitScore,
    setHealth,
    setScene,
  } = useGameStore();

  // Wave state
  const [wavePhase, setWavePhase] = useState<WavePhase>('waiting');
  const [currentWave, setCurrentWave] = useState(0);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<BattleProjectileData[]>([]);
  const [powerups, setPowerups] = useState<PowerUpData[]>([]);
  const [waveText, setWaveText] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [showDefeat, setShowDefeat] = useState(false);
  const [punchActive, setPunchActive] = useState(false);
  const [punchOrigin, setPunchOrigin] = useState<[number, number, number]>([0, 1, 0]);
  const [punchAngle, setPunchAngle] = useState(0);
  const [playerEffects, setPlayerEffects] = useState<PlayerEffects>({
    speedBoost: false,
    shieldActive: false,
    speedTimer: 0,
    shieldTimer: 0,
  });

  // Refs for useFrame access
  const wavePhaseRef = useRef<WavePhase>('waiting');
  const currentWaveRef = useRef(0);
  const waveTimerRef = useRef(0);
  const elapsedRef = useRef(0);
  const healAccumRef = useRef(0);
  const aliveEnemiesRef = useRef(0);
  const effectsRef = useRef<PlayerEffects>({ speedBoost: false, shieldActive: false, speedTimer: 0, shieldTimer: 0 });

  // Sync refs
  useEffect(() => { wavePhaseRef.current = wavePhase; }, [wavePhase]);
  useEffect(() => { currentWaveRef.current = currentWave; }, [currentWave]);
  useEffect(() => { effectsRef.current = playerEffects; }, [playerEffects]);

  // Initialize game on mount
  useEffect(() => {
    setScene('battle');
    startGame();
    setHealth(100);
    setScore(0);
    elapsedRef.current = 0;
    healAccumRef.current = 0;
    (window as any).__battleShieldActive = false;
    return () => {
      (window as any).__battleShieldActive = false;
    };
  }, []);

  // Spawn a wave of enemies
  const spawnWave = useCallback((waveIndex: number) => {
    const waveEnemies = generateWaveEnemies(waveIndex);
    setEnemies(waveEnemies);
    aliveEnemiesRef.current = waveEnemies.length;
  }, []);

  // Spawn powerups between waves
  const spawnPowerups = useCallback(() => {
    const newPowerups: PowerUpData[] = [];
    const randPos = (): [number, number, number] => [
      (Math.random() - 0.5) * 30,
      0,
      (Math.random() - 0.5) * 30,
    ];

    for (let i = 0; i < 3; i++) {
      newPowerups.push({ id: `heart_${i}`, type: 'heart', position: randPos(), collected: false });
    }
    for (let i = 0; i < 2; i++) {
      newPowerups.push({ id: `speed_${i}`, type: 'speed', position: randPos(), collected: false });
    }
    newPowerups.push({ id: 'shield_0', type: 'shield', position: randPos(), collected: false });

    setPowerups(newPowerups);
  }, []);

  // Handle enemy death
  const handleEnemyDeath = useCallback((id: string) => {
    setEnemies((prev) => prev.filter((e) => e.id !== id));
    aliveEnemiesRef.current = Math.max(0, aliveEnemiesRef.current - 1);
  }, []);

  // Handle enemy shooting
  const handleShoot = useCallback(
    (
      startPos: [number, number, number],
      target: THREE.Vector3,
      speed: number,
      damage: number,
      isBossSpread?: boolean,
    ) => {
      if (isBossSpread) {
        const dir = new THREE.Vector3().subVectors(target, new THREE.Vector3(...startPos)).normalize();
        const baseAngle = Math.atan2(dir.x, dir.z);
        const spreadAngles = [baseAngle - 0.3, baseAngle, baseAngle + 0.3];
        const newProjectiles: BattleProjectileData[] = spreadAngles.map((a, i) => ({
          id: `proj_${Date.now()}_${i}`,
          position: startPos,
          target: new THREE.Vector3(
            startPos[0] + Math.sin(a) * 15,
            startPos[1],
            startPos[2] + Math.cos(a) * 15,
          ),
          speed,
          damage,
        }));
        setProjectiles((prev) => [...prev, ...newProjectiles]);
      } else {
        setProjectiles((prev) => [
          ...prev,
          {
            id: `proj_${Date.now()}`,
            position: startPos,
            target: target.clone(),
            speed,
            damage,
          },
        ]);
      }
    },
    [],
  );

  // Handle projectile hitting player
  const handleProjectileHit = useCallback(
    (damage: number) => {
      const shieldActive = effectsRef.current.shieldActive;
      if (!shieldActive) {
        storeTakeDamage(damage);
      }
    },
    [storeTakeDamage],
  );

  // Handle projectile expiry
  const handleProjectileExpire = useCallback((id: string) => {
    setProjectiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Handle powerup collection
  const handlePowerupCollect = useCallback(
    (id: string, type: PowerUpKind) => {
      setPowerups((prev) => prev.map((p) => (p.id === id ? { ...p, collected: true } : p)));
      switch (type) {
        case 'heart':
          heal(25);
          setNotification('+25 HP restored!');
          break;
        case 'speed':
          setPlayerEffects((prev) => ({ ...prev, speedBoost: true, speedTimer: 10 }));
          setNotification('Speed Boost activated! 10s');
          break;
        case 'shield':
          setPlayerEffects((prev) => ({ ...prev, shieldActive: true, shieldTimer: 8 }));
          (window as any).__battleShieldActive = true;
          setNotification('Shield activated! 8s');
          break;
      }
    },
    [heal, setNotification],
  );

  // Player attack (E key or mobile attack button)
  const attackRafRef = useRef<number>(0);
  useEffect(() => {
    let lastAttack = false;
    const check = () => {
      const input = getInputState();
      if (input.attack && !lastAttack && !game.isGameOver && wavePhaseRef.current === 'fighting') {
        punchHitSet.clear();
        setPunchOrigin([
          playerWorld.position.x,
          playerWorld.position.y + 1,
          playerWorld.position.z,
        ]);
        setPunchAngle(playerWorld.facingAngle);
        setPunchActive(true);
        setTimeout(() => setPunchActive(false), 300);
      }
      lastAttack = input.attack;
      attackRafRef.current = requestAnimationFrame(check);
    };
    attackRafRef.current = requestAnimationFrame(check);
    return () => cancelAnimationFrame(attackRafRef.current);
  }, [game.isGameOver]);

  // Main game loop
  useFrame((_, delta) => {
    // Clamp delta to avoid physics issues
    const dt = Math.min(delta, 0.1);

    // Check game over
    if (game.health <= 0 && wavePhaseRef.current !== 'defeat' && wavePhaseRef.current !== 'victory') {
      setWavePhase('defeat');
      setShowDefeat(true);
      endGame();
      return;
    }

    // Don't update if paused, defeated, or victory
    if (wavePhaseRef.current === 'defeat' || wavePhaseRef.current === 'victory') return;

    // Update elapsed time
    elapsedRef.current += dt;
    setTime(elapsedRef.current);

    // Health regeneration: 1 HP per 5 seconds
    healAccumRef.current += dt;
    if (healAccumRef.current >= 5 && game.health < game.maxHealth) {
      healAccumRef.current = 0;
      heal(1);
    }

    // Update player effects
    setPlayerEffects((prev) => {
      let { speedBoost, shieldActive, speedTimer, shieldTimer } = prev;
      if (speedBoost) {
        speedTimer -= dt;
        if (speedTimer <= 0) {
          speedBoost = false;
          speedTimer = 0;
        }
      }
      if (shieldActive) {
        shieldTimer -= dt;
        if (shieldTimer <= 0) {
          shieldActive = false;
          shieldTimer = 0;
          (window as any).__battleShieldActive = false;
        }
      }
      return { speedBoost, shieldActive, speedTimer, shieldTimer };
    });

    // Combo timer decay
    if (game.comboTimer > 0) {
      // Store handles combo decay in the game state; we just need to trigger resetCombo when timer hits 0
    }

    // Wave phase state machine
    waveTimerRef.current += dt;

    switch (wavePhaseRef.current) {
      case 'waiting':
        if (waveTimerRef.current >= 1.5) {
          setWavePhase('waveIntro');
          setWaveText('WAVE 1');
          waveTimerRef.current = 0;
          spawnWave(0);
          setCurrentWave(0);
        }
        break;

      case 'waveIntro':
        if (waveTimerRef.current >= 2.5) {
          setWavePhase('fighting');
          waveTimerRef.current = 0;
        }
        break;

      case 'fighting':
        if (aliveEnemiesRef.current <= 0) {
          setWavePhase('waveBreak');
          waveTimerRef.current = 0;
          spawnPowerups();
          setNotification('Wave cleared! Collect power-ups!');
        }
        break;

      case 'waveBreak':
        if (waveTimerRef.current >= 3) {
          const nextWave = currentWaveRef.current + 1;
          if (nextWave >= 5) {
            // All waves cleared — VICTORY!
            setWavePhase('victory');
            setShowVictory(true);
            endGame();
            // Calculate final score with time bonus
            const timeBonus = Math.max(0, Math.floor((300 - elapsedRef.current) * 5));
            const finalScore = game.score + timeBonus;
            setScore(finalScore);
            addScore(timeBonus);
            submitScore('battle', finalScore, elapsedRef.current);
            setNotification(`Victory! Final Score: ${Math.floor(finalScore)}`);
          } else {
            setCurrentWave(nextWave);
            setWavePhase('waveIntro');
            setWaveText(`WAVE ${nextWave + 1}`);
            waveTimerRef.current = 0;
            spawnWave(nextWave);
            setPowerups([]);
          }
        }
        break;
    }
  });

  return (
    <>
      {/* Environment */}
      <Sky preset="sunset" />
      <Lighting />
      <fog attach="fog" args={['#1a1a2e', 40, 80]} />

      {/* Player */}
      <Player position={[0, 2, 0]} primaryColor="#22c55e" skinColor="#fbbf24" />
      <PlayerTracker />
      <ThirdPersonCamera offset={[0, 6, 12]} />

      {/* Arena */}
      <ArenaLayout />

      {/* Shield Visual */}
      <ShieldVisual active={playerEffects.shieldActive} />

      {/* Enemies */}
      {enemies.map((enemy) => (
        <BattleEnemy
          key={enemy.id}
          {...enemy}
          onDeath={handleEnemyDeath}
          onShoot={handleShoot}
        />
      ))}

      {/* Projectiles */}
      {projectiles.map((proj) => (
        <Projectile
          key={proj.id}
          data={proj}
          onHitPlayer={handleProjectileHit}
          onExpire={handleProjectileExpire}
        />
      ))}

      {/* Power-ups */}
      {powerups.map((pu) => (
        <BattlePowerUp key={pu.id} data={pu} onCollect={handlePowerupCollect} />
      ))}

      {/* Punch Hitbox */}
      <PunchHitbox active={punchActive} origin={punchOrigin} angle={punchAngle} />

      {/* HUD Text */}
      <WaveTextDisplay
        text={waveText}
        visible={wavePhase === 'waveIntro'}
      />
      <VictoryDisplay score={game.score} visible={showVictory} />
      <DefeatDisplay visible={showDefeat} />

      {/* Wave break text */}
      {wavePhase === 'waveBreak' && (
        <Text
          position={[0, 10, 0]}
          fontSize={1.5}
          color="#a3a3a3"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          Next wave incoming...
        </Text>
      )}

      {/* Control hints */}
      <Text
        position={[0, -0.5, 18]}
        fontSize={0.5}
        color="#737373"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {'WASD: Move | SPACE: Jump | E: Attack | Mouse: Look'}
      </Text>
    </>
  );
}