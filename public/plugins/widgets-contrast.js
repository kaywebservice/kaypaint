// Color Contrast Checker — kaypaint plugin (widgets-contrast)
// Live WCAG AA/AAA contrast testing between two colors.

(function () {
  var PANEL_ID = "contrast-panel";
  var fg = "#ffffff";
  var bg = "#111827";

  function channel(c) {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    var clean = hex.length === 4
      ? "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      : hex;
    var r = parseInt(clean.slice(1, 3), 16) / 255;
    var g = parseInt(clean.slice(3, 5), 16) / 255;
    var b = parseInt(clean.slice(5, 7), 16) / 255;
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function ratio() {
    var l1 = luminance(fg);
    var l2 = luminance(bg);
    var hi = l1 > l2 ? l1 : l2;
    var lo = l1 > l2 ? l2 : l1;
    return (hi + 0.05) / (lo + 0.05);
  }

  function badge(min, label) {
    var pass = ratio() >= min;
    return (
      "<div class='rounded-md bg-white/5 border border-white/10 p-2 text-center'>" +
      "<div class='text-[10px] text-gray-500'>" + label + "</div>" +
      "<div class='font-semibold " + (pass ? "text-emerald-300" : "text-red-300") + "'>" +
      (pass ? "PASS" : "FAIL") + "</div>" +
      "</div>"
    );
  }

  function render() {
    var r = ratio();
    api.ui.createPanel(
      PANEL_ID,
      "Contrast Checker",
      "<div class='space-y-2'>" +
      "<div class='flex items-center gap-2'>" +
      "<label class='flex-1 text-gray-400'>Text" +
      "<input type='color' data-plugin-action='fg' value='" + fg + "' " +
      "class='mt-1 w-full h-8 rounded cursor-pointer bg-transparent border border-white/10' /></label>" +
      "<label class='flex-1 text-gray-400'>Background" +
      "<input type='color' data-plugin-action='bg' value='" + bg + "' " +
      "class='mt-1 w-full h-8 rounded cursor-pointer bg-transparent border border-white/10' /></label>" +
      "</div>" +
      "<div class='rounded-lg p-3 text-center border border-white/10' style='background:" + bg + ";color:" + fg + "'>" +
      "<span class='text-sm font-semibold'>Sample text</span>" +
      "</div>" +
      "<div class='text-center text-lg font-bold text-white'>" + r.toFixed(2) + ":1</div>" +
      "<div class='grid grid-cols-2 gap-1.5'>" +
      badge(4.5, "AA Normal") +
      badge(3, "AA Large") +
      badge(7, "AAA Normal") +
      badge(4.5, "AAA Large") +
      "</div>" +
      "</div>"
    );
  }

  function persist() {
    storage.set("colors", JSON.stringify({ fg: fg, bg: bg }));
  }

  storage.get("colors").then(function (saved) {
    if (saved) {
      try {
        var parsed = JSON.parse(saved);
        if (parsed.fg) fg = parsed.fg;
        if (parsed.bg) bg = parsed.bg;
      } catch (e) {
        // keep defaults
      }
    }
    render();
  });

  api.ui.onPanelAction(PANEL_ID, "fg", function (value) {
    if (!value) return;
    fg = value;
    persist();
    render();
  });
  api.ui.onPanelAction(PANEL_ID, "bg", function (value) {
    if (!value) return;
    bg = value;
    persist();
    render();
  });
})();
