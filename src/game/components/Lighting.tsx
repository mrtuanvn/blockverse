'use client';

export default function Lighting() {
  return (
    <>
      <ambientLight intensity={0.6} color="#fff5e6" />
      <directionalLight
        position={[30, 50, 30]}
        intensity={1.0}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.0005}
      />
      <hemisphereLight
        color="#87ceeb"
        groundColor="#8b6914"
        intensity={0.4}
      />
    </>
  );
}