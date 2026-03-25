export type HexColorString = `#${string}`;

export interface BaseValueParams {
  WIDTH: number;
  HEIGHT: number;
  Y_OFFSET: number;
}

export type SingleColorValue = BaseValueParams & {
  DEFAULT_COLOR: HexColorString;
  DARK_COLOR: HexColorString;
  SPECIAL_COLOR: HexColorString;
  DEFAULT_COLOR_U: HexColorString;
  DEFAULT_COLOR_D: HexColorString;
  DARK_COLOR_U: HexColorString;
  DARK_COLOR_D: HexColorString;
  SPECIAL_COLOR_U: HexColorString;
  SPECIAL_COLOR_D: HexColorString;
};

export type HighwayColorValue = BaseValueParams & {
  DEFAULT_COLOR_U: HexColorString;
  DEFAULT_COLOR_D: HexColorString;
  DARK_COLOR_U: HexColorString;
  DARK_COLOR_D: HexColorString;
  SPECIAL_COLOR_U: HexColorString;
  SPECIAL_COLOR_D: HexColorString;

  DEFAULT_COLOR?: never;
  DARK_COLOR?: never;
  SPECIAL_COLOR?: never;
};

export type ObjectConfigValue = SingleColorValue | HighwayColorValue;
