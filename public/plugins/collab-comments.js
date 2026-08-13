// Comments & Review — kaypaint plugin (collab-comments)
// Review thread list stored with the project.

(function () {
  var PANEL_ID = "collab-comments-panel";
  var KEY = "proj.comments";

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
        .map(function (c, i) {
          return "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
            "<div class='flex items-center gap-2'>" +
            "<span class='text-[9px] font-bold uppercase tracking-wide text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded px-1.5 py-0.5'>" + (c.status === "resolved" ? "Resolved" : "Open") + "</span>" +
            "<span class='text-[10px] text-gray-500 flex-1'>" + esc(c.author || "Reviewer") + "</span>" +
            "<button data-plugin-action='toggle-" + i + "' class='text-[10px] text-gray-300 border border-white/10 rounded px-1.5 py-0.5 bg-white/5'>Toggle</button>" +
            "<button data-plugin-action='remove-" + i + "' class='text-[10px] text-red-300 border border-red-400/20 rounded px-1.5 py-0.5 bg-red-500/10'>Remove</button>" +
            "</div>" +
            "<p class='text-xs text-gray-200 mt-1'>" + esc(c.text) + "</p>" +
            "</div>";
        })
        .join("");
      api.ui.createPanel(
        PANEL_ID,
        "Comments & Review",
        "<div class='space-y-1.5'>" +
        "<p class='text-gray-400 mb-2'>" + list.length + " comments in the review thread.</p>" +
        "<input data-plugin-action='text' placeholder='Leave a comment…' class='w-full text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600' />" +
        "<button data-plugin-action='add' class='w-full text-left px-2.5 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/25 transition-colors'><span class='block text-gray-100'>Add Comment</span></button>" +
        rows +
        "</div>"
      );
    });
  }

  var pendingText = "";

  api.ui.onPanelAction(PANEL_ID, "text", function (v) { pendingText = String(v || ""); });
  api.ui.onPanelAction(PANEL_ID, "add", function () {
    var text = pendingText.trim();
    if (!text) {
      api.ui.showNotification("Comments: comment is empty", "warning");
      return;
    }
    load().then(function (list) {
      list.push({ text: text, author: "Local Reviewer", status: "open" });
      return save(list);
    }).then(function () {
      pendingText = "";
      api.ui.showNotification("Comments: comment added", "info");
      refresh();
    });
  });

  for (var i = 0; i < 16; i++) {
    (function (idx) {
      api.ui.onPanelAction(PANEL_ID, "toggle-" + idx, function () {
        load().then(function (list) {
          if (idx < list.length) list[idx].status = list[idx].status === "resolved" ? "open" : "resolved";
          return save(list);
        }).then(refresh);
      });
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
    id: "collab-comments-open",
    tooltip: "Comments & Review",
    icon: "MessagesSquare",
    onClick: refresh,
  });
})();