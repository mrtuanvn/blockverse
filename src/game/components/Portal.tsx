'use client';

import { useRef, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import { useGameStore, SCENE_CONFIGS } from '@/game/store';
import type { GameScene } from '@/game/types';

interface PortalProps {
  scene: GameScene;
  position: [number, number, number];
  label?: string;
  color?: string;
  icon?: string;
}

const PORTAL_PARTICLES_COUNT = 12;

export default function Portal({
  scene,
  position,
  label,
  color = '#a855f7',
  icon = '🌀',
}: PortalProps) {
  const ringRef = useRef<Group>(null);
  const innerRingRef = useRef<Group>(null);
  const particlesRef = useRef<Group>(null);
  const [isHovered, setIsHovered] = useState(false);

  const setScene = useGameStore((s) => s.setScene);
  const startTransition = useGameStore((s) => s.startTransition);
  const setNotification = useGameStore((s) => s.setNotification);
  const { camera } = useThree();

  const sceneConfig = SCENE_CONFIGS[scene];

  const handleActivate = useCallback(() => {
    startTransition();
    setNotification(`Traveling to ${sceneConfig.name}...`);
    setTimeout(() => {
      setScene(scene);
    }, 1200);
  }, [scene, sceneConfig.name, setScene, startTransition, setNotification]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.8;
      // Pulsing glow
      const glowScale = 1 + Math.sin(t * 2) * 0.05;
      ringRef.current.scale.setScalar(isHovered ? glowScale * 1.1 : glowScale);
    }

    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = -t * 1.2;
    }

    // Animate particles floating around portal
    if (particlesRef.current) {
      particlesRef.current.children.forEach((child, i) => {
        const angle = (i / PORTAL_PARTICLES_COUNT) * Math.PI * 2 + t * 0.5;
        const radius = 2.2 + Math.sin(t * 2 + i) * 0.3;
        const yOffset = Math.sin(t * 1.5 + i * 0.5) * 0.8;
        child.position.x = Math.cos(angle) * radius;
        child.position.y = yOffset;
        child.position.z = Math.sin(angle) * radius;
        child.rotation.x = t * 2 + i;
        child.rotation.y = t * 1.5 + i;
      });
    }

    // Proximity check
    const cameraPos = camera.position;
    const dx = cameraPos.x - position[0];
    const dz = cameraPos.z - position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3) {
      handleActivate();
    }
  });

  return (
    <group position={position}>
      {/* Portal Ring (outer) */}
      <group ref={ringRef}>
        <mesh castShadow>
          <torusGeometry args={[2, 0.2, 8, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isHovered ? 0.8 : 0.4}
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
      </group>

      {/* Portal Ring (inner) */}
      <group ref={innerRingRef}>
        <mesh>
          <torusGeometry args={[1.5, 0.12, 8, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            roughness={0.2}
            metalness={0.7}
            transparent
            opacity={0.7}
          />
        </mesh>
      </group>

      {/* Portal center glow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        onClick={handleActivate}
      >
        <circleGeometry args={[1.8, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating particles around portal */}
      <group ref={particlesRef}>
        {Array.from({ length: PORTAL_PARTICLES_COUNT }).map((_, i) => (
          <mesh key={i} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* Label */}
      <Text
        position={[0, 3.2, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        font={undefined}
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {label || sceneConfig.name}
      </Text>

      {/* Icon text */}
      <Text
        position={[0, 0, 0.05]}
        fontSize={0.8}
        anchorX="center"
        anchorY="middle"
        font={undefined}
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {icon}
      </Text>

      {/* Ground indicator ring */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.8, 3, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}