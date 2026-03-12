import React, { FC, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { MoonProps } from "../types/geo";

export const Moon: FC<
  MoonProps & {
    orbitRadius?: number;
    orbitSpeed?: number;
    enableOrbit?: boolean;
    orbitTilt?: number;
  }
> = ({
  position = [-10, 0, -10],
  intensity = 0.3,
  radius = 0.27,
  color = "#d8d8ff",
  orbitRadius = 8,
  orbitSpeed = 0.1,
  enableOrbit = false,
  orbitTilt = 0.089,
}) => {
  const [hovered, setHovered] = useState(false);
  const moonRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, "textures/2k_moon.jpg");

  useFrame((state, delta) => {
    // orbit
    if (enableOrbit && groupRef.current) {
      const time = state.clock.elapsedTime * orbitSpeed;

      const x = Math.cos(time) * orbitRadius;
      const y = Math.sin(time) * orbitRadius * Math.sin(orbitTilt);
      const z = Math.sin(time) * orbitRadius * Math.cos(orbitTilt);

      groupRef.current.position.set(x, y, z);

      if (moonRef.current) {
        moonRef.current.rotation.y = -time;
      }
    } else if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <group ref={groupRef} position={enableOrbit ? [0, 0, 0] : position}>
      <directionalLight intensity={intensity} color={color} />

      <pointLight intensity={intensity * 0.2} color={color} distance={20} />

      <mesh
        ref={moonRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        <meshLambertMaterial map={texture} />
      </mesh>

      {hovered && (
        <Html
          position={[0, radius * 2, 0]}
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bg-black/80 backdrop-blur-sm border border-gray-400/40 rounded px-2.5 py-1.5 text-[10px] text-gray-300 font-mono whitespace-nowrap shadow-lg shadow-gray-500/10">
            That&apos;s no moon... wait, yes it is.
          </div>
        </Html>
      )}

      <mesh>
        <sphereGeometry args={[radius * 1.03, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
};
