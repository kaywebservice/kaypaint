// Pixel Art Pack — kaypaint plugin (filters-pixelart)
// Retro pixelation with indexed-style block sizes.

(function () {
  var PANEL_ID = "pixelart-panel";

  function pixelate(block, label) {
    api.filters.apply("pixelate", { blocksize: block }).then(function (ok) {
      if (ok) api.ui.showNotification("Pixel Art: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to pixelate", "warning");
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

  api.ui.createPanel(
    PANEL_ID,
    "Pixel Art",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Render the selected object as chunky retro pixels.</p>" +
    button("subtle", "Subtle — 8px", "Light arcade texture") +
    button("classic", "Classic — 16px", "16-bit console look") +
    button("chunky", "Chunky — 32px", "Bold 8-bit blocks") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "subtle", function () { pixelate(8, "8px"); });
  api.ui.onPanelAction(PANEL_ID, "classic", function () { pixelate(16, "16px"); });
  api.ui.onPanelAction(PANEL_ID, "chunky", function () { pixelate(32, "32px"); });

  api.ui.addToolbarButton({
    id: "pixelart-classic",
    tooltip: "Pixel Art (16px)",
    icon: "Target",
    onClick: function () { pixelate(16, "16px"); },
  });
})();
