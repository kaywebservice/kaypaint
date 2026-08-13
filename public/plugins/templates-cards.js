// Business Card Kit — kaypaint plugin (templates-cards)
// One-click business card canvas-format layer setup.

(function () {
  var PANEL_ID = "templates-cards-panel";

  function newFrame(name, sizeLabel) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Card Kit: created \"" + name + "\" (" + sizeLabel + ")", "info");
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
      "Business Card Kit",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Card frame layers at print-safe ratios.</p>" +
      button("us", "US 3.5x2", "Standard US card") +
      button("eu", "EU 85x55", "Standard EU card") +
      button("sq", "Square Card", "Modern square format") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "us", function () { newFrame("US Card", "1050 x 600 px @300dpi"); });
  api.ui.onPanelAction(PANEL_ID, "eu", function () { newFrame("EU Card", "1004 x 649 px @300dpi"); });
  api.ui.onPanelAction(PANEL_ID, "sq", function () { newFrame("Square Card", "1080 x 1080"); });

  refresh();

  api.ui.addToolbarButton({
    id: "templates-cards-us",
    tooltip: "Card Kit (US 3.5x2)",
    icon: "LayoutTemplate",
    onClick: function () { newFrame("US Card", "1050 x 600 px @300dpi"); },
  });
})();