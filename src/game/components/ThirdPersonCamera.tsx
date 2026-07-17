'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import * as THREE from 'three';
import { consumeCameraDelta, consumePointerLockRequest, isMobileDevice } from '@/game/hooks/useInputState';

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

  const effectiveRef = targetRef || internalRef;

  // Detect mobile once
  useEffect(() => {
    isMobile.current = isMobileDevice();
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
  }, [camera]);

  useEffect(() => {
    cameraOffsetState.offset = offset;
  }, [offset]);

  useEffect(() => {
    const canvas = gl.domElement;

    // Only add pointer lock listeners on desktop
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

    // ─── Consume touch camera delta (from MobileControls joystick area) ───
    const touchDelta = consumeCameraDelta();
    if (touchDelta.dx !== 0 || touchDelta.dy !== 0) {
      rotationY.current -= touchDelta.dx;
      rotationX.current = Math.max(
        -Math.PI / 3,
        Math.min(Math.PI / 3, rotationX.current + touchDelta.dy)
      );
      cameraOffsetState.rotationY = rotationY.current;
      cameraOffsetState.rotationX = rotationX.current;
    }

    // Calculate camera position based on spherical coordinates
    const distance = offset[2];
    const height = offset[1];

    const sphericalY = rotationY.current;
    const sphericalX = rotationX.current;

    const camX = targetPosition.current.x + Math.sin(sphericalY) * Math.cos(sphericalX) * distance;
    const camY = targetPosition.current.y + height - Math.sin(sphericalX) * distance * 0.5;
    const camZ = targetPosition.current.z + Math.cos(sphericalY) * Math.cos(sphericalX) * distance;

    const targetCamPos = new THREE.Vector3(camX, camY, camZ);

    // Smooth lerp
    const lerpFactor = 1 - Math.pow(0.01, delta);
    camera.position.lerp(targetCamPos, lerpFactor);

    // Look at player
    const lookTarget = new THREE.Vector3(
      targetPosition.current.x,
      targetPosition.current.y - 0.5,
      targetPosition.current.z
    );
    camera.lookAt(lookTarget);
  });

  // Invisible target marker if no external ref provided
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