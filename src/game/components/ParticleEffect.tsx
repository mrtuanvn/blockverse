'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Group } from 'three';
import * as THREE from 'three';

interface Particle {
  id: number;
  mesh: Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ParticleEffectProps {
  position: [number, number, number];
  color?: string;
  count?: number;
  speed?: number;
  size?: number;
}

export default function ParticleEffect({
  position,
  color = '#fbbf24',
  count = 10,
  speed = 3,
  size = 0.1,
}: ParticleEffectProps) {
  const groupRef = useRef<Group>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleMeshesRef = useRef<Mesh[]>([]);

  const initialParticles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const vx = Math.sin(phi) * Math.cos(theta) * speed * (0.5 + Math.random());
      const vy = Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * (0.5 + Math.random()) + 2;
      const vz = Math.cos(phi) * speed * (0.5 + Math.random()) * (Math.random() > 0.5 ? 1 : -1);

      return {
        id: i,
        velocity: new THREE.Vector3(vx, vy, vz),
        life: 0,
        maxLife: 0.5 + Math.random() * 1,
      };
    });
  }, [count, speed]);

  useEffect(() => {
    setParticles(initialParticles);
  }, [initialParticles]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    let allDead = true;

    groupRef.current.children.forEach((child, i) => {
      const particle = particles[i];
      if (!particle) return;

      particle.life += delta;

      if (particle.life >= particle.maxLife) {
        child.visible = false;
        return;
      }

      allDead = false;

      // Apply gravity
      particle.velocity.y -= 9.8 * delta;

      // Move particle
      child.position.x += particle.velocity.x * delta;
      child.position.y += particle.velocity.y * delta;
      child.position.z += particle.velocity.z * delta;

      // Fade out
      const lifeRatio = 1 - particle.life / particle.maxLife;
      const mat = (child as Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = lifeRatio;

      // Shrink
      const scale = lifeRatio * size * 10;
      child.scale.setScalar(Math.max(0.01, scale));
    });

    // Auto-remove when all particles die
    if (allDead && particles.length > 0) {
      if (groupRef.current.parent) {
        groupRef.current.parent.remove(groupRef.current);
      }
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {particles.map((particle) => (
        <mesh key={particle.id} castShadow>
          <boxGeometry args={[size, size, size]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={1}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}