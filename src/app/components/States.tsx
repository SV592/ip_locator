import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import statesData from "../../../public/geo_json/countries_states.json";
import { GeoJSONFeatureCollection, CountriesProps } from "../types/geo";
import { drawThreeGeo } from "../utils/threeGeoJSON";

export const States: React.FC<CountriesProps> = ({
  data = statesData as GeoJSONFeatureCollection,
  radius = 2.01,
  color = "#fff",
  animated = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const statesRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    const options = {
      json: data,
      radius,
      color: new THREE.Color(color),
      materalOptions: {
        color,
        size: 0.05,
      },
    };

    const states = drawThreeGeo(options);
    statesRef.current = states;
    groupRef.current.add(states);

    return () => {
      if (groupRef.current && statesRef.current) {
        groupRef.current.remove(statesRef.current);
      }
    };
  }, [data, radius, color]);

  useFrame((state) => {
    if (animated && statesRef.current?.userData.update) {
      statesRef.current.userData.update(state.clock.elapsedTime);
    }

    // if (groupRef.current) {
    //   groupRef.current.rotation.y += 0.01;
    // }
  });

  return <group ref={groupRef} />;
};
