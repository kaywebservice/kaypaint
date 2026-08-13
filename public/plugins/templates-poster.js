// Poster & Flyer Bundle — kaypaint plugin (templates-poster)
// One-click poster canvas-format layer setup.

(function () {
  var PANEL_ID = "templates-poster-panel";

  function newFrame(name, sizeLabel) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Poster Bundle: created \"" + name + "\" (" + sizeLabel + ")", "info");
        refresh();
      }
    });
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

  function refresh() {
    api.ui.createPanel(
      PANEL_ID,
      "Poster & Flyer Bundle",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Print-safe poster frame layers.</p>" +
      button("a3", "A3 Poster", "297 x 420 mm") +
      button("a4", "A4 Flyer", "210 x 297 mm") +
      button("a5", "A5 Flyer", "148 x 210 mm") +
      button("tabloid", "Tabloid Poster", "279 x 432 mm") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "a3", function () { newFrame("A3 Poster", "297 x 420 mm"); });
  api.ui.onPanelAction(PANEL_ID, "a4", function () { newFrame("A4 Flyer", "210 x 297 mm"); });
  api.ui.onPanelAction(PANEL_ID, "a5", function () { newFrame("A5 Flyer", "148 x 210 mm"); });
  api.ui.onPanelAction(PANEL_ID, "tabloid", function () { newFrame("Tabloid Poster", "279 x 432 mm"); });

  refresh();

  api.ui.addToolbarButton({
    id: "templates-poster-a3",
    tooltip: "Poster Bundle (A3)",
    icon: "LayoutTemplate",
    onClick: function () { newFrame("A3 Poster", "297 x 420 mm"); },
  });
})();