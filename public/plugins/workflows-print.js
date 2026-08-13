// Print Prep Batch — kaypaint plugin (workflows-print)
// Flatten checks and print reference layer setup.

(function () {
  var PANEL_ID = "workflows-print-panel";

  function newLayer(name) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Print Prep: created \"" + name + "\"", "info");
        refresh();
      }
    });
  }

  function refresh() {
    var layers = api.layers.getAll();
    var risky = layers.filter(function (l) { return l.blendMode && l.blendMode !== "normal"; });
    var semi = layers.filter(function (l) { return l.opacity !== undefined && l.opacity < 100; });
    api.ui.createPanel(
      PANEL_ID,
      "Print Prep Batch",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Print readiness report.</p>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'><span class='text-sm " + (risky.length ? "text-yellow-300" : "text-emerald-300") + "'>" + risky.length + " blend-mode layers</span><span class='block text-[10px] text-gray-500'>May need flattening</span></div>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'><span class='text-sm " + (semi.length ? "text-yellow-300" : "text-emerald-300") + "'>" + semi.length + " semi-transparent layers</span><span class='block text-[10px] text-gray-500'>Opacity below 100%</span></div>" +
      button("cmyk", "Add CMYK Guide", "Spot-plate reference layer") +
      button("bleed", "Add Bleed Layer", "0.125in bleed reference") +
      button("rescan", "Re-scan", "Refresh the report") +
      "</div>"
    );
  }

  function button(action, label, hint) {
    return (
      "<button data-plugin-action='" + action + "' " +
      "class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'>" +
      "<span class='block text-gray-100'>" + label + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + hint + "</span>" +
      "</button>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "cmyk", function () { newLayer("CMYK Guide"); });
  api.ui.onPanelAction(PANEL_ID, "bleed", function () { newLayer("Bleed Layer"); });
  api.ui.onPanelAction(PANEL_ID, "rescan", refresh);

  refresh();

  api.ui.addToolbarButton({
    id: "workflows-print-rescan",
    tooltip: "Print Prep (scan)",
    icon: "Printer",
    onClick: refresh,
  });
})();