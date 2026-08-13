// Pantone Palettes — kaypaint plugin (presets-pantone)
// Reference swatches of popular coated Pantone spot colors.

(function () {
  var PANEL_ID = "presets-pantone-panel";

  var PMS = [
    { name: "PMS 485 C - Pure Red", hex: "#DA291C" },
    { name: "PMS 300 C - Blue", hex: "#005EB8" },
    { name: "PMS 116 C - Yellow", hex: "#FEDD00" },
    { name: "PMS 348 C - Green", hex: "#007A33" },
    { name: "PMS 165 C - Orange", hex: "#FF671F" },
    { name: "PMS 293 C - Royal Blue", hex: "#003DA5" },
    { name: "PMS 185 C - Bright Red", hex: "#E4002B" },
    { name: "PMS 2592 C - Purple", hex: "#73237F" },
    { name: "PMS 7545 C - Graphite", hex: "#5B6770" },
    { name: "PMS 802 C - Vivid Green", hex: "#44D62C" },
    { name: "PMS 1235 C - Amber", hex: "#FFC72C" },
    { name: "PMS 376 C - Leaf Green", hex: "#84BD00" },
  ];

  function swatch(s) {
    return "<div class='flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5'>" +
      "<span class='w-6 h-6 rounded border border-white/20 shrink-0' style='background:" + s.hex + "'></span>" +
      "<span class='flex-1'><span class='block text-xs text-gray-100'>" + s.name + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + s.hex + "</span></span>" +
      "</div>";
  }

  api.ui.createPanel(
    PANEL_ID,
    "Pantone Palettes",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Popular coated spot colors.</p>" +
    PMS.map(swatch).join("") +
    "</div>"
  );

  api.ui.addToolbarButton({
    id: "presets-pantone-open",
    tooltip: "Pantone Palettes",
    icon: "BookMarked",
    onClick: function () {
      api.ui.showNotification("Pantone Palettes: reference panel open", "info");
    },
  });
})();