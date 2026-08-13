// Pathfinder Panel — kaypaint plugin (ai2-pathfinder)
// Unite, intersect and subtract shapes via the vector pathfinder engine.

(function () {
  var PANEL_ID = "ai2-pathfinder-panel";

  function run(op, label) {
    api.canvas.pathfinder(op).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Pathfinder: " + label + " applied", "success");
      } else {
        api.ui.showNotification("Pathfinder: select exactly two shapes first", "warning");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Boolean path operations</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Select two overlapping shapes, then run an operation. The result is a single path.</span>" +
      "</div>" +
      "<button data-plugin-action='unite' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Unite</span></button>" +
      "<button data-plugin-action='minus' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100 text-sm'>Minus Front</span></button>" +
      "<button data-plugin-action='intersect' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100 text-sm'>Intersect</span></button>" +
      "<button data-plugin-action='divide' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100 text-sm'>Subtract (Front − Back)</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Pathfinder", html);
  }

  api.ui.onPanelAction(PANEL_ID, "unite", function () { run("union", "Unite"); });
  api.ui.onPanelAction(PANEL_ID, "minus", function () { run("subtract", "Minus Front"); });
  api.ui.onPanelAction(PANEL_ID, "intersect", function () { run("intersect", "Intersect"); });
  api.ui.onPanelAction(PANEL_ID, "divide", function () { run("subtract", "Subtract"); });

  render();

  api.ui.addToolbarButton({
    id: "ai2-pathfinder-unite",
    tooltip: "Pathfinder: Unite",
    icon: "Shapes",
    onClick: function () { run("union", "Unite"); },
  });
})();