// RAW & HEIC Develop — kaypaint plugin (formats-raw)
// RAW-style develop pipeline for the active image layer: exposure, white
// balance, highlights/shadows, vibrance and sharpening, applied locally via
// canvas.readPixels / canvas.writePixels.

(function () {
  var PANEL_ID = "formats-raw-panel";
  var state = { exposure: 0, temp: 0, tint: 0, highlights: 0, shadows: 0, vibrance: 100, sharpen: 0 };

  function clamp255(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("RAW Develop: select an image layer first", "warning");
      return;
    }
    var w = img.width, h = img.height;
    var out = img.data.slice();

    var gain = Math.pow(2, state.exposure);
    var tempGainR = 1 + state.temp * 0.12;
    var tempGainB = 1 - state.temp * 0.12;
    var tintGainG = 1 - state.tint * 0.08; // +tint = magenta (less green)
    var tintR = 1 + state.tint * 0.06;
    var tintB = 1 + state.tint * 0.06;
    var hl = state.highlights / 100;
    var sh = state.shadows / 100;
    var vibrance = state.vibrance / 100;

    for (var i = 0; i < out.length; i += 4) {
      var r = out[i] * gain * tempGainR * tintR;
      var g = out[i + 1] * gain * tintGainG;
      var b = out[i + 2] * gain * tempGainB * tintB;

      var lum = 0.299 * r + 0.587 * g + 0.114 * b;
      var t = lum / 255;
      // Smooth (quadratic) highlight roll-off and shadow lift — no banding.
      if (hl > 0 && t > 0.4) {
        var kh = ((t - 0.4) / 0.6) * ((t - 0.4) / 0.6);
        var amt = hl * kh;
        r = r * (1 - amt * 0.42) + lum * amt * 0.1;
        g = g * (1 - amt * 0.42) + lum * amt * 0.1;
        b = b * (1 - amt * 0.42) + lum * amt * 0.1;
      }
      if (sh > 0 && t < 0.6) {
        var ks = ((0.6 - t) / 0.6) * ((0.6 - t) / 0.6);
        var amt2 = sh * ks;
        r += (255 - r) * amt2 * 0.35;
        g += (255 - g) * amt2 * 0.35;
        b += (255 - b) * amt2 * 0.35;
      }

      // vibrance: boost saturation of muted pixels
      if (vibrance !== 1) {
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var sat = mx === 0 ? 0 : (mx - mn) / mx;
        var boost = 1 + (vibrance - 1) * (1 - sat);
        var aLum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = aLum + (r - aLum) * boost;
        g = aLum + (g - aLum) * boost;
        b = aLum + (b - aLum) * boost;
      }

      out[i] = clamp255(r);
      out[i + 1] = clamp255(g);
      out[i + 2] = clamp255(b);
    }

    if (state.sharpen > 0) {
      var amt = state.sharpen / 100 * 1.2;
      var copy = out.slice();
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var cIdx = y * w + x;
          var o = cIdx * 4;
          for (var ch = 0; ch < 3; ch++) {
            var center = copy[o + ch];
            var blur =
              (copy[(cIdx - w - 1) * 4 + ch] + copy[(cIdx - w) * 4 + ch] + copy[(cIdx - w + 1) * 4 + ch] +
               copy[(cIdx - 1) * 4 + ch] + copy[(cIdx + 1) * 4 + ch] +
               copy[(cIdx + w - 1) * 4 + ch] + copy[(cIdx + w) * 4 + ch] + copy[(cIdx + w + 1) * 4 + ch]) / 8;
            out[o + ch] = clamp255(center + (center - blur) * amt);
          }
        }
      }
    }

    api.canvas.writePixels({ width: w, height: h, data: out }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("RAW develop applied (exposure " + state.exposure + " EV)", "info");
      } else {
        api.ui.showNotification("RAW Develop: could not write pixels", "error");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>EXPOSURE — " + state.exposure.toFixed(1) + " EV</label>" +
      "<input type='range' data-plugin-action='exposure' min='-20' max='20' step='1' value='" + state.exposure * 10 + "' class='w-full accent-emerald-400' />" +
      "<label class='block text-[10px] text-gray-500 mt-1 mb-1'>WHITE BALANCE — " + (state.temp > 0 ? "warm" : state.temp < 0 ? "cool" : "neutral") + "</label>" +
      "<input type='range' data-plugin-action='temp' min='-10' max='10' step='1' value='" + state.temp * 10 + "' class='w-full accent-emerald-400' />" +
      "<label class='block text-[10px] text-gray-500 mt-1 mb-1'>TINT — " + (state.tint > 0 ? "magenta" : state.tint < 0 ? "green" : "neutral") + "</label>" +
      "<input type='range' data-plugin-action='tint' min='-10' max='10' step='1' value='" + state.tint * 10 + "' class='w-full accent-emerald-400' />" +
      "<label class='block text-[10px] text-gray-500 mt-1 mb-1'>HIGHLIGHTS — " + state.highlights + "</label>" +
      "<input type='range' data-plugin-action='highlights' min='0' max='100' step='5' value='" + state.highlights + "' class='w-full accent-emerald-400' />" +
      "<label class='block text-[10px] text-gray-500 mt-1 mb-1'>SHADOWS — " + state.shadows + "</label>" +
      "<input type='range' data-plugin-action='shadows' min='0' max='100' step='5' value='" + state.shadows + "' class='w-full accent-emerald-400' />" +
      "<label class='block text-[10px] text-gray-500 mt-1 mb-1'>VIBRANCE — " + state.vibrance + "</label>" +
      "<input type='range' data-plugin-action='vibrance' min='50' max='150' step='5' value='" + state.vibrance + "' class='w-full accent-emerald-400' />" +
      "<label class='block text-[10px] text-gray-500 mt-1 mb-1'>SHARPEN — " + state.sharpen + "</label>" +
      "<input type='range' data-plugin-action='sharpen' min='0' max='100' step='5' value='" + state.sharpen + "' class='w-full accent-emerald-400' />" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Develop</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "RAW Develop", html);
  }

  function num(v) { return parseInt(v, 10) || 0; }

  api.ui.onPanelAction(PANEL_ID, "exposure", function (v) { state.exposure = num(v) / 10; render(); });
  api.ui.onPanelAction(PANEL_ID, "temp", function (v) { state.temp = num(v) / 10; render(); });
  api.ui.onPanelAction(PANEL_ID, "tint", function (v) { state.tint = num(v) / 10; render(); });
  api.ui.onPanelAction(PANEL_ID, "highlights", function (v) { state.highlights = num(v); render(); });
  api.ui.onPanelAction(PANEL_ID, "shadows", function (v) { state.shadows = num(v); render(); });
  api.ui.onPanelAction(PANEL_ID, "vibrance", function (v) { state.vibrance = num(v); render(); });
  api.ui.onPanelAction(PANEL_ID, "sharpen", function (v) { state.sharpen = num(v); render(); });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);

  render();

  api.ui.addToolbarButton({
    id: "formats-raw-apply",
    tooltip: "RAW Develop",
    icon: "Sun",
    onClick: apply,
  });
})();