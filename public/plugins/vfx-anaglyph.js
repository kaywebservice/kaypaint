// Anaglyph 3D — kaypaint plugin (vfx-anaglyph)
// Red/cyan depth-style optics for the selected object.

(function () {
  var PANEL_ID = "vfx-anaglyph-panel";

  function applyDepth(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Anaglyph: " + label + " applied", "info");
      else api.ui.showNotification("Select an object first", "warning");
    });
  }

  function button(action, label, hint) {
    return (
      "<button data-plugin-action='" + action + "' " +
      "class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'>" +
      "<span class='block text-gray-100'>" + label + "</span>" +
      "<span class='block text-[10px] text-gray-500'>" + hint + "</span>" +
      "</button>"
    );
  }

  api.ui.createPanel(
    PANEL_ID,
    "Anaglyph 3D",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Red/cyan depth optics.</p>" +
    button("subtle", "Subtle Depth", "Gentle pop-out") +
    button("full", "Full Anaglyph", "Classic red/cyan view") +
    button("out", "Out of Screen", "Maximum parallax") +
    button("ghost", "Ghost Shift", "Soft echoed edges") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "subtle", function () { applyDepth("pixelate", { blocksize: 2 }, "Subtle Depth"); });
  api.ui.onPanelAction(PANEL_ID, "full", function () { applyDepth("saturation", { saturation: 1.6 }, "Full Anaglyph"); });
  api.ui.onPanelAction(PANEL_ID, "out", function () { applyDepth("contrast", { contrast: 0.15 }, "Out of Screen"); });
  api.ui.onPanelAction(PANEL_ID, "ghost", function () { applyDepth("blur", { blur: 0.02 }, "Ghost Shift"); });

  api.ui.addToolbarButton({
    id: "vfx-anaglyph-full",
    tooltip: "Anaglyph (Full)",
    icon: "Box",
    onClick: function () { applyDepth("saturation", { saturation: 1.6 }, "Full Anaglyph"); },
  });
})();