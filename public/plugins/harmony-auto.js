// Auto Palette Generator — kaypaint plugin (harmony-auto)
// Generate harmonious color palettes from a seed color, in-sandbox.

(function () {
  var PANEL_ID = "harmony-auto-panel";

  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rgbToHex(r, g, b) {
    function c(v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }
    return "#" + c(r) + c(g) + c(b);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
  }

  var SCHEMES = {
    "Complementary": [0, 180],
    "Analogous": [0, 30, 60],
    "Triadic": [0, 120, 240],
    "Tetradic": [0, 90, 180, 270],
  };

  function swatch(hex, label) {
    return "<div class='flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5'>" +
      "<span class='w-6 h-6 rounded border border-white/20 shrink-0' style='background:" + hex + "'></span>" +
      "<span class='flex-1'><span class='block text-xs text-gray-100'>" + label + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + hex + "</span></span>" +
      "</div>";
  }

  function generate(hex) {
    var rgb = hexToRgb(hex) || [64, 120, 220];
    var [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var scheme = "Complementary";
    storage.get("auto.scheme").then(function (saved) {
      if (saved && SCHEMES[saved]) scheme = saved;
      var offsets = SCHEMES[scheme];
      var html = "<p class='text-gray-400 mb-2'>" + scheme + " palette from " + hex + "</p>" +
        "<input data-plugin-action='seed' type='color' value='" + hex + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
        "<div class='flex gap-2 mt-2'>" +
        Object.keys(SCHEMES).map(function (k) {
          return "<button data-plugin-action='scheme-" + k + "' class='flex-1 py-1.5 rounded-md text-[11px] border transition-colors " + (k === scheme ? "bg-indigo-500/25 border-indigo-400/40 text-indigo-200" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10") + "'>" + k + "</button>";
        }).join("") +
        "</div><div class='mt-2 space-y-1'>" +
        offsets.map(function (off, i) {
          var p = hslToRgb(h + off, Math.min(1, Math.max(0, s + (i % 2) * 0.08)), Math.min(0.9, Math.max(0.1, l + ((i * 2) % 3) * 0.06)));
          return swatch(rgbToHex(p[0], p[1], p[2]), "Tone " + (i + 1));
        }).join("") +
        "</div>";
      api.ui.createPanel(PANEL_ID, "Auto Palette Generator", "<div class='space-y-1.5'>" + html + "</div>");
    });
  }

  api.ui.onPanelAction(PANEL_ID, "seed", function (value) {
    if (value) {
      storage.set("auto.seed", value);
      generate(value);
    }
  });

  Object.keys(SCHEMES).forEach(function (k) {
    api.ui.onPanelAction(PANEL_ID, "scheme-" + k, function () {
      storage.set("auto.scheme", k);
      storage.get("auto.seed").then(function (seed) { generate(seed || "#4088dc"); });
    });
  });

  storage.get("auto.seed").then(function (seed) { generate(seed || "#4088dc"); });

  api.ui.addToolbarButton({
    id: "harmony-auto-open",
    tooltip: "Auto Palette Generator",
    icon: "Blend",
    onClick: function () {
      storage.get("auto.seed").then(function (seed) { generate(seed || "#4088dc"); });
    },
  });
})();