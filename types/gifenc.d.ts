declare module "gifenc" {
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette: number[][];
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
        repeat?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(): GIFEncoderInstance;

  export function quantize(
    rgba: Uint8Array,
    maxColors: number,
    opts?: any
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array,
    palette: number[][],
    format?: string
  ): Uint8Array;
}