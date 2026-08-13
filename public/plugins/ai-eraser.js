// Object Eraser — kaypaint plugin (ai-eraser)
// Magic-wand style eraser: makes pixels similar to a chosen color
// transparent (with edge-aware tolerance), via canvas.readPixels /
// canvas.writePixels.

(function () {
  var PANEL_ID = "ai-eraser-panel";
  var state = { color: "#ffffff", tolerance: 40 };

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("Object Eraser: select an image layer first", "warning");
      return;
    }
    var w = img.width, h = img.height;
    var data = img.data;
    var target = hexToRgb(state.color);
    var tol = state.tolerance;
    var out = data.slice();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var dr = data[i] - target[0], dg = data[i + 1] - target[1], db = data[i + 2] - target[2];
        var d = Math.sqrt(dr * dr + dg * dg + db * db);
        if (d <= tol) {
          var t = d / tol;
          out[i + 3] = Math.round(255 * (t * t));
        }
      }
    }
    api.canvas.writePixels({ width: w, height: h, data: out }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Erased pixels matching the color (tolerance " + tol + ")", "info");
      } else {
        api.ui.showNotification("Object Eraser: could not write pixels", "error");
      }
    });
  }

  function aiErase() {
    var dataUrl = api.canvas.getDataURL("png");
    if (!dataUrl) {
      api.ui.showNotification("AI Erase: canvas not available", "warning");
      return;
    }
    api.ui.showNotification("AI Erase: asking the AI to remove the object…", "info");
    api.network.request("/api/gemini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "inpaint", prompt: "Remove the selected object and fill the area seamlessly", imageBase64: dataUrl }),
    }).then(function (res) {
      if (!res || !res.ok) {
        api.ui.showNotification(
          res && res.status === 503
            ? "AI Erase: AI not configured (GEMINI_API_KEY) — the local eraser is still available"
            : "AI Erase failed — the local eraser is still available",
          "warning"
        );
        return;
      }
      var data = res.json();
      if (!data || !data.dataUrl) {
        api.ui.showNotification("AI Erase: no result from the AI", "warning");
        return;
      }
      api.canvas.replaceActiveImage(data.dataUrl).then(function (ok) {
        api.ui.showNotification(
          ok ? "AI Erase: object removed" : "AI Erase: could not apply the result",
          ok ? "success" : "warning"
        );
      });
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>TARGET COLOR</label>" +
      "<input type='color' data-plugin-action='color' value='" + state.color + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer mb-2' />" +
      "<label class='block text-[10px] text-gray-500 mb-1'>TOLERANCE — " + state.tolerance + "</label>" +
      "<input type='range' data-plugin-action='tolerance' min='5' max='100' step='5' value='" + state.tolerance + "' class='w-full accent-emerald-400 mb-2' />" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Erase Color</span></button>" +
      "<button data-plugin-action='aiErase' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 transition-colors'><span class='block text-gray-100 text-sm'>AI Erase (Gemini)</span><span class='block text-[10px] text-gray-500'>Requires GEMINI_API_KEY</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Object Eraser", html);
  }

  api.ui.onPanelAction(PANEL_ID, "color", function (value) { if (value) state.color = value; });
  api.ui.onPanelAction(PANEL_ID, "tolerance", function (value) {
    var n = parseInt(value, 10);
    if (n >= 0) { state.tolerance = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);
  api.ui.onPanelAction(PANEL_ID, "aiErase", aiErase);

  render();

  api.ui.addToolbarButton({
    id: "ai-eraser-apply",
    tooltip: "Object Eraser",
    icon: "Eraser",
    onClick: apply,
  });
})();