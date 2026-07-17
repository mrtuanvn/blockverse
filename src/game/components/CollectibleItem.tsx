'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import type { Mesh, Group } from 'three';
import { useGameStore } from '@/game/store';
import type { Collectible } from '@/game/types';

interface CollectibleItemProps extends Collectible {
  onCollect?: (item: Collectible) => void;
}

const ITEM_CONFIGS = {
  coin: {
    geometry: 'octahedron' as const,
    color: '#fbbf24',
    emissive: '#f59e0b',
    emissiveIntensity: 0.3,
    scale: 0.35,
  },
  gem: {
    geometry: 'icosahedron' as const,
    color: '#22d3ee',
    emissive: '#06b6d4',
    emissiveIntensity: 0.5,
    scale: 0.4,
  },
  heart: {
    geometry: 'box' as const,
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.3,
    scale: 0.35,
  },
  powerup: {
    geometry: 'dodecahedron' as const,
    color: '#a855f7',
    emissive: '#9333ea',
    emissiveIntensity: 0.4,
    scale: 0.4,
  },
};

export default function CollectibleItem({
  type,
  position,
  value,
  id,
  collected,
  onCollect,
}: CollectibleItemProps) {
  const meshRef = useRef<Group>(null);
  const [isCollected, setIsCollected] = useState(collected);
  const addScore = useGameStore((s) => s.addScore);
  const addCoins = useGameStore((s) => s.addCoins);
  const heal = useGameStore((s) => s.heal);
  const addCombo = useGameStore((s) => s.addCombo);
  const setNotification = useGameStore((s) => s.setNotification);

  useEffect(() => {
    setIsCollected(collected);
  }, [collected]);

  const config = ITEM_CONFIGS[type];

  useFrame((state) => {
    if (!meshRef.current || isCollected) return;
    const t = state.clock.getElapsedTime();

    switch (type) {
      case 'coin':
        meshRef.current.rotation.y = t * 3;
        meshRef.current.rotation.x = Math.sin(t * 2) * 0.3;
        meshRef.current.position.y = position[1] + Math.sin(t * 2) * 0.15;
        break;
      case 'gem':
        meshRef.current.rotation.y = t * 1.5;
        meshRef.current.rotation.z = t * 0.8;
        meshRef.current.position.y = position[1] + Math.sin(t * 1.5 + 1) * 0.2;
        break;
      case 'heart':
        meshRef.current.rotation.z = Math.sin(t * 2) * 0.3;
        meshRef.current.position.y = position[1] + Math.sin(t * 2.5) * 0.2 + 0.1;
        break;
      case 'powerup':
        meshRef.current.rotation.y = t * 2;
        meshRef.current.rotation.x = t * 1.2;
        const pulse = 1 + Math.sin(t * 4) * 0.15;
        meshRef.current.scale.setScalar(pulse * config.scale);
        meshRef.current.position.y = position[1] + Math.sin(t * 1.8) * 0.25;
        break;
    }
  });

  const handleCollision = (other: { rigidBodyObject?: { name?: string } | { name?: string } } | { other?: { rigidBodyObject?: { name?: string } } }) => {
    if (isCollected) return;

    let collidingName: string | undefined;

    if ('rigidBodyObject' in other) {
      const obj = other.rigidBodyObject as any;
      collidingName = obj?.name || obj?.userData?.name;
    }
    if ('other' in other) {
      const o = (other as any).other;
      collidingName = o?.rigidBodyObject?.name || o?.colliderObject?.name;
    }

    if (collidingName === 'player-body') {
      setIsCollected(true);

      switch (type) {
        case 'coin':
          addScore(value);
          addCoins(value);
          addCombo();
          setNotification(`+${value} coins!`);
          break;
        case 'gem':
          addScore(value * 5);
          addCombo();
          setNotification(`+${value * 5} points!`);
          break;
        case 'heart':
          heal(value);
          setNotification(`+${value} HP!`);
          break;
        case 'powerup':
          addScore(value * 10);
          heal(25);
          setNotification('Power Up! +Health & Score!');
          break;
      }

      onCollect?.({ id, type, position, value, collected: true });
    }
  };

  if (isCollected) return null;

  const geometryEl = (() => {
    switch (config.geometry) {
      case 'octahedron':
        return <octahedronGeometry args={[1, 0]} />;
      case 'icosahedron':
        return <icosahedronGeometry args={[1, 0]} />;
      case 'dodecahedron':
        return <dodecahedronGeometry args={[1, 0]} />;
      case 'box':
        return <boxGeometry args={[0.5, 0.5, 0.5]} />;
    }
  })();

  return (
    <RigidBody
      type="fixed"
      position={position}
      colliders={false}
      name={`collectible-${id}`}
      sensor
      onIntersectionEnter={handleCollision}
    >
      <CuboidCollider args={[0.4, 0.4, 0.4]} sensor />
      <group ref={meshRef} position={position} scale={config.scale}>
        <mesh castShadow>
          {geometryEl}
          <meshStandardMaterial
            color={config.color}
            emissive={config.emissive}
            emissiveIntensity={config.emissiveIntensity}
            roughness={0.3}
            metalness={0.2}
          />
        </mesh>
        {type === 'heart' && (
          <>
            <mesh position={[-0.15, 0, 0]} castShadow>
              <boxGeometry args={[0.3, 0.5, 0.3]} />
              <meshStandardMaterial
                color={config.color}
                emissive={config.emissive}
                emissiveIntensity={config.emissiveIntensity}
              />
            </mesh>
            <mesh position={[0.15, 0, 0]} castShadow>
              <boxGeometry args={[0.3, 0.5, 0.3]} />
              <meshStandardMaterial
                color={config.color}
                emissive={config.emissive}
                emissiveIntensity={config.emissiveIntensity}
              />
            </mesh>
          </>
        )}
      </group>
    </RigidBody>
  );
}