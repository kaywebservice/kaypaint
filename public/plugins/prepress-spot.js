// Trapping & Spot Colors — kaypaint plugin (prepress-spot)
// Spot-color reference layers for print separations.

(function () {
  var PANEL_ID = "prepress-spot-panel";

  var SPOTS = [
    { name: "PANTONE 485 C", hex: "#DA291C" },
    { name: "PANTONE 300 C", hex: "#005EB8" },
    { name: "PANTONE 872 C (Metallic)", hex: "#84754E" },
    { name: "PANTONE 348 C", hex: "#007A33" },
  ];

  function newSpot(name) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Spot Colors: created \"" + name + "\" separation layer", "info");
        refresh();
      }
    });
  }

  function refresh() {
    var layers = api.layers.getAll();
    var hasSpot = layers.some(function (l) { return /spot|pantone/i.test(l.name); });
    var swatches = SPOTS.map(function (s) {
      return "<div class='flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5'>" +
        "<span class='w-6 h-6 rounded border border-white/20 shrink-0' style='background:" + s.hex + "'></span>" +
        "<span class='flex-1 text-xs text-gray-100'>" + s.name + "</span>" +
        "<button data-plugin-action='spot-" + s.name + "' class='text-[10px] text-gray-300 border border-white/10 rounded px-1.5 py-0.5 bg-white/5'>Add</button>" +
        "</div>";
    }).join("");
    api.ui.createPanel(
      PANEL_ID,
      "Trapping & Spot Colors",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + (hasSpot ? "Spot layers detected on canvas." : "No spot layers yet — add a separation layer.") + "</p>" +
      swatches +
      "</div>"
    );
  }

  SPOTS.forEach(function (s) {
    api.ui.onPanelAction(PANEL_ID, "spot-" + s.name, function () { newSpot(s.name + " Spot"); });
  });

  refresh();

  api.ui.addToolbarButton({
    id: "prepress-spot-open",
    tooltip: "Spot Colors (add spot layer)",
    icon: "Printer",
    onClick: refresh,
  });
})();