// Sprite Sheet Exporter — kaypaint plugin (export-sprite)
// Compute uniform sprite-sheet grid layouts.

(function () {
  var PANEL_ID = "export-sprite-panel";

  function gridFor(count, w, h) {
    var cols = Math.ceil(Math.sqrt(Number(count || 1)));
    var rows = Math.ceil(count / cols);
    return { cols: cols, rows: rows, w: cols * w, h: rows * h };
  }

  function row(count, w, h, pad) {
    var g = gridFor(count, w + pad * 2, h + pad * 2);
    return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='block text-sm text-gray-100'>" + count + " frames (" + w + "x" + h + "px, pad " + pad + ")</span>" +
      "<span class='block text-[10px] text-gray-500'>Sheet " + g.cols + " x " + g.rows + " → " + g.w + " x " + g.h + " px</span>" +
      "</div>";
  }

  api.ui.createPanel(
    PANEL_ID,
    "Sprite Sheet Exporter",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Uniform grid layout calculator.</p>" +
    row(4, 64, 64, 0) +
    row(8, 64, 64, 0) +
    row(12, 128, 128, 2) +
    row(24, 32, 32, 0) +
    row(36, 96, 96, 4) +
    "</div>"
  );

  api.ui.addToolbarButton({
    id: "export-sprite-open",
    tooltip: "Sprite Sheet Exporter",
    icon: "Download",
    onClick: function () {
      api.ui.showNotification("Sprite Sheet: layout panel open", "info");
    },
  });
})();