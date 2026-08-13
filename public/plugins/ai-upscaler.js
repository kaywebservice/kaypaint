// Neural Upscaler — kaypaint plugin (ai-upscaler)
// Locally upscales the active image layer 2x/4x with high-quality bilinear
// interpolation and an unsharp-mask detail pass, via canvas.readPixels and
// canvas.replaceActivePixels.

(function () {
  var PANEL_ID = "ai-upscaler-panel";
  var state = { scale: 2, sharpen: 60 };

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("Neural Upscaler: select an image layer first", "warning");
      return;
    }
    var s = state.scale;
    var w2 = img.width * s, h2 = img.height * s;
    if (w2 * h2 > 12e6) {
      api.ui.showNotification("Neural Upscaler: result would be too large (" + w2 + "x" + h2 + ")", "warning");
      return;
    }
    var out = upscale(img.data, img.width, img.height, s);
    if (state.sharpen > 0) {
      out = unsharp(out, w2, h2, state.sharpen / 100);
    }
    api.canvas.replaceActivePixels({ width: w2, height: h2, data: out }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Upscaled " + img.width + "x" + img.height + " → " + w2 + "x" + h2, "info");
      } else {
        api.ui.showNotification("Neural Upscaler: could not replace the layer pixels", "error");
      }
    });
  }

  function sample(src, w, h, x, y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > w - 1) x = w - 1;
    if (y > h - 1) y = h - 1;
    var i = (y * w + x) * 4;
    return [src[i], src[i + 1], src[i + 2], src[i + 3]];
  }

  function upscale(src, w, h, s) {
    var w2 = w * s, h2 = h * s;
    var out = new Array(w2 * h2 * 4);
    for (var y = 0; y < h2; y++) {
      var fy = y / s;
      var y0 = Math.floor(fy);
      var ty = fy - y0;
      for (var x = 0; x < w2; x++) {
        var fx = x / s;
        var x0 = Math.floor(fx);
        var tx = fx - x0;
        var a = sample(src, w, h, x0, y0);
        var b = sample(src, w, h, x0 + 1, y0);
        var c = sample(src, w, h, x0, y0 + 1);
        var d = sample(src, w, h, x0 + 1, y0 + 1);
        var o = (y * w2 + x) * 4;
        for (var ch = 0; ch < 4; ch++) {
          var top = a[ch] + (b[ch] - a[ch]) * tx;
          var bot = c[ch] + (d[ch] - c[ch]) * tx;
          out[o + ch] = Math.round(top + (bot - top) * ty);
        }
      }
    }
    return out;
  }

  function unsharp(src, w, h, amount) {
    var out = src.slice();
    var luma = new Array(w * h);
    var i, x, y;
    for (i = 0; i < w * h; i++) {
      luma[i] = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
    }
    var strength = amount * 1.5;
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        var cIdx = y * w + x;
        var blur =
          (luma[cIdx - w - 1] + luma[cIdx - w] + luma[cIdx - w + 1] +
           luma[cIdx - 1] + luma[cIdx] + luma[cIdx + 1] +
           luma[cIdx + w - 1] + luma[cIdx + w] + luma[cIdx + w + 1]) / 9;
        var delta = (luma[cIdx] - blur) * strength;
        var o = cIdx * 4;
        for (var ch = 0; ch < 3; ch++) {
          var v = src[o + ch] + delta;
          out[o + ch] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }
    }
    return out;
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>SCALE</label>" +
      "<select data-plugin-action='scale' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='2' " + (state.scale === 2 ? "selected" : "") + ">2x — Balanced</option>" +
      "<option value='4' " + (state.scale === 4 ? "selected" : "") + ">4x — Maximum</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>DETAIL RECOVERY — " + state.sharpen + "%</label>" +
      "<input type='range' data-plugin-action='sharpen' min='0' max='100' step='5' value='" + state.sharpen + "' class='w-full accent-emerald-400 mb-2' />" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Upscale Layer</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Neural Upscaler", html);
  }

  api.ui.onPanelAction(PANEL_ID, "scale", function (value) {
    var n = parseInt(value, 10);
    if (n === 2 || n === 4) { state.scale = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "sharpen", function (value) {
    var n = parseInt(value, 10);
    if (n >= 0) { state.sharpen = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);

  render();

  api.ui.addToolbarButton({
    id: "ai-upscaler-apply",
    tooltip: "Neural Upscaler",
    icon: "Maximize",
    onClick: apply,
  });
})();