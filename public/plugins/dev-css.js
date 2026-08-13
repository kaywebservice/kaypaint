// CSS & Specs Exporter — kaypaint plugin (dev-css)
// Export layer specs as CSS custom rules.

(function () {
  var PANEL_ID = "dev-css-panel";

  function cssName(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "layer";
  }

  function refresh() {
    var layers = api.layers.getAll();
    var css = layers.map(function (l, i) {
      var opacity = (typeof l.opacity === "number" ? l.opacity : 100) / 100;
      return "." + cssName(l.name) + "-" + i + " {\n" +
        "  layer: \"" + l.name + "\";\n" +
        "  opacity: " + opacity.toFixed(2) + ";\n" +
        "  mix-blend-mode: " + (l.blendMode || "normal") + ";\n" +
        (l.locked ? "  pointer-events: none;\n" : "") +
        (l.visible ? "  display: block;\n" : "  display: none;\n") +
        "}";
    }).join("\n\n") || "/* No layers on canvas yet. */";

    api.ui.createPanel(
      PANEL_ID,
      "CSS & Specs Exporter",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + layers.length + " layers exported as specs.</p>" +
      "<pre class='text-[10px] leading-relaxed text-emerald-300 bg-white/5 border border-white/10 rounded-md p-2 max-h-56 overflow-auto'>" + css.replace(/</g, "&lt;") + "</pre>" +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "refresh", refresh);

  refresh();

  api.ui.addToolbarButton({
    id: "dev-css-open",
    tooltip: "CSS & Specs Exporter",
    icon: "Code",
    onClick: refresh,
  });
})();