// YouTube Thumbnail Kit — kaypaint plugin (templates-youtube)
// One-click thumbnail canvas-format layer setup.

(function () {
  var PANEL_ID = "templates-youtube-panel";

  function newFrame(name, sizeLabel) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Thumbnail Kit: created \"" + name + "\" (" + sizeLabel + ")", "info");
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
      "YouTube Thumbnail Kit",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Thumbnail frame layers.</p>" +
      button("hd", "HD 1280x720", "Standard thumbnail") +
      button("fhd", "Full HD 1920x1080", "Hi-res thumbnail") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "hd", function () { newFrame("Thumbnail HD", "1280 x 720"); });
  api.ui.onPanelAction(PANEL_ID, "fhd", function () { newFrame("Thumbnail Full HD", "1920 x 1080"); });

  refresh();

  api.ui.addToolbarButton({
    id: "templates-youtube-hd",
    tooltip: "Thumbnail Kit (HD)",
    icon: "LayoutTemplate",
    onClick: function () { newFrame("Thumbnail HD", "1280 x 720"); },
  });
})();