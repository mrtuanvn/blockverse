'use client';

import { useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import { useGameStore } from '@/game/store';
import ParticleEffect from './ParticleEffect';
import type { Enemy as EnemyType } from '@/game/types';

interface EnemyProps extends EnemyType {
  onDeath?: (id: string) => void;
}

export default function Enemy({
  id,
  type,
  position,
  health: initialHealth,
  maxHealth,
  speed,
  damage,
  color,
  size,
  patrolRange,
  onDeath,
}: EnemyProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const groupRef = useRef<Group>(null);
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const leftPupilRef = useRef<Mesh>(null);
  const rightPupilRef = useRef<Mesh>(null);

  const [currentHealth, setCurrentHealth] = useState(initialHealth);
  const [isDead, setIsDead] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  const takeDamage = useGameStore((s) => s.takeDamage);
  const addScore = useGameStore((s) => s.addScore);
  const setNotification = useGameStore((s) => s.setNotification);

  const originX = position[0];
  const originZ = position[2];
  const facingDir = useRef(1);

  const handleCollision = useCallback(
    (other: any) => {
      let collidingName: string | undefined;
      if (other?.rigidBodyObject) {
        collidingName = (other.rigidBodyObject as any).name;
      }
      if (other?.other?.rigidBodyObject) {
        collidingName = (other.other.rigidBodyObject as any).name;
      }

      if (collidingName === 'player-body') {
        takeDamage(damage);
      }
    },
    [damage, takeDamage]
  );

  const handlePlayerDamage = useCallback(() => {
    if (isDead) return;
    setCurrentHealth((h) => {
      const newHealth = h - 25;
      if (newHealth <= 0) {
        setIsDead(true);
        setShowParticles(true);
        addScore(type === 'boss' ? 500 : 100);
        setNotification(`Enemy defeated! +${type === 'boss' ? 500 : 100} pts`);
        setTimeout(() => {
          onDeath?.(id);
        }, 500);
        return 0;
      }
      return newHealth;
    });
  }, [isDead, id, type, addScore, setNotification, onDeath]);

  useFrame((state) => {
    if (isDead || !bodyRef.current || !groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const rb = bodyRef.current;

    // Patrol behavior: back and forth
    const patrolOffset = Math.sin(t * speed * 0.3) * patrolRange;

    // Get player position from the scene (approximate)
    const playerPos = rb.translation();
    let targetX = originX + patrolOffset;
    let targetZ = originZ;

    // Chase behavior: check if player is within range
    // We'll use a simple distance check based on the player's approximate position
    // In a real game, you'd pass the player ref
    const moveX = targetX - playerPos.x;
    const moveZ = targetZ - playerPos.z;
    const dist = Math.sqrt(moveX * moveX + moveZ * moveZ);

    if (dist > 0.1) {
      const nx = (moveX / dist) * speed;
      const nz = (moveZ / dist) * speed;
      rb.setLinvel({ x: nx, y: playerPos.y > -19 ? rb.linvel().y : 0, z: nz }, true);

      // Face movement direction
      facingDir.current = moveX > 0 ? 1 : -1;
      groupRef.current.rotation.y = facingDir.current > 0 ? 0 : Math.PI;
    }

    // Bobbing animation
    groupRef.current.position.y = Math.sin(t * 3) * 0.05;

    // Eye tracking (look at direction of movement)
    if (leftPupilRef.current && rightPupilRef.current) {
      const pupilOffset = 0.02;
      leftPupilRef.current.position.x = -0.06 + facingDir.current * pupilOffset;
      rightPupilRef.current.position.x = 0.06 + facingDir.current * pupilOffset;
    }

    // Health check via collision damage
    // (The actual damage comes from the player hitting this enemy)
  });

  const healthPercent = maxHealth > 0 ? currentHealth / maxHealth : 0;
  const barWidth = Math.max(0, healthPercent) * (size * 1.5);

  if (isDead && !showParticles) return null;

  return (
    <>
      {showParticles && (
        <ParticleEffect
          position={[position[0], position[1] + size, position[2]]}
          color={color}
          count={15}
          speed={4}
          size={0.15}
        />
      )}
      {!isDead && (
        <RigidBody
          ref={bodyRef}
          type="dynamic"
          position={position}
          enabledRotations={[false, false, false]}
          linearDamping={5}
          lockRotations
          colliders={false}
          name={`enemy-${id}`}
          onCollisionEnter={handleCollision}
        >
          <CuboidCollider
            args={[size / 2, size / 2, size / 2]}
            position={[0, size / 2, 0]}
          />
          <group ref={groupRef}>
            {/* Health Bar */}
            <group position={[0, size + 0.6, 0]}>
              <mesh>
                <boxGeometry args={[size * 1.5, 0.12, 0.05]} />
                <meshBasicMaterial color="#1a1a2e" />
              </mesh>
              <mesh position={[-((size * 1.5) - barWidth) / 2, 0, 0.001]}>
                <boxGeometry args={[barWidth, 0.1, 0.05]} />
                <meshBasicMaterial
                  color={healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444'}
                />
              </mesh>
            </group>

            {/* Body */}
            <mesh position={[0, size / 2, 0]} castShadow>
              <boxGeometry args={[size, size, size * 0.8]} />
              <meshStandardMaterial color={color} roughness={0.7} />
            </mesh>

            {/* Boss crown */}
            {type === 'boss' && (
              <group position={[0, size + 0.15, 0]}>
                <mesh>
                  <boxGeometry args={[size * 0.8, 0.2, size * 0.8]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
                </mesh>
                <mesh position={[-size * 0.3, 0.15, 0]}>
                  <boxGeometry args={[0.1, 0.2, 0.1]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
                </mesh>
                <mesh position={[size * 0.3, 0.15, 0]}>
                  <boxGeometry args={[0.1, 0.2, 0.1]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
                </mesh>
              </group>
            )}

            {/* Eyes */}
            <group position={[0, size * 0.65, size * 0.4 + 0.01]}>
              {/* Left eye white */}
              <mesh ref={leftEyeRef} position={[-0.12, 0, 0]}>
                <boxGeometry args={[0.14, 0.14, 0.02]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {/* Left pupil */}
              <mesh ref={leftPupilRef} position={[-0.06, 0, 0.015]}>
                <boxGeometry args={[0.06, 0.06, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
              {/* Right eye white */}
              <mesh ref={rightEyeRef} position={[0.12, 0, 0]}>
                <boxGeometry args={[0.14, 0.14, 0.02]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {/* Right pupil */}
              <mesh ref={rightPupilRef} position={[0.06, 0, 0.015]}>
                <boxGeometry args={[0.06, 0.06, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>

              {/* Angry eyebrows */}
              <mesh position={[-0.12, 0.12, 0]} rotation={[0, 0, 0.3]}>
                <boxGeometry args={[0.18, 0.04, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
              <mesh position={[0.12, 0.12, 0]} rotation={[0, 0, -0.3]}>
                <boxGeometry args={[0.18, 0.04, 0.02]} />
                <meshBasicMaterial color="#1a1a1a" />
              </mesh>
            </group>
          </group>
        </RigidBody>
      )}
    </>
  );
}