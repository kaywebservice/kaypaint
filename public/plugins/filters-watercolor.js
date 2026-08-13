// Watercolor Pack — kaypaint plugin (filters-watercolor)
// Painterly bleed, bloom and paper texture blending.

(function () {
  var PANEL_ID = "filters-watercolor-panel";

  function applyWash(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Watercolor: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to wash", "warning");
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
    "Watercolor Pack",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Wet media looks for the selected object.</p>" +
    button("bleed", "Wet Bleed", "Soft water bloom") +
    button("wash", "Faded Wash", "Lifted airy tint") +
    button("pigment", "Vivid Pigment", "Rich saturated paint") +
    button("paper", "Paper Grain", "Textured tooth feel") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "bleed", function () { applyWash("blur", { blur: 0.04 }, "Wet Bleed"); });
  api.ui.onPanelAction(PANEL_ID, "wash", function () { applyWash("brightness", { brightness: 0.1 }, "Faded Wash"); });
  api.ui.onPanelAction(PANEL_ID, "pigment", function () { applyWash("saturation", { saturation: 1.35 }, "Vivid Pigment"); });
  api.ui.onPanelAction(PANEL_ID, "paper", function () { applyWash("noise", { noise: 12 }, "Paper Grain"); });

  api.ui.addToolbarButton({
    id: "filters-watercolor-bleed",
    tooltip: "Watercolor (Wet Bleed)",
    icon: "Droplets",
    onClick: function () { applyWash("blur", { blur: 0.04 }, "Wet Bleed"); },
  });
})();