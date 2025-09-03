import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import type { GeoJSON, Geometry } from "../types/geo";

/* draw GeoJSON on a 3D globe */

interface DrawThreeGeoProps {
  json: GeoJSON;
  radius: number;
  materalOptions?: THREE.PointsMaterialParameters;
  color?: number | string;
  fill?: boolean;
}

export function drawThreeGeo({
  json,
  radius,
  materalOptions,
}: DrawThreeGeoProps): THREE.Object3D {
  const container = new THREE.Object3D();

  container.userData.update = (t: number) => {
    for (let i = 0; i < container.children.length; i++) {
      container.children[i].userData.update?.(t);
    }
  };

  container.rotation.x = -Math.PI * 0.5; // fix orientation

  const x_values: number[] = [];
  const y_values: number[] = [];
  const z_values: number[] = [];
  const json_geom = createGeometryArray(json);

  let coordinate_array: number[][] = [];

  for (let geom_num = 0; geom_num < json_geom.length; geom_num++) {
    const geom = json_geom[geom_num];

    if (!geom) continue;

    if (geom.type === "Point") {
      convertToSphereCoords(geom.coordinates as number[], radius);
      drawParticle(x_values[0], y_values[0], z_values[0], materalOptions);
    } else if (geom.type === "MultiPoint") {
      for (const coords of geom.coordinates as number[][]) {
        convertToSphereCoords(coords, radius);
        drawParticle(x_values[0], y_values[0], z_values[0], materalOptions);
      }
    } else if (geom.type === "LineString") {
      coordinate_array = createCoordinateArray(geom.coordinates as number[][]);
      coordinate_array.forEach((coords) =>
        convertToSphereCoords(coords, radius)
      );
      drawLine(x_values, y_values, z_values, materalOptions);
    } else if (geom.type === "Polygon") {
      (geom.coordinates as number[][][]).forEach((segment) => {
        coordinate_array = createCoordinateArray(segment);
        coordinate_array.forEach((coords) =>
          convertToSphereCoords(coords, radius)
        );
        drawLine(x_values, y_values, z_values, materalOptions);
      });
    } else if (geom.type === "MultiLineString") {
      (geom.coordinates as number[][][]).forEach((segment) => {
        coordinate_array = createCoordinateArray(segment);
        coordinate_array.forEach((coords) =>
          convertToSphereCoords(coords, radius)
        );
        drawLine(x_values, y_values, z_values, materalOptions);
      });
    } else if (geom.type === "MultiPolygon") {
      (geom.coordinates as number[][][][]).forEach((polygon) => {
        polygon.forEach((segment) => {
          coordinate_array = createCoordinateArray(segment);
          coordinate_array.forEach((coords) =>
            convertToSphereCoords(coords, radius)
          );
          drawLine(x_values, y_values, z_values, materalOptions);
        });
      });
    } else {
      throw new Error("The geoJSON is not valid.");
    }
  }

  function createGeometryArray(json: GeoJSON): Geometry[] {
    const geometry_array: Geometry[] = [];

    if (json.type === "Feature") {
      geometry_array.push(json.geometry as Geometry);
    } else if (json.type === "FeatureCollection") {
      for (const feature of json.features) {
        geometry_array.push(feature.geometry as Geometry);
      }
    } else if (json.type === "GeometryCollection") {
      for (const geom of json.geometries) {
        geometry_array.push(geom);
      }
    } else {
      throw new Error("The geoJSON is not valid.");
    }
    return geometry_array;
  }

  function createCoordinateArray(feature: number[][]): number[][] {
    const temp_array: number[][] = [];
    let interpolation_array: number[][] = [];

    for (let point_num = 0; point_num < feature.length; point_num++) {
      const point1 = feature[point_num];
      const point2 = feature[point_num - 1];

      if (point_num > 0) {
        if (needsInterpolation(point2, point1)) {
          interpolation_array = [point2, point1];
          interpolation_array = interpolatePoints(interpolation_array);

          for (const inter_point of interpolation_array) {
            temp_array.push(inter_point);
          }
        } else {
          temp_array.push(point1);
        }
      } else {
        temp_array.push(point1);
      }
    }
    return temp_array;
  }

  function needsInterpolation(point2: number[], point1: number[]): boolean {
    const lon1 = point1[0];
    const lat1 = point1[1];
    const lon2 = point2[0];
    const lat2 = point2[1];
    const lon_distance = Math.abs(lon1 - lon2);
    const lat_distance = Math.abs(lat1 - lat2);

    return lon_distance > 5 || lat_distance > 5;
  }

  function interpolatePoints(interpolation_array: number[][]): number[][] {
    let temp_array: number[][] = [];

    for (
      let point_num = 0;
      point_num < interpolation_array.length - 1;
      point_num++
    ) {
      const point1 = interpolation_array[point_num];
      const point2 = interpolation_array[point_num + 1];

      if (needsInterpolation(point2, point1)) {
        temp_array.push(point1);
        temp_array.push(getMidpoint(point1, point2));
      } else {
        temp_array.push(point1);
      }
    }

    temp_array.push(interpolation_array[interpolation_array.length - 1]);

    if (temp_array.length > interpolation_array.length) {
      temp_array = interpolatePoints(temp_array);
    }
    return temp_array;
  }

  function getMidpoint(point1: number[], point2: number[]): number[] {
    const midpoint_lon = (point1[0] + point2[0]) / 2;
    const midpoint_lat = (point1[1] + point2[1]) / 2;
    return [midpoint_lon, midpoint_lat];
  }

  function convertToSphereCoords(
    coordinates_array: number[],
    sphere_radius: number
  ): void {
    const lon = coordinates_array[0];
    const lat = coordinates_array[1];

    x_values.push(
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((lon * Math.PI) / 180) *
        sphere_radius
    );
    y_values.push(
      Math.cos((lat * Math.PI) / 180) *
        Math.sin((lon * Math.PI) / 180) *
        sphere_radius
    );
    z_values.push(Math.sin((lat * Math.PI) / 180) * sphere_radius);
  }

  function drawParticle(
    x: number,
    y: number,
    z: number,
    options?: THREE.PointsMaterialParameters
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([x, y, z], 3)
    );

    const particle_material = new THREE.PointsMaterial(options);
    const particle = new THREE.Points(geo, particle_material);

    container.add(particle);
    clearArrays();
  }

  function drawLine(
    x_values: number[],
    y_values: number[],
    z_values: number[],
    options?: THREE.LineBasicMaterialParameters
  ) {
    const lineGeo = new LineGeometry();
    const verts: number[] = [];
    for (let i = 0; i < x_values.length; i++) {
      verts.push(x_values[i], y_values[i], z_values[i]);
    }
    lineGeo.setPositions(verts);

    const color = new THREE.Color("#fff");

    const lineMaterial = new LineMaterial({
      color: color.getHex(),
      linewidth: 2,
      fog: true,
    });

    const line = new Line2(lineGeo, lineMaterial);
    line.computeLineDistances();

    const rate = Math.random() * 0.0002;
    line.userData.update = (t: number) => {
      lineMaterial.dashOffset = t * rate;
    };

    container.add(line);
    clearArrays();
  }

  function clearArrays() {
    x_values.length = 0;
    y_values.length = 0;
    z_values.length = 0;
  }

  return container;
}
