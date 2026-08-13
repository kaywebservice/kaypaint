// Movie Layer Support — kaypaint plugin (video-movielayers)
// Imports video clips as editable movie layers on the canvas.

(function () {
  var PANEL_ID = "video-movielayers-panel";

  function importClip() {
    api.video.importMovie().then(function (ok) {
      api.ui.showNotification(
        ok ? "Movie layer import started — choose a clip" : "Movie layers: canvas not ready",
        ok ? "info" : "warning"
      );
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Movie layers</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Import an MP4/WebM clip as an editable layer. Play it back from the timeline; position, scale and rotate it like any other layer.</span>" +
      "</div>" +
      "<button data-plugin-action='import' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Import Movie Clip…</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Movie Layer Support", html);
  }

  api.ui.onPanelAction(PANEL_ID, "import", importClip);

  render();

  api.ui.addToolbarButton({
    id: "video-movielayers-import",
    tooltip: "Import Movie Clip",
    icon: "Film",
    onClick: importClip,
  });
})();