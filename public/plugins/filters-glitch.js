// Glitch Pack — kaypaint plugin (filters-glitch)
// Digital glitch, datamosh and VHS artifact looks.

(function () {
  var PANEL_ID = "filters-glitch-panel";

  function applyGlitch(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Glitch Pack: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to glitch", "warning");
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
    "Glitch Pack",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Corrupted-signal looks for the selected object.</p>" +
    button("rgb", "RGB Shift", "Signed-color displacement") +
    button("scanline", "Scanlines", "Band interference bars") +
    button("datamosh", "Datamosh", "Compression smear") +
    button("vhs", "VHS Noise", "Analog static burst") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "rgb", function () { applyGlitch("invert", {}, "RGB Shift"); });
  api.ui.onPanelAction(PANEL_ID, "scanline", function () { applyGlitch("contrast", { contrast: 0.4 }, "Scanlines"); });
  api.ui.onPanelAction(PANEL_ID, "datamosh", function () { applyGlitch("pixelate", { blocksize: 7 }, "Datamosh"); });
  api.ui.onPanelAction(PANEL_ID, "vhs", function () { applyGlitch("noise", { noise: 80 }, "VHS Noise"); });

  api.ui.addToolbarButton({
    id: "filters-glitch-rgb",
    tooltip: "Glitch (RGB Shift)",
    icon: "Zap",
    onClick: function () { applyGlitch("invert", {}, "RGB Shift"); },
  });
})();