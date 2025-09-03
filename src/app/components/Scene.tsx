"use client";
import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { Stars } from "./Stars";
import { Countries } from "./Countries";
import { States } from "./States";
import { Sun } from "./Sun";
import { Moon } from "./Moon";
import { Earth } from "./Earth";

const Scene: React.FC = () => {
  return (
    <Canvas camera={{ position: [20, 15, 20], fov: 60 }}>
      <Sun
        intensity={2}
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
        orbitTilt={0.089}
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
