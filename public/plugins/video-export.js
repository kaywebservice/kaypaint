// Export Studio — kaypaint plugin (video-export)
// Renders the timeline to an MP4/WebM video.

(function () {
  var PANEL_ID = "video-export-panel";

  function exportVideo(format) {
    api.ui.showNotification("Rendering video…", "info");
    api.video.exportVideo({ format: format }).then(function (ok) {
      api.ui.showNotification(
        ok ? "Video exported" : "Export failed — is the timeline ready?",
        ok ? "success" : "warning"
      );
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Render the timeline</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Exports the current keyframe animation as a video file. Uses the browser MediaRecorder.</span>" +
      "</div>" +
      "<button data-plugin-action='mp4' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Export MP4</span></button>" +
      "<button data-plugin-action='webm' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100 text-sm'>Export WebM</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Export Studio", html);
  }

  api.ui.onPanelAction(PANEL_ID, "mp4", function () { exportVideo("video/mp4"); });
  api.ui.onPanelAction(PANEL_ID, "webm", function () { exportVideo("video/webm"); });

  render();

  api.ui.addToolbarButton({
    id: "video-export-render",
    tooltip: "Export Video",
    icon: "Video",
    onClick: function () { exportVideo("video/webm"); },
  });
})();