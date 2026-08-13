// Crop Marks & Bleed — kaypaint plugin (export-cropmarks)
// Adds print crop-mark and bleed reference layers.

(function () {
  var PANEL_ID = "export-cropmarks-panel";

  function newMarkLayer(name) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Crop Marks: created \"" + name + "\"", "info");
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
    var layers = api.layers.getAll();
    var hasMarks = layers.some(function (l) { return /crop|bleed|trim/i.test(l.name); });
    api.ui.createPanel(
      PANEL_ID,
      "Crop Marks & Bleed",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + (hasMarks ? "Mark layers detected on canvas." : "No mark layers yet.") + "</p>" +
      button("crop", "Crop Marks Layer", "Standard corner cuts") +
      button("bleed", "Bleed Layer", "0.125in bleed reference") +
      button("trim", "Trim Marks Layer", "Final trim boundary") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "crop", function () { newMarkLayer("Crop Marks"); });
  api.ui.onPanelAction(PANEL_ID, "bleed", function () { newMarkLayer("Bleed Layer"); });
  api.ui.onPanelAction(PANEL_ID, "trim", function () { newMarkLayer("Trim Marks"); });

  refresh();

  api.ui.addToolbarButton({
    id: "export-cropmarks-crop",
    tooltip: "Crop Marks (add layer)",
    icon: "Printer",
    onClick: function () { newMarkLayer("Crop Marks"); },
  });
})();