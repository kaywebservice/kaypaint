// Type Kerning — kaypaint plugin (type-kerning)
// Adjusts letter-spacing (tracking) of the active text layer, plus numeric
// size/weight quick actions, via the canvas.text API.

(function () {
  var PANEL_ID = "type-kerning-panel";
  var state = { tracking: 0 };

  function apply(tracking) {
    var ok = api.text.setStyle({ letterSpacing: tracking });
    if (!ok) {
      api.ui.showNotification("Type Kerning: select a text layer first", "warning");
      return false;
    }
    return true;
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Fine-tune letter spacing on the active text layer</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Tracking: " + (state.tracking > 0 ? "+" : "") + state.tracking + " px</span>" +
      "</div>" +
      "<input type='range' data-plugin-action='tracking' min='-10' max='60' step='1' value='" + state.tracking + "' class='w-full accent-emerald-400' />" +
      "<div class='grid grid-cols-4 gap-1'>" +
      "<button data-plugin-action='tight' data-value='1' class='text-left px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Tight</span><span class='block text-[9px] text-gray-500'>-2</span></button>" +
      "<button data-plugin-action='normal' data-value='1' class='text-left px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Normal</span><span class='block text-[9px] text-gray-500'>0</span></button>" +
      "<button data-plugin-action='wide' data-value='1' class='text-left px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Wide</span><span class='block text-[9px] text-gray-500'>+4</span></button>" +
      "<button data-plugin-action='poster' data-value='1' class='text-left px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Poster</span><span class='block text-[9px] text-gray-500'>+16</span></button>" +
      "</div>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>EXTRA</label>" +
      "<div class='flex gap-1'>" +
      "<button data-plugin-action='weight' data-value='bold' class='flex-1 px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Bold</span></button>" +
      "<button data-plugin-action='upsize' data-value='1' class='flex-1 px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Size +4</span></button>" +
      "<button data-plugin-action='downsize' data-value='1' class='flex-1 px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>Size −4</span></button>" +
      "</div>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Type Kerning", html);
  }

  api.ui.onPanelAction(PANEL_ID, "tracking", function (value) {
    var n = parseInt(value, 10);
    if (!isNaN(n)) { state.tracking = n; render(); apply(n); }
  });
  api.ui.onPanelAction(PANEL_ID, "tight", function () { state.tracking = -2; render(); apply(-2); });
  api.ui.onPanelAction(PANEL_ID, "normal", function () { state.tracking = 0; render(); apply(0); });
  api.ui.onPanelAction(PANEL_ID, "wide", function () { state.tracking = 4; render(); apply(4); });
  api.ui.onPanelAction(PANEL_ID, "poster", function () { state.tracking = 16; render(); apply(16); });
  api.ui.onPanelAction(PANEL_ID, "weight", function (value) {
    if (value) api.text.setStyle({ fontWeight: value });
  });
  api.ui.onPanelAction(PANEL_ID, "upsize", function () {
    var info = api.text.getActive();
    if (info && info.isText) api.text.setStyle({ fontSize: info.fontSize + 4 });
  });
  api.ui.onPanelAction(PANEL_ID, "downsize", function () {
    var info = api.text.getActive();
    if (info && info.isText) api.text.setStyle({ fontSize: Math.max(4, info.fontSize - 4) });
  });

  render();

  api.ui.addToolbarButton({
    id: "type-kerning-apply",
    tooltip: "Type Kerning",
    icon: "AlignCenter",
    onClick: function () { apply(state.tracking); },
  });
})();