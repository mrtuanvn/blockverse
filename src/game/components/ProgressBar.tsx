'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import * as THREE from 'three';

interface ProgressBarProps {
  position: [number, number, number];
  progress: number;
  width?: number;
  color?: string;
  label?: string;
}

export default function ProgressBar({
  position,
  progress,
  width = 2,
  color = '#22c55e',
  label,
}: ProgressBarProps) {
  const fillRef = useRef<Group>(null);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const barHeight = 0.15;
  const barDepth = 0.05;

  useFrame(() => {
    if (fillRef.current) {
      const targetScaleX = clampedProgress;
      fillRef.current.scale.x += (targetScaleX - fillRef.current.scale.x) * 0.1;
    }
  });

  // Always face the camera (billboard)
  return (
    <group position={position}>
      {/* Background */}
      <mesh>
        <boxGeometry args={[width, barHeight, barDepth]} />
        <meshBasicMaterial color="#1a1a2e" />
      </mesh>

      {/* Fill */}
      <group ref={fillRef} position={[-(width - width * clampedProgress) / 2, 0, 0.001]}>
        <mesh>
          <boxGeometry args={[width, barHeight - 0.03, barDepth]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* Border */}
      <mesh>
        <boxGeometry args={[width + 0.04, barHeight + 0.04, barDepth - 0.01]} />
        <meshBasicMaterial color="#333333" wireframe />
      </mesh>

      {/* Optional Label */}
      {label && (
        <group position={[0, -0.25, 0]}>
          <sprite>
            <spriteMaterial color="white" transparent opacity={0.8} />
          </sprite>
        </group>
      )}
    </group>
  );
}