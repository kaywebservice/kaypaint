// Halftone Pack — kaypaint plugin (filters-halftone)
// Dot and line screen looks for comics and print.

(function () {
  var PANEL_ID = "filters-halftone-panel";

  function applyScreen(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Halftone: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to screen", "warning");
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

  function step(action, options, label, hint) {
    api.ui.onPanelAction(PANEL_ID, action, function () { applyScreen("pixelate", options, label); });
    return button(action, label, hint);
  }

  api.ui.createPanel(
    PANEL_ID,
    "Halftone Pack",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Retro screened looks — pick a dot size.</p>" +
    step("fine", { blocksize: 3 }, "Fine Dot 3px", "Dense newsprint screen") +
    step("medium", { blocksize: 6 }, "Dot Screen 6px", "Classic comic screen") +
    step("coarse", { blocksize: 10 }, "Coarse Dot 10px", "Bold pop-art screen") +
    button("contrast", "High-Contrast Plate", "Punchy print contrast") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "contrast", function () { applyScreen("contrast", { contrast: 0.35 }, "High-Contrast Plate"); });

  api.ui.addToolbarButton({
    id: "filters-halftone-medium",
    tooltip: "Halftone (Dot 6px)",
    icon: "Grid3x3",
    onClick: function () { applyScreen("pixelate", { blocksize: 6 }, "Dot Screen 6px"); },
  });
})();