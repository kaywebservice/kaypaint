// Social Export Set — kaypaint plugin (workflows-social)
// One-click setup of social-format layers.

(function () {
  var PANEL_ID = "workflows-social-panel";

  function newLayerFor(name, sizeLabel) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Social Export Set: created \"" + name + "\" (" + sizeLabel + ")", "info");
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
    api.ui.createPanel(
      PANEL_ID,
      "Social Export Set",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + layers.length + " layers. Creates a named layer per format.</p>" +
      button("ig-post", "Instagram Post", "Square layer - 1080 x 1080") +
      button("ig-story", "Instagram Story", "Vertical layer - 1080 x 1920") +
      button("x-post", "X (Twitter) Post", "Wide layer - 1600 x 900") +
      button("yt-thumb", "YouTube Thumbnail", "HD layer - 1280 x 720") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "ig-post", function () { newLayerFor("Instagram Post", "1080 x 1080"); });
  api.ui.onPanelAction(PANEL_ID, "ig-story", function () { newLayerFor("Instagram Story", "1080 x 1920"); });
  api.ui.onPanelAction(PANEL_ID, "x-post", function () { newLayerFor("X Post", "1600 x 900"); });
  api.ui.onPanelAction(PANEL_ID, "yt-thumb", function () { newLayerFor("YouTube Thumbnail", "1280 x 720"); });

  refresh();

  api.ui.addToolbarButton({
    id: "workflows-social-ig-post",
    tooltip: "Social Export Set (IG Post layer)",
    icon: "LayoutTemplate",
    onClick: function () { newLayerFor("Instagram Post", "1080 x 1080"); },
  });
})();