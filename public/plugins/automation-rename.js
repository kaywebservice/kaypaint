// Batch Rename Suite — kaypaint plugin (automation-rename)
// Dry-run preview of rename templates against your layers.

(function () {
  var PANEL_ID = "automation-rename-panel";

  function esc(s) {
    return String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function preview() {
    var layers = api.layers.getAll();
    var templates = [
      { label: "kebab-case (#1)", fn: function (l, i) { return "layer-" + (i + 1) + "-" + l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); } },
      { label: "Title Up (#1)", fn: function (l, i) { return "Layer " + (i + 1) + " — " + l.name; } },
      { label: "Numbered only", fn: function (l, i) { return "Layer_" + String(i + 1).padStart(2, "0"); } },
    ];
    var rows = templates.map(function (t, ti) {
      var items = layers.slice(0, 8).map(function (l, i) {
        return "<div class='flex justify-between text-[11px] text-gray-400'><span class='truncate'>" + esc(l.name) + "</span><span class='text-gray-200 ml-2 truncate'>→ " + esc(t.fn(l, i)) + "</span></div>";
      }).join("");
      return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
        "<span class='block text-sm text-gray-100'>" + t.label + "</span>" +
        "<div class='mt-1 space-y-0.5'>" + items + "</div>" +
        "</div>";
    }).join("");
    api.ui.createPanel(
      PANEL_ID,
      "Batch Rename Suite",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Dry-run preview for " + layers.length + " layers.</p>" +
      rows +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "refresh", preview);

  preview();

  api.ui.addToolbarButton({
    id: "automation-rename-preview",
    tooltip: "Batch Rename (dry-run)",
    icon: "Cpu",
    onClick: preview,
  });
})();