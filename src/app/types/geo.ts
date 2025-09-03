import * as THREE from "three";

// [longitude, latitude]
export type GeoJSONCoordinate = [number, number];

// A polygon is an array of linear rings.
// each ring is an array of coordinates.
// the first ring = outer boundary, others = holes.
export type GeoJSONPolygonCoordinates = GeoJSONCoordinate[][];

// a multipolygon is an array of polygons.
export type GeoJSONMultiPolygonCoordinates = GeoJSONPolygonCoordinates[];

/**
 * Properties for a country feature (Admin-0)
 */
export interface CountryProperties {
  continent: string;
  economy: string;
  income_grp: string;
  iso_a3: string;
  name: string;
  pop_est: number;
  mapcolor7?: number;
  mapcolor8?: number;
  mapcolor9?: number;
  mapcolor13?: number;
  [key: string]: unknown;
}

/**
 * Properties for a province/state feature
 */
export interface ProvinceProperties {
  featurecla: string;
  iso_a2: string;
  name: string;
  type: string;
  postal: string;
  admin: string;
  sales_rgn: number;
  [key: string]: unknown;
}

/**
 * Component props for rendering countries on a Three.js globe
 */
export interface CountriesProps {
  data?: GeoJSONFeatureCollection;
  radius?: number;
  color?: number | string; // allow hex string too
  animated?: boolean;
}

export interface SunProps {
  position?: [number, number, number];
  intensity?: number;
  radius?: number;
  color?: string | number;
}

export interface MoonProps {
  position?: [number, number, number];
  intensity?: number;
  radius?: number;
  color?: string | number;
  sphereColor?: string | number;
}

// --- GeoJSON FeatureCollection types ---

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  crs?: {
    type: string;
    properties: { name: string };
  };
  features: Array<{
    type: "Feature";
    properties:
      | CountryProperties
      | ProvinceProperties
      | Record<string, unknown>;
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: GeoJSONPolygonCoordinates | GeoJSONMultiPolygonCoordinates;
    };
  }>;
}

export interface DrawThreeGeoOptions {
  json: GeoJSONFeatureCollection;
  radius: number;
  color?: number | string;
  getColor?: (props: CountryProperties) => THREE.Color;
  fill?: boolean; // 👈 new
}

// --- Basic GeoJSON Geometry types ---

export interface GeoJSONPoint {
  type: "Point";
  coordinates: GeoJSONCoordinate;
}

export interface GeoJSONMultiPoint {
  type: "MultiPoint";
  coordinates: GeoJSONCoordinate[];
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: GeoJSONCoordinate[];
}

export interface GeoJSONMultiLineString {
  type: "MultiLineString";
  coordinates: GeoJSONCoordinate[][];
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: GeoJSONPolygonCoordinates;
}

export interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: GeoJSONMultiPolygonCoordinates;
}

// Union = all geometry types
export type Geometry =
  | GeoJSONPoint
  | GeoJSONMultiPoint
  | GeoJSONLineString
  | GeoJSONMultiLineString
  | GeoJSONPolygon
  | GeoJSONMultiPolygon;

// --- Feature types ---
export interface GeoJSONFeature {
  type: "Feature";
  geometry: Geometry;
  properties: CountryProperties | ProvinceProperties | Record<string, unknown>;
}

export interface GeoJSONGeometryCollection {
  type: "GeometryCollection";
  geometries: Geometry[];
}

// Union for all GeoJSON possibilities
export type GeoJSON =
  | GeoJSONFeature
  | GeoJSONFeatureCollection
  | GeoJSONGeometryCollection
  | Geometry;

// declare our helper
export declare function drawThreeGeo(options: DrawThreeGeoOptions): THREE.Group;
