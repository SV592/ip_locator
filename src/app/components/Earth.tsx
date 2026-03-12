import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader, useFrame } from '@react-three/fiber'

// --- Night lights texture (unchanged) ---

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
    { cx: 118, cy: 98,  spread: 12, count: 35 },
    { cx: 87,  cy: 97,  spread: 8,  count: 25 },
    { cx: 107, cy: 90,  spread: 10, count: 20 },
    { cx: 258, cy: 82,  spread: 14, count: 40 },
    { cx: 278, cy: 80,  spread: 10, count: 25 },
    { cx: 338, cy: 112, spread: 10, count: 30 },
    { cx: 392, cy: 93,  spread: 12, count: 35 },
    { cx: 408, cy: 88,  spread: 6,  count: 20 },
    { cx: 373, cy: 122, spread: 8,  count: 20 },
    { cx: 176, cy: 155, spread: 10, count: 25 },
    { cx: 410, cy: 158, spread: 7,  count: 18 },
    { cx: 307, cy: 104, spread: 8,  count: 20 },
    { cx: 267, cy: 128, spread: 6,  count: 15 },
    { cx: 272, cy: 163, spread: 5,  count: 12 },
    { cx: 400, cy: 90,  spread: 4,  count: 15 },
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

// --- Procedural cloud texture via value noise FBM ---

function noiseHash(x: number, y: number): number {
  return ((Math.sin(x * 127.1 + y * 311.7) * 43758.5453123) % 1 + 1) % 1
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const n00 = noiseHash(ix, iy)
  const n10 = noiseHash(ix + 1, iy)
  const n01 = noiseHash(ix, iy + 1)
  const n11 = noiseHash(ix + 1, iy + 1)
  return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) +
         n01 * (1 - sx) * sy + n11 * sx * sy
}

function fbm(x: number, y: number, octaves: number): number {
  let val = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq)
    amp *= 0.5
    freq *= 2
  }
  return val
}

function buildCloudTexture(): THREE.CanvasTexture {
  const w = 512, h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(w, h)
  const data = imageData.data

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4
      const nx = px / w * 8
      const ny = py / h * 4

      let n = fbm(nx + 3.7, ny + 1.2, 5)

      // Threshold to create distinct cloud patches
      n = Math.max(0, n - 0.35) / 0.65
      n = n * n // sharpen edges

      // Reduce near poles (less clouds)
      const latFactor = Math.sin((py / h) * Math.PI)
      n *= latFactor

      const val = Math.min(255, Math.floor(n * 255))
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = val
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

// --- Ocean specular map from earth texture ---

function buildOceanSpecMap(img: HTMLImageElement): THREE.CanvasTexture {
  const w = 512, h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(img, 0, 0, w, h)
  const imgData = ctx.getImageData(0, 0, w, h)
  const pixels = imgData.data

  const specData = ctx.createImageData(w, h)
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
    const sum = r + g + b + 1
    const blueDominance = b / sum
    const luminance = r * 0.299 + g * 0.587 + b * 0.114
    // Ocean: blue-dominant and relatively dark
    const isOcean = blueDominance > 0.37 && luminance < 130
    const spec = isOcean ? 80 : 4
    specData.data[i] = spec
    specData.data[i + 1] = spec
    specData.data[i + 2] = spec
    specData.data[i + 3] = 255
  }

  ctx.putImageData(specData, 0, 0)

  // Simple box blur for smooth transitions
  const blurred = ctx.getImageData(0, 0, w, h)
  const src = new Uint8ClampedArray(blurred.data)
  const radius = 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const sy = Math.min(h - 1, Math.max(0, y + dy))
          const sx = ((x + dx) % w + w) % w // wrap horizontally
          sum += src[(sy * w + sx) * 4]
          count++
        }
      }
      const avg = sum / count
      const idx = (y * w + x) * 4
      blurred.data[idx] = avg
      blurred.data[idx + 1] = avg
      blurred.data[idx + 2] = avg
      blurred.data[idx + 3] = 255
    }
  }
  ctx.putImageData(blurred, 0, 0)

  return new THREE.CanvasTexture(canvas)
}

// --- Component ---

export const Earth = () => {
  const earthRef = useRef<THREE.Mesh>(null)
  const cloudRef = useRef<THREE.Mesh>(null)
  const atmosRef = useRef<THREE.ShaderMaterial>(null)
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null)

  const earthTexture = useLoader(THREE.TextureLoader, 'textures/2k_earth_daymap.jpg')
  const nightTexture = useMemo(() => buildNightLightsTexture(), [])
  const cloudTexture = useMemo(() => buildCloudTexture(), [])
  const oceanSpecMap = useMemo(
    () => buildOceanSpecMap(earthTexture.image as HTMLImageElement),
    [earthTexture]
  )

  useFrame((state, delta) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.003 * delta
    }

    // Find the sun's directional light (cached after first find)
    if (!sunLightRef.current) {
      state.scene.traverse((obj) => {
        if (obj instanceof THREE.DirectionalLight && !sunLightRef.current) {
          sunLightRef.current = obj
        }
      })
    }

    // Update atmosphere sun direction
    if (sunLightRef.current && atmosRef.current) {
      const pos = new THREE.Vector3()
      sunLightRef.current.getWorldPosition(pos)
      atmosRef.current.uniforms.uSunDir.value.copy(pos.normalize())
    }
  })

  return (
    <group>
      {/* Earth sphere with ocean specular */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[2, 128, 128]} />
        <meshPhongMaterial
          map={earthTexture}
          bumpMap={earthTexture}
          bumpScale={0.04}
          specular={new THREE.Color('#3a6a7a')}
          specularMap={oceanSpecMap}
          shininess={15}
          emissive={new THREE.Color('#ffddaa')}
          emissiveMap={nightTexture}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Procedural cloud layer */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[2.008, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.28}
          alphaMap={cloudTexture}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>

      {/* Sun-aware atmospheric glow */}
      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          ref={atmosRef}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uSunDir: { value: new THREE.Vector3(1, 0.5, 0) },
          }}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            varying vec3 vWorldPos;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
              vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uSunDir;
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            varying vec3 vWorldPos;
            void main() {
              float intensity = pow(0.7 - dot(vNormal, vPositionNormal), 2.5);

              // How much this point faces the sun
              vec3 worldDir = normalize(vWorldPos);
              float sunFacing = dot(worldDir, uSunDir) * 0.5 + 0.5;
              float sunBoost = mix(0.15, 1.3, pow(sunFacing, 1.5));

              // Warmer tint on sun side, cooler on dark side
              vec3 sunColor = vec3(0.4, 0.7, 1.0);
              vec3 darkColor = vec3(0.12, 0.25, 0.7);
              vec3 atmosColor = mix(darkColor, sunColor, sunFacing);

              vec3 atmosphere = atmosColor * intensity * sunBoost;
              gl_FragColor = vec4(atmosphere, intensity * 0.8 * sunBoost);
            }
          `}
        />
      </mesh>
    </group>
  )
}
