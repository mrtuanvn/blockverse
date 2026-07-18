'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { Mesh, Group } from 'three';
import { useGameStore } from '@/game/store';
import { getInputState, initKeyboardInput, isMobileDevice, playerWorldMove } from '@/game/hooks/useInputState';

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
  const lastJump = useRef(false);
  const keysPressed = useRef<Set<string>>(new Set());

  // Coyote time: allows jumping briefly after leaving a ledge
  const lastGroundedTime = useRef(0);
  const COYOTE_TIME = 0.15; // 150ms grace period

  // Jump buffer: if you press jump slightly before landing, it still works
  const lastJumpPressTime = useRef(0);
  const JUMP_BUFFER = 0.12; // 120ms buffer

  const loseLife = useGameStore((s) => s.loseLife);
  const game = useGameStore((s) => s.game);
  const spawnPos = useRef<[number, number, number]>([...position]);

  // Mobile gets slightly easier physics
  const mobileMode = useRef(false);

  const JUMP_FORCE = 9;     // Higher jump
  const MOVE_SPEED = 7;     // Slightly faster
  const MAX_SPEED = 9;
  const ACCELERATION = 12;  // Smooth acceleration (was instant before)
  const DECELERATION = 10;  // Smooth deceleration

  useEffect(() => {
    mobileMode.current = isMobileDevice();
    const cleanup = initKeyboardInput();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && game.isGameOver && apiRef.current) {
        apiRef.current.setTranslation(
          { x: spawnPos.current[0], y: spawnPos.current[1] + 2, z: spawnPos.current[2] },
          true
        );
        apiRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cleanup();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [game.isGameOver]);

  useFrame((state, delta) => {
    if (!apiRef.current || !groupRef.current) return;

    const rbPos = apiRef.current.translation();
    const rbVel = apiRef.current.linvel();
    const time = state.clock.getElapsedTime();

    // Fall detection — more forgiving on mobile
    const fallThreshold = mobileMode.current ? -30 : -20;
    if (rbPos.y < fallThreshold) {
      loseLife();
      apiRef.current.setTranslation(
        { x: spawnPos.current[0], y: spawnPos.current[1] + 2, z: spawnPos.current[2] },
        true
      );
      apiRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    // ─── Floor detection (collision-based + velocity) ───
    // onCollisionEnter sets isOnFloor=true. We keep it true while
    // vertical velocity is low. NO height check — works at any altitude.
    const wasOnFloor = isOnFloor.current;
    const velCheck = Math.abs(rbVel.y) < 1.5;
    const newFloorState = (isOnFloor.current && velCheck) || (wasOnFloor && velCheck);

    if (newFloorState && !wasOnFloor) {
      lastGroundedTime.current = time;
    }
    isOnFloor.current = newFloorState;

    if (isOnFloor.current) {
      lastGroundedTime.current = time;
    }

    // ─── Read input ───
    const input = getInputState();
    let moveX = input.moveX;
    let moveZ = input.moveZ;

    const isMoving = moveX !== 0 || moveZ !== 0;
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    // ─── Camera-relative movement ───
    const camera = state.camera;
    const cameraAngle = Math.atan2(camera.position.x - rbPos.x, camera.position.z - rbPos.z);
    const cos = Math.cos(cameraAngle);
    const sin = Math.sin(cameraAngle);
    const worldMoveX = moveX * cos + moveZ * sin;
    const worldMoveZ = -moveX * sin + moveZ * cos;

    // Export for auto-camera-follow
    playerWorldMove.x = worldMoveX;
    playerWorldMove.z = worldMoveZ;
    playerWorldMove.isMoving = isMoving;

    // ─── Smooth acceleration / deceleration ───
    const targetVelX = worldMoveX * MOVE_SPEED;
    const targetVelZ = worldMoveZ * MOVE_SPEED;

    const accel = isMoving ? ACCELERATION : DECELERATION;
    const lerpT = Math.min(1, accel * delta);

    const currentVelX = rbVel.x;
    const currentVelZ = rbVel.z;
    const newVelX = currentVelX + (targetVelX - currentVelX) * lerpT;
    const newVelZ = currentVelZ + (targetVelZ - currentVelZ) * lerpT;

    const clampedX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, newVelX));
    const clampedZ = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, newVelZ));

    // ─── JUMP with coyote time + buffer ───
    const currentJump = input.jump;
    const timeSinceGrounded = time - lastGroundedTime.current;
    const canCoyoteJump = timeSinceGrounded < COYOTE_TIME;

    // Track when jump was first pressed (rising edge)
    if (currentJump && !lastJump.current) {
      lastJumpPressTime.current = time;
    }

    // Execute jump if: recently pressed (buffer) AND on ground (or coyote)
    const timeSinceJumpPress = time - lastJumpPressTime.current;
    const jumpBuffered = timeSinceJumpPress < JUMP_BUFFER && lastJumpPressTime.current > 0;

    if (jumpBuffered && (isOnFloor.current || canCoyoteJump)) {
      apiRef.current.setLinvel({ x: clampedX, y: JUMP_FORCE, z: clampedZ }, true);
      lastJumpPressTime.current = 0;
      vibrateJump();
    }
    lastJump.current = currentJump;

    // Apply movement
    apiRef.current.setLinvel(
      {
        x: clampedX,
        y: rbVel.y,
        z: clampedZ,
      },
      true
    );

    // ─── Rotate player to face movement direction ───
    if (isMoving) {
      const angle = Math.atan2(worldMoveX, worldMoveZ);
      const currentRotY = groupRef.current.rotation.y;
      let diff = angle - currentRotY;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      groupRef.current.rotation.y += diff * Math.min(1, delta * 12);
    }

    // ─── Walking animation ───
    if (isMoving) {
      const swingSpeed = 8;
      const swingAmount = 0.6;
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time * swingSpeed) * swingAmount;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(time * swingSpeed) * swingAmount;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -Math.sin(time * swingSpeed) * swingAmount;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time * swingSpeed) * swingAmount;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(time * swingSpeed * 2)) * 0.05;
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
      linearDamping={3}    // Slightly less damping = more slidey/forgiving
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
          <mesh position={[-0.1, 0.05, 0.26]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0.1, 0.05, 0.26]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
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

function vibrateJump() {
  try { navigator.vibrate?.(20); } catch {}
}