// Ink Sketch Pack — kaypaint plugin (filters-ink)
// Sketch, crosshatch and ink wash illustration looks.

(function () {
  var PANEL_ID = "filters-ink-panel";

  function applyInk(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Ink Sketch: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to ink", "warning");
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
    "Ink Sketch Pack",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Illustration and ink looks for the selected object.</p>" +
    "<div class='flex gap-2'>" +
    "<button data-plugin-action='linework' class='flex-1 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-100 transition-colors'>Sketch Linework</button>" +
    "<button data-plugin-action='wash' class='flex-1 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-100 transition-colors'>Ink Wash</button>" +
    "</div>" +
    button("deep", "Deep Ink", "Dark dramatic blacks") +
    button("grit", "Charcoal Grit", "Rough textured grain") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "linework", function () { applyInk("grayscale", {}, "Sketch Linework"); });
  api.ui.onPanelAction(PANEL_ID, "wash", function () { applyInk("brightness", { brightness: 0.12 }, "Ink Wash"); });
  api.ui.onPanelAction(PANEL_ID, "deep", function () { applyInk("contrast", { contrast: 0.35 }, "Deep Ink"); });
  api.ui.onPanelAction(PANEL_ID, "grit", function () { applyInk("noise", { noise: 22 }, "Charcoal Grit"); });

  api.ui.addToolbarButton({
    id: "filters-ink-linework",
    tooltip: "Ink Sketch (Linework)",
    icon: "Brush",
    onClick: function () { applyInk("grayscale", {}, "Sketch Linework"); },
  });
})();