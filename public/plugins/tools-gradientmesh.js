// Gradient Mesh — kaypaint plugin (tools-gradientmesh)
// Generates a smooth multi-color gradient "mesh" as an SVG made of an
// interpolated grid of quads, inserted via the canvas.addSvg API.

(function () {
  var PANEL_ID = "tools-gradientmesh-panel";
  var state = { rows: 5, cols: 7, palette: "sunset", size: 800 };

  var PALETTES = {
    sunset: ["#ff5f6d", "#ffc371", "#ff9a3c", "#d8507b"],
    cool: ["#2b59c3", "#4d96ff", "#25d0f0", "#7b66ff"],
    warm: ["#ff5f3b", "#ffc93b", "#ff9f1c", "#c44536"],
    forest: ["#2d6a4f", "#52b788", "#95d5b2", "#d8f3dc"],
    mono: ["#1f2937", "#4b5563", "#9ca3af", "#e5e7eb"],
  };

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rgbToHex(r, g, b) {
    function c(v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }
    return "#" + c(r) + c(g) + c(b);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function paletteColor(palette, t) {
    var stops = PALETTES[palette] || PALETTES.sunset;
    var f = t * (stops.length - 1);
    var i = Math.min(stops.length - 2, Math.floor(f));
    var frac = f - i;
    var a = hexToRgb(stops[i]);
    var b2 = hexToRgb(stops[i + 1]);
    return [
      lerp(a[0], b2[0], frac),
      lerp(a[1], b2[1], frac),
      lerp(a[2], b2[2], frac),
    ];
  }

  function jitter(rgb, amount) {
    return [
      rgb[0] + (Math.random() * 2 - 1) * amount,
      rgb[1] + (Math.random() * 2 - 1) * amount,
      rgb[2] + (Math.random() * 2 - 1) * amount,
    ];
  }

  function buildMesh() {
    var rows = state.rows, cols = state.cols;
    var sub = 5;
    var gx = rows * sub + 1, gy = cols * sub + 1;
    var grid = [];
    var i, j;
    for (i = 0; i < gx; i++) {
      grid.push(new Array(gy));
    }
    for (i = 0; i <= rows; i++) {
      for (j = 0; j <= cols; j++) {
        var t = (i / rows + j / cols) / 2;
        var base = paletteColor(state.palette, t);
        var amt = i % 2 === 0 ? 22 : 38;
        var c = jitter(base, amt);
        if (i === 0 && j === 0) c = base;
        if (i === rows && j === cols) c = base;
        c[0] = Math.max(0, Math.min(255, c[0]));
        c[1] = Math.max(0, Math.min(255, c[1]));
        c[2] = Math.max(0, Math.min(255, c[2]));
        for (var si = 0; si < sub; si++) {
          for (var sj = 0; sj < sub; sj++) {
            var ui = i * sub + si;
            var uj = j * sub + sj;
            if (i === rows && si > 0) continue;
            if (j === cols && sj > 0) continue;
            grid[ui][uj] = c;
          }
        }
      }
    }
    var cellW = state.size / (rows * sub);
    var cellH = state.size / (cols * sub);
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + state.size + '" height="' + state.size + '" viewBox="0 0 ' + state.size + ' ' + state.size + '">');
    for (i = 0; i < gx - 1; i++) {
      for (j = 0; j < gy - 1; j++) {
        var c00 = grid[i][j], c10 = grid[i + 1][j], c01 = grid[i][j + 1], c11 = grid[i + 1][j + 1];
        var r = (c00[0] + c10[0] + c01[0] + c11[0]) / 4;
        var g = (c00[1] + c10[1] + c01[1] + c11[1]) / 4;
        var b = (c00[2] + c10[2] + c01[2] + c11[2]) / 4;
        parts.push(
          '<rect x="' + (i * cellW).toFixed(1) + '" y="' + (j * cellH).toFixed(1) + '" width="' + (cellW + 0.5).toFixed(1) + '" height="' + (cellH + 0.5).toFixed(1) + '" fill="' + rgbToHex(r, g, b) + '"/>'
        );
      }
    }
    parts.push("</svg>");
    return parts.join("");
  }

  function generate() {
    var svg = buildMesh();
    api.canvas.addSvg(svg, { name: "Gradient mesh " + state.rows + "x" + state.cols, scale: 1 }).then(function (ok) {
      if (ok) {
        api.ui.showNotification(
          "Gradient mesh " + state.rows + "x" + state.cols + " inserted (" + state.palette + ", " + state.size + "px)",
          "info"
        );
      } else {
        api.ui.showNotification("Gradient Mesh: could not insert the mesh", "warning");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>MESH</label>" +
      "<select data-plugin-action='rows' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='3' " + (state.rows === 3 ? "selected" : "") + ">3 × 4</option>" +
      "<option value='5' " + (state.rows === 5 ? "selected" : "") + ">5 × 7</option>" +
      "<option value='6' " + (state.rows === 6 ? "selected" : "") + ">6 × 9</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>PALETTE</label>" +
      "<select data-plugin-action='palette' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='sunset' " + (state.palette === "sunset" ? "selected" : "") + ">Sunset</option>" +
      "<option value='cool' " + (state.palette === "cool" ? "selected" : "") + ">Cool</option>" +
      "<option value='warm' " + (state.palette === "warm" ? "selected" : "") + ">Warm</option>" +
      "<option value='forest' " + (state.palette === "forest" ? "selected" : "") + ">Forest</option>" +
      "<option value='mono' " + (state.palette === "mono" ? "selected" : "") + ">Grayscale</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>SIZE</label>" +
      "<select data-plugin-action='size' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='600' " + (state.size === 600 ? "selected" : "") + ">600 px</option>" +
      "<option value='800' " + (state.size === 800 ? "selected" : "") + ">800 px</option>" +
      "<option value='1200' " + (state.size === 1200 ? "selected" : "") + ">1200 px</option>" +
      "</select>" +
      "<button data-plugin-action='generate' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100'>Generate Mesh</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Gradient Mesh", html);
  }

  api.ui.onPanelAction(PANEL_ID, "rows", function (value) {
    var n = parseInt(value, 10);
    var COLS = { 3: 4, 5: 7, 6: 9 };
    if (COLS[n]) { state.rows = n; state.cols = COLS[n]; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "palette", function (value) {
    if (value) { state.palette = value; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "size", function (value) {
    var n = parseInt(value, 10);
    if (n >= 100) { state.size = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "generate", generate);

  render();

  api.ui.addToolbarButton({
    id: "tools-gradientmesh-generate",
    tooltip: "Gradient Mesh",
    icon: "Grid",
    onClick: generate,
  });
})();