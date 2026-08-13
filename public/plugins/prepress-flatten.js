// Flatten Checker — kaypaint plugin (prepress-flatten)
// Scans layers for pre-print flattening risks.

(function () {
  var PANEL_ID = "prepress-flatten-panel";

  function scan() {
    var layers = api.layers.getAll();
    var risky = layers.filter(function (l) { return l.blendMode && l.blendMode !== "normal"; });
    var semi = layers.filter(function (l) { return l.opacity !== undefined && l.opacity < 100; });
    var locked = layers.filter(function (l) { return l.locked; });
    var issues = 0;
    if (risky.length) issues++;
    if (semi.length) issues++;
    if (locked.length) issues++;

    var summary =
      "<p class='text-gray-400 mb-2'>Checked " + layers.length + " layers.</p>" +
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'><span class='text-sm " + (risky.length ? "text-yellow-300" : "text-emerald-300") + "'>" + risky.length + " non-normal blend modes</span><span class='block text-[10px] text-gray-500'>May flatten unpredictably in print</span></div>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'><span class='text-sm " + (semi.length ? "text-yellow-300" : "text-emerald-300") + "'>" + semi.length + " partially transparent layers</span><span class='block text-[10px] text-gray-500'>Opacity below 100%</span></div>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'><span class='text-sm " + (locked.length ? "text-gray-300" : "text-emerald-300") + "'>" + locked.length + " locked layers</span><span class='block text-[10px] text-gray-500'>Locked before flatten</span></div>" +
      "</div>";

    api.ui.createPanel(
      PANEL_ID,
      "Flatten Checker",
      "<div class='space-y-1.5'>" + summary +
      "<button data-plugin-action='rescan' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100'>Re-scan Document</span></button>" +
      "</div>"
    );

    api.ui.showNotification(
      "Flatten Checker: " + issues + (issues === 1 ? " risk found" : " risks found") + (issues === 0 ? " — document is print-clean" : ""),
      issues === 0 ? "info" : "warning"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "rescan", scan);

  scan();

  api.ui.addToolbarButton({
    id: "prepress-flatten-scan",
    tooltip: "Flatten Checker (Scan)",
    icon: "Printer",
    onClick: scan,
  });
})();