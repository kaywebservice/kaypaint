// Social Post Templates — kaypaint plugin (templates-social)
// One-click canvas-format layer setup for social platforms.

(function () {
  var PANEL_ID = "templates-social-panel";

  function newFrame(name, sizeLabel) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Social Templates: created \"" + name + "\" (" + sizeLabel + ")", "info");
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
      "Social Post Templates",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Creates a named frame layer per format.</p>" +
      button("square", "Square 1080", "Instagram post") +
      button("portrait", "Portrait 4:5", "Feed portrait") +
      button("story", "Story 9:16", "Stories & Reels") +
      button("landscape", "Landscape 16:9", "X & YouTube") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "square", function () { newFrame("Square 1080 Frame", "1080 x 1080"); });
  api.ui.onPanelAction(PANEL_ID, "portrait", function () { newFrame("Portrait Frame", "1080 x 1350"); });
  api.ui.onPanelAction(PANEL_ID, "story", function () { newFrame("Story Frame", "1080 x 1920"); });
  api.ui.onPanelAction(PANEL_ID, "landscape", function () { newFrame("Landscape Frame", "1920 x 1080"); });

  refresh();

  api.ui.addToolbarButton({
    id: "templates-social-square",
    tooltip: "Social Templates (Square 1080)",
    icon: "LayoutTemplate",
    onClick: function () { newFrame("Square 1080 Frame", "1080 x 1080"); },
  });
})();