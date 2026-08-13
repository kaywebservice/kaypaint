// Imposition Layouts — kaypaint plugin (prepress-imposition)
// N-up imposition math and print sheet layout preview.

(function () {
  var PANEL_ID = "prepress-imposition-panel";

  function fits(pageW, pageH, sheetW, sheetH) {
    return Math.floor(sheetW / pageW) * Math.floor(sheetH / pageH);
  }

  function layoutRow(name, pageW, pageH, sheetW, sheetH) {
    var n = fits(pageW, pageH, sheetW, sheetH);
    return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='block text-sm text-gray-100'>" + name + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + pageW + "x" + pageH + " on " + sheetW + "x" + sheetH + " → " + n + " up</span>" +
      "</div>";
  }

  api.ui.createPanel(
    PANEL_ID,
    "Imposition Layouts",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>How many pages fit per print sheet.</p>" +
    layoutRow("A5 pages on A3", 148, 210, 297, 420) +
    layoutRow("Business cards on A4", 85, 55, 210, 297) +
    layoutRow("Postcards on A3", 100, 148, 297, 420) +
    layoutRow("A4 pages on A2", 210, 297, 420, 594) +
    "</div>"
  );

  api.ui.addToolbarButton({
    id: "prepress-imposition-open",
    tooltip: "Imposition Layouts",
    icon: "Printer",
    onClick: function () {
      api.ui.showNotification("Imposition: reference panel open", "info");
    },
  });
})();