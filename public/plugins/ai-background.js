// Background Remover — kaypaint plugin (ai-background)
// One-click subject cutout: flood-fills the background from the image
// edges (adaptive color tolerance) and makes it transparent, via
// canvas.readPixels / canvas.writePixels.

(function () {
  var PANEL_ID = "ai-background-panel";
  var state = { tolerance: 30, feather: 1 };

  function colorDist(a, b) {
    var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("Background Remover: select an image layer first", "warning");
      return;
    }
    var w = img.width, h = img.height;
    var data = img.data;
    var tol = state.tolerance;

    function pxAt(x, y) {
      var i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    }

    // Sample border colors as seeds for flood fill
    var seeds = [];
    var i, x, y;
    for (x = 0; x < w; x++) {
      seeds.push(pxAt(x, 0));
      seeds.push(pxAt(x, h - 1));
    }
    for (y = 0; y < h; y++) {
      seeds.push(pxAt(0, y));
      seeds.push(pxAt(w - 1, y));
    }

    var bg = new Array(w * h);
    for (i = 0; i < w * h; i++) bg[i] = false;

    var queue = [];
    var qi = 0;
    for (x = 0; x < w; x++) {
      enqueue(x, 0, pxAt(x, 0));
      enqueue(x, h - 1, pxAt(x, h - 1));
    }
    for (y = 0; y < h; y++) {
      enqueue(0, y, pxAt(0, y));
      enqueue(w - 1, y, pxAt(w - 1, y));
    }

    function enqueue(x, y, seed) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      var idx = y * w + x;
      if (bg[idx]) return;
      if (colorDist(pxAt(x, y), seed) > tol) return;
      bg[idx] = true;
      queue.push([x, y, seed]);
    }

    while (qi < queue.length) {
      var cur = queue[qi++];
      var cx = cur[0], cy = cur[1], cseed = cur[2];
      enqueue(cx + 1, cy, cseed);
      enqueue(cx - 1, cy, cseed);
      enqueue(cx, cy + 1, cseed);
      enqueue(cx, cy - 1, cseed);
    }

    var feather = state.feather > 0 ? 1 : 0;
    var out = data.slice();
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var idx = y * w + x;
        if (bg[idx]) {
          var o = idx * 4;
          out[o + 3] = 0;
          if (feather) {
            var edge = false;
            if (x > 0 && !bg[idx - 1]) edge = true;
            else if (x < w - 1 && !bg[idx + 1]) edge = true;
            else if (y > 0 && !bg[idx - w]) edge = true;
            else if (y < h - 1 && !bg[idx + w]) edge = true;
            if (edge) out[o + 3] = 90;
          }
        }
      }
    }

    api.canvas.writePixels({ width: w, height: h, data: out }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Background removed (tolerance " + tol + ")", "info");
      } else {
        api.ui.showNotification("Background Remover: could not write pixels", "error");
      }
    });
  }

  function aiCutout() {
    var dataUrl = api.canvas.getDataURL("png");
    if (!dataUrl) {
      api.ui.showNotification("AI Cutout: canvas not available", "warning");
      return;
    }
    api.ui.showNotification("AI Cutout: removing the background…", "info");
    api.network.request("/api/gemini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "inpaint", prompt: "Remove the background completely, keep only the main subject with clean edges", imageBase64: dataUrl }),
    }).then(function (res) {
      if (!res || !res.ok) {
        api.ui.showNotification(
          res && res.status === 503
            ? "AI Cutout: AI not configured (GEMINI_API_KEY) — the local matting is still available"
            : "AI Cutout failed — the local matting is still available",
          "warning"
        );
        return;
      }
      var data = res.json();
      if (!data || !data.dataUrl) {
        api.ui.showNotification("AI Cutout: no result from the AI", "warning");
        return;
      }
      api.canvas.replaceActiveImage(data.dataUrl).then(function (ok) {
        api.ui.showNotification(
          ok ? "AI Cutout: background removed" : "AI Cutout: could not apply the result",
          ok ? "success" : "warning"
        );
      });
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>TOLERANCE — " + state.tolerance + "</label>" +
      "<input type='range' data-plugin-action='tolerance' min='5' max='90' step='5' value='" + state.tolerance + "' class='w-full accent-emerald-400 mb-2' />" +
      "<label class='block text-[10px] text-gray-500 mb-1'>EDGE FEATHER</label>" +
      "<select data-plugin-action='feather' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='0' " + (state.feather === 0 ? "selected" : "") + ">Off</option>" +
      "<option value='1' " + (state.feather === 1 ? "selected" : "") + ">Soft edge</option>" +
      "</select>" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Remove Background</span></button>" +
      "<button data-plugin-action='aiCutout' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 transition-colors'><span class='block text-gray-100 text-sm'>AI Cutout (Gemini)</span><span class='block text-[10px] text-gray-500'>Requires GEMINI_API_KEY</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Background Remover", html);
  }

  api.ui.onPanelAction(PANEL_ID, "tolerance", function (value) {
    var n = parseInt(value, 10);
    if (n >= 0) { state.tolerance = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "feather", function (value) {
    state.feather = value === "1" ? 1 : 0;
    render();
  });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);
  api.ui.onPanelAction(PANEL_ID, "aiCutout", aiCutout);

  render();

  api.ui.addToolbarButton({
    id: "ai-background-apply",
    tooltip: "Background Remover",
    icon: "Image",
    onClick: apply,
  });
})();