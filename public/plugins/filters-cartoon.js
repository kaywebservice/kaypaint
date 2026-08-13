// Cartoon Pack — kaypaint plugin (filters-cartoon)
// Cel shading, edge tones and comic inking looks.

(function () {
  var PANEL_ID = "filters-cartoon-panel";

  function applyCartoon(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Cartoon Pack: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to cartoon", "warning");
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
    "Cartoon Pack",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Flat, graphic comic looks.</p>" +
    button("cel", "Cel Shade", "Smooth flat posterization") +
    button("ink", "Comic Inking", "Bold graphic lines") +
    button("print", "Flat Color Print", "Reduced clean palette") +
    button("comic", "Classic Comic", "Retro punched look") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "cel", function () { applyCartoon("saturation", { saturation: 0.85 }, "Cel Shade"); });
  api.ui.onPanelAction(PANEL_ID, "ink", function () { applyCartoon("contrast", { contrast: 0.38 }, "Comic Inking"); });
  api.ui.onPanelAction(PANEL_ID, "print", function () { applyCartoon("saturation", { saturation: 0.5 }, "Flat Color Print"); });
  api.ui.onPanelAction(PANEL_ID, "comic", function () { applyCartoon("vintage", {}, "Classic Comic"); });

  api.ui.addToolbarButton({
    id: "filters-cartoon-ink",
    tooltip: "Cartoon (Comic Inking)",
    icon: "Brush",
    onClick: function () { applyCartoon("contrast", { contrast: 0.38 }, "Comic Inking"); },
  });
})();