// Batch Filter Runner — kaypaint plugin (batch-filters)
// Apply one filter preset across every layer on the canvas.

(function () {
  var PANEL_ID = "batch-filters-panel";

  function applyToAll(name, options, label) {
    var layers = api.layers.getAll();
    if (!layers.length) {
      api.ui.showNotification("Batch Filter: no layers on canvas", "warning");
      return;
    }
    var done = 0;
    layers.forEach(function (layer) {
      api.layers.setActive(layer.id);
      api.filters.apply(name, options).then(function (ok) { if (ok) done++; });
    });
    setTimeout(function () {
      api.ui.showNotification("Batch Filter: " + label + " applied to " + done + "/" + layers.length + " layers", done === layers.length ? "info" : "warning");
    }, 250);
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
    "Batch Filter Runner",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Applies the chosen look to every layer at once.</p>" +
    button("flat", "Flat Grade", "Uniform contrast across all layers") +
    button("bw", "Batch B&W", "Grayscale on every layer") +
    button("pop", "Batch Pop", "Saturation boost on every layer") +
    button("soft", "Batch Soften", "Subtle blur on every layer") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "flat", function () { applyToAll("contrast", { contrast: 0.12 }, "Flat Grade"); });
  api.ui.onPanelAction(PANEL_ID, "bw", function () { applyToAll("grayscale", {}, "Batch B&W"); });
  api.ui.onPanelAction(PANEL_ID, "pop", function () { applyToAll("saturation", { saturation: 1.25 }, "Batch Pop"); });
  api.ui.onPanelAction(PANEL_ID, "soft", function () { applyToAll("blur", { blur: 0.02 }, "Batch Soften"); });

  api.ui.addToolbarButton({
    id: "batch-filters-bw",
    tooltip: "Batch Filter (B&W all layers)",
    icon: "Workflow",
    onClick: function () { applyToAll("grayscale", {}, "Batch B&W"); },
  });
})();