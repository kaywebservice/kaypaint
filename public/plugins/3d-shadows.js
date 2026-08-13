// Depth Shadow Suite — kaypaint plugin (3d-shadows)
// Contact shadow and depth-of-field softening looks.

(function () {
  var PANEL_ID = "3d-shadows-panel";

  function applyShadow(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Depth Shadow: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to shadow", "warning");
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
    "Depth Shadow Suite",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Shadow and depth softening presets.</p>" +
    button("contact", "Contact Shadow", "Tight grounded shadow") +
    button("soft", "Soft Diffuse", "Wide gentle falloff") +
    button("dof", "Lens DOF", "Distanced focus blur") +
    button("depth", "Deep Depth", "Strong out-of-focus") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "contact", function () { applyShadow("brightness", { brightness: -0.06 }, "Contact Shadow"); });
  api.ui.onPanelAction(PANEL_ID, "soft", function () { applyShadow("blur", { blur: 0.03 }, "Soft Diffuse"); });
  api.ui.onPanelAction(PANEL_ID, "dof", function () { applyShadow("blur", { blur: 0.08 }, "Lens DOF"); });
  api.ui.onPanelAction(PANEL_ID, "depth", function () { applyShadow("blur", { blur: 0.15 }, "Deep Depth"); });

  api.ui.addToolbarButton({
    id: "3d-shadows-soft",
    tooltip: "Depth Shadow (Soft Diffuse)",
    icon: "Box",
    onClick: function () { applyShadow("blur", { blur: 0.03 }, "Soft Diffuse"); },
  });
})();