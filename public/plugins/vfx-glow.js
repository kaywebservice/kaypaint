// Glow & Bloom — kaypaint plugin (vfx-glow)
// Cinematic glow, bloom and halo effects via the real filter stack.

(function () {
  var PANEL_ID = "vfx-glow-panel";

  function applyGlow(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Glow & Bloom: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to glow", "warning");
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
    "Glow & Bloom",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Soft light effects for the selected object.</p>" +
    button("soft", "Soft Bloom", "Gentle diffuse halation") +
    button("haze", "Heavy Haze", "Strong dreamy bloom") +
    button("neon", "Neon Halo", "Bright saturated pop") +
    button("halation", "Super-8 Halation", "Warm film-style glow") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "soft", function () { applyGlow("blur", { blur: 0.03 }, "Soft Bloom"); });
  api.ui.onPanelAction(PANEL_ID, "haze", function () { applyGlow("blur", { blur: 0.08 }, "Heavy Haze"); });
  api.ui.onPanelAction(PANEL_ID, "neon", function () { applyGlow("saturation", { saturation: 1.55 }, "Neon Halo"); });
  api.ui.onPanelAction(PANEL_ID, "halation", function () { applyGlow("vintage", {}, "Super-8 Halation"); });

  api.ui.addToolbarButton({
    id: "vfx-glow-soft",
    tooltip: "Glow & Bloom (Soft)",
    icon: "Zap",
    onClick: function () { applyGlow("blur", { blur: 0.03 }, "Soft Bloom"); },
  });
})();