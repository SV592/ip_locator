import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import countriesData from "../../../public/geo_json/countries.json";
import { GeoJSONFeatureCollection, CountriesProps } from "../types/geo";
import { drawThreeGeo } from "../utils/threeGeoJSON";

export const Countries: React.FC<CountriesProps> = ({
  data = countriesData as GeoJSONFeatureCollection,
  radius = 2.01,
  color = "#fff",
  animated = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const countriesRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    const options = {
      json: data,
      radius,
      materalOptions: {
        color,
        size: 0.05,
      },
    };

    const countries = drawThreeGeo(options);
    countriesRef.current = countries;
    groupRef.current.add(countries);

    return () => {
      if (groupRef.current && countriesRef.current) {
        groupRef.current.remove(countriesRef.current);
      }
    };
  }, [data, radius, color]);

  useFrame((state) => {
    if (animated && countriesRef.current?.userData.update) {
      countriesRef.current.userData.update(state.clock.elapsedTime);
    }
    // if (groupRef.current) {
    //   groupRef.current.rotation.y += 0.01;
    // }
  });

  return <group ref={groupRef} />;
};
