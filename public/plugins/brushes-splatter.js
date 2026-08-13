// Splatter Brush — kaypaint plugin (brushes-splatter)
// Paints randomized ink splatter (blotches + droplets) onto the active
// layer via canvas.readPixels / canvas.writePixels.

(function () {
  var PANEL_ID = "brushes-splatter-panel";
  var state = { color: "#7c2d12", size: 256, strength: 75 };

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rnd(seed) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  }

  function maskSplatter(s) {
    var alpha = new Array(s * s);
    var blobs = [];
    var i;
    var main = Math.max(5, Math.round(s / 34));
    for (i = 0; i < main; i++) {
      blobs.push({
        x: s * 0.2 + rnd(i + 2) * s * 0.6,
        y: s * 0.2 + rnd(i + 9) * s * 0.6,
        r: s * (0.06 + rnd(i + 4) * 0.12),
        irr: 0.6 + rnd(i + 6) * 0.8,
      });
    }
    var drops = Math.max(14, Math.round(s / 10));
    for (i = 0; i < drops; i++) {
      blobs.push({
        x: s * 0.1 + rnd(i + 20) * s * 0.8,
        y: s * 0.1 + rnd(i + 30) * s * 0.8,
        r: s * (0.006 + rnd(i + 40) * 0.02),
        irr: 0.2,
      });
    }
    for (var ly = 0; ly < s; ly++) {
      for (var lx = 0; lx < s; lx++) {
        var a = 0;
        for (var b = 0; b < blobs.length; b++) {
          var bl = blobs[b];
          var dx = lx - bl.x;
          var dy = ly - bl.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var wob = bl.irr > 0.3 ? 1 + 0.18 * Math.sin(lx * 0.7 + ly * 1.3 + bl.r) : 1;
          var rr = bl.r * wob;
          if (rr < 1) continue;
          var shape = 1 - dist / rr;
          if (shape > 0) {
            var ba = shape * shape * (1 + 0.15 * Math.sin(lx * 3 + ly * 3.7));
            if (ba > 1) ba = 1;
            if (ba > a) a = ba;
          }
        }
        alpha[ly * s + lx] = Math.round(a * 255);
      }
    }
    return alpha;
  }

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("Splatter Brush: select an image layer first", "warning");
      return;
    }
    var s = Math.min(state.size, img.width, img.height);
    if (s < 16) {
      api.ui.showNotification("Splatter Brush: layer too small for this brush", "warning");
      return;
    }
    var rgb = hexToRgb(state.color);
    var alpha = maskSplatter(s);
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
        api.ui.showNotification("Splatter painted (center " + s + "px)", "info");
      } else {
        api.ui.showNotification("Splatter Brush: could not write pixels", "error");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>INK COLOR</label>" +
      "<input type='color' data-plugin-action='color' value='" + state.color + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>SPLATTER SIZE</label>" +
      "<select data-plugin-action='size' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='128' " + (state.size === 128 ? "selected" : "") + ">128 px</option>" +
      "<option value='256' " + (state.size === 256 ? "selected" : "") + ">256 px</option>" +
      "<option value='512' " + (state.size === 512 ? "selected" : "") + ">512 px</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>AMOUNT — " + state.strength + "%</label>" +
      "<input type='range' data-plugin-action='strength' min='20' max='100' step='5' value='" + state.strength + "' class='w-full accent-emerald-400' />" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Paint Splatter</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Splatter Brush", html);
  }

  api.ui.onPanelAction(PANEL_ID, "color", function (value) { if (value) state.color = value; });
  api.ui.onPanelAction(PANEL_ID, "size", function (value) {
    var n = parseInt(value, 10);
    if (n >= 16) { state.size = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "strength", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) { state.strength = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);

  render();

  api.ui.addToolbarButton({
    id: "brushes-splatter-apply",
    tooltip: "Splatter Brush",
    icon: "Brush",
    onClick: apply,
  });
})();