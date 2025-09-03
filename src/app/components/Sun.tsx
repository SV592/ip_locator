import React, { FC, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { SunProps } from "../types/geo";

export const Sun: FC<
  SunProps & {
    orbitRadius?: number;
    orbitSpeed?: number;
    enableOrbit?: boolean;
    orbitTilt?: number;
  }
> = ({
  position = [10, 0, 10],
  intensity = 1.5,
  radius = 0.5,
  color = "#ffffaa",
  orbitRadius = 50,
  orbitSpeed = 0.02,
  enableOrbit = false,
  orbitTilt = 0.409,
}) => {
  const sunRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (enableOrbit && groupRef.current) {
      const time = state.clock.elapsedTime * orbitSpeed;

      const x = Math.cos(time) * orbitRadius;
      const y = Math.sin(time) * orbitRadius * Math.sin(orbitTilt);
      const z = Math.sin(time) * orbitRadius * Math.cos(orbitTilt);

      groupRef.current.position.set(x, y, z);
    }

    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={enableOrbit ? [0, 0, 0] : position}>
      <directionalLight
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <pointLight
        intensity={intensity * 0.5}
        color={color}
        distance={100}
        decay={2}
      />

      <mesh ref={sunRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial
          map={new THREE.TextureLoader().load("textures/2k_sun.jpg")}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.15, 32, 32]} />
        <meshBasicMaterial
          color="#ffff99"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.5, 24, 24]} />
        <meshBasicMaterial
          color="#ffff66"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
