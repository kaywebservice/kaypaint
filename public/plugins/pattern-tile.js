// Pattern Tile — kaypaint plugin (pattern-tile)
// Makes the active layer tileable: re-arranges its pixels so the edges
// match seamlessly (toroidal shift) or turns it into a repeating pattern
// grid, using the canvas.readPixels / canvas.writePixels APIs.

(function () {
  var PANEL_ID = "pattern-tile-panel";
  var state = { mode: "shift", cells: 4 };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function seamlessShift(data, w, h) {
    var halfW = Math.floor(w / 2);
    var halfH = Math.floor(h / 2);
    var out = new Array(data.length);
    for (var y = 0; y < h; y++) {
      var sy = (y + halfH) % h;
      for (var x = 0; x < w; x++) {
        var sx = (x + halfW) % w;
        var s = (sy * w + sx) * 4;
        var d = (y * w + x) * 4;
        out[d] = data[s];
        out[d + 1] = data[s + 1];
        out[d + 2] = data[s + 2];
        out[d + 3] = data[s + 3];
      }
    }
    return out;
  }

  function repeatGrid(data, w, h, cells) {
    var cw = Math.floor(w / cells);
    var ch = Math.floor(h / cells);
    if (cw < 2 || ch < 2) return null;
    var out = new Array(data.length);
    for (var y = 0; y < h; y++) {
      var gy = Math.min(cells - 1, Math.floor(y / ch));
      var ly = y % ch;
      for (var x = 0; x < w; x++) {
        var gx = Math.min(cells - 1, Math.floor(x / cw));
        var lx = x % cw;
        var sx = clamp(Math.floor((lx / cw) * w), 0, w - 1);
        var sy = clamp(Math.floor((ly / ch) * h), 0, h - 1);
        var s = (sy * w + sx) * 4;
        var d = (y * w + x) * 4;
        out[d] = data[s];
        out[d + 1] = data[s + 1];
        out[d + 2] = data[s + 2];
        out[d + 3] = data[s + 3];
      }
    }
    return out;
  }

  function apply() {
    var img = api.canvas.readPixels();
    if (!img) {
      api.ui.showNotification("Pattern Tile: select a layer with image content first", "warning");
      return;
    }
    var out;
    if (state.mode === "shift") {
      out = seamlessShift(img.data, img.width, img.height);
    } else {
      out = repeatGrid(img.data, img.width, img.height, state.cells);
      if (!out) {
        api.ui.showNotification("Pattern Tile: tile count too high for this image size", "warning");
        return;
      }
    }
    api.canvas.writePixels({ width: img.width, height: img.height, data: out }).then(function (ok) {
      if (ok) {
        api.ui.showNotification(
          "Pattern Tile: " + (state.mode === "shift" ? "seams shifted" : state.cells + "x" + state.cells + " repeat applied"),
          "info"
        );
      } else {
        api.ui.showNotification("Pattern Tile: could not write pixels back to the layer", "error");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Make the active layer seamlessly tileable</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Runs on the active image layer; result is applied in place.</span>" +
      "</div>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>MODE</label>" +
      "<select data-plugin-action='mode' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='shift' " + (state.mode === "shift" ? "selected" : "") + ">Seam Shift (torus wrap)</option>" +
      "<option value='repeat' " + (state.mode === "repeat" ? "selected" : "") + ">Repeat Pattern Grid</option>" +
      "</select>" +
      (state.mode === "repeat"
        ? "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>GRID SIZE</label>" +
          "<select data-plugin-action='cells' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
          "<option value='2' " + (state.cells === 2 ? "selected" : "") + ">2 × 2</option>" +
          "<option value='3' " + (state.cells === 3 ? "selected" : "") + ">3 × 3</option>" +
          "<option value='4' " + (state.cells === 4 ? "selected" : "") + ">4 × 4</option>" +
          "<option value='6' " + (state.cells === 6 ? "selected" : "") + ">6 × 6</option>" +
          "</select>"
        : "") +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors mt-2'><span class='block text-gray-100 text-sm'>Apply Pattern</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Pattern Tile", html);
  }

  api.ui.onPanelAction(PANEL_ID, "mode", function (value) {
    if (value) { state.mode = value; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "cells", function (value) {
    var n = parseInt(value, 10);
    if (n >= 2) { state.cells = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);

  render();

  api.ui.addToolbarButton({
    id: "pattern-tile-apply",
    tooltip: "Pattern Tile",
    icon: "Grid",
    onClick: apply,
  });
})();