// Bulk Resize & Convert — kaypaint plugin (batch-resize)
// Print-size and DPI conversion reference calculator.

(function () {
  var PANEL_ID = "batch-resize-panel";

  function pxFor(mm, dpi) {
    return Math.round((mm / 25.4) * dpi);
  }

  function rowMM(label, mmW, mmH) {
    var row = [150, 300, 600].map(function (dpi) {
      return "<span class='text-[10px] text-gray-400'>" + dpi + "dpi: " + pxFor(mmW, dpi) + "x" + pxFor(mmH, dpi) + "</span>";
    }).join(" · ");
    return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='block text-sm text-gray-100'>" + label + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + row + "</span>" +
      "</div>";
  }

  function rowPx(label, w, h) {
    var row = [72, 150, 300, 600].map(function (dpi) {
      return "<span class='text-[10px] text-gray-400'>" + dpi + "dpi: " + (w / dpi * 25.4).toFixed(1) + "x" + (h / dpi * 25.4).toFixed(1) + "mm</span>";
    }).join(" · ");
    return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='block text-sm text-gray-100'>" + label + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + row + "</span>" +
      "</div>";
  }

  api.ui.createPanel(
    PANEL_ID,
    "Bulk Resize & Convert",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Size / DPI conversion reference.</p>" +
    rowMM("A4 (210x297mm)", 210, 297) +
    rowMM("A3 (297x420mm)", 297, 420) +
    rowPx("1080x1080 px", 1080, 1080) +
    rowPx("1920x1080 px", 1920, 1080) +
    "<p class='text-[10px] text-gray-500'>Export targets: PNG · JPG · WebP · AVIF</p>" +
    "</div>"
  );

  api.ui.addToolbarButton({
    id: "batch-resize-open",
    tooltip: "Resize & Convert (reference)",
    icon: "Workflow",
    onClick: function () {
      api.ui.showNotification("Bulk Resize: reference panel open", "info");
    },
  });
})();