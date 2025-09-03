import React, { FC, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { SunProps } from "../types/geo";

export const Sun: FC<
  SunProps & {
    orbitRadius?: number;
    orbitSpeed?: number;
    enableOrbit?: boolean;
    orbitHeight?: number;
  }
> = ({
  position = [10, 0, 10],
  intensity = 1.5,
  radius = 0.5,
  color = "#ffffaa",
  orbitRadius = 50,
  orbitSpeed = 0.02,
  enableOrbit = false,
  orbitHeight = 10,
}) => {
  const sunRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const glowRef1 = useRef<THREE.Mesh>(null);
  const glowRef2 = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    //  orbit
    if (enableOrbit && groupRef.current) {
      const time = state.clock.elapsedTime * orbitSpeed;

      const x = Math.cos(time) * orbitRadius;
      const y = orbitHeight;
      const z = Math.sin(time) * orbitRadius;

      groupRef.current.position.set(x, y, z);
    }

    // Rotate sun
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.05;
    }

    // pulsing
    const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1;
    if (glowRef1.current) {
      glowRef1.current.scale.setScalar(1.15 * pulse);
    }
    if (glowRef2.current) {
      glowRef2.current.scale.setScalar(1.5 * (2 - pulse) * 0.5);
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

      <mesh ref={glowRef1}>
        <sphereGeometry args={[radius * 1.15, 32, 32]} />
        <meshBasicMaterial
          color="#ffff99"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={glowRef2}>
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
