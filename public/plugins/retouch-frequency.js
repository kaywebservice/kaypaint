// Frequency Separation — kaypaint plugin (retouch-frequency)
// Smooth color pass and texture reveal presets.

(function () {
  var PANEL_ID = "retouch-frequency-panel";

  function applyPass(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Frequency Separation: " + label + " applied", "info");
      else api.ui.showNotification("Select an object first", "warning");
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
    "Frequency Separation",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Low-frequency smooth pass and high-frequency detail passes.</p>" +
    button("smooth", "Smooth Color Pass", "Blend low-frequency color") +
    button("soft", "Soft Surface", "Subtle frequency blend") +
    button("texture", "Texture Reveal", "Boost high-frequency detail") +
    button("flat", "Flat Color", "Even-out tonal patches") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "smooth", function () { applyPass("blur", { blur: 0.07 }, "Smooth Color Pass"); });
  api.ui.onPanelAction(PANEL_ID, "soft", function () { applyPass("blur", { blur: 0.03 }, "Soft Surface"); });
  api.ui.onPanelAction(PANEL_ID, "texture", function () { applyPass("contrast", { contrast: 0.12 }, "Texture Reveal"); });
  api.ui.onPanelAction(PANEL_ID, "flat", function () { applyPass("saturation", { saturation: 1.2 }, "Flat Color"); });

  api.ui.addToolbarButton({
    id: "retouch-frequency-smooth",
    tooltip: "Frequency Separation (Smooth Pass)",
    icon: "Wand2",
    onClick: function () { applyPass("blur", { blur: 0.07 }, "Smooth Color Pass"); },
  });
})();