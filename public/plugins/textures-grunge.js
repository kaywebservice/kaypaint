// Grunge & Grain — kaypaint plugin (textures-grunge)
// Grungy overlays, dirt and scratch looks via the real filter engine.

(function () {
  var PANEL_ID = "textures-grunge-panel";

  function applyGrunge(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Grunge & Grain: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to grunge", "warning");
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
    "Grunge & Grain",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Dirty, distressed textures for the selected object.</p>" +
    button("grit", "Grunge Grit", "Heavy dirty grain") +
    button("plate", "Dirty Plate", "Faded grunge wash") +
    button("deep", "Deep Grunge", "Crushed dark contrast") +
    button("fade", "Bleached Print", "Washed-out distress") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "grit", function () { applyGrunge("noise", { noise: 38 }, "Grunge Grit"); });
  api.ui.onPanelAction(PANEL_ID, "plate", function () { applyGrunge("brightness", { brightness: -0.08 }, "Dirty Plate"); });
  api.ui.onPanelAction(PANEL_ID, "deep", function () { applyGrunge("contrast", { contrast: 0.22 }, "Deep Grunge"); });
  api.ui.onPanelAction(PANEL_ID, "fade", function () { applyGrunge("saturation", { saturation: 0.55 }, "Bleached Print"); });

  api.ui.addToolbarButton({
    id: "textures-grunge-grit",
    tooltip: "Grunge & Grain (Grit)",
    icon: "Grid3x3",
    onClick: function () { applyGrunge("noise", { noise: 38 }, "Grunge Grit"); },
  });
})();