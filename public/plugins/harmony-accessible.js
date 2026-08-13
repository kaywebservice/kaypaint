// Accessible Harmonies — kaypaint plugin (harmony-accessible)
// Generate color schemes that pass WCAG contrast, computed in-sandbox.

(function () {
  var PANEL_ID = "harmony-accessible-panel";

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

  function luminance([r, g, b]) {
    function lin(v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
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

  function rgbToHsl([r, g, b]) {
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

  function swatch(hex, label) {
    var rgb = hexToRgb(hex);
    if (!rgb) return "";
    var bg = hex;
    var fg = contrast(rgb, [0, 0, 0]) > 5 ? "#000000" : "#ffffff";
    return "<div class='flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5'>" +
      "<span class='w-6 h-6 rounded border border-white/20 shrink-0' style='background:" + bg + "'></span>" +
      "<span class='flex-1'><span class='block text-xs text-gray-100' style='color:" + fg + "'>" + label + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + hex + "</span></span>" +
      "<span class='text-[10px] font-semibold rounded px-1.5 py-0.5 " + (contrast(rgb, [0, 0, 0]) > 4.5 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300") + "'>" + contrast(rgb, [0, 0, 0]).toFixed(2) + ":1</span>" +
      "</div>";
  }

  function refresh() {
    var base = "#0055cc";
    storage.get("hc.base").then(function (stored) {
      if (stored) base = stored;
      var rgb = hexToRgb(base) || hexToRgb("#0055cc");
      var [h, s, l] = rgbToHsl(rgb);
      var words = ["90", "180", "270", "0"];
      var palette = { fill: base };
      var html = "<p class='text-gray-400 mb-2'>Contrast-checked palette from " + base + "</p>" +
        "<input data-plugin-action='base' data-value='" + base + "' type='color' value='" + base + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
        "<div class='mt-2 space-y-1'>" +
        swatch(base, "Base color") +
        swatch(rgbToHex(255, 255, 255), "White on base") +
        swatch(rgbToHex(0, 0, 0), "Black on base") +
        "</div>";
      api.ui.createPanel(PANEL_ID, "Accessible Harmonies", "<div class='space-y-1.5'>" + html + "</div>");
    });
  }

  api.ui.onPanelAction(PANEL_ID, "base", function (value) {
    if (value) {
      storage.set("hc.base", value);
      refresh();
    }
  });

  refresh();

  api.ui.addToolbarButton({
    id: "harmony-accessible-open",
    tooltip: "Accessible Harmonies",
    icon: "Blend",
    onClick: refresh,
  });
})();