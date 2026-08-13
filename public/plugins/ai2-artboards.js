// Artboards — kaypaint plugin (ai2-artboards)
// Inserts a named artboard (with safe-area guides and label) onto the
// canvas via the canvas.addSvg API.

(function () {
  var PANEL_ID = "ai2-artboards-panel";
  var state = { size: "a4p", color: "#ffffff", label: "Artboard 1" };

  var SIZES = {
    a4p: { w: 297, h: 210, label: "A4 Portrait" },
    a4l: { w: 210, h: 297, label: "A4 Landscape" },
    a5: { w: 148, h: 210, label: "A5 Portrait" },
    card: { w: 148, h: 105, label: "Postcard" },
    ig: { w: 108, h: 108, label: "Square 1:1" },
    wide: { w: 320, h: 180, label: "16:9" },
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function buildArtboard() {
    var dim = SIZES[state.size] || SIZES.a4p;
    var w = dim.w, h = dim.h;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">');
    parts.push('<rect width="' + w + '" height="' + h + '" fill="' + state.color + '" stroke="#94a3b8" stroke-width="0.8"/>');
    parts.push('<rect x="' + w * 0.05 + '" y="' + h * 0.05 + '" width="' + w * 0.9 + '" height="' + h * 0.9 + '" fill="none" stroke="#cbd5e1" stroke-width="0.4" stroke-dasharray="2 2"/>');
    if (state.label) {
      parts.push(
        '<text x="' + w * 0.05 + '" y="' + h * 0.05 + '" font-family="Inter, Arial, sans-serif" font-size="' + Math.max(3, Math.round(w * 0.035)) + '" fill="#64748b" transform="translate(0,14)">' + esc(state.label) + "</text>"
      );
    }
    parts.push("</svg>");
    api.canvas.addSvg(parts.join(""), { name: "Artboard: " + state.label, scale: 1 }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Artboard inserted (" + dim.label + ")", "info");
      } else {
        api.ui.showNotification("Artboards: could not insert the artboard", "warning");
      }
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>SIZE</label>" +
      "<select data-plugin-action='size' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>";
    var keys = Object.keys(SIZES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      html += "<option value='" + k + "' " + (state.size === k ? "selected" : "") + ">" + SIZES[k].label + "</option>";
    }
    html +=
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>BACKGROUND</label>" +
      "<input type='color' data-plugin-action='color' value='" + state.color + "' class='w-full h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer mb-2' />" +
      "<label class='block text-[10px] text-gray-500 mb-1'>LABEL</label>" +
      "<input data-plugin-action='label' value='" + esc(state.label) + "' placeholder='Artboard 1' class='w-full text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600 mb-2' />" +
      "<button data-plugin-action='insert' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100'>Insert Artboard</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Artboards", html);
  }

  api.ui.onPanelAction(PANEL_ID, "size", function (value) {
    if (value) { state.size = value; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "color", function (value) { if (value) state.color = value; });
  api.ui.onPanelAction(PANEL_ID, "label", function (value) { state.label = value; });
  api.ui.onPanelAction(PANEL_ID, "insert", buildArtboard);

  render();

  api.ui.addToolbarButton({
    id: "ai2-artboards-insert",
    tooltip: "Insert Artboard",
    icon: "Frame",
    onClick: buildArtboard,
  });
})();