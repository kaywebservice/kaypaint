// Slice & Responsive Preview — kaypaint plugin (dev-slices)
// Manage named slice regions and preview responsive breakpoints.

(function () {
  var PANEL_ID = "dev-slices-panel";
  var KEY = "dev.slices";

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

  function breakpoints() {
    return [
      { label: "Mobile 375", w: 375 },
      { label: "Tablet 768", w: 768 },
      { label: "Desktop 1440", w: 1440 },
      { label: "Wide 1920", w: 1920 },
    ];
  }

  function refresh() {
    load().then(function (list) {
      var rows = list
        .map(function (s, i) {
          return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
            "<div class='flex items-center gap-2'>" +
            "<span class='flex-1 text-xs text-gray-100'>" + esc(s.name) + "</span>" +
            "<button data-plugin-action='remove-" + i + "' class='text-[10px] text-red-300 border border-red-400/20 rounded px-1.5 py-0.5 bg-red-500/10'>Remove</button>" +
            "</div>" +
            "<div class='mt-1.5 space-y-1'>" +
            breakpoints().map(function (bp) {
              return "<span class='flex justify-between text-[10px] text-gray-500'><span>" + bp.label + "</span><span>= " + Math.round(Number(s.w || 0) * (bp.w / 1440)) + " px</span></span>";
            }).join("") +
            "</div>" +
            "</div>";
        })
        .join("");
      api.ui.createPanel(
        PANEL_ID,
        "Slice & Responsive Preview",
        "<div class='space-y-1.5'>" +
        "<p class='text-gray-400 mb-2'>" + list.length + " slice regions.</p>" +
        "<div class='flex gap-2'>" +
        "<input data-plugin-action='name' placeholder='Slice name' class='flex-1 text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600' />" +
        "<input data-plugin-action='width' type='number' placeholder='Width px' class='w-20 text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600' />" +
        "</div>" +
        "<button data-plugin-action='add' class='w-full text-left px-2.5 py-1.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 transition-colors'><span class='block text-gray-100'>Add Slice</span></button>" +
        rows +
        "</div>"
      );
    });
  }

  var pendingName = "";
  var pendingW = 1440;

  api.ui.onPanelAction(PANEL_ID, "name", function (v) { pendingName = String(v || ""); });
  api.ui.onPanelAction(PANEL_ID, "width", function (v) { var n = Number(v); if (!isNaN(n) && n > 0) pendingW = n; });
  api.ui.onPanelAction(PANEL_ID, "add", function () {
    var name = pendingName.trim();
    if (!name) { api.ui.showNotification("Slices: enter a name", "warning"); return; }
    load().then(function (list) {
      list.push({ name: name, w: pendingW });
      return save(list);
    }).then(function () {
      pendingName = "";
      api.ui.showNotification("Slices: added \"" + name + "\"", "info");
      refresh();
    });
  });

  for (var i = 0; i < 10; i++) {
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
    id: "dev-slices-open",
    tooltip: "Slices & Breakpoints",
    icon: "Code",
    onClick: refresh,
  });
})();