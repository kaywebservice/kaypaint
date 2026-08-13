// Light Leaks — kaypaint plugin (vfx-lightleaks)
// Film light leaks, flares and lens burn looks.

(function () {
  var PANEL_ID = "vfx-lightleaks-panel";

  function applyLeak(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Light Leaks: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to leak", "warning");
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
    "Light Leaks",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Analog leak and flare grades.</p>" +
    button("amber", "Amber Leak", "Warm lens burn") +
    button("rose", "Rose Flare", "Pink romantic glow") +
    button("film", "Vintage Leak", "Classic 70s film cast") +
    button("kodak", "Kodachrome Burn", "Bold saturated flare") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "amber", function () { applyLeak("brownie", {}, "Amber Leak"); });
  api.ui.onPanelAction(PANEL_ID, "rose", function () { applyLeak("polaroid", {}, "Rose Flare"); });
  api.ui.onPanelAction(PANEL_ID, "film", function () { applyLeak("vintage", {}, "Vintage Leak"); });
  api.ui.onPanelAction(PANEL_ID, "kodak", function () { applyLeak("kodachrome", {}, "Kodachrome Burn"); });

  api.ui.addToolbarButton({
    id: "vfx-lightleaks-amber",
    tooltip: "Light Leaks (Amber)",
    icon: "Sun",
    onClick: function () { applyLeak("brownie", {}, "Amber Leak"); },
  });
})();