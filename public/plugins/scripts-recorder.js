// Action Recorder — kaypaint plugin (scripts-recorder)
// Browse recorded actions and replay them from a panel.

(function () {
  var PANEL_ID = "scripts-recorder-panel";

  function refresh() {
    var list = api.actions.getAll();
    var rows = list
      .map(function (a) {
        return "<button data-plugin-action='run-" + a.id + "' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'>" +
          "<span class='block text-gray-100'>" + a.name + "</span>" +
          "<span class='block text-[10px] text-gray-500'>" + (a.steps ? a.steps.length : 0) + " steps</span>" +
          "</button>";
      })
      .join("");
    api.ui.createPanel(
      PANEL_ID,
      "Action Recorder",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>" + list.length + " recorded actions.</p>" +
      (list.length ? rows : "<p class='text-gray-500 text-sm'>No actions recorded yet.</p>") +
      "</div>"
    );
  }

  var list = api.actions.getAll();
  list.forEach(function (a) {
    api.ui.onPanelAction(PANEL_ID, "run-" + a.id, function () {
      api.actions.run(a.id).then(function (ok) {
        api.ui.showNotification("Action Recorder: " + (ok ? "replayed " : "could not run ") + a.name, ok ? "info" : "warning");
      });
    });
  });

  refresh();

  api.ui.addToolbarButton({
    id: "scripts-recorder-replay",
    tooltip: "Action Recorder (open panel)",
    icon: "Play",
    onClick: function () {
      api.ui.showNotification("Action Recorder: panel is open", "info");
      refresh();
    },
  });
})();