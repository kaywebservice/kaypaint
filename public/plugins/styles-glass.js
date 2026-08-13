// Glass & Frosted — kaypaint plugin (styles-glass)
// Frosted glass and glossy refraction looks for the selected object.

(function () {
  var PANEL_ID = "styles-glass-panel";

  function applyGlass(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Glass & Frosted: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to frost", "warning");
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
    "Glass & Frosted",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Frosted and glossy glass looks.</p>" +
    button("frosted", "Frosted Glass", "Soft diffused blur") +
    button("heavy", "Heavy Frost", "Strong diffusion") +
    button("gloss", "Gloss Finish", "Bright polished sheen") +
    button("low", "Low-Iron Glass", "Nearly clear clean") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "frosted", function () { applyGlass("blur", { blur: 0.05 }, "Frosted Glass"); });
  api.ui.onPanelAction(PANEL_ID, "heavy", function () { applyGlass("blur", { blur: 0.12 }, "Heavy Frost"); });
  api.ui.onPanelAction(PANEL_ID, "gloss", function () { applyGlass("brightness", { brightness: 0.15 }, "Gloss Finish"); });
  api.ui.onPanelAction(PANEL_ID, "low", function () { applyGlass("saturation", { saturation: 0.9 }, "Low-Iron Glass"); });

  api.ui.addToolbarButton({
    id: "styles-glass-frosted",
    tooltip: "Glass (Frosted)",
    icon: "Droplets",
    onClick: function () { applyGlass("blur", { blur: 0.05 }, "Frosted Glass"); },
  });
})();