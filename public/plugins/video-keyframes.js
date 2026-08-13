// Keyframe Animator — kaypaint plugin (video-keyframes)
// Records the active object's current values at the playhead, and explains
// easing. The timeline below the canvas edits frames, props and easing.

(function () {
  var PANEL_ID = "video-keyframes-panel";

  function addKf() {
    api.video.addKeyframes().then(function (ok) {
      api.ui.showNotification(
        ok
          ? "Keyframes added for the selected layer (position, scale, opacity, angle)"
          : "Keyframe Animator: select a layer first",
        ok ? "success" : "warning"
      );
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Animate layers on the timeline</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>Move the playhead, hit Add Keyframe, then change the layer. The timeline interpolates between keyframes — pick an easing per keyframe there.</span>" +
      "</div>" +
      "<button data-plugin-action='add' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Add Keyframe</span><span class='block text-[10px] text-gray-500'>at the current playhead</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Keyframe Animator", html);
  }

  api.ui.onPanelAction(PANEL_ID, "add", addKf);

  render();

  api.ui.addToolbarButton({
    id: "video-keyframes-add",
    tooltip: "Add Keyframe at playhead",
    icon: "Plus",
    onClick: addKf,
  });
})();