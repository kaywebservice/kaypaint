// Font & Palette Library — kaypaint plugin (asset-library)
// Store and recall named colors in a personal library.

(function () {
  var PANEL_ID = "asset-library-panel";
  var KEY = "lib.palette";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function load() {
    return storage.get(KEY).then(function (raw) {
      try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
    });
  }

  function save(list) {
    return storage.set(KEY, JSON.stringify(list));
  }

  function refresh() {
    load().then(function (list) {
      var rows = list
        .map(function (item, i) {
          return "<div class='flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5'>" +
            "<span class='w-6 h-6 rounded border border-white/20 shrink-0' style='background:" + esc(item.hex) + "'></span>" +
            "<span class='flex-1'><span class='block text-xs text-gray-100'>" + esc(item.name) + "</span>" +
            "<span class='block text-[10px] text-gray-500'>" + esc(item.hex) + "</span></span>" +
            "<button data-plugin-action='remove-" + i + "' class='text-[10px] text-red-300 hover:text-red-200 border border-red-400/20 rounded px-1.5 py-0.5 bg-red-500/10'>Remove</button>" +
            "</div>";
        })
        .join("");
      api.ui.createPanel(
        PANEL_ID,
        "Font & Palette Library",
        "<div class='space-y-1.5'>" +
        "<p class='text-gray-400 mb-2'>" + list.length + " saved colors.</p>" +
        "<div class='flex gap-2'>" +
        "<input data-plugin-action='name' placeholder='Name' class='flex-1 text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600' />" +
        "<input data-plugin-action='hex' type='color' value='#3b82f6' class='w-10 h-9 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
        "</div>" +
        "<button data-plugin-action='save' class='w-full text-left px-2.5 py-1.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 transition-colors'><span class='block text-gray-100'>Save Color</span></button>" +
        rows +
        "</div>"
      );
    });
  }

  var pendingName = "";

  api.ui.onPanelAction(PANEL_ID, "name", function (v) { pendingName = String(v || ""); });
  api.ui.onPanelAction(PANEL_ID, "save", function (value) {
    var hex = String(value || "#3b82f6");
    load().then(function (list) {
      list.push({ name: pendingName || hex, hex: hex });
      return save(list);
    }).then(function () {
      api.ui.showNotification("Palette Library: saved " + hex, "info");
      refresh();
    });
  });

  var removePrefix = /^remove-(\d+)$/;
  api.ui.onPanelAction(PANEL_ID, "remove-0", function () { removeAt(0); });
  api.ui.onPanelAction(PANEL_ID, "remove-1", function () { removeAt(1); });
  api.ui.onPanelAction(PANEL_ID, "remove-2", function () { removeAt(2); });
  api.ui.onPanelAction(PANEL_ID, "remove-3", function () { removeAt(3); });
  api.ui.onPanelAction(PANEL_ID, "remove-4", function () { removeAt(4); });
  api.ui.onPanelAction(PANEL_ID, "remove-5", function () { removeAt(5); });
  api.ui.onPanelAction(PANEL_ID, "remove-6", function () { removeAt(6); });
  api.ui.onPanelAction(PANEL_ID, "remove-7", function () { removeAt(7); });
  api.ui.onPanelAction(PANEL_ID, "remove-8", function () { removeAt(8); });
  api.ui.onPanelAction(PANEL_ID, "remove-9", function () { removeAt(9); });

  function removeAt(i) {
    load().then(function (list) {
      if (i < list.length) list.splice(i, 1);
      return save(list);
    }).then(function () { refresh(); });
  }

  refresh();

  api.ui.addToolbarButton({
    id: "asset-library-open",
    tooltip: "Palette Library",
    icon: "FolderOpen",
    onClick: refresh,
  });
})();