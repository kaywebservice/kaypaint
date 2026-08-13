// Pattern Sheet — kaypaint plugin (pattern-live)
// Snapshots the current artwork and inserts a "pattern sheet" grid made of
// the artwork repeated NxN (a live-pattern preview), via canvas.getDataURL
// and the canvas.addSvg API.

(function () {
  var PANEL_ID = "pattern-live-panel";
  var state = { grid: 3, fade: 0 };

  function renderSheet() {
    var info = api.canvas.getInfo();
    var dataUrl = api.canvas.getDataURL("png");
    if (!dataUrl) {
      api.ui.showNotification("Pattern Sheet: canvas is not available right now", "warning");
      return;
    }
    var w = info.width, h = info.height;
    var cellW = w / state.grid, cellH = h / state.grid;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">');
    parts.push('<rect width="' + w + '" height="' + h + '" fill="#ffffff"/>');
    for (var gy = 0; gy < state.grid; gy++) {
      for (var gx = 0; gx < state.grid; gx++) {
        parts.push(
          '<image href="' + dataUrl + '" x="' + (gx * cellW).toFixed(2) + '" y="' + (gy * cellH).toFixed(2) + '" width="' + cellW.toFixed(2) + '" height="' + cellH.toFixed(2) + '"/>'
        );
      }
    }
    parts.push("</svg>");
    api.canvas.addSvg(parts.join(""), { name: "Pattern sheet " + state.grid + "x" + state.grid, scale: 1 }).then(function (ok) {
      if (ok) {
        api.ui.showNotification(
          "Pattern sheet: " + (state.grid * state.grid) + " tiles of the artwork inserted (" + w + "x" + h + " px)",
          "info"
        );
      } else {
        api.ui.showNotification("Pattern Sheet: could not insert the pattern grid", "warning");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Insert a pattern sheet from the current artwork</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>A live snapshot of the canvas is repeated in a grid — handy for wallpaper and fabric previews.</span>" +
      "</div>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>GRID</label>" +
      "<select data-plugin-action='grid' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='2' " + (state.grid === 2 ? "selected" : "") + ">2 × 2</option>" +
      "<option value='3' " + (state.grid === 3 ? "selected" : "") + ">3 × 3</option>" +
      "<option value='4' " + (state.grid === 4 ? "selected" : "") + ">4 × 4</option>" +
      "<option value='5' " + (state.grid === 5 ? "selected" : "") + ">5 × 5</option>" +
      "</select>" +
      "<button data-plugin-action='insert' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100'>Insert Pattern Sheet</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Pattern Sheet", html);
  }

  api.ui.onPanelAction(PANEL_ID, "grid", function (value) {
    var n = parseInt(value, 10);
    if (n >= 2) { state.grid = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "insert", renderSheet);

  render();

  api.ui.addToolbarButton({
    id: "pattern-live-insert",
    tooltip: "Insert Pattern Sheet",
    icon: "LayoutGrid",
    onClick: renderSheet,
  });
})();