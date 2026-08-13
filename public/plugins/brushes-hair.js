// Hair Brush — kaypaint plugin (brushes-hair)
// Paints fine parallel hair strands (with taper) onto the active layer
// via canvas.readPixels / canvas.writePixels.

(function () {
  var PANEL_ID = "brushes-hair-panel";
  var state = { color: "#3f2f22", size: 256, strength: 80 };

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function maskHair(s) {
    var alpha = new Array(s * s);
    var strands = Math.max(18, Math.round(s / 12));
    var spacing = s / strands;
    for (var ly = 0; ly < s; ly++) {
      for (var lx = 0; lx < s; lx++) {
        var a = 0;
        for (var k = 0; k < strands; k++) {
          // strand k runs diagonally; jitter the offset per strand (strand 0 sits on center)
          var off = k === 0 ? 0 : k * spacing + ((k * 7) % 5) - 2;
          var d = Math.abs((lx - ly) / Math.SQRT2 - off);
          var taper = (lx + ly) / (2 * (s - 1));
          var width = s * 0.008 + taper * s * 0.012;
          var band = 1 - d / (width + 0.0001);
          if (band < 0) band = 0;
          var strandA = band * band;
          if (strandA > a) a = strandA;
        }
        alpha[ly * s + lx] = Math.round(a * 255);
      }
    }
    return alpha;
  }

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("Hair Brush: select an image layer first", "warning");
      return;
    }
    var s = Math.min(state.size, img.width, img.height);
    if (s < 8) {
      api.ui.showNotification("Hair Brush: layer too small for this brush", "warning");
      return;
    }
    var rgb = hexToRgb(state.color);
    var alpha = maskHair(s);
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
        api.ui.showNotification("Hair strands painted (center " + s + "px)", "info");
      } else {
        api.ui.showNotification("Hair Brush: could not write pixels", "error");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>HAIR COLOR</label>" +
      "<input type='color' data-plugin-action='color' value='" + state.color + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>BRUSH SIZE</label>" +
      "<select data-plugin-action='size' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='128' " + (state.size === 128 ? "selected" : "") + ">128 px</option>" +
      "<option value='256' " + (state.size === 256 ? "selected" : "") + ">256 px</option>" +
      "<option value='512' " + (state.size === 512 ? "selected" : "") + ">512 px</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>OPACITY — " + state.strength + "%</label>" +
      "<input type='range' data-plugin-action='strength' min='20' max='100' step='5' value='" + state.strength + "' class='w-full accent-emerald-400' />" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Paint Strands</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Hair Brush", html);
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
    id: "brushes-hair-apply",
    tooltip: "Hair Brush",
    icon: "Brush",
    onClick: apply,
  });
})();