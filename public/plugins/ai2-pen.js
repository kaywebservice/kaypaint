// Vector Pen Suite — kaypaint plugin (ai2-pen)
// Launches the full pen tool (bezier curves + anchor editing + pathfinder)
// and inserts reusable sample curves. Backed by the built-in pen tool and
// the vector pathfinder engine.

(function () {
  var PANEL_ID = "ai2-pen-panel";

  var SAMPLES = {
    wave: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><path d="M 20 100 C 80 20, 120 20, 180 100 S 320 180, 380 100" fill="none" stroke="#000000" stroke-width="2"/></svg>',
    leaf: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><path d="M 10 110 C 30 40, 170 20, 190 10 C 170 70, 120 100, 10 110 Z" fill="none" stroke="#000000" stroke-width="2"/></svg>',
    heart: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180"><path d="M 100 160 C 20 100, 20 40, 70 40 C 85 40, 95 50, 100 62 C 105 50, 115 40, 130 40 C 180 40, 180 100, 100 160 Z" fill="none" stroke="#000000" stroke-width="2"/></svg>',
  };

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Vector pen suite</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Click anchors to place points; drag to pull out bezier handles. Double-click a finished path to edit its anchors. Alt-drag breaks handle symmetry.</span>" +
      "</div>" +
      "<button data-plugin-action='pen' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Open Pen Tool</span></button>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>INSERT SAMPLE CURVE</label>" +
      "<div class='grid grid-cols-3 gap-1'>" +
      "<button data-plugin-action='wave' data-value='1' class='px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Wave</span></button>" +
      "<button data-plugin-action='leaf' data-value='1' class='px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Leaf</span></button>" +
      "<button data-plugin-action='heart' data-value='1' class='px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Heart</span></button>" +
      "</div>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Vector Pen Suite", html);
  }

  function insert(kind) {
    api.canvas.addSvg(SAMPLES[kind], { name: "Sample curve: " + kind, scale: 1 }).then(function (ok) {
      api.ui.showNotification(
        ok ? "Sample curve inserted — double-click it to edit anchors" : "Could not insert the curve",
        ok ? "info" : "warning"
      );
    });
  }

  api.ui.onPanelAction(PANEL_ID, "pen", function () {
    api.tools.setActive("pen");
    api.ui.showNotification("Pen tool active — click to add anchors, drag for curves", "info");
  });
  api.ui.onPanelAction(PANEL_ID, "wave", function () { insert("wave"); });
  api.ui.onPanelAction(PANEL_ID, "leaf", function () { insert("leaf"); });
  api.ui.onPanelAction(PANEL_ID, "heart", function () { insert("heart"); });

  render();

  api.ui.addToolbarButton({
    id: "ai2-pen-open",
    tooltip: "Open Pen Tool",
    icon: "PenTool",
    onClick: function () {
      api.tools.setActive("pen");
    },
  });
})();