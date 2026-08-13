// Print DPI & PDF-X Presets — kaypaint plugin (presets-print)
// Print-safe resolution reference and DPI preview calculator.

(function () {
  var PANEL_ID = "presets-print-panel";

  function pxPer(mm, dpi) {
    return Math.round((mm / 25.4) * dpi);
  }

  function previewRow(label, mmW, mmH, dpi) {
    return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='block text-sm text-gray-100'>" + label + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + mmW + " x " + mmH + " mm @ " + dpi + " dpi = " + pxPer(mmW, dpi) + " x " + pxPer(mmH, dpi) + " px</span>" +
      "</div>";
  }

  api.ui.createPanel(
    PANEL_ID,
    "Print DPI & PDF-X Presets",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Resolution reference for common print sizes.</p>" +
    previewRow("A4 - 300 dpi", 210, 297, 300) +
    previewRow("A4 - 600 dpi", 210, 297, 600) +
    previewRow("A3 - 300 dpi", 297, 420, 300) +
    previewRow("US Letter - 300 dpi", 215.9, 279.4, 300) +
    previewRow("Business Card - 300 dpi", 85, 55, 300) +
    "</div>"
  );

  api.ui.addToolbarButton({
    id: "presets-print-open",
    tooltip: "Print DPI Presets",
    icon: "BookMarked",
    onClick: function () {
      api.ui.showNotification("Print DPI: reference panel open", "info");
    },
  });
})();