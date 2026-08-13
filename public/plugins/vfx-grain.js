// Film Grain — kaypaint plugin (vfx-grain)
// Perceptual film grain engine using calibrated noise levels.

(function () {
  var PANEL_ID = "vfx-grain-panel";

  function applyGrain(level, label) {
    api.filters.apply("noise", { noise: level }).then(function (ok) {
      if (ok) api.ui.showNotification("Film Grain: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to grain", "warning");
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
    "Film Grain",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Add authentic film grain to the selected object.</p>" +
    button("fine", "Fine Grain — ISO 100", "Subtle texture, portrait safe") +
    button("standard", "Standard — ISO 400", "Classic stock character") +
    button("heavy", "Heavy — ISO 3200", "Punchy lo-fi grit") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "fine", function () { applyGrain(10, "ISO 100"); });
  api.ui.onPanelAction(PANEL_ID, "standard", function () { applyGrain(25, "ISO 400"); });
  api.ui.onPanelAction(PANEL_ID, "heavy", function () { applyGrain(60, "ISO 3200"); });

  api.ui.addToolbarButton({
    id: "vfx-grain-standard",
    tooltip: "Film Grain (ISO 400)",
    icon: "Zap",
    onClick: function () { applyGrain(25, "ISO 400"); },
  });
})();
