// Typography Scale — kaypaint plugin (widgets-typography)
// Modular type scale calculator with classic ratio presets.

(function () {
  var PANEL_ID = "type-scale-panel";
  var base = 16;
  var ratio = 1.333;

  var RATIOS = [
    { action: "r1.2", label: "1.200", name: "Minor Third", value: 1.2 },
    { action: "r1.25", label: "1.250", name: "Major Third", value: 1.25 },
    { action: "r1.333", label: "1.333", name: "Perfect Fourth", value: 1.333 },
    { action: "r1.414", label: "1.414", name: "Augmented Fourth", value: 1.414 },
    { action: "r1.5", label: "1.500", name: "Perfect Fifth", value: 1.5 },
    { action: "r1.618", label: "1.618", name: "Golden Ratio", value: 1.618 }
  ];

  function stepName(i) {
    if (i === 0) return "Base";
    return "H" + i;
  }

  function render() {
    var rows = "";
    var size = base;
    for (var i = 0; i < 6; i++) {
      var display = Math.max(8, Math.round(size));
      rows +=
        "<div class='flex items-baseline justify-between border-b border-white/5 py-1'>" +
        "<span class='text-white' style='font-size:" + display + "px;line-height:1.25'>Ag</span>" +
        "<span class='text-[10px] text-gray-500 whitespace-nowrap ml-2'>" +
        stepName(i) + " · " + size.toFixed(1) + "px</span>" +
        "</div>";
      size = size * ratio;
    }

    var ratioButtons = "";
    for (var j = 0; j < RATIOS.length; j++) {
      var r = RATIOS[j];
      var active = Math.abs(ratio - r.value) < 0.001;
      ratioButtons +=
        "<button data-plugin-action='" + r.action + "' " +
        "class='px-2 py-1 rounded-md text-[10px] border transition-colors " +
        (active
          ? "bg-indigo-500/20 text-indigo-200 border-indigo-400/40"
          : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10") + "'>" +
        r.label + "</button>";
    }

    api.ui.createPanel(
      PANEL_ID,
      "Type Scale",
      "<div class='space-y-2'>" +
      "<label class='flex items-center gap-2 text-gray-400'>Base size" +
      "<input type='number' data-plugin-action='base' value='" + base + "' min='6' max='144' " +
      "class='w-16 rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-white' />px</label>" +
      "<div class='flex flex-wrap gap-1'>" + ratioButtons + "</div>" +
      "<div>" + rows + "</div>" +
      "<p class='text-[10px] text-gray-500'>Ratio " + ratio.toFixed(3) + " — modular scale</p>" +
      "</div>"
    );
  }

  function persist() {
    storage.set("scale", JSON.stringify({ base: base, ratio: ratio }));
  }

  storage.get("scale").then(function (saved) {
    if (saved) {
      try {
        var parsed = JSON.parse(saved);
        if (parsed.base > 0) base = parsed.base;
        if (parsed.ratio > 0) ratio = parsed.ratio;
      } catch (e) {
        // keep defaults
      }
    }
    render();
  });

  api.ui.onPanelAction(PANEL_ID, "base", function (value) {
    var n = parseFloat(value);
    if (!n || n < 1) return;
    base = n;
    persist();
    render();
  });
  for (var k = 0; k < RATIOS.length; k++) {
    (function (entry) {
      api.ui.onPanelAction(PANEL_ID, entry.action, function () {
        ratio = entry.value;
        persist();
        render();
      });
    })(RATIOS[k]);
  }
})();
