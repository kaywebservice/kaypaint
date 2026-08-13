/**
 * Filter Gallery catalog. Every category maps display names to the existing
 * pixel ops in engine/filterOps.ts (FILTER_OPS), with a suggested intensity
 * (0-100) for the Filter Gallery dialog.
 */

export interface FilterGalleryItem {
  name: string;
  op: string;
  intensity: number;
}

export interface FilterGalleryCategory {
  name: string;
  filters: FilterGalleryItem[];
}

export const filterGalleryCategories: FilterGalleryCategory[] = [
  {
    name: "Artistic",
    filters: [
      { name: "Diffuse", op: "diffuse", intensity: 50 },
      { name: "Blur More", op: "blurMore", intensity: 50 },
      { name: "Dither", op: "dither", intensity: 50 },
      { name: "High Pass", op: "highPass", intensity: 50 },
      { name: "Offset", op: "offset", intensity: 50 },
      { name: "Maximum", op: "maximum", intensity: 50 },
      { name: "Minimum", op: "minimum", intensity: 50 },
      { name: "Custom", op: "custom", intensity: 50 },
    ],
  },
  {
    name: "Blur",
    filters: [
      { name: "Gaussian Blur", op: "gaussianBlur", intensity: 30 },
      { name: "Box Blur", op: "boxBlur", intensity: 30 },
      { name: "Motion Blur", op: "motionBlur", intensity: 30 },
      { name: "Radial Blur", op: "radialBlur", intensity: 30 },
      { name: "Average", op: "average", intensity: 50 },
      { name: "Blur More", op: "blurMore", intensity: 50 },
      { name: "Lens Blur", op: "lensBlur", intensity: 40 },
      { name: "Shape Blur", op: "shapeBlur", intensity: 40 },
    ],
  },
  {
    name: "Brush Strokes",
    filters: [
      { name: "Emboss", op: "emboss", intensity: 50 },
      { name: "Wind", op: "wind", intensity: 50 },
      { name: "Diffuse", op: "diffuse", intensity: 50 },
      { name: "Tiles", op: "tiles", intensity: 50 },
      { name: "Shear", op: "shear", intensity: 50 },
      { name: "Displace", op: "displace", intensity: 50 },
      { name: "Pinch", op: "pinch", intensity: 50 },
    ],
  },
  {
    name: "Distort",
    filters: [
      { name: "Pinch", op: "pinch", intensity: 50 },
      { name: "Spherize", op: "spherize", intensity: 50 },
      { name: "Twirl", op: "twirl", intensity: 50 },
      { name: "Ripple", op: "ripple", intensity: 50 },
      { name: "Shear", op: "shear", intensity: 50 },
      { name: "Displace", op: "displace", intensity: 50 },
      { name: "Radial Blur", op: "radialBlur", intensity: 30 },
      { name: "Motion Blur", op: "motionBlur", intensity: 30 },
    ],
  },
  {
    name: "Noise",
    filters: [
      { name: "Add Noise", op: "addNoise", intensity: 30 },
      { name: "Reduce Noise", op: "reduceNoise", intensity: 50 },
      { name: "Median", op: "median", intensity: 50 },
      { name: "Dust & Scratches", op: "dustScratches", intensity: 50 },
    ],
  },
  {
    name: "Sharpen",
    filters: [
      { name: "Sharpen", op: "sharpen", intensity: 60 },
      { name: "Sharpen More", op: "sharpenMore", intensity: 60 },
      { name: "Sharpen Edges", op: "sharpenEdges", intensity: 60 },
      { name: "Unsharp Mask", op: "unsharpMask", intensity: 60 },
      { name: "Smart Sharpen", op: "smartSharpen", intensity: 60 },
    ],
  },
  {
    name: "Stylize",
    filters: [
      { name: "Emboss", op: "emboss", intensity: 50 },
      { name: "Find Edges", op: "findEdges", intensity: 100 },
      { name: "Solarize", op: "solarize", intensity: 100 },
      { name: "Wind", op: "wind", intensity: 50 },
      { name: "Diffuse", op: "diffuse", intensity: 50 },
      { name: "Tiles", op: "tiles", intensity: 50 },
      { name: "High Pass", op: "highPass", intensity: 50 },
    ],
  },
  {
    name: "Texture",
    filters: [
      { name: "Tiles", op: "tiles", intensity: 50 },
      { name: "Offset", op: "offset", intensity: 50 },
      { name: "Maximum", op: "maximum", intensity: 50 },
      { name: "Minimum", op: "minimum", intensity: 50 },
      { name: "High Pass", op: "highPass", intensity: 50 },
      { name: "Box Blur", op: "boxBlur", intensity: 30 },
      { name: "Median", op: "median", intensity: 50 },
    ],
  },
  {
    name: "Render",
    filters: [
      { name: "Clouds", op: "clouds", intensity: 100 },
      { name: "Difference Clouds", op: "differenceClouds", intensity: 100 },
      { name: "Fibers", op: "fibers", intensity: 50 },
      { name: "Lens Flare", op: "lensFlare", intensity: 60 },
    ],
  },
];
