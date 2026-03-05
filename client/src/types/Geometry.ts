export interface Point3D {
  // oxlint-disable-next-line id-length
  x: number;
  // oxlint-disable-next-line id-length
  y: number;
  // oxlint-disable-next-line id-length
  z: number;
}

export type Geometry3D = Point3D[];

export type GeometryList3D = Geometry3D[];
