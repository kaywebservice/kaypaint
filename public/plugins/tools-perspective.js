// Perspective Guide Tool — kaypaint plugin (tools-perspective)
// Creates one/two/three-point perspective guide layers.

(function () {
  var PANEL_ID = "tools-perspective-panel";

  function addGuide(name) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Perspective Guide: created \"" + name + "\"", "info");
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
    var hasGuide = layers.some(function (l) { return /perspective|vanishing/i.test(l.name); });
    api.ui.createPanel(
      PANEL_ID,
      "Perspective Guide Tool",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + (hasGuide ? "Guide layers already on canvas." : "Add vanishing-point guide layers.") + "</p>" +
      button("one", "1-Point Guide", "Single vanishing point") +
      button("two", "2-Point Guide", "Corner perspective pair") +
      button("three", "3-Point Guide", "Full aerial perspective") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "one", function () { addGuide("1-Point Perspective Guide"); });
  api.ui.onPanelAction(PANEL_ID, "two", function () { addGuide("2-Point Perspective Guide"); });
  api.ui.onPanelAction(PANEL_ID, "three", function () { addGuide("3-Point Perspective Guide"); });

  refresh();

  api.ui.addToolbarButton({
    id: "tools-perspective-one",
    tooltip: "Perspective Guide (1-point)",
    icon: "PenTool",
    onClick: function () { addGuide("1-Point Perspective Guide"); },
  });
})();