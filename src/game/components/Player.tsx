'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { Mesh, Group } from 'three';
import { useGameStore } from '@/game/store';

interface PlayerProps {
  position?: [number, number, number];
  primaryColor?: string;
  skinColor?: string;
}

export default function Player({
  position = [0, 2, 0],
  primaryColor = '#ef4444',
  skinColor = '#fbbf24',
}: PlayerProps) {
  const bodyRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const apiRef = useRef<any>(null);
  const isOnFloor = useRef(false);
  const keysPressed = useRef<Set<string>>(new Set());
  const velocity = useRef<[number, number, number]>([0, 0, 0]);

  const loseLife = useGameStore((s) => s.loseLife);
  const game = useGameStore((s) => s.game);
  const spawnPos = useRef<[number, number, number]>([...position]);

  const JUMP_FORCE = 8;
  const MOVE_SPEED = 6;
  const MAX_SPEED = 8;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'r' && game.isGameOver) {
        if (apiRef.current) {
          apiRef.current.setTranslation(
            { x: spawnPos.current[0], y: spawnPos.current[1] + 2, z: spawnPos.current[2] },
            true
          );
          apiRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [game.isGameOver]);

  useFrame((state, delta) => {
    if (!apiRef.current || !groupRef.current) return;

    const rbPos = apiRef.current.translation();
    const rbVel = apiRef.current.linvel();

    // Fall detection
    if (rbPos.y < -20) {
      loseLife();
      apiRef.current.setTranslation(
        { x: spawnPos.current[0], y: spawnPos.current[1] + 2, z: spawnPos.current[2] },
        true
      );
      apiRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    // Check if on floor
    isOnFloor.current = Math.abs(rbVel.y) < 0.5 && rbPos.y < spawnPos.current[1] + 1.5;

    const keys = keysPressed.current;
    let moveX = 0;
    let moveZ = 0;

    if (keys.has('w') || keys.has('arrowup')) moveZ -= 1;
    if (keys.has('s') || keys.has('arrowdown')) moveZ += 1;
    if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
    if (keys.has('d') || keys.has('arrowright')) moveX += 1;

    const isMoving = moveX !== 0 || moveZ !== 0;
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }

    // Get camera direction for movement relative to camera
    const camera = state.camera;
    const cameraAngle = Math.atan2(camera.position.x - rbPos.x, camera.position.z - rbPos.z);
    const cos = Math.cos(cameraAngle);
    const sin = Math.sin(cameraAngle);
    const worldMoveX = moveX * cos + moveZ * sin;
    const worldMoveZ = -moveX * sin + moveZ * cos;

    const targetVelX = worldMoveX * MOVE_SPEED;
    const targetVelZ = worldMoveZ * MOVE_SPEED;

    const clampedX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, targetVelX));
    const clampedZ = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, targetVelZ));

    apiRef.current.setLinvel(
      {
        x: clampedX,
        y: rbVel.y,
        z: clampedZ,
      },
      true
    );

    // Jump
    if ((keys.has(' ') || keys.has('space')) && isOnFloor.current) {
      apiRef.current.setLinvel({ x: rbVel.x, y: JUMP_FORCE, z: rbVel.z }, true);
    }

    // Rotate player to face movement direction
    if (isMoving) {
      const angle = Math.atan2(worldMoveX, worldMoveZ);
      const currentRotY = groupRef.current.rotation.y;
      let diff = angle - currentRotY;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      groupRef.current.rotation.y += diff * Math.min(1, delta * 10);
    }

    // Walking animation
    const time = state.clock.getElapsedTime();
    if (isMoving) {
      const swingSpeed = 8;
      const swingAmount = 0.6;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(time * swingSpeed) * swingAmount;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -Math.sin(time * swingSpeed) * swingAmount;
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = -Math.sin(time * swingSpeed) * swingAmount;
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = Math.sin(time * swingSpeed) * swingAmount;
      }
      // Bobbing
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.abs(Math.sin(time * swingSpeed * 2)) * 0.05;
      }
    } else {
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (bodyRef.current) bodyRef.current.position.y = 0;
    }
  });

  const healthPercent = game.health / game.maxHealth;
  const barColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
  const barWidth = Math.max(0, healthPercent) * 1.2;

  return (
    <RigidBody
      ref={apiRef}
      name="player-body"
      type="dynamic"
      position={position}
      enabledRotations={[false, false, false]}
      linearDamping={4}
      mass={1}
      lockRotations
      colliders={false}
      onCollisionEnter={() => {
        isOnFloor.current = true;
      }}
    >
      <CuboidCollider args={[0.3, 0.9, 0.3]} position={[0, 0.9, 0]} />
      <group ref={groupRef}>
        {/* Health bar */}
        <group position={[0, 2.3, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.2, 0.12, 0.05]} />
            <meshBasicMaterial color="#1a1a2e" />
          </mesh>
          <mesh position={[-(1.2 - barWidth) / 2, 0, 0.001]}>
            <boxGeometry args={[barWidth, 0.1, 0.05]} />
            <meshBasicMaterial color={barColor} />
          </mesh>
        </group>

        {/* Head */}
        <group position={[0, 1.65, 0]}>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color={skinColor} />
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
        <group ref={bodyRef} position={[0, 1.0, 0]}>
          <mesh>
            <boxGeometry args={[0.6, 0.8, 0.3]} />
            <meshStandardMaterial color={primaryColor} />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.425, 1.2, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color={skinColor} />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.425, 1.2, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color={skinColor} />
          </mesh>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.15, 0.4, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.15, 0.4, 0]}>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.25, 0.8, 0.25]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}