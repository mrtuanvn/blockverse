'use client';

import { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

interface GroundProps {
  size?: number;
  color?: string;
  receiveShadow?: boolean;
}

function createGridTexture(color: string, size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const resolution = 512;
  canvas.width = resolution;
  canvas.height = resolution;

  const ctx = canvas.getContext('2d')!;
  const gridCells = 16;
  const cellSize = resolution / gridCells;

  // Base color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, resolution, resolution);

  // Darker grid lines
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const darkerColor = `rgb(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.7)}, ${Math.floor(b * 0.7)})`;
  const lighterColor = `rgb(${Math.min(255, Math.floor(r * 1.1))}, ${Math.min(255, Math.floor(g * 1.1))}, ${Math.min(255, Math.floor(b * 1.1))})`;

  for (let i = 0; i <= gridCells; i++) {
    const pos = i * cellSize;
    ctx.strokeStyle = darkerColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, resolution);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(resolution, pos);
    ctx.stroke();
  }

  // Subtle checker pattern for some cells
  for (let x = 0; x < gridCells; x++) {
    for (let y = 0; y < gridCells; y++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = lighterColor;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        ctx.globalAlpha = 1;
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(size / 4, size / 4);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;

  return texture;
}

export default function Ground({
  size = 100,
  color = '#4ade80',
  receiveShadow = true,
}: GroundProps) {
  const texture = useMemo(() => createGridTexture(color, size), [color, size]);

  return (
    <RigidBody type="fixed" name="ground">
      <CuboidCollider args={[size / 2, 0.1, size / 2]} position={[0, -0.1, 0]} />
      <mesh
        receiveShadow={receiveShadow}
        position={[0, -0.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}