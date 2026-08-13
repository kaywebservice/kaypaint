export type LayerType =
  | "image"
  | "text"
  | "shape"
  | "group"
  | "adjustment"
  | "smart";

export interface KayLayer {
  id: string;

  name: string;

  type: LayerType;

  visible: boolean;

  locked: boolean;

  opacity: number;

  blendMode: string;

  hasMask: boolean;
  objectId?: string;
  layerStyles?: string;
}