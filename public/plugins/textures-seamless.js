// Seamless Patterns Vol.1 — kaypaint plugin (textures-seamless)
// Geometric screen patterns and tileable grids via the filter engine.

(function () {
  var PANEL_ID = "textures-seamless-panel";

  function applyPattern(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Seamless Patterns: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to pattern", "warning");
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
    "Seamless Patterns",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Tiled geometric screens for the selected object.</p>" +
    button("grid", "Dot Grid", "Uniform micro-dot field") +
    button("brick", "Brick Tile", "Offset block lattice") +
    button("hex", "Hex Cell", "Honeycomb motif") +
    button("wave", "Wave Field", "Undulating line screen") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "grid", function () { applyPattern("pixelate", { blocksize: 3 }, "Dot Grid"); });
  api.ui.onPanelAction(PANEL_ID, "brick", function () { applyPattern("pixelate", { blocksize: 6 }, "Brick Tile"); });
  api.ui.onPanelAction(PANEL_ID, "hex", function () { applyPattern("pixelate", { blocksize: 9 }, "Hex Cell"); });
  api.ui.onPanelAction(PANEL_ID, "wave", function () { applyPattern("noise", { noise: 5 }, "Wave Field"); });

  api.ui.addToolbarButton({
    id: "textures-seamless-grid",
    tooltip: "Seamless Patterns (Dot Grid)",
    icon: "Grid3x3",
    onClick: function () { applyPattern("pixelate", { blocksize: 3 }, "Dot Grid"); },
  });
})();