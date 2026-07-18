'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import * as THREE from 'three';
import { consumeCameraDelta, isMobileDevice, playerWorldMove } from '@/game/hooks/useInputState';

interface ThirdPersonCameraProps {
  targetRef?: React.RefObject<Group | null>;
  offset?: [number, number, number];
}

export const cameraOffsetState = {
  offset: [0, 5, 10] as [number, number, number],
  rotationY: 0,
  rotationX: 0,
};

export default function ThirdPersonCamera({
  targetRef,
  offset = [0, 5, 10],
}: ThirdPersonCameraProps) {
  const { camera, gl } = useThree();
  const isLocked = useRef(false);
  const rotationY = useRef(0);
  const rotationX = useRef(0);
  const targetPosition = useRef(new THREE.Vector3(0, 2, 0));
  const internalRef = useRef<Group>(null);
  const isMobile = useRef(false);

  // For auto-follow: track last manual camera input time
  const lastManualInput = useRef(0);

  const effectiveRef = targetRef || internalRef;

  useEffect(() => {
    isMobile.current = isMobileDevice();
  }, []);

  // Mobile: start looking slightly down
  useEffect(() => {
    if (isMobile.current) {
      rotationX.current = 0.35;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!isLocked.current && !isMobile.current) {
      gl.domElement.requestPointerLock();
    }
  }, [gl]);

  const handlePointerLockChange = useCallback(() => {
    isLocked.current = document.pointerLockElement === gl.domElement;
  }, [gl]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isLocked.current) return;
    rotationY.current -= e.movementX * 0.002;
    rotationX.current = Math.max(
      -Math.PI / 3,
      Math.min(Math.PI / 3, rotationX.current + e.movementY * 0.002)
    );
    cameraOffsetState.rotationY = rotationY.current;
    cameraOffsetState.rotationX = rotationX.current;
    lastManualInput.current = performance.now();
  }, [camera]);

  useEffect(() => {
    cameraOffsetState.offset = offset;
  }, [offset]);

  useEffect(() => {
    const canvas = gl.domElement;
    if (!isMobile.current) {
      canvas.addEventListener('click', handleClick);
      document.addEventListener('pointerlockchange', handlePointerLockChange);
      document.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      if (!isMobile.current) {
        canvas.removeEventListener('click', handleClick);
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
        document.removeEventListener('mousemove', handleMouseMove);
        if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock();
        }
      }
    };
  }, [gl, handleClick, handlePointerLockChange, handleMouseMove]);

  useFrame((_, delta) => {
    const target = effectiveRef.current;
    if (target) {
      targetPosition.current.copy(target.position);
      targetPosition.current.y += 2;
    }

    const now = performance.now();
    const mobile = isMobile.current;

    // ─── Consume touch camera delta (manual swipe) ───
    const touchDelta = consumeCameraDelta();
    if (touchDelta.dx !== 0 || touchDelta.dy !== 0) {
      rotationY.current -= touchDelta.dx;
      rotationX.current = Math.max(
        -Math.PI / 3,
        Math.min(Math.PI / 3, rotationX.current + touchDelta.dy)
      );
      cameraOffsetState.rotationY = rotationY.current;
      cameraOffsetState.rotationX = rotationX.current;
      lastManualInput.current = now;
    }

    // ─── AUTO-FOLLOW: rotate camera behind player when moving ───
    // Only on mobile, and only if no manual input in the last 1.5 seconds
    if (mobile && playerWorldMove.isMoving && now - lastManualInput.current > 1500) {
      // Player's world movement direction
      const moveAngle = Math.atan2(playerWorldMove.x, playerWorldMove.z);
      // Camera should be behind the player = opposite of movement
      const desiredCamAngle = moveAngle + Math.PI;

      // Find shortest rotation difference
      let diff = desiredCamAngle - rotationY.current;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      // Smoothly rotate camera (slow rotation, not instant)
      const autoRotateSpeed = 1.8; // radians/sec — gentle
      const maxStep = autoRotateSpeed * delta;
      const step = Math.abs(diff) < maxStep ? diff : Math.sign(diff) * maxStep;
      rotationY.current += step;

      cameraOffsetState.rotationY = rotationY.current;
    }

    // ─── Camera distance ───
    const distance = mobile ? offset[2] * 0.7 : offset[2];
    const height = mobile ? offset[1] * 0.8 : offset[1];

    const sphericalY = rotationY.current;
    const sphericalX = rotationX.current;

    const camX = targetPosition.current.x + Math.sin(sphericalY) * Math.cos(sphericalX) * distance;
    const camY = targetPosition.current.y + height - Math.sin(sphericalX) * distance * 0.5;
    const camZ = targetPosition.current.z + Math.cos(sphericalY) * Math.cos(sphericalX) * distance;

    const targetCamPos = new THREE.Vector3(camX, camY, camZ);

    // Smooth follow — fast on mobile
    const smoothness = mobile ? 0.02 : 0.01;
    const lerpFactor = 1 - Math.pow(smoothness, delta);
    camera.position.lerp(targetCamPos, lerpFactor);

    // Look at player
    const lookY = mobile
      ? targetPosition.current.y - 0.2
      : targetPosition.current.y - 0.5;
    camera.lookAt(
      targetPosition.current.x,
      lookY,
      targetPosition.current.z
    );
  });

  if (!targetRef) {
    return (
      <group ref={internalRef} position={[0, 2, 0]}>
        <mesh visible={false}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
        </mesh>
      </group>
    );
  }

  return null;
}