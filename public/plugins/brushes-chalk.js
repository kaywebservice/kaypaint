// Chalk Brush — kaypaint plugin (brushes-chalk)
// Paints a rough, speckled chalk stroke onto the active layer via
// canvas.readPixels / canvas.writePixels.

(function () {
  var PANEL_ID = "brushes-chalk-panel";
  var state = { color: "#f8fafc", size: 256, strength: 75 };

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // Deterministic-ish speckle: hash(x,y) in [0,1]
  function speck(seed, x, y) {
    var n = seed + x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    n = n ^ (n >> 16);
    return ((n >>> 0) % 1000) / 1000;
  }

  function maskChalk(s) {
    var alpha = new Array(s * s);
    var band = s * 0.16;
    for (var ly = 0; ly < s; ly++) {
      for (var lx = 0; lx < s; lx++) {
        var d = Math.abs(lx - ly) / Math.SQRT2;
        var t = (lx + ly) / (2 * (s - 1));
        var edge = 1 - (d / (band + 0.001));
        if (edge < 0) edge = 0;
        edge = edge * edge;
        var r = speck(1234, lx, ly + Math.floor(t * 7));
        var coarse = r > 0.28 ? 1 : 0;
        var fine = r > 0.55 ? 1 : 0;
        var a = edge * (0.55 + 0.45 * fine) * coarse;
        alpha[ly * s + lx] = Math.round(a * 255);
      }
    }
    return alpha;
  }

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("Chalk Brush: select an image layer first", "warning");
      return;
    }
    var s = Math.min(state.size, img.width, img.height);
    if (s < 8) {
      api.ui.showNotification("Chalk Brush: layer too small for this brush", "warning");
      return;
    }
    var rgb = hexToRgb(state.color);
    var alpha = maskChalk(s);
    var strength = state.strength / 100;
    var x0 = Math.floor((img.width - s) / 2);
    var y0 = Math.floor((img.height - s) / 2);
    var out = img.data.slice();
    for (var ly = 0; ly < s; ly++) {
      for (var lx = 0; lx < s; lx++) {
        var a = (alpha[ly * s + lx] / 255) * strength;
        if (a <= 0.01) continue;
        var i = ((y0 + ly) * img.width + x0 + lx) * 4;
        out[i] = out[i] * (1 - a) + rgb[0] * a;
        out[i + 1] = out[i + 1] * (1 - a) + rgb[1] * a;
        out[i + 2] = out[i + 2] * (1 - a) + rgb[2] * a;
      }
    }
    api.canvas.writePixels({ width: img.width, height: img.height, data: out }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Chalk stroke painted (center " + s + "px)", "info");
      } else {
        api.ui.showNotification("Chalk Brush: could not write pixels", "error");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>CHALK COLOR</label>" +
      "<input type='color' data-plugin-action='color' value='" + state.color + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>TIP SIZE</label>" +
      "<select data-plugin-action='size' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='128' " + (state.size === 128 ? "selected" : "") + ">128 px</option>" +
      "<option value='256' " + (state.size === 256 ? "selected" : "") + ">256 px</option>" +
      "<option value='512' " + (state.size === 512 ? "selected" : "") + ">512 px</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>DENSITY — " + state.strength + "%</label>" +
      "<input type='range' data-plugin-action='strength' min='20' max='100' step='5' value='" + state.strength + "' class='w-full accent-emerald-400' />" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Paint Stroke</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Chalk Brush", html);
  }

  api.ui.onPanelAction(PANEL_ID, "color", function (value) { if (value) state.color = value; });
  api.ui.onPanelAction(PANEL_ID, "size", function (value) {
    var n = parseInt(value, 10);
    if (n >= 8) { state.size = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "strength", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) { state.strength = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);

  render();

  api.ui.addToolbarButton({
    id: "brushes-chalk-apply",
    tooltip: "Chalk Brush",
    icon: "Brush",
    onClick: apply,
  });
})();