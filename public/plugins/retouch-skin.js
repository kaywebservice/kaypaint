// Skin Smoothing Suite — kaypaint plugin (retouch-skin)
// Natural skin softening with detail-preserving presets.

(function () {
  var PANEL_ID = "retouch-skin-panel";

  function applySkin(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Skin Smoothing: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to smooth", "warning");
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
    "Skin Smoothing Suite",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Texture-preserving softening presets.</p>" +
    button("natural", "Natural Soften", "Keeps fine detail") +
    button("portrait", "Portrait Smooth", "Balanced skin feel") +
    button("glow", "Glow Finish", "Subtle luminous soften") +
    button("studio", "Studio Clean", "Stronger smoothing") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "natural", function () { applySkin("blur", { blur: 0.01 }, "Natural Soften"); });
  api.ui.onPanelAction(PANEL_ID, "portrait", function () { applySkin("blur", { blur: 0.03 }, "Portrait Smooth"); });
  api.ui.onPanelAction(PANEL_ID, "glow", function () { applySkin("brightness", { brightness: 0.06 }, "Glow Finish"); });
  api.ui.onPanelAction(PANEL_ID, "studio", function () { applySkin("blur", { blur: 0.06 }, "Studio Clean"); });

  api.ui.addToolbarButton({
    id: "retouch-skin-portrait",
    tooltip: "Skin Smoothing (Portrait)",
    icon: "Wand2",
    onClick: function () { applySkin("blur", { blur: 0.03 }, "Portrait Smooth"); },
  });
})();