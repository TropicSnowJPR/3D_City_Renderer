export interface LatLon {
  lat: number;
  lon: number;
}

export interface Bounds {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}

export interface Way {
  type: "way";
  id: number;
  bounds: Bounds;
  nodes: number[];
  geometry: LatLon[];
  tags?: Record<string, string>;
}

export interface RelationMember {
  type: "way" | "node" | "relation";
  ref: number;
  role: string;
  geometry?: LatLon[];
}

export interface Relation {
  type: "relation";
  id: number;
  bounds: Bounds;
  members: RelationMember[];
  tags?: Record<string, string>;
}

export type OSMElement = Way | Relation;
