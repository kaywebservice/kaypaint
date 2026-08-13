// Gradient on Stroke — kaypaint plugin (ai2-strokegradient)
// Generates decorative paths whose strokes carry a color gradient along the
// path direction, inserted as SVG via the canvas.addSvg API.

(function () {
  var PANEL_ID = "ai2-strokegradient-panel";
  var state = { shape: "wave", start: "#6366f1", mid: "#22d3ee", end: "#a855f7", width: 12, dash: 0 };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function pathFor(shape, W, H) {
    var pts = [];
    var n = 80, i;
    if (shape === "wave") {
      for (i = 0; i <= n; i++) {
        var t = i / n;
        pts.push([t * W, H / 2 + Math.sin(t * Math.PI * 3) * H * 0.32]);
      }
    } else if (shape === "zigzag") {
      for (i = 0; i <= n; i++) {
        var t2 = i / n;
        var seg = Math.floor(t2 * 12);
        var phase = seg % 2 === 0 ? H * 0.22 : H * 0.78;
        pts.push([t2 * W, phase]);
      }
    } else if (shape === "loop") {
      var cx = W / 2, cy = H / 2;
      var steps = 360;
      for (i = 0; i <= steps; i++) {
        var a = (i / steps) * Math.PI * 2;
        var rx = W * 0.42 * (0.6 + 0.4 * Math.abs(Math.cos(a * 3)));
        var ry = H * 0.36;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
    } else if (shape === "spiral") {
      var turns = 3.5;
      var maxR = Math.min(W, H) * 0.44;
      var cx2 = W / 2, cy2 = H / 2;
      var steps2 = 220;
      for (i = 0; i <= steps2; i++) {
        var a2 = (i / steps2) * turns * Math.PI * 2;
        var r = (i / steps2) * maxR;
        pts.push([cx2 + Math.cos(a2) * r, cy2 + Math.sin(a2) * r]);
      }
    } else {
      // arc
      var cx3 = W * 0.5, cy3 = H * 0.75;
      var rx3 = W * 0.4, ry3 = H * 0.6;
      var steps3 = 120;
      for (i = 0; i <= steps3; i++) {
        var a3 = Math.PI + (i / steps3) * Math.PI;
        pts.push([cx3 + Math.cos(a3) * rx3, cy3 + Math.sin(a3) * ry3]);
      }
    }
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (i = 1; i < pts.length; i++) {
      d += " L" + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1);
    }
    return d;
  }

  function buildSvg() {
    var W = 800, H = 800;
    var d = pathFor(state.shape, W, H);
    var dash = state.dash > 0 ? ' stroke-dasharray="' + state.dash + " " + state.dash + '"' : "";
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="' + esc(state.start) + '"/>' +
      '<stop offset="50%" stop-color="' + esc(state.mid) + '"/>' +
      '<stop offset="100%" stop-color="' + esc(state.end) + '"/>' +
      "</linearGradient></defs>" +
      '<path d="' + d + '" fill="none" stroke="url(#sg)" stroke-width="' + state.width + '" stroke-linecap="round" stroke-linejoin="round"' + dash + "/>" +
      "</svg>";
    return svg;
  }

  function generate() {
    var svg = buildSvg();
    api.canvas.addSvg(svg, { name: "Gradient stroke: " + state.shape, scale: 1 }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Gradient stroke inserted (" + state.shape + ")", "info");
      } else {
        api.ui.showNotification("Gradient on Stroke: could not insert the path", "warning");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>SHAPE</label>" +
      "<select data-plugin-action='shape' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='wave' " + (state.shape === "wave" ? "selected" : "") + ">Wave</option>" +
      "<option value='zigzag' " + (state.shape === "zigzag" ? "selected" : "") + ">Zigzag</option>" +
      "<option value='loop' " + (state.shape === "loop" ? "selected" : "") + ">Loop</option>" +
      "<option value='spiral' " + (state.shape === "spiral" ? "selected" : "") + ">Spiral</option>" +
      "<option value='arc' " + (state.shape === "arc" ? "selected" : "") + ">Arc</option>" +
      "</select>" +
      "<div class='grid grid-cols-3 gap-2 mb-2'>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>START</label><input type='color' data-plugin-action='start' value='" + state.start + "' class='w-8 h-8 rounded-md bg-white/5 border border-white/10 cursor-pointer' /></div>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>MID</label><input type='color' data-plugin-action='mid' value='" + state.mid + "' class='w-8 h-8 rounded-md bg-white/5 border border-white/10 cursor-pointer' /></div>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>END</label><input type='color' data-plugin-action='end' value='" + state.end + "' class='w-8 h-8 rounded-md bg-white/5 border border-white/10 cursor-pointer' /></div>" +
      "</div>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>STROKE WIDTH — " + state.width + "px</label>" +
      "<input type='range' data-plugin-action='width' min='2' max='40' step='1' value='" + state.width + "' class='w-full accent-emerald-400 mb-2' />" +
      "<label class='block text-[10px] text-gray-500 mb-1'>DASH — " + (state.dash === 0 ? "solid" : state.dash + "px") + "</label>" +
      "<input type='range' data-plugin-action='dash' min='0' max='40' step='2' value='" + state.dash + "' class='w-full accent-emerald-400 mb-2' />" +
      "<button data-plugin-action='generate' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Insert Gradient Stroke</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Gradient on Stroke", html);
  }

  api.ui.onPanelAction(PANEL_ID, "shape", function (value) { if (value) { state.shape = value; render(); } });
  api.ui.onPanelAction(PANEL_ID, "start", function (value) { if (value) state.start = value; });
  api.ui.onPanelAction(PANEL_ID, "mid", function (value) { if (value) state.mid = value; });
  api.ui.onPanelAction(PANEL_ID, "end", function (value) { if (value) state.end = value; });
  api.ui.onPanelAction(PANEL_ID, "width", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) { state.width = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "dash", function (value) {
    var n = parseInt(value, 10);
    if (n >= 0) { state.dash = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "generate", generate);

  render();

  api.ui.addToolbarButton({
    id: "ai2-strokegradient-generate",
    tooltip: "Gradient on Stroke",
    icon: "PenLine",
    onClick: generate,
  });
})();