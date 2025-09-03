import React, { FC, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
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
  const moonRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

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

      <mesh ref={moonRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshLambertMaterial
          map={new THREE.TextureLoader().load("textures/2k_moon.jpg")}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.03, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
};
