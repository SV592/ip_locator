import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  varying float vPhase;
  varying vec3 vColor;

  void main() {
    vPhase = aPhase;
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;

  varying float vPhase;
  varying vec3 vColor;

  void main() {
    // Discard fragments outside the circular point shape
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    // Soft circular edge
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

    // Twinkle: each star gets a unique rate derived from its phase
    // phase doubles as a seed for the rate variation (0.5 to 1.5 Hz range)
    float rate = 0.5 + vPhase / (2.0 * 3.14159265);
    float twinkle = sin(uTime * rate + vPhase);
    // Remap from [-1,1] to [0.4, 1.0]
    float opacity = 0.4 + 0.6 * (twinkle * 0.5 + 0.5);

    gl_FragColor = vec4(vColor, alpha * opacity);
  }
`;

export const Stars = () => {
  const starsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const starCount = 5000;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // Position
      positions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(2000);
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(2000);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(2000);

      // Size: random between 0.5 and 3.0
      sizes[i] = THREE.MathUtils.randFloat(0.5, 3.0);

      // Phase: random 0 to 2*PI
      phases[i] = Math.random() * Math.PI * 2;

      // Color: mostly white with slight warm/cool tint variation
      const tint = Math.random();
      if (tint < 0.15) {
        // Warm (yellowish)
        colors[i * 3 + 0] = THREE.MathUtils.randFloat(0.95, 1.0);  // r
        colors[i * 3 + 1] = THREE.MathUtils.randFloat(0.85, 0.95); // g
        colors[i * 3 + 2] = THREE.MathUtils.randFloat(0.65, 0.80); // b
      } else if (tint < 0.30) {
        // Cool (bluish)
        colors[i * 3 + 0] = THREE.MathUtils.randFloat(0.75, 0.88); // r
        colors[i * 3 + 1] = THREE.MathUtils.randFloat(0.85, 0.95); // g
        colors[i * 3 + 2] = THREE.MathUtils.randFloat(0.95, 1.0);  // b
      } else {
        // White with very subtle variation
        colors[i * 3 + 0] = THREE.MathUtils.randFloat(0.88, 1.0);  // r
        colors[i * 3 + 1] = THREE.MathUtils.randFloat(0.88, 1.0);  // g
        colors[i * 3 + 2] = THREE.MathUtils.randFloat(0.92, 1.0);  // b
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize",    new THREE.BufferAttribute(sizes,     1));
    geometry.setAttribute("aPhase",   new THREE.BufferAttribute(phases,    1));
    geometry.setAttribute("aColor",   new THREE.BufferAttribute(colors,    3));

    const uniforms = {
      uTime: { value: 0 },
    };

    return { geometry, uniforms };
  }, []);

  useFrame(({ clock }) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.0005;
    }
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <points ref={starsRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
