// Oil Paint Pack — kaypaint plugin (filters-oil)
// Impasto painterly rendering looks.

(function () {
  var PANEL_ID = "filters-oil-panel";

  function applyOil(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Oil Paint: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to paint", "warning");
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
    "Oil Paint Pack",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Impasto brushstroke rendering.</p>" +
    button("soft", "Soft Impasto", "Gentle painterly smear") +
    button("thick", "Thick Stroke", "Bold visible strokes") +
    button("rich", "Rich Pigment", "Deep saturated paint") +
    button("flat", "Palette Knife", "Smooth flat spreading") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "soft", function () { applyOil("blur", { blur: 0.05 }, "Soft Impasto"); });
  api.ui.onPanelAction(PANEL_ID, "thick", function () { applyOil("blur", { blur: 0.11 }, "Thick Stroke"); });
  api.ui.onPanelAction(PANEL_ID, "rich", function () { applyOil("saturation", { saturation: 1.4 }, "Rich Pigment"); });
  api.ui.onPanelAction(PANEL_ID, "flat", function () { applyOil("contrast", { contrast: 0.05 }, "Palette Knife"); });

  api.ui.addToolbarButton({
    id: "filters-oil-thick",
    tooltip: "Oil Paint (Thick Stroke)",
    icon: "Brush",
    onClick: function () { applyOil("blur", { blur: 0.11 }, "Thick Stroke"); },
  });
})();