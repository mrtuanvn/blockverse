'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Grid, OrbitControls, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/game/store';
import type { Block } from '@/game/types';

// ============================================================
// Constants
// ============================================================

const BLOCK_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'White', hex: '#f8fafc' },
  { name: 'Black', hex: '#1e293b' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Cyan', hex: '#06b6d4' },
];

const BLOCK_TYPES = [
  { name: 'Normal', value: 'normal' as const },
  { name: 'Wood', value: 'wood' as const },
  { name: 'Stone', value: 'stone' as const },
  { name: 'Metal', value: 'metal' as const },
  { name: 'Glass', value: 'glass' as const },
] as const;

const GRID_SIZE = 50;
const HALF_GRID = GRID_SIZE / 2;

// ============================================================
// Procedural Wood Texture (canvas-based, shared singleton)
// ============================================================

let _woodTex: THREE.CanvasTexture | null = null;
function getWoodTexture(): THREE.CanvasTexture {
  if (_woodTex) return _woodTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#92400e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  for (let y = 0; y < 128; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 128; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.07 + y * 0.02) * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1;
  for (let y = 5; y < 128; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  _woodTex = new THREE.CanvasTexture(c);
  _woodTex.wrapS = _woodTex.wrapT = THREE.RepeatWrapping;
  return _woodTex;
}

// ============================================================
// Block Material – renders the right visual per block type
// ============================================================

function BlockMaterial({ block }: { block: Block }) {
  const woodTex = useMemo(() => getWoodTexture(), []);
  switch (block.type) {
    case 'wood':
      return <meshStandardMaterial map={woodTex} roughness={0.85} />;
    case 'stone':
      return <meshStandardMaterial color="#6b7280" roughness={1} />;
    case 'metal':
      return <meshStandardMaterial color="#d1d5db" metalness={0.85} roughness={0.15} />;
    case 'glass':
      return <meshStandardMaterial color="#e0f2fe" transparent opacity={0.35} roughness={0.05} />;
    default:
      return <meshStandardMaterial color={block.color} />;
  }
}

// ============================================================
// PlacedBlock – single placed block with physics + outlines
// ============================================================

function PlacedBlock({ block, onPlaceClick }: { block: Block; onPlaceClick: (e: ThreeEvent<MouseEvent>) => void }) {
  return (
    <RigidBody type="fixed" position={block.position} colliders={false}>
      <CuboidCollider args={[0.5, 0.5, 0.5]} />
      <mesh castShadow receiveShadow userData={{ blockId: block.id }} onClick={onPlaceClick}>
        <boxGeometry args={[1, 1, 1]} />
        <BlockMaterial block={block} />
        <Edges threshold={15} color="#000000" />
      </mesh>
    </RigidBody>
  );
}

// ============================================================
// House Template Generator
// ============================================================

function createHouseTemplate(): Block[] {
  const blocks: Block[] = [];
  const add = (x: number, y: number, z: number, color: string, type: Block['type']) => {
    blocks.push({
      id: crypto.randomUUID(),
      position: [x, y, z] as [number, number, number],
      size: [1, 1, 1],
      color,
      type,
      placed: true,
    });
  };

  // Floor (5x5 wood)
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++)
      add(x, 0.5, z, '#92400e', 'wood');

  // Walls (3 layers, stone, with door opening)
  for (let layer = 0; layer < 3; layer++) {
    const y = layer + 1.5;
    for (let x = -2; x <= 2; x++) {
      if (x === 0 && layer < 2) continue; // door
      add(x, y, -2, '#6b7280', 'stone'); // front
      add(x, y, 2, '#6b7280', 'stone');  // back
    }
    for (let z = -1; z <= 1; z++) {
      add(-2, y, z, '#6b7280', 'stone'); // left
      add(2, y, z, '#6b7280', 'stone');  // right
    }
  }

  // Roof (5x5 wood)
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++)
      add(x, 4.5, z, '#92400e', 'wood');

  // Glass windows on side walls
  add(-2, 2.5, 0, '#ffffff', 'glass');
  add(2, 2.5, 0, '#ffffff', 'glass');

  // Metal door frame accent
  add(-1, 0.5, -2, '#9ca3af', 'metal');
  add(1, 0.5, -2, '#9ca3af', 'metal');
  add(0, 2.5, -2, '#9ca3af', 'metal');

  return blocks;
}

// ============================================================
// BuilderScene – main exported component
// ============================================================

export default function BuilderScene() {
  const { raycaster, camera, pointer, gl } = useThree();

  // -- Store bindings --
  const blocks = useGameStore((s) => s.builderBlocks);
  const addBlock = useGameStore((s) => s.addBlock);
  const removeBlock = useGameStore((s) => s.removeBlock);
  const clearBlocks = useGameStore((s) => s.clearBlocks);
  const color = useGameStore((s) => s.selectedBlockColor);
  const blockType = useGameStore((s) => s.selectedBlockType);
  const setColor = useGameStore((s) => s.setSelectedBlockColor);
  const setType = useGameStore((s) => s.setSelectedBlockType);
  const addScore = useGameStore((s) => s.addScore);
  const score = useGameStore((s) => s.game.score);

  // -- Refs for Three.js objects --
  const groundRef = useRef<THREE.Mesh>(null);
  const blocksGroupRef = useRef<THREE.Group>(null);
  const ghostRef = useRef<THREE.Mesh>(null);
  const ghostMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // -- Mutable state refs (stable across renders, no re-renders) --
  const ghostPos = useRef(new THREE.Vector3(0, -100, 0));
  const ghostValid = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const wasDragging = useRef(false);

  // Mirror store values into refs for use inside non-React callbacks
  const colorRef = useRef(color);
  const typeRef = useRef(blockType);
  const blocksRef = useRef(blocks);
  const removeRef = useRef(removeBlock);
  useEffect(() => { colorRef.current = color; });
  useEffect(() => { typeRef.current = blockType; });
  useEffect(() => { blocksRef.current = blocks; });
  useEffect(() => { removeRef.current = removeBlock; });

  // -- UI notification --
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, ms = 2500) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // ================================================================
  // Per-frame: move ghost block via raycasting
  // ================================================================
  useFrame(() => {
    if (!ghostRef.current || !ghostMatRef.current) return;
    raycaster.setFromCamera(pointer, camera);

    // Gather all raycast targets
    const targets: THREE.Object3D[] = [];
    if (groundRef.current) targets.push(groundRef.current);
    if (blocksGroupRef.current) {
      blocksGroupRef.current.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh && m.userData?.blockId) targets.push(m);
      });
    }
    if (targets.length === 0) { ghostRef.current.visible = false; return; }

    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length === 0) { ghostRef.current.visible = false; return; }

    const hit = hits[0];
    let px: number, py: number, pz: number;

    if (hit.object.userData?.isGround) {
      px = Math.round(hit.point.x);
      py = 0.5;
      pz = Math.round(hit.point.z);
    } else {
      const bid: string | undefined = hit.object.userData?.blockId;
      const src = blocksRef.current.find((b) => b.id === bid);
      if (!src) { ghostRef.current.visible = false; return; }

      const n = hit.face?.normal?.clone();
      if (n) n.transformDirection(hit.object.matrixWorld);

      const nx = n?.x ?? 0, ny = n?.y ?? 0, nz = n?.z ?? 0;
      if (Math.abs(ny) > 0.5) {
        px = src.position[0]; py = src.position[1] + Math.sign(ny); pz = src.position[2];
      } else if (Math.abs(nx) > 0.5) {
        px = src.position[0] + Math.sign(nx); py = src.position[1]; pz = src.position[2];
      } else {
        px = src.position[0]; py = src.position[1]; pz = src.position[2] + Math.sign(nz);
      }
    }

    // Clamp to grid area
    px = Math.max(-HALF_GRID, Math.min(HALF_GRID - 1, px));
    pz = Math.max(-HALF_GRID, Math.min(HALF_GRID - 1, pz));
    py = Math.max(0.5, py);

    const occupied = blocksRef.current.some(
      (b) => b.position[0] === px && b.position[1] === py && b.position[2] === pz,
    );
    ghostPos.current.set(px, py, pz);
    ghostValid.current = !occupied;

    ghostRef.current.position.set(px, py, pz);
    ghostRef.current.visible = true;
    ghostMatRef.current.color.set(occupied ? '#ef4444' : '#22c55e');
  });

  // ================================================================
  // Left-click: place block at ghost position
  // ================================================================
  const handlePlace = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (!ghostValid.current || !ghostRef.current?.visible) return;
      const p = ghostPos.current;
      addBlock({
        id: crypto.randomUUID(),
        position: [p.x, p.y, p.z],
        size: [1, 1, 1],
        color: colorRef.current,
        type: typeRef.current as Block['type'],
        placed: true,
      });
      addScore(10);
    },
    [addBlock, addScore],
  );

  // ================================================================
  // Right-click: remove block (with drag-ignore)
  // ================================================================
  useEffect(() => {
    const canvas = gl.domElement;

    const onDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) {
        dragStart.current = { x: e.clientX, y: e.clientY };
        wasDragging.current = false;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (dragStart.current) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        if (dx * dx + dy * dy > 25) wasDragging.current = true;
      }
    };
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      if (wasDragging.current) { dragStart.current = null; return; }
      dragStart.current = null;

      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);

      const targets: THREE.Object3D[] = [];
      if (blocksGroupRef.current) {
        blocksGroupRef.current.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh && m.userData?.blockId) targets.push(m);
        });
      }
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const bid: string | undefined = hits[0].object.userData?.blockId;
        if (bid) removeRef.current(bid);
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    canvas.addEventListener('contextmenu', onCtx);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('contextmenu', onCtx);
    };
  }, [gl, raycaster, camera]);

  // ================================================================
  // Toolbar actions: Save / Load / Clear / Template
  // ================================================================
  const handleSave = useCallback(() => {
    try {
      localStorage.setItem('blockverse_builder', JSON.stringify(blocks));
      showToast('💾 Build Saved!');
    } catch { showToast('❌ Save failed'); }
  }, [blocks, showToast]);

  const handleLoad = useCallback(() => {
    try {
      const raw = localStorage.getItem('blockverse_builder');
      if (!raw) { showToast('❌ No saved build found'); return; }
      const data = JSON.parse(raw) as Block[];
      clearBlocks();
      data.forEach((b) => addBlock(b));
      showToast(`📂 Loaded ${data.length} blocks`);
    } catch { showToast('❌ Load failed'); }
  }, [addBlock, clearBlocks, showToast]);

  const handleClear = useCallback(() => {
    clearBlocks();
    showToast('🗑️ All blocks cleared');
  }, [clearBlocks, showToast]);

  const handleTemplate = useCallback(() => {
    const tmpl = createHouseTemplate();
    clearBlocks();
    tmpl.forEach((b) => addBlock(b));
    addScore(tmpl.length * 10);
    showToast(`🏠 House loaded (${tmpl.length} blocks)`);
  }, [addBlock, addScore, clearBlocks, showToast]);

  // Cleanup toast timer
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ================================================================
  // Render
  // ================================================================
  return (
    <>
      {/* ---- Sky + Lighting ---- */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[15, 25, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <hemisphereLight args={['#87ceeb', '#4ade80', 0.35]} />
      <fog attach="fog" args={['#c8e6c9', 40, 80]} />

      {/* ---- Green Ground Plane (50x50) ---- */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color="#4ade80" roughness={0.9} />
      </mesh>

      {/* ---- Invisible raycast ground (click target) ---- */}
      <mesh
        ref={groundRef}
        position={[0, 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        userData={{ isGround: true }}
        onClick={handlePlace}
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>

      {/* ---- Grid Overlay ---- */}
      <Grid
        infiniteGrid
        cellSize={1}
        sectionSize={5}
        color="#6b7280"
        sectionColor="#9ca3af"
        fadeDistance={35}
        cellThickness={0.5}
        sectionThickness={1}
        fadeStrength={1.5}
        position={[0, 0.01, 0]}
      />

      {/* ---- Ghost Block (preview) ---- */}
      <mesh ref={ghostRef} position={[0, -100, 0]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={ghostMatRef}
          color="#22c55e"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
        <Edges threshold={15} color="#000000" />
      </mesh>

      {/* ---- Placed Blocks ---- */}
      <group ref={blocksGroupRef}>
        {blocks.map((b) => (
          <PlacedBlock key={b.id} block={b} onPlaceClick={handlePlace} />
        ))}
      </group>

      {/* ---- Orbit Controls ---- */}
      <OrbitControls
        makeDefault
        minDistance={3}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.1}
        mouseButtons={{
          LEFT: (-1) as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        target={[0, 0, 0]}
      />

      {/* ---- 2D HTML Overlay ---- */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>

          {/* === Controls Hint – Top Left === */}
          <div
            className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-[10px] sm:text-xs rounded-lg px-3 py-2 leading-relaxed select-none"
            style={{ pointerEvents: 'none' }}
          >
            <span className="font-bold text-amber-400">Controls:</span>{' '}
            <span className="opacity-90">
              Left Click → Place &nbsp;|&nbsp; Right Click → Remove
              &nbsp;|&nbsp; Scroll → Zoom &nbsp;|&nbsp; Right Drag → Rotate
              &nbsp;|&nbsp; Middle Drag → Pan
            </span>
          </div>

          {/* === Score & Block Count – Top Right === */}
          <div
            className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs sm:text-sm rounded-lg px-4 py-2 flex items-center gap-3 select-none"
            style={{ pointerEvents: 'none' }}
          >
            <span>🧱 <strong>{blocks.length}</strong></span>
            <span className="w-px h-4 bg-white/20" />
            <span>⭐ <strong>{Math.floor(score)}</strong></span>
          </div>

          {/* === Toast Notification === */}
          {toast && (
            <div
              className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-500/95 text-black font-bold rounded-xl px-5 py-2.5 text-sm sm:text-base shadow-lg shadow-amber-600/30 whitespace-nowrap"
              style={{ pointerEvents: 'none', animation: 'bounce 0.5s ease-out' }}
            >
              {toast}
            </div>
          )}

          {/* === Toolbar – Bottom Center === */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 w-[calc(100%-1rem)] max-w-2xl"
            style={{ pointerEvents: 'none' }}
          >
            {/* -- Color Swatches -- */}
            <div
              className="flex gap-1 sm:gap-1.5 bg-black/70 backdrop-blur-sm rounded-xl p-1.5 sm:p-2 flex-wrap justify-center"
              style={{ pointerEvents: 'auto' }}
            >
              {BLOCK_COLORS.map((c) => {
                const active = color === c.hex;
                return (
                  <button
                    key={c.hex}
                    title={c.name}
                    onClick={() => setColor(c.hex)}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-md border-2 transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer"
                    style={{
                      backgroundColor: c.hex,
                      borderColor: active ? '#ffffff' : 'rgba(255,255,255,0.15)',
                      boxShadow: active ? `0 0 8px 2px ${c.hex}80` : 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* -- Block Types + Actions -- */}
            <div
              className="flex items-center gap-1 sm:gap-1.5 bg-black/70 backdrop-blur-sm rounded-xl p-1.5 sm:p-2 flex-wrap justify-center"
              style={{ pointerEvents: 'auto' }}
            >
              {BLOCK_TYPES.map((t) => {
                const active = blockType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer"
                    style={{
                      backgroundColor: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                      border: `1px solid ${active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}

              <div className="w-px h-5 bg-white/20 mx-0.5 sm:mx-1" />

              <button onClick={handleSave} className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-500 text-white transition-all cursor-pointer">
                💾 Save
              </button>
              <button onClick={handleLoad} className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold bg-sky-600/80 hover:bg-sky-500 text-white transition-all cursor-pointer">
                📂 Load
              </button>
              <button onClick={handleClear} className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold bg-red-600/80 hover:bg-red-500 text-white transition-all cursor-pointer">
                🗑️ Clear
              </button>
              <button onClick={handleTemplate} className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold bg-amber-600/80 hover:bg-amber-500 text-white transition-all cursor-pointer">
                🏠 Template
              </button>
            </div>
          </div>
        </div>
      </Html>
    </>
  );
}