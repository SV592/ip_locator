"use client";
import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { Stars } from "./Stars";
import { Countries } from "./Countries";
import { States } from "./States";
import { Sun } from "./Sun";
import { Moon } from "./Moon";

const Earth = () => {
  const earthTexture = new THREE.TextureLoader().load(
    "textures/2k_earth_daymap.jpg"
  );

  return (
    <mesh>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial
        map={earthTexture}
        bumpScale={0.05}
        metalness={0}
        roughness={1}
      />
    </mesh>
  );
};

const Scene: React.FC = () => {
  return (
    <Canvas camera={{ position: [15, 10, 15], fov: 60 }}>
      <Sun
        intensity={1.5}
        radius={3}
        enableOrbit={true}
        orbitRadius={50}
        orbitSpeed={0.02}
      />

      <Moon
        intensity={0.3}
        radius={0.54}
        enableOrbit={true}
        orbitRadius={8}
        orbitSpeed={0.1}
      />

      <ambientLight intensity={0.1} />

      <Earth />
      <Countries />
      <States />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        target={[0, 0, 0]}
        maxDistance={100}
        minDistance={5}
      />

      <Stars />
      <color attach="background" args={["#000000"]} />
    </Canvas>
  );
};

export default Scene;
