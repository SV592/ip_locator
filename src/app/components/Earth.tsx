import React, { useRef } from "react";
import * as THREE from "three";

export const Earth = () => {
  const earthRef = useRef<THREE.Mesh>(null);

  const earthTexture = new THREE.TextureLoader().load(
    "textures/2k_earth_daymap.jpg"
  );

  return (
    <group>
      {/* earth sphere */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[2, 128, 128]} />
        <meshPhongMaterial
          map={earthTexture}
          bumpMap={earthTexture}
          bumpScale={0.02}
          specular={new THREE.Color("#101010")}
          shininess={5}
          emissive={new THREE.Color("#112244")}
          emissiveIntensity={0.02}
        />
      </mesh>

      {/* cloud */}
      <mesh>
        <sphereGeometry args={[2.003, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>

      {/* glow */}
      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              float intensity = pow(0.7 - dot(vNormal, vPositionNormal), 2.5);
              vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;
              gl_FragColor = vec4(atmosphere, intensity * 0.8);
            }
          `}
        />
      </mesh>
    </group>
  );
};
