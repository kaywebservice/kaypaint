// God Rays — kaypaint plugin (vfx-godrays)
// Volumetric light shaft looks for the selected object.

(function () {
  var PANEL_ID = "vfx-godrays-panel";

  function applyRays(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("God Rays: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to ray", "warning");
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
    "God Rays",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Volumetric light presets.</p>" +
    button("sunrise", "Sunrise Shafts", "Warm soft rays") +
    button("haze", "Atmospheric Haze", "Diffused light bloom") +
    button("spotlight", "Spotlight Beam", "Focused bright shaft") +
    button("golden", "Golden Hour", "Rich warm glow") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "sunrise", function () { applyRays("polaroid", {}, "Sunrise Shafts"); });
  api.ui.onPanelAction(PANEL_ID, "haze", function () { applyRays("blur", { blur: 0.06 }, "Atmospheric Haze"); });
  api.ui.onPanelAction(PANEL_ID, "spotlight", function () { applyRays("brightness", { brightness: 0.2 }, "Spotlight Beam"); });
  api.ui.onPanelAction(PANEL_ID, "golden", function () { applyRays("vintage", {}, "Golden Hour"); });

  api.ui.addToolbarButton({
    id: "vfx-godrays-golden",
    tooltip: "God Rays (Golden Hour)",
    icon: "Sun",
    onClick: function () { applyRays("vintage", {}, "Golden Hour"); },
  });
})();