// Deep PSD Importer — kaypaint plugin (formats-psd)
// Full PSD round-trip: exports the document as a layered .psd (RGB or CMYK
// with an ICC profile) and imports layered PSD files into the canvas, via the
// file.exportPSD / file.importPSD host APIs.

(function () {
  var PANEL_ID = "formats-psd-panel";

  function exportPsd(cmyk) {
    api.ui.showNotification("Exporting PSD…", "info");
    api.file.exportPSD("kaypaint.psd", { cmyk: !!cmyk }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("PSD exported" + (cmyk ? " (CMYK + ICC)" : " (RGB)"), "success");
      } else {
        api.ui.showNotification("PSD export failed — is the canvas ready?", "error");
      }
    });
  }

  function importPsd() {
    api.ui.showNotification("Choose a PSD file…", "info");
    api.file.importPSD().then(function (ok) {
      if (ok) {
        api.ui.showNotification("PSD imported — layers added to the canvas", "success");
      } else {
        api.ui.showNotification("PSD import cancelled or failed", "warning");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Layered PSD round-trip</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Preserves layer names, visibility and opacity. CMYK export embeds an ICC profile.</span>" +
      "</div>" +
      "<button data-plugin-action='exportRgb' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Export as PSD (RGB)</span></button>" +
      "<button data-plugin-action='exportCmyk' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Export as PSD (CMYK + ICC)</span></button>" +
      "<button data-plugin-action='import' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100 text-sm'>Import PSD…</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Deep PSD Importer", html);
  }

  api.ui.onPanelAction(PANEL_ID, "exportRgb", function () { exportPsd(false); });
  api.ui.onPanelAction(PANEL_ID, "exportCmyk", function () { exportPsd(true); });
  api.ui.onPanelAction(PANEL_ID, "import", importPsd);

  render();

  api.ui.addToolbarButton({
    id: "formats-psd-export",
    tooltip: "Export PSD",
    icon: "FileImage",
    onClick: function () { exportPsd(false); },
  });
})();