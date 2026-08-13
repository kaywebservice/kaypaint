// Variable Type — kaypaint plugin (type-variable)
// Adjust the active text object's family, size, weight and style live,
// backed by the canvas.text API. Offers quick presets for body / display /
// heading sizing and variable-weight stepping.

(function () {
  var PANEL_ID = "type-variable-panel";
  var state = { family: "Inter", size: 48, weight: "400", tracking: 0, italic: false };

  var FONTS = ["Inter", "Roboto", "Poppins", "Montserrat", "Playfair Display", "Georgia", "Courier New", "Arial"];

  function sizePresets() {
    return [
      { label: "Caption", v: 14 },
      { label: "Body", v: 24 },
      { label: "Heading", v: 48 },
      { label: "Display", v: 96 },
    ];
  }

  function apply() {
    var patch = { fontFamily: state.family, fontSize: state.size, fontWeight: String(state.weight) };
    if (state.tracking !== 0) patch.letterSpacing = state.tracking;
    if (state.italic) patch.fontStyle = "italic";
    var ok = api.text.setStyle(patch);
    if (!ok) {
      api.ui.showNotification("Variable Type: select a text layer first", "warning");
    }
  }

  function syncFromActive() {
    var info = api.text.getActive();
    if (info && info.isText) {
      state.family = info.fontFamily;
      state.size = info.fontSize;
      state.weight = String(info.fontWeight === "normal" ? "400" : info.fontWeight === "bold" ? "700" : info.fontWeight || "400");
      state.tracking = info.letterSpacing || 0;
      state.italic = info.fontStyle === "italic";
      render();
    }
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Adjust the selected text layer</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Font, size, weight and style — applied live to the active text object.</span>" +
      "</div>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>FONT</label>" +
      "<select data-plugin-action='family' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>";
    for (var i = 0; i < FONTS.length; i++) {
      html += "<option value='" + FONTS[i] + "' " + (state.family === FONTS[i] ? "selected" : "") + ">" + FONTS[i] + "</option>";
    }
    html +=
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>SIZE — " + state.size + " px</label>" +
      "<input type='range' data-plugin-action='size' min='8' max='200' step='1' value='" + state.size + "' class='w-full accent-emerald-400' />" +
      "<div class='grid grid-cols-4 gap-1'>";
    var presets = sizePresets();
    for (var p = 0; p < presets.length; p++) {
      html += "<button data-plugin-action='sizePreset' data-value='" + presets[p].v + "' class='text-left px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[10px] text-gray-100'>" + presets[p].label + "</span><span class='block text-[9px] text-gray-500'>" + presets[p].v + "px</span></button>";
    }
    html +=
      "</div>" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>WEIGHT — " + state.weight + "</label>" +
      "<input type='range' data-plugin-action='weight' min='100' max='900' step='100' value='" + state.weight + "' class='w-full accent-emerald-400' />" +
      "<label class='block text-[10px] text-gray-500 mt-2 mb-1'>TRACKING — " + (state.tracking > 0 ? "+" : "") + state.tracking + "</label>" +
      "<input type='range' data-plugin-action='tracking' min='-10' max='50' step='1' value='" + state.tracking + "' class='w-full accent-emerald-400' />" +
      "<label class='flex items-center gap-2 mt-2 text-xs text-gray-200'><input type='checkbox' data-plugin-action='italic' data-value='1' " + (state.italic ? "checked" : "") + " class='accent-emerald-400' /> Italic</label>" +
      "<button data-plugin-action='apply' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Apply Type</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Variable Type", html);
  }

  api.ui.onPanelAction(PANEL_ID, "family", function (value) {
    if (value) { state.family = value; render(); apply(); }
  });
  api.ui.onPanelAction(PANEL_ID, "size", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) { state.size = n; render(); apply(); }
  });
  api.ui.onPanelAction(PANEL_ID, "sizePreset", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) { state.size = n; render(); apply(); }
  });
  api.ui.onPanelAction(PANEL_ID, "weight", function (value) {
    var n = parseInt(value, 10);
    if (n >= 100 && n <= 900) { state.weight = String(n); render(); apply(); }
  });
  api.ui.onPanelAction(PANEL_ID, "tracking", function (value) {
    var n = parseInt(value, 10);
    if (!isNaN(n)) { state.tracking = n; render(); apply(); }
  });
  api.ui.onPanelAction(PANEL_ID, "italic", function () {
    state.italic = !state.italic;
    render();
    apply();
  });
  api.ui.onPanelAction(PANEL_ID, "apply", apply);

  syncFromActive();
  render();

  api.ui.addToolbarButton({
    id: "type-variable-apply",
    tooltip: "Variable Type",
    icon: "Type",
    onClick: apply,
  });
})();