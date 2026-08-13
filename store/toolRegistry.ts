import type { ToolId } from "@/types/editor";

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: string;
  shortcut: string;
}

export const tools: ToolDef[] = [
  { id: "move", name: "Move Tool", icon: "move", shortcut: "V" },
  { id: "select", name: "Select Tool", icon: "select", shortcut: "A" },
  { id: "marquee", name: "Marquee Tool", icon: "marquee", shortcut: "M" },
  { id: "lasso", name: "Lasso Tool", icon: "lasso", shortcut: "L" },
  { id: "polygonalLasso", name: "Polygonal Lasso", icon: "lasso", shortcut: "Shift+L" },
  { id: "magneticLasso", name: "Magnetic Lasso", icon: "lasso", shortcut: "Shift+L" },
  { id: "wand", name: "Magic Wand", icon: "wand", shortcut: "W" },
  { id: "brush", name: "Brush Tool", icon: "brush", shortcut: "B" },
  { id: "pencil", name: "Pencil Tool", icon: "pencil", shortcut: "N" },
  { id: "eraser", name: "Eraser Tool", icon: "eraser", shortcut: "E" },
  { id: "heal", name: "Healing Brush", icon: "heal", shortcut: "J" },
  { id: "clone", name: "Clone Stamp", icon: "clone", shortcut: "S" },
  { id: "spotHeal", name: "Spot Healing", icon: "spotHeal", shortcut: "J" },
  { id: "text", name: "Text Tool", icon: "text", shortcut: "T" },
  { id: "vText", name: "Vertical Type", icon: "vText", shortcut: "Shift+T" },
  { id: "shape", name: "Shape Tool", icon: "shape", shortcut: "U" },
  { id: "pen", name: "Pen Tool", icon: "pen", shortcut: "P" },
  { id: "bucket", name: "Bucket Tool", icon: "bucket", shortcut: "K" },
  { id: "gradient", name: "Gradient Tool", icon: "gradient", shortcut: "G" },
  { id: "crop", name: "Crop Tool", icon: "crop", shortcut: "C" },
  { id: "zoom", name: "Zoom Tool", icon: "zoom", shortcut: "Z" },
  { id: "hand", name: "Hand Tool", icon: "hand", shortcut: "H" },
  { id: "color", name: "Eyedropper", icon: "color", shortcut: "I" },
  { id: "dodge", name: "Dodge Tool", icon: "dodge", shortcut: "O" },
  { id: "burn", name: "Burn Tool", icon: "burn", shortcut: "O" },
  { id: "sponge", name: "Sponge Tool", icon: "sponge", shortcut: "O" },
  { id: "smudge", name: "Smudge Tool", icon: "smudge", shortcut: "R" },
  { id: "sharpen", name: "Sharpen Tool", icon: "sharpen", shortcut: "R" },
  { id: "blur", name: "Blur Tool", icon: "blur", shortcut: "J" },
  { id: "brightness", name: "Brightness", icon: "brightness", shortcut: "Y" },
  { id: "quickMask", name: "Quick Mask", icon: "quickMask", shortcut: "Q" },
  { id: "measure", name: "Measure Tool", icon: "measure", shortcut: "K" },
  { id: "slice", name: "Slice Tool", icon: "slice", shortcut: "K" },
  { id: "frame", name: "Frame Tool", icon: "frame", shortcut: "K" },
  { id: "liquify", name: "Liquify", icon: "liquify", shortcut: "L" },
  { id: "textOnPath", name: "Text on Path", icon: "textOnPath", shortcut: "Shift+T" },
  { id: "magicEraser", name: "Magic Eraser", icon: "eraser", shortcut: "E" },
  { id: "backgroundEraser", name: "Background Eraser", icon: "eraser", shortcut: "E" },
  { id: "colorReplacement", name: "Color Replacement", icon: "brush", shortcut: "B" },
  { id: "historyBrush", name: "History Brush", icon: "brush", shortcut: "Y" },
  { id: "artHistoryBrush", name: "Art History Brush", icon: "brush", shortcut: "Y" },
  { id: "mixerBrush", name: "Mixer Brush", icon: "brush", shortcut: "B" },
  { id: "patternStamp", name: "Pattern Stamp", icon: "clone", shortcut: "S" },
  { id: "patch", name: "Patch Tool", icon: "heal", shortcut: "J" },
  { id: "redEye", name: "Red Eye Tool", icon: "heal", shortcut: "J" },
  { id: "quickSelection", name: "Quick Selection", icon: "wand", shortcut: "W" },
  { id: "refineEdge", name: "Refine Edge Brush", icon: "wand", shortcut: "R" },
  { id: "objectSelection", name: "Object Selection", icon: "wand", shortcut: "W" },
  { id: "rotateView", name: "Rotate View", icon: "hand", shortcut: "R" },
  { id: "notes", name: "Notes Tool", icon: "text", shortcut: "I" },
  { id: "count", name: "Count Tool", icon: "measure", shortcut: "I" },
];

export default tools;