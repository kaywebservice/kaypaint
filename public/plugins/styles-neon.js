// Neon Text Styles — kaypaint plugin (styles-neon)
// Glow-driven neon looks applied to the selected object.

(function () {
  var PANEL_ID = "styles-neon-panel";

  function applyNeon(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Neon Styles: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to neon", "warning");
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
    "Neon Text Styles",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Glowing neon looks for text and shapes.</p>" +
    button("pink", "Pink Neon Tube", "Hot pink glow") +
    button("cyan", "Cyan Sign", "Cool electric glow") +
    button("white", "White Tube", "Clean bright halo") +
    button("gold", "Golden Sign", "Warm amber glow") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "pink", function () { applyNeon("saturation", { saturation: 1.7 }, "Pink Neon Tube"); });
  api.ui.onPanelAction(PANEL_ID, "cyan", function () { applyNeon("saturation", { saturation: 1.5 }, "Cyan Sign"); });
  api.ui.onPanelAction(PANEL_ID, "white", function () { applyNeon("brightness", { brightness: 0.25 }, "White Tube"); });
  api.ui.onPanelAction(PANEL_ID, "gold", function () { applyNeon("vintage", {}, "Golden Sign"); });

  api.ui.addToolbarButton({
    id: "styles-neon-pink",
    tooltip: "Neon (Pink Tube)",
    icon: "Droplets",
    onClick: function () { applyNeon("saturation", { saturation: 1.7 }, "Pink Neon Tube"); },
  });
})();