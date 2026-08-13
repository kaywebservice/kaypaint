// Project Asset Manager — kaypaint plugin (asset-manager)
// Collect and organize font, color and image asset references per project.

(function () {
  var PANEL_ID = "asset-manager-panel";
  var KEY = "proj.assets";

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
          var kindBadge = "bg-indigo-500/20 text-indigo-300";
          if (item.type === "color") kindBadge = "bg-pink-500/20 text-pink-300";
          if (item.type === "font") kindBadge = "bg-emerald-500/20 text-emerald-300";
          return "<div class='flex items-center gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5'>" +
            "<span class='text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 " + kindBadge + "'>" + esc(item.type) + "</span>" +
            "<span class='flex-1 text-xs text-gray-100'>" + esc(item.name) + "</span>" +
            "<button data-plugin-action='remove-" + i + "' class='text-[10px] text-red-300 border border-red-400/20 rounded px-1.5 py-0.5 bg-red-500/10'>Remove</button>" +
            "</div>";
        })
        .join("");
      api.ui.createPanel(
        PANEL_ID,
        "Project Asset Manager",
        "<div class='space-y-1.5'>" +
        "<p class='text-gray-400 mb-2'>" + list.length + " collected assets.</p>" +
        "<div class='flex gap-2'>" +
        "<select data-plugin-action='type' class='flex-none text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200'>" +
        "<option value='image'>Image</option><option value='font'>Font</option><option value='color'>Color</option>" +
        "</select>" +
        "<input data-plugin-action='name' placeholder='Asset name' class='flex-1 text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600' />" +
        "</div>" +
        "<button data-plugin-action='add' class='w-full text-left px-2.5 py-1.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 transition-colors'><span class='block text-gray-100'>Add Asset</span></button>" +
        rows +
        "</div>"
      );
    });
  }

  var pendingType = "image";
  var pendingName = "";

  api.ui.onPanelAction(PANEL_ID, "type", function (v) { if (v) pendingType = String(v); });
  api.ui.onPanelAction(PANEL_ID, "name", function (v) { pendingName = String(v || ""); });
  api.ui.onPanelAction(PANEL_ID, "add", function () {
    var name = pendingName.trim();
    if (!name) {
      api.ui.showNotification("Asset Manager: enter an asset name", "warning");
      return;
    }
    load().then(function (list) {
      list.push({ type: pendingType, name: name });
      return save(list);
    }).then(function () {
      pendingName = "";
      api.ui.showNotification("Asset Manager: collected \"" + name + "\"", "info");
      refresh();
    });
  });

  var removeAll = /^remove-(\d+)$/;
  for (var i = 0; i < 12; i++) {
    (function (idx) {
      api.ui.onPanelAction(PANEL_ID, "remove-" + idx, function () {
        load().then(function (list) {
          if (idx < list.length) list.splice(idx, 1);
          return save(list);
        }).then(refresh);
      });
    })(i);
  }

  refresh();

  api.ui.addToolbarButton({
    id: "asset-manager-open",
    tooltip: "Project Asset Manager",
    icon: "FolderOpen",
    onClick: refresh,
  });
})();