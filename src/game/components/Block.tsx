'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { Mesh } from 'three';
import type { Block as BlockType } from '@/game/types';

interface BlockProps extends BlockType {
  onClick?: (id: string) => void;
  onHover?: (id: string | null) => void;
}

const BLOCK_MATERIALS: Record<
  BlockType['type'],
  { color: string; roughness: number; metalness: number; opacity: number; transparent?: boolean }
> = {
  normal: {
    color: '#ef4444',
    roughness: 0.6,
    metalness: 0.1,
    opacity: 1,
  },
  wood: {
    color: '#92400e',
    roughness: 0.9,
    metalness: 0.0,
    opacity: 1,
  },
  stone: {
    color: '#78716c',
    roughness: 1.0,
    metalness: 0.0,
    opacity: 1,
  },
  metal: {
    color: '#9ca3af',
    roughness: 0.3,
    metalness: 0.8,
    opacity: 1,
  },
  glass: {
    color: '#67e8f9',
    roughness: 0.1,
    metalness: 0.1,
    opacity: 0.5,
    transparent: true,
  },
};

export default function Block({
  id,
  position,
  size = [1, 1, 1] as [number, number, number],
  color,
  type = 'normal',
  onClick,
  onHover,
}: BlockProps) {
  const meshRef = useRef<Mesh>(null);
  const wireframeRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const materialConfig = BLOCK_MATERIALS[type];
  const blockColor = color || materialConfig.color;

  useFrame(() => {
    if (wireframeRef.current) {
      const targetScale = hovered ? 1.05 : 1.02;
      const currentScale = wireframeRef.current.scale.x;
      wireframeRef.current.scale.setScalar(
        currentScale + (targetScale - currentScale) * 0.15
      );
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    onClick?.(id);
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
    onHover?.(id);
  };

  const handlePointerOut = () => {
    setHovered(false);
    onHover?.(null);
  };

  return (
    <RigidBody type="fixed" position={position} name={`block-${id}`}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={blockColor}
          roughness={materialConfig.roughness}
          metalness={materialConfig.metalness}
          transparent={materialConfig.transparent || false}
          opacity={materialConfig.opacity}
        />
      </mesh>

      {/* Hover outline (wireframe) */}
      {hovered && (
        <mesh ref={wireframeRef} scale={[1.02, 1.02, 1.02]}>
          <boxGeometry args={size} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.5} />
        </mesh>
      )}

      {/* Stone roughness visual - small bumps */}
      {type === 'stone' && (
        <>
          <mesh position={[-size[0] * 0.3, size[1] * 0.3, size[2] / 2 + 0.001]}>
            <boxGeometry args={[size[0] * 0.3, size[1] * 0.2, 0.001]} />
            <meshStandardMaterial
              color="#6b7280"
              roughness={1}
              transparent
              opacity={0.4}
            />
          </mesh>
          <mesh position={[size[0] * 0.2, -size[1] * 0.2, size[2] / 2 + 0.001]}>
            <boxGeometry args={[size[0] * 0.25, size[1] * 0.15, 0.001]} />
            <meshStandardMaterial
              color="#6b7280"
              roughness={1}
              transparent
              opacity={0.3}
            />
          </mesh>
        </>
      )}
    </RigidBody>
  );
}