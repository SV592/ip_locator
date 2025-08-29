"use client";
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const GlobeGeometry = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Mesh for the solid sphere */}
      <mesh>
        <sphereGeometry args={[2, 32, 32]} />
        <meshLambertMaterial wireframe color={0x9cdba6} />
      </mesh>

      {/* Mesh for the wireframe edges */}
      {/* <lineSegments> */}
      {/* EdgesGeometry takes a BufferGeometry as an argument */}
      {/* <edgesGeometry args={[new THREE.SphereGeometry(2)]} /> */}
      {/* <lineBasicMaterial color={0xffffff} /> */}
      {/* </lineSegments> */}
    </group>
  );
};

const Stars = () => {
  const starsRef = useRef<THREE.Points>(null);

  // Generate the star field geometry once
  const starGeometry = useMemo(() => {
    const starCount = 5000;
    const starGeometry = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < starCount; i++) {
      const x = THREE.MathUtils.randFloatSpread(2000); // large spread
      const y = THREE.MathUtils.randFloatSpread(2000);
      const z = THREE.MathUtils.randFloatSpread(2000);
      positions.push(x, y, z);
    }

    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    return starGeometry;
  }, []);

  useFrame(() => {
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.0005; // slow rotatio
    }
  });

  return (
    <points ref={starsRef} geometry={starGeometry}>
      <pointsMaterial color="white" size={2} sizeAttenuation={false} />
    </points>
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
      <perspectiveCamera fov={75} near={0.1} far={1000} position={[0, 0, 5]} />
      <color attach="background" args={["#212121"]} />
    </Canvas>
  );
};

export default Globe;
