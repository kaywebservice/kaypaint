// Dreamy Grade — kaypaint plugin (luts-dreamy)
// Pastel, airy and romantic washed-out looks.

(function () {
  var PANEL_ID = "luts-dreamy-panel";

  function applyLook(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Dreamy Grade: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to grade", "warning");
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
    "Dreamy Grade",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Washed, pastel aesthetic grades.</p>" +
    button("airy", "Airy Bright", "Soft lifted exposure") +
    button("matte", "Soft Matte", "Faded gentle contrast") +
    button("pastel", "Muted Pastel", "Desaturated dream tone") +
    button("glow", "Glow Wash", "Slight dreamy softening") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "airy", function () { applyLook("brightness", { brightness: 0.15 }, "Airy Bright"); });
  api.ui.onPanelAction(PANEL_ID, "matte", function () { applyLook("contrast", { contrast: -0.18 }, "Soft Matte"); });
  api.ui.onPanelAction(PANEL_ID, "pastel", function () { applyLook("saturation", { saturation: 0.75 }, "Muted Pastel"); });
  api.ui.onPanelAction(PANEL_ID, "glow", function () { applyLook("blur", { blur: 0.03 }, "Glow Wash"); });

  api.ui.addToolbarButton({
    id: "luts-dreamy-matte",
    tooltip: "Dreamy Grade (Soft Matte)",
    icon: "Sparkles",
    onClick: function () { applyLook("contrast", { contrast: -0.18 }, "Soft Matte"); },
  });
})();