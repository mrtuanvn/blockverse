'use client';

import { Sky } from '@react-three/drei';

interface SkyProps {
  preset?: 'sunset' | 'dawn' | 'night' | 'day';
}

export default function GameSky({ preset = 'sunset' }: SkyProps) {
  const presets: Record<string, { sunPosition: [number, number, number]; turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number }> = {
    sunset: {
      sunPosition: [100, 20, 100],
      turbidity: 8,
      rayleigh: 2,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
    },
    dawn: {
      sunPosition: [-100, 10, 100],
      turbidity: 10,
      rayleigh: 3,
      mieCoefficient: 0.01,
      mieDirectionalG: 0.9,
    },
    day: {
      sunPosition: [100, 200, 100],
      turbidity: 3,
      rayleigh: 0.5,
      mieCoefficient: 0.001,
      mieDirectionalG: 0.7,
    },
    night: {
      sunPosition: [0, -50, 0],
      turbidity: 1,
      rayleigh: 0.1,
      mieCoefficient: 0.0,
      mieDirectionalG: 0.0,
    },
  };

  const config = presets[preset] || presets.sunset;

  return (
    <Sky
      sunPosition={config.sunPosition}
      turbidity={config.turbidity}
      rayleigh={config.rayleigh}
      mieCoefficient={config.mieCoefficient}
      mieDirectionalG={config.mieDirectionalG}
      distance={450000}
    />
  );
}