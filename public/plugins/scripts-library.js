// Shareable Script Library — kaypaint plugin (scripts-library)
// Browse and replay documented scripts saved in your project.

(function () {
  var PANEL_ID = "scripts-library-panel";
  var KEY = "lib.scripts";

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
    load().then(function (scripts) {
      var rows = scripts
        .map(function (s, i) {
          return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
            "<span class='block text-xs text-gray-100'>" + esc(s.name) + "</span>" +
            "<span class='block text-[10px] text-gray-500'>" + esc(s.desc || "") + "</span>" +
            "<button data-plugin-action='remove-" + i + "' class='mt-1 text-[10px] text-red-300 border border-red-400/20 rounded px-1.5 py-0.5 bg-red-500/10'>Remove</button>" +
            "</div>";
        })
        .join("");
      var live = api.actions.getAll();
      var liveRows = live
        .map(function (a) {
          return "<button data-plugin-action='run-" + a.id + "' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'>" +
            "<span class='block text-gray-100'>" + esc(a.name) + "</span>" +
            "<span class='block text-[10px] text-gray-500'>Replay action script</span>" +
            "</button>";
        })
        .join("");
      api.ui.createPanel(
        PANEL_ID,
        "Shareable Script Library",
        "<div class='space-y-1.5'>" +
        "<p class='text-gray-400 mb-2'>" + scripts.length + " saved scripts, " + live.length + " live actions.</p>" +
        "<input data-plugin-action='name' placeholder='Script name' class='w-full text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600' />" +
        "<button data-plugin-action='save' class='w-full text-left px-2.5 py-1.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 transition-colors'><span class='block text-gray-100'>Save Script Note</span></button>" +
        (liveRows || "<p class='text-gray-500 text-sm mt-1'>No live actions yet.</p>") +
        rows +
        "</div>"
      );
    });
  }

  var pendingName = "";

  api.ui.onPanelAction(PANEL_ID, "name", function (v) { pendingName = String(v || ""); });
  api.ui.onPanelAction(PANEL_ID, "save", function () {
    var name = pendingName.trim();
    if (!name) { api.ui.showNotification("Script Library: enter a name", "warning"); return; }
    load().then(function (list) {
      list.push({ name: name, desc: "Saved from library" });
      return save(list);
    }).then(function () {
      pendingName = "";
      api.ui.showNotification("Script Library: saved \"" + name + "\"", "info");
      refresh();
    });
  });

  var live = api.actions.getAll();
  live.forEach(function (a) {
    api.ui.onPanelAction(PANEL_ID, "run-" + a.id, function () {
      api.actions.run(a.id).then(function (ok) {
        api.ui.showNotification("Script Library: " + (ok ? "ran " : "could not run ") + a.name, ok ? "info" : "warning");
      });
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
    id: "scripts-library-open",
    tooltip: "Script Library",
    icon: "Play",
    onClick: refresh,
  });
})();