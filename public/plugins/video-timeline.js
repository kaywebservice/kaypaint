// Video Timeline — kaypaint plugin (video-timeline)
// Controls the frame timeline: playback, scrubbing, loop and fps. The
// timeline itself lives at the bottom of the editor; this panel drives it.

(function () {
  var PANEL_ID = "video-timeline-panel";
  var state = { time: 0, duration: 120, fps: 24, playing: false, loop: false, trackCount: 0 };

  function refresh() {
    var s = api.video.getState();
    state = {
      time: s.time,
      duration: s.duration,
      fps: s.fps,
      playing: s.playing,
      loop: s.loop,
      trackCount: s.trackCount,
    };
    render();
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<div class='rounded-md bg-white/5 border border-white/10 px-2.5 py-2'>" +
      "<span class='text-xs text-gray-100'>Frame " + Math.floor(state.time) + " / " + state.duration + "</span>" +
      "<span class='block text-[10px] text-gray-500 mt-0.5'>" + state.trackCount + " keyframe tracks · " + state.fps + " fps</span>" +
      "</div>" +
      "<input type='range' data-plugin-action='seek' min='0' max='" + state.duration + "' step='1' value='" + Math.floor(state.time) + "' class='w-full accent-emerald-400' />" +
      "<div class='grid grid-cols-2 gap-1'>" +
      "<button data-plugin-action='play' data-value='1' class='px-2 py-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30'><span class='block text-[11px] text-gray-100'>" + (state.playing ? "Pause" : "Play") + "</span></button>" +
      "<button data-plugin-action='loop' data-value='1' class='px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10'><span class='block text-[11px] text-gray-100'>Loop: " + (state.loop ? "On" : "Off") + "</span></button>" +
      "</div>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>FPS — " + state.fps + "</label>" +
      "<select data-plugin-action='fps' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='12' " + (state.fps === 12 ? "selected" : "") + ">12</option>" +
      "<option value='24' " + (state.fps === 24 ? "selected" : "") + ">24</option>" +
      "<option value='30' " + (state.fps === 30 ? "selected" : "") + ">30</option>" +
      "<option value='60' " + (state.fps === 60 ? "selected" : "") + ">60</option>" +
      "</select>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Video Timeline", html);
  }

  api.ui.onPanelAction(PANEL_ID, "seek", function (value) {
    var n = parseInt(value, 10);
    if (!isNaN(n)) { state.time = n; api.video.seek(n); render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "play", function () {
    if (state.playing) api.video.pause();
    else api.video.play();
    refresh();
  });
  api.ui.onPanelAction(PANEL_ID, "loop", function () {
    api.video.setLoop(!state.loop);
    refresh();
  });
  api.ui.onPanelAction(PANEL_ID, "fps", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) {
      api.video.setFps(n);
      refresh();
    }
  });

  render();

  api.ui.addToolbarButton({
    id: "video-timeline-play",
    tooltip: "Play / Pause timeline",
    icon: "Play",
    onClick: function () {
      if (state.playing) api.video.pause();
      else api.video.play();
      refresh();
    },
  });
})();