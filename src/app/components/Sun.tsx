import React, { FC, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { SunProps } from "../types/geo";

export const Sun: FC<SunProps> = ({
  position = [10, 0, 10],
  intensity = 1.5,
  radius = 0.5,
  color = "#ffffaa",
}) => {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef1 = useRef<THREE.Mesh>(null);

  //  pulse
  useFrame((state) => {
    const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.05 + 1;
    if (glowRef1.current) {
      glowRef1.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <directionalLight
        position={position}
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <pointLight
        position={position}
        intensity={intensity * 0.5}
        color={color}
        distance={30}
        decay={2}
      />

      {/* sun sphere with texture */}
      <mesh ref={sunRef} position={position}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial
          map={new THREE.TextureLoader().load("textures/2k_sun.jpg")}
        />
      </mesh>

      {/* glow layers */}
      <mesh ref={glowRef1} position={position}>
        <sphereGeometry args={[radius * 1.15, 32, 32]} />
        <meshBasicMaterial
          color="#ffff99"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh position={position}>
        <sphereGeometry args={[radius * 1.5, 24, 24]} />
        <meshBasicMaterial
          color="#ffff66"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh position={position}>
        <sphereGeometry args={[radius * 2.5, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

export default Sun;
