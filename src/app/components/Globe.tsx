"use client";
import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { Stars } from "./Stars";
import { Countries } from "./Countries";
import { States } from "./States";

const GlobeGeometry = () => {
  const groupRef = useRef<THREE.Group>(null);

  // useFrame(() => {
  //   if (groupRef.current) {
  //     groupRef.current.rotation.y += 0.01;
  //   }
  // });

  return (
    <group ref={groupRef}>
      {/* mesh for wireframe edges */}
      <lineSegments>
        {/* EdgesGeometry takes a BufferGeometry as an argument */}
        <edgesGeometry args={[new THREE.SphereGeometry(2)]} />
        <lineBasicMaterial color={"#44444E"} />
      </lineSegments>

      {/* <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshPhongMaterial color={"#3a9bdc"} transparent opacity={0.9} />
      </mesh> */}
    </group>
  );
};

const Globe: React.FC = () => {
  return (
    <Canvas>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <OrbitControls enablePan enableZoom enableRotate />
      <directionalLight position={[1, 1, 1]} intensity={10} color={0x9cdba6} />
      <GlobeGeometry />
      <Stars />
      <Countries />
      <States />
      <perspectiveCamera fov={75} near={0.1} far={1000} position={[0, 0, 5]} />
      <color attach="background" args={["#000000"]} />
    </Canvas>
  );
};

export default Globe;
