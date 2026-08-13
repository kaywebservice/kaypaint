// Isometric Grid Tool — kaypaint plugin (tools-isometric)
// Creates isometric grid guide layers in 30/60/90 perspective.

(function () {
  var PANEL_ID = "tools-isometric-panel";

  function addGrid(name) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Isometric Grid: created \"" + name + "\"", "info");
        refresh();
      }
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

  function refresh() {
    var layers = api.layers.getAll();
    var hasGrid = layers.some(function (l) { return /iso|grid/i.test(l.name); });
    api.ui.createPanel(
      PANEL_ID,
      "Isometric Grid Tool",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + (hasGrid ? "Grid layers already on canvas." : "Add axis guides for isometric drawing.") + "</p>" +
      button("grid", "Isometric Grid", "30/60/90 axis guide layer") +
      button("base", "Base Plane", "Ground plane guide layer") +
      button("top", "Top Plane", "Ceiling plane guide layer") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "grid", function () { addGrid("Isometric Grid"); });
  api.ui.onPanelAction(PANEL_ID, "base", function () { addGrid("Isometric Base Plane"); });
  api.ui.onPanelAction(PANEL_ID, "top", function () { addGrid("Isometric Top Plane"); });

  refresh();

  api.ui.addToolbarButton({
    id: "tools-isometric-grid",
    tooltip: "Isometric Grid (add guide)",
    icon: "PenTool",
    onClick: function () { addGrid("Isometric Grid"); },
  });
})();