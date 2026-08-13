// Shape Builder Tool — kaypaint plugin (ai2-shapebuilder)
// Merges or cuts overlapping shapes by running the vector pathfinder engine
// on the selected shapes.

(function () {
  var PANEL_ID = "ai2-shapebuilder-panel";

  function run(op, label) {
    api.canvas.pathfinder(op).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Shape Builder: " + label + " applied", "success");
      } else {
        api.ui.showNotification("Shape Builder: select exactly two shapes first", "warning");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Merge and cut shapes</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Select two overlapping shapes, then pick an operation. The result replaces both with a single path.</span>" +
      "</div>" +
      "<button data-plugin-action='unite' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Unite (merge)</span></button>" +
      "<button data-plugin-action='intersect' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100 text-sm'>Intersect</span></button>" +
      "<button data-plugin-action='subtract' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100 text-sm'>Subtract Front</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Shape Builder", html);
  }

  api.ui.onPanelAction(PANEL_ID, "unite", function () { run("union", "Unite"); });
  api.ui.onPanelAction(PANEL_ID, "intersect", function () { run("intersect", "Intersect"); });
  api.ui.onPanelAction(PANEL_ID, "subtract", function () { run("subtract", "Subtract"); });

  render();

  api.ui.addToolbarButton({
    id: "ai2-shapebuilder-open",
    tooltip: "Shape Builder",
    icon: "Shapes",
    onClick: function () { run("union", "Unite"); },
  });
})();