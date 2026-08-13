// Social Mockup Frames — kaypaint plugin (mockups-social)
// Device-frame canvas layers for portfolio-ready posts.

(function () {
  var PANEL_ID = "mockups-social-panel";

  function newFrame(name, sizeLabel) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Social Mockups: created \"" + name + "\" (" + sizeLabel + ")", "info");
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
      "Social Mockup Frames",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Frame layers sized for device mockups.</p>" +
      button("phone", "Phone Frame", "1080 x 2340 canvas") +
      button("laptop", "Laptop Frame", "16:9 wide canvas") +
      button("tablet", "Tablet Frame", "4:3 portrait canvas") +
      button("desktop", "Desktop Canvas", "1440 x 900 canvas") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "phone", function () { newFrame("Phone Frame", "1080 x 2340 @3x"); });
  api.ui.onPanelAction(PANEL_ID, "laptop", function () { newFrame("Laptop Frame", "2880 x 1800 @2x"); });
  api.ui.onPanelAction(PANEL_ID, "tablet", function () { newFrame("Tablet Frame", "2048 x 1536 @2x"); });
  api.ui.onPanelAction(PANEL_ID, "desktop", function () { newFrame("Desktop Canvas", "1440 x 900"); });

  refresh();

  api.ui.addToolbarButton({
    id: "mockups-social-phone",
    tooltip: "Social Mockups (Phone Frame)",
    icon: "ScreenShare",
    onClick: function () { newFrame("Phone Frame", "1080 x 2340 @3x"); },
  });
})();