// Particles — kaypaint plugin (vfx-particles)
// Dust, snow, embers and bokeh particle overlays.

(function () {
  var PANEL_ID = "vfx-particles-panel";

  function applyParticles(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Particles: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to add particles", "warning");
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
    "Particles",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Floating particle looks for the selected object.</p>" +
    button("dust", "Dust Motes", "Fine drifting speckle") +
    button("snow", "Snowfall", "Soft scattered flakes") +
    button("embers", "Embers", "Sparkling warm grit") +
    button("bokeh", "Bokeh Dots", "Soft round light spots") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "dust", function () { applyParticles("noise", { noise: 8 }, "Dust Motes"); });
  api.ui.onPanelAction(PANEL_ID, "snow", function () { applyParticles("noise", { noise: 18 }, "Snowfall"); });
  api.ui.onPanelAction(PANEL_ID, "embers", function () { applyParticles("noise", { noise: 12 }, "Embers"); });
  api.ui.onPanelAction(PANEL_ID, "bokeh", function () { applyParticles("pixelate", { blocksize: 4 }, "Bokeh Dots"); });

  api.ui.addToolbarButton({
    id: "vfx-particles-dust",
    tooltip: "Particles (Dust Motes)",
    icon: "Sparkles",
    onClick: function () { applyParticles("noise", { noise: 8 }, "Dust Motes"); },
  });
})();