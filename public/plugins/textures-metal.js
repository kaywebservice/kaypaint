// Rust & Metal — kaypaint plugin (textures-metal)
// Weathered metal, rust and brushed surface looks.

(function () {
  var PANEL_ID = "textures-metal-panel";

  function applyMetal(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Rust & Metal: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to texture", "warning");
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
    "Rust & Metal",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Industrial and weathered surfaces.</p>" +
    button("brushed", "Brushed Steel", "Fine anisotropic grain") +
    button("rust", "Rust Corrosion", "Course pitted decay") +
    button("scratched", "Scratched Plate", "Wear and tear marks") +
    button("galvanized", "Galvanized Zinc", "Speckled industrial") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "brushed", function () { applyMetal("noise", { noise: 10 }, "Brushed Steel"); });
  api.ui.onPanelAction(PANEL_ID, "rust", function () { applyMetal("noise", { noise: 30 }, "Rust Corrosion"); });
  api.ui.onPanelAction(PANEL_ID, "scratched", function () { applyMetal("contrast", { contrast: 0.15 }, "Scratched Plate"); });
  api.ui.onPanelAction(PANEL_ID, "galvanized", function () { applyMetal("pixelate", { blocksize: 3 }, "Galvanized Zinc"); });

  api.ui.addToolbarButton({
    id: "textures-metal-brushed",
    tooltip: "Rust & Metal (Brushed Steel)",
    icon: "Grid3x3",
    onClick: function () { applyMetal("noise", { noise: 10 }, "Brushed Steel"); },
  });
})();