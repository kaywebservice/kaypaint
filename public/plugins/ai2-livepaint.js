// Live Paint — kaypaint plugin (ai2-livepaint)
// Fill overlapping shapes fast: recolor the active path's interior with a
// live preview color, or run the pathfinder to merge before filling.

(function () {
  var PANEL_ID = "ai2-livepaint-panel";
  var state = { color: "#3b82f6" };

  function fill() {
    var ok = api.canvas.setFill(state.color);
    api.ui.showNotification(
      ok ? "Live Paint: fill applied to the active shape" : "Live Paint: select a shape to fill first",
      ok ? "info" : "warning"
    );
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Live fill across paths</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Pick a color and fill the active shape. To fill overlapping shapes as one region, run Shape Builder → Unite first.</span>" +
      "</div>" +
      "<input type='color' data-plugin-action='color' value='" + state.color + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
      "<button data-plugin-action='fill' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Fill Active Shape</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Live Paint", html);
  }

  api.ui.onPanelAction(PANEL_ID, "color", function (value) { if (value) state.color = value; });
  api.ui.onPanelAction(PANEL_ID, "fill", fill);

  render();

  api.ui.addToolbarButton({
    id: "ai2-livepaint-fill",
    tooltip: "Live Paint Fill",
    icon: "PaintBucket",
    onClick: fill,
  });
})();