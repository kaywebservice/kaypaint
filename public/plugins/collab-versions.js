// Version Snapshots — kaypaint plugin (collab-versions)
// Navigate document history snapshots from a panel.

(function () {
  var PANEL_ID = "collab-versions-panel";
  var MAX_SLOTS = 10;

  function bindSlot(slot) {
    api.ui.onPanelAction(PANEL_ID, "jump-" + slot, function () {
      var stack = api.history.getStack();
      var index = stack.length - 1 - slot;
      if (index < 0 || index >= stack.length) return;
      api.history.jumpTo(index);
      api.ui.showNotification("Version Snapshots: restored #" + (index + 1), "info");
      setTimeout(refresh, 200);
    });
  }

  function refresh() {
    var stack = api.history.getStack();
    var visible = stack.slice(-MAX_SLOTS).reverse();
    var rows = visible
      .map(function (step, i) {
        var slot = stack.length - 1 - i;
        return "<button data-plugin-action='jump-" + slot + "' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'>" +
          "<span class='block text-gray-100'>" + step.name + "</span>" +
          "<span class='block text-[10px] text-gray-500'>Snapshot #" + (stack.length - i) + " of " + stack.length + "</span>" +
          "</button>";
      })
      .join("");
    api.ui.createPanel(
      PANEL_ID,
      "Version Snapshots",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + stack.length + " snapshots recorded.</p>" +
      (stack.length ? rows : "<p class='text-gray-500 text-sm'>No history yet.</p>") +
      "<button data-plugin-action='undo' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100'>Undo</span></button>" +
      "<button data-plugin-action='redo' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100'>Redo</span></button>" +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "undo", function () {
    api.history.undo();
    api.ui.showNotification("Version Snapshots: stepped back", "info");
    setTimeout(refresh, 150);
  });
  api.ui.onPanelAction(PANEL_ID, "redo", function () {
    api.history.redo();
    api.ui.showNotification("Version Snapshots: stepped forward", "info");
    setTimeout(refresh, 150);
  });

  for (var s = 0; s < MAX_SLOTS; s++) bindSlot(s);

  refresh();
})();