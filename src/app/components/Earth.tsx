import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader, useFrame } from '@react-three/fiber'

const buildNightLightsTexture = (): THREE.Texture => {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  type Cluster = { cx: number; cy: number; spread: number; count: number };

  const clusters: Cluster[] = [
    // US East Coast
    { cx: 118, cy: 98,  spread: 12, count: 35 },
    // US West Coast
    { cx: 87,  cy: 97,  spread: 8,  count: 25 },
    // US Midwest / Great Lakes
    { cx: 107, cy: 90,  spread: 10, count: 20 },
    // Europe (Western)
    { cx: 258, cy: 82,  spread: 14, count: 40 },
    // Europe (Central/Eastern)
    { cx: 278, cy: 80,  spread: 10, count: 25 },
    // India
    { cx: 338, cy: 112, spread: 10, count: 30 },
    // East China
    { cx: 392, cy: 93,  spread: 12, count: 35 },
    // Japan
    { cx: 408, cy: 88,  spread: 6,  count: 20 },
    // Southeast Asia
    { cx: 373, cy: 122, spread: 8,  count: 20 },
    // South America East Coast
    { cx: 176, cy: 155, spread: 10, count: 25 },
    // Australia East
    { cx: 410, cy: 158, spread: 7,  count: 18 },
    // Middle East
    { cx: 307, cy: 104, spread: 8,  count: 20 },
    // Nigeria
    { cx: 267, cy: 128, spread: 6,  count: 15 },
    // South Africa
    { cx: 272, cy: 163, spread: 5,  count: 12 },
    // Korea
    { cx: 400, cy: 90,  spread: 4,  count: 15 },
    // Mexico / Central America
    { cx: 100, cy: 112, spread: 8,  count: 15 },
  ];

  for (const { cx, cy, spread, count } of clusters) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.random() * spread;
      const px    = cx + Math.cos(angle) * dist;
      const py    = cy + Math.sin(angle) * dist;
      const brightness = 0.3 + Math.random() * 0.7;
      const radius     = 0.5 + Math.random() * 1.0;

      const r = Math.round(255 * Math.min(1, brightness * 1.1));
      const g = Math.round(255 * Math.min(1, brightness * 0.87));
      const b = Math.round(255 * Math.min(1, brightness * 0.55));

      const grd = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.fillStyle = grd;
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const Earth = () => {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);

  const earthTexture = useLoader(THREE.TextureLoader, 'textures/2k_earth_daymap.jpg');

  const nightTexture = useMemo(() => buildNightLightsTexture(), []);

  useFrame((_, delta) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.003 * delta;
    }
  });

  return (
    <group>
      {/* earth sphere */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[2, 128, 128]} />
        <meshPhongMaterial
          map={earthTexture}
          bumpMap={earthTexture}
          bumpScale={0.04}
          specular={new THREE.Color('#101010')}
          shininess={5}
          emissive={new THREE.Color('#ffddaa')}
          emissiveMap={nightTexture}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* rotating cloud layer */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[2.003, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.18}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>

      {/* atmospheric glow */}
      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              float intensity = pow(0.7 - dot(vNormal, vPositionNormal), 2.5);
              vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;
              gl_FragColor = vec4(atmosphere, intensity * 0.8);
            }
          `}
        />
      </mesh>
    </group>
  );
};
