// Chromatic Aberration — kaypaint plugin (vfx-chromatic)
// Lens-style dispersion and fringe looks.

(function () {
  var PANEL_ID = "vfx-chromatic-panel";

  function applyDispersion(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Chromatic: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to fringe", "warning");
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
    "Chromatic Aberration",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Lens fringe and dispersion looks.</p>" +
    button("fringe", "Edge Fringe", "Subtle lens dispersion") +
    button("splits", "RGB Split", "Pronounced channel split") +
    button("blur", "Lens Soft", "Diffused lens blur") +
    button("bold", "Bold Fringe", "Strong neon edges") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "fringe", function () { applyDispersion("invert", {}, "Edge Fringe"); });
  api.ui.onPanelAction(PANEL_ID, "splits", function () { applyDispersion("pixelate", { blocksize: 4 }, "RGB Split"); });
  api.ui.onPanelAction(PANEL_ID, "blur", function () { applyDispersion("blur", { blur: 0.03 }, "Lens Soft"); });
  api.ui.onPanelAction(PANEL_ID, "bold", function () { applyDispersion("saturation", { saturation: 1.3 }, "Bold Fringe"); });

  api.ui.addToolbarButton({
    id: "vfx-chromatic-fringe",
    tooltip: "Chromatic (Edge Fringe)",
    icon: "Zap",
    onClick: function () { applyDispersion("invert", {}, "Edge Fringe"); },
  });
})();