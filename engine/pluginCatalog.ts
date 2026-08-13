export type PluginPrice = { kind: "once"; amount: number } | { kind: "sub"; monthly: number };

export interface PluginDef {
  id: string;
  name: string;
  category: string;
  price: PluginPrice;
  tagline: string;
  features: string[];
  popular?: boolean;
}

export interface PluginCategory {
  id: string;
  label: string;
  icon: string;
}

export const PLUGIN_CATEGORIES: PluginCategory[] = [
  { id: "filters", label: "Filter Packs", icon: "Filter" },
  { id: "vfx", label: "VFX Packs", icon: "Zap" },
  { id: "luts", label: "LUT & Grade", icon: "Palette" },
  { id: "brushes", label: "Brush Packs", icon: "Brush" },
  { id: "textures", label: "Textures & Patterns", icon: "Grid3x3" },
  { id: "styles", label: "Layer Styles", icon: "Droplets" },
  { id: "workflows", label: "Workflows", icon: "ListChecks" },
  { id: "automation", label: "Automation", icon: "Cpu" },
  { id: "export", label: "Export Modules", icon: "Download" },
  { id: "templates", label: "Templates", icon: "LayoutTemplate" },
  { id: "tools", label: "Tool Additions", icon: "PenTool" },
  { id: "ai", label: "AI Add-ons", icon: "Brain" },
  { id: "formats", label: "Format Support", icon: "FileText" },
  { id: "pro-presets", label: "Pro Presets", icon: "BookMarked" },
  { id: "widgets", label: "Widgets & Data", icon: "Calculator" },
  { id: "batch", label: "Batch Processing", icon: "Workflow" },
  { id: "mockups", label: "Mockups", icon: "Shirt" },
  { id: "asset", label: "Asset Management", icon: "FolderOpen" },
  { id: "harmony", label: "Color Tools", icon: "Blend" },
  { id: "dev", label: "Export for Dev", icon: "Code" },
  { id: "type", label: "Typography Tools", icon: "Type" },
  { id: "3d", label: "3D Add-ons", icon: "Box" },
  { id: "collab", label: "Collaboration", icon: "MessagesSquare" },
  { id: "retouch", label: "Retouch Kits", icon: "Wand2" },
  { id: "prepress", label: "Print Prepress", icon: "Printer" },
  { id: "pattern", label: "Pattern Designer", icon: "Shapes" },
  { id: "scripts", label: "Scripts & Actions", icon: "Play" },
  { id: "illustrator", label: "Illustrator Tools", icon: "PenLine" },
  { id: "video", label: "Video Editing", icon: "Video" },
];

const once = (amount: number): PluginPrice => ({ kind: "once", amount });
const sub = (monthly: number): PluginPrice => ({ kind: "sub", monthly });

function p(
  id: string,
  name: string,
  category: string,
  price: PluginPrice,
  tagline: string,
  features: string[],
  popular = false
): PluginDef {
  return { id, name, category, price, tagline, features, popular };
}

export const PLUGIN_CATALOG: PluginDef[] = [
  // Filter packs
  p("filters-glitch", "Glitch Pack", "filters", once(9.99), "10 glitch effects: RGB shift, scanlines, datamosh, VHS noise.", ["RGB split & shift distortion", "Scanlines, datamosh and VHS artifacts", "Static glitch bursts with seed control"]),
  p("filters-watercolor", "Watercolor Pack", "filters", once(9.99), "Painterly bleed, bloom and paper texture blending.", ["Paint bleed with wet-edge effects", "Paper texture blend modes", "Wash intensity presets"]),
  p("filters-halftone", "Halftone Pack", "filters", once(9.99), "Dot, line and burst screens for comics and print.", ["Dot, line and burst screening", "Per-channel screen angles", "Print-ready density presets"]),
  p("filters-ink", "Ink Sketch Pack", "filters", once(9.99), "Sketch, crosshatch and ink wash illustration looks.", ["Pencil sketch converter", "Crosshatch with density control", "Ink wash bleeding styles"]),
  p("filters-pixelart", "Pixel Art Pack", "filters", once(9.99), "Retro pixelation styles with indexed palettes.", ["Bayer & ordered dithering", "Indexed retro palettes", "Pixel scale preview"]),
  p("filters-oil", "Oil Paint Pack", "filters", once(9.99), "Impasto brushstroke rendering of any image.", ["Impasto stroke direction control", "Palette knife style", "Paint thickness depth"]),
  p("filters-cartoon", "Cartoon Pack", "filters", once(9.99), "Cel shading, edge tones and comic inking.", ["Cel shading with threshold", "Edge tone outlining", "Flat color quantization"]),

  // VFX
  p("vfx-glow", "Glow & Bloom", "vfx", once(9.99), "Cinematic glow, bloom and neon halo effects.", ["High-pass bloom with threshold", "Neon halo and aura modes", "Super-8 halation"]),
  p("vfx-chromatic", "Chromatic Aberration", "vfx", once(9.99), "Lens-style RGB fringe and dispersion.", ["Radial & linear fringe", "Edge dispersion falloff", "Lens warp pairing"]),
  p("vfx-lightleaks", "Light Leaks", "vfx", once(9.99), "Film light leaks, flares and lens burns.", ["Procedural leak shapes", "Animated leak generator", "Overlay blend presets"]),
  p("vfx-grain", "Film Grain", "vfx", once(9.99), "Authentic film grain with size, luma and chroma control.", ["Perceptual grain engine", "Luma/color/scanline grain", "Match to film stocks"]),
  p("vfx-particles", "Particles", "vfx", once(9.99), "Dust, snow, embers and bokeh particle overlays.", ["Dust, snow, ember and bokeh kits", "Wind & gravity simulation", "Frozen-frame particle paint"]),
  p("vfx-godrays", "God Rays", "vfx", once(9.99), "Volumetric light shafts from any light source.", ["Radial volumetric shafts", "Source point & falloff control", "Atmospheric haze pairing"]),
  p("vfx-anaglyph", "Anaglyph 3D", "vfx", once(9.99), "True red/cyan 3D depth effects.", ["Depth-map driven parallax", "Red/cyan color optics", "Out-of-screen strength"]),

  // LUTs
  p("luts-film", "Film Emulation", "luts", once(4.99), "Kodak, Fuji and Cinestill look LUTs with grain pairing.", ["Kodak & Fuji stock curves", "Cinestill halation look", "Print film toe & shoulder"]),
  p("luts-tealorange", "Teal & Orange", "luts", once(4.99), "Blockbuster teal-and-orange contrast grades.", ["Skin-safe orange saturator", "Teal shadow rolloff", "Subtle to heavy variants"]),
  p("luts-dreamy", "Dreamy Grade", "luts", once(4.99), "Pastel, airy and romantic washed grades.", ["Pastel lift presets", "Soft matte contrast", "Glow-weighted highlights"]),
  p("luts-bw", "Fine-Art B&W", "luts", once(4.99), "Zone-system black & white with toning options.", ["Zone system exposure mapping", "Split-toned silver & selenium", "Paper texture pairings"]),

  // Brushes
  p("brushes-splatter", "Splatter Brushes", "brushes", once(4.99), "20 dynamic ink and paint splatter brushes.", ["Dynamic splatter physics", "Drip & streak variants", "Pressure-aware scatter"]),
  p("brushes-hair", "Hair & Fur Brushes", "brushes", once(4.99), "Realistic strand, fur and eyebrow brushes.", ["Strand clustering engine", "Directional fur strokes", "Whisker & lash detail set"]),
  p("brushes-foliage", "Foliage Brushes", "brushes", once(4.99), "Leaves, grass, branches and flowers brush pack.", ["Leaf cluster brushes", "Grass wind presets", "Branch stroke library"]),
  p("brushes-chalk", "Chalk & Pastel", "brushes", once(4.99), "Soft chalk, pastel and charcoal textures.", ["Paper-grain dusting", "Blendable pastel strokes", "Charcoal smudge tip"]),
  p("brushes-calligraphy", "Calligraphy Set", "brushes", once(4.99), "Flat-nib, brush and flex pen calligraphy tools.", ["Flat-nib angle control", "Brush flex dynamics", "Copperplate flourish set"]),

  // Textures
  p("textures-canvas", "Canvas & Paper", "textures", once(4.99), "50+ real canvas, watercolor and bristol textures.", ["Studio-scanned surfaces", "Opacity & scale controls", "Render-to-layer support"]),
  p("textures-metal", "Rust & Metal", "textures", once(4.99), "Weathered metal, rust and brushed surfaces.", ["Rust corrosion generators", "Brushed steel anisotropy", "Scratches & dents overlays"]),
  p("textures-seamless", "Seamless Patterns Vol.1", "textures", once(4.99), "80 seamless geometric and organic patterns.", ["80 tileable pattern sets", "Recolor engine", "Brick, hex & drop layouts"]),
  p("textures-grunge", "Grunge & Grain", "textures", once(4.99), "Grungy overlays, dirt and scratch layers.", ["Scanned grunge plates", "Overlay strength control", "Dust & dirt scatter"]),

  // Styles
  p("styles-chrome", "Chrome Styles", "styles", once(4.99), "20 metallic chrome layer style presets.", ["Chrome, gold and titanium", "Environment reflection maps", "Bevel depth controls"]),
  p("styles-glass", "Glass & Frosted", "styles", once(4.99), "Frosted glass, refraction and liquid styles.", ["Frosted blur refraction", "Edge highlight lightwrap", "Liquid droplet overlay"]),
  p("styles-neon", "Neon Text Styles", "styles", once(4.99), "Glowing neon sign styles with flicker.", ["Neon tube glow physics", "Flicker & buzz animation", "Glass tube reflections"]),
  p("styles-buttons", "Beveled Button Kit", "styles", once(4.99), "UI-grade beveled and glossy button styles.", ["Glossy & matte bevels", "Pressed-state styles", "Icon emboss presets"]),

  // Workflows
  p("workflows-social", "Social Export Set", "workflows", once(9.99), "One-click multi-size export for all social platforms.", ["12 platform size presets", "Safe-area cropping", "Filename auto-tagging"]),
  p("workflows-print", "Print Prep Batch", "workflows", once(9.99), "Flatten, convert to CMYK and export print batches.", ["Flatten & smart object bake", "CMYK separation check", "Bleed & trim mark insertion"]),

  // Automation
  p("automation-rename", "Batch Rename Suite", "automation", once(9.99), "Rename layers, groups and docs with templates.", ["Numbering & case templates", "Find/replace tokens", "Dry-run preview"]),
  p("automation-organizer", "Layer Organizer", "automation", once(9.99), "Auto-group, sort and color-tag your layers.", ["Auto-group by naming prefix", "Sort by type/size", "Recolor tag engine"]),

  // Export
  p("export-cropmarks", "Crop Marks & Bleed", "export", once(9.99), "Professional bleed, crop and registration marks.", ["Standard & cool-white marks", "Bleed-aware export", "Slug space control"]),
  p("export-sprite", "Sprite Sheet Exporter", "export", once(9.99), "Grid sprites to sheets for game engines.", ["Uniform & packed layouts", "Frame padding options", "JSON metadata output"]),

  // Templates
  p("templates-social", "Social Post Templates", "templates", once(9.99), "60+ editable social media layouts.", ["Instagram, TikTok, X formats", "10 design style kits", "Editable smart layers"]),
  p("templates-youtube", "YouTube Thumbnail Kit", "templates", once(9.99), "High-CTR thumbnail designs with face zones.", ["Bold typography layouts", "Safe title zones", "Clickbait color presets"]),
  p("templates-cards", "Business Card Kit", "templates", once(9.99), "Modern business card layouts with print setup.", ["12 industry styles", "Bleed-ready templates", "QR placement zones"]),
  p("templates-poster", "Poster & Flyer Bundle", "templates", once(9.99), "Posters, flyers and event art layouts.", ["25 print formats A3-A6", "Festival & retail styling", "Type hierarchy presets"]),

  // Tools
  p("tools-isometric", "Isometric Grid Tool", "tools", once(4.99), "Draw and snap in perfect isometric perspective.", ["30/60/90 grid engine", "Isometric shape shortcuts", "Object snapping"]),
  p("tools-perspective", "Perspective Guide Tool", "tools", once(4.99), "1/2/3-point perspective rulers.", ["Vanishing point rulers", "Perspective ellipse guides", "Per-object snap planes"]),
  p("tools-gradientmesh", "Gradient Mesh Tool", "tools", once(4.99), "Vector-style gradient mesh fills.", ["Mesh point editing", "Smooth color interpolation", "Export to shapes"]),
  p("tools-qr", "QR Code Generator", "tools", once(1.99), "Generate styled QR codes on canvas.", ["URL / text / Wi-Fi QR", "Logo embedding", "Error correction levels"]),
  p("tools-barcode", "Barcode Generator", "tools", once(1.99), "EAN, UPC and Code128 barcodes.", ["Multiple symbologies", "Check-digit validation", "Print resolution safe"]),

  // AI
  p("ai-upscaler", "Neural Upscaler", "ai", sub(4.99), "AI super-resolution up to 4x with detail recovery.", ["SRGAN-based 2x/4x upscale", "Face detail recovery", "Batch folder support"]),
  p("ai-eraser", "Object Eraser", "ai", sub(4.99), "AI object removal with content-aware fill.", ["Tap-to-remove objects", "Content-aware inpaint", "Edge-aware refinement"]),
  p("ai-background", "Background Remover", "ai", sub(4.99), "One-click subject cutout for portraits & product.", ["Person & product matting", "Hair-level edge detail", "Feather & shrink controls"]),
  p("ai-texttoimage", "Text-to-Image", "ai", sub(4.99), "Generate images from prompts inside kaypaint.", ["Prompt-to-canvas generation", "Style & aspect controls", "Variation batches"]),

  // Formats
  p("formats-raw", "RAW & HEIC Import", "formats", once(4.99), "Open camera RAW and HEIC photos natively.", ["CR2/NEF/ARW decode", "HEIC/HEIF support", "Exposure & WB preview"]),
  p("formats-psd", "Deep PSD Importer", "formats", once(4.99), "Advanced PSD/PSB import: styles, masks, clipping.", ["Layer style fidelity", "Vector mask import", "Clipping group support"]),

  // Pro presets
  p("presets-pantone", "Pantone Palettes", "pro-presets", once(4.99), "Coated & uncoated Pantone color books.", ["Full PMS coated grid", "Nearest-color matching", "Spot color preview"]),
  p("presets-print", "Print DPI & PDF-X Presets", "pro-presets", once(4.99), "One-click print-ready document presets.", ["300/600 dpi setups", "PDF/X-1a & X-4 export", "Paper size library"]),

  // Widgets
  p("widgets-typography", "Typography Scale", "widgets", once(1.99), "Modular type scale calculator panel.", ["Perfect fourth/fifth scales", "Line-height pairing", "Copy-to-text presets"]),
  p("widgets-contrast", "Color Contrast Checker", "widgets", once(1.99), "WCAG AA/AAA contrast checking on the fly.", ["Live pair testing", "AA/AAA compliance chips", "Suggested fixes"]),

  // Batch
  p("batch-filters", "Batch Filter Runner", "batch", once(9.99), "Apply any filter or adjustment to many images.", ["Queue of 250+ docs", "Filter chain presets", "Unified undo"]),
  p("batch-resize", "Bulk Resize & Convert", "batch", once(9.99), "Resize, convert and rename whole folders.", ["Dimension & DPI presets", "PNG/JPG/WebP/AVIF targets", "Metadata stripping"]),

  // Mockups
  p("mockups-product", "Product Mockup Studio", "mockups", once(9.99), "Wrap designs into shirts, mugs, phones and boxes.", ["Smart warp projection", "Lighting & shadow control", "30 product templates"]),
  p("mockups-social", "Social Mockup Frames", "mockups", once(9.99), "Device frames for portfolio-ready posts.", ["Phone, laptop & tablet frames", "Ambient scene backdrops", "4K export"]),

  // Asset
  p("asset-manager", "Project Asset Manager", "asset", once(1.99), "Collect fonts, colors and assets per project.", ["Auto-collect linked assets", "Project packaging", "Import/export bundles"]),
  p("asset-library", "Font & Palette Library", "asset", once(1.99), "Personal library for fonts and palettes.", ["Tagged font browser", "Palette collections", "Sync via copy/paste"]),

  // Harmony
  p("harmony-auto", "Auto Palette Generator", "harmony", once(1.99), "Extract harmonious palettes from images.", ["K-means color extraction", "Harmony rule engine", "Export to swatch panel"]),
  p("harmony-accessible", "Accessible Harmonies", "harmony", once(1.99), "Generate color schemes that pass WCAG.", ["Contrast-filtered harmony", "Color-blind simulation", "Pair suggestions"]),

  // Dev
  p("dev-css", "CSS & Specs Exporter", "dev", once(9.99), "Copy styles as CSS, tokens and design specs.", ["CSS/LESS/Tailwind output", "Measurement annotations", "Figma-style specs view"]),
  p("dev-slices", "Slice & Responsive Preview", "dev", once(9.99), "Slice exports with responsive breakpoint preview.", ["Named slice regions", "Breakpoint previews", "Asset manifest export"]),

  // Typography
  p("type-variable", "Variable Font Panel", "type", once(9.99), "Slider control for variable font axes.", ["Weight/width/slant axes", "Axis presets & comparisons", "Live preview text"]),
  p("type-kerning", "Kerning Pairs Editor", "type", once(9.99), "Edit and export custom kerning pairs.", ["Pair editing over live text", "Class-based kerning", "Export kern tables"]),

  // 3D
  p("3d-bevel", "Bevel & Extrude", "3d", once(9.99), "True extrusion and bevel for shapes and text.", ["Depth & taper controls", "Phong lighting preview", "Bake to layer"]),
  p("3d-shadows", "Depth Shadow Suite", "3d", once(9.99), "Contact shadows, AO and depth-of-field blur.", ["Contact shadow generator", "Ambient occlusion bake", "Lens DOF simulation"]),

  // Collab
  p("collab-comments", "Comments & Review", "collab", once(29.99), "Pin comments on canvas and share review links.", ["Canvas pin comments", "Threaded discussion UI", "Resolve history"]),
  p("collab-versions", "Version Snapshots", "collab", once(29.99), "Time-travel through document snapshots.", ["Auto & manual snapshots", "Side-by-side compare", "One-click restore"]),

  // Retouch
  p("retouch-frequency", "Frequency Separation", "retouch", once(9.99), "Pro-grade skin retouching via frequency layers.", ["Dual-frequency split", "Color & texture isolation", "Healing brush pairing"]),
  p("retouch-dodgeburn", "Dodge & Burn Panel", "retouch", once(9.99), "Luminosity dodge and burn on separate layers.", ["Midtone-safe painting", "Opacity strength ramps", "Selective color burn"]),
  p("retouch-skin", "Skin Smoothing Suite", "retouch", once(9.99), "Natural skin softening with detail preservation.", ["Frequency-based smoothing", "Feature-aware masks", "Preset intensities"]),

  // Prepress
  p("prepress-imposition", "Imposition Layouts", "prepress", once(9.99), "Arrange pages for print sheets.", ["N-up & booklet layouts", "Crop & fold marks", "Sheet size calculator"]),
  p("prepress-spot", "Trapping & Spot Colors", "prepress", once(9.99), "Spot color handling and ink trapping.", ["Spot channel support", "Auto trap generation", "Overprint preview"]),
  p("prepress-flatten", "Flatten Checker", "prepress", once(9.99), "Detect flattening issues before printing.", ["Transparency risk scan", "Font outline warnings", "Resolution health report"]),

  // Pattern
  p("pattern-tile", "Seamless Tile Generator", "pattern", once(4.99), "Make any art tileable in one click.", ["Seam wrapping engine", "Edge bleed tools", "Export tile packs"]),
  p("pattern-live", "Live Pattern Preview", "pattern", once(4.99), "Preview patterns tiled across your canvas.", ["Real-time tiling preview", "Tile offset randomization", "Scale without crop"]),

  // Scripts
  p("scripts-recorder", "Action Recorder", "scripts", once(9.99), "Record kaypaint actions and replay them.", ["Full action capture", "Batch replay with prompts", "Conditional steps"]),
  p("scripts-library", "Shareable Script Library", "scripts", once(9.99), "Import community workflows and scripts.", ["Script format import", "Verified library browser", "One-click install"]),

  // Illustrator
  p("ai2-pen", "Vector Pen Suite", "illustrator", once(29.99), "Full pen tool with curves, anchor edits and path ops.", ["Pen/curvature tools", "Anchor & handle editing", "Path cleanup"]),
  p("ai2-pathfinder", "Pathfinder Panel", "illustrator", once(29.99), "Unite, minus, intersect and divide shapes.", ["Boolean path operations", "Shape builder preview", "Compound path output"]),
  p("ai2-shapebuilder", "Shape Builder Tool", "illustrator", once(29.99), "Merge and cut shapes by drawing over them.", ["Drag-to-merge regions", "Alt-click delete", "Live highlight"]),
  p("ai2-livepaint", "Live Paint", "illustrator", once(29.99), "Paint fills across overlapping paths.", ["Auto face detection", "Gap detection & closure", "Rekeyable fills"]),
  p("ai2-artboards", "Artboard System", "illustrator", once(29.99), "Multiple artboards with per-board export.", ["Up to 100 artboards", "Board reordering & rulers", "Per-board export sets"]),
  p("ai2-strokegradient", "Gradient on Stroke", "illustrator", once(29.99), "Color gradients along path strokes.", ["Along-path gradient mapping", "Stroke profile editing", "Angle & pitch controls"]),

  // Video
  p("video-timeline", "Video Timeline", "video", once(49.99), "Full frame timeline with layers and playback.", ["Layer-based timeline", "Playback & scrubbing", "Frame-accurate navigation"]),
  p("video-keyframes", "Keyframe Animator", "video", once(49.99), "Animate position, scale, opacity and filters.", ["Bezier eased keyframes", "Transform & filter tracks", "Motion preview"]),
  p("video-movielayers", "Movie Layer Support", "video", once(49.99), "Import video clips as editable movie layers.", ["MP4/WebM/MOV import", "Per-frame filter stacking", "Speed & trim controls"]),
  p("video-export", "Export Studio", "video", once(49.99), "Render timelines to mp4/webm with presets.", ["1080p/4K render presets", "Web & social profiles", "Frame-range rendering"]),
];

export const ALL_ACCESS = {
  id: "bundle",
  name: "All-Access Bundle",
  tagline: "Every plugin, every pack, every tool. One lifetime license, including future releases.",
  price: once(99.0),
  features: [
    "All 92 individual plugins included",
    "Free access to all future plugins",
    "AI add-ons included 6 months free",
    "Priority support & feature votes",
  ],
  icon: "Crown",
} as const;

export function formatPrice(price: PluginPrice): string {
  if (price.kind === "sub") return `$${price.monthly.toFixed(2)}/mo`;
  return `$${price.amount.toFixed(2)}`;
}