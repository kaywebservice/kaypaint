// Canvas & Paper — kaypaint plugin (textures-canvas)
// Real paper-grain and canvas-tooth textures via the filter engine.

(function () {
  var PANEL_ID = "textures-canvas-panel";

  function applyTexture(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Canvas & Paper: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to texture", "warning");
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
    "Canvas & Paper",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Tactile paper and canvas grain.</p>" +
    button("smooth", "Smooth Bristol", "Fine paper tooth") +
    button("watercolor", "Watercolor Paper", "Visible cotton grain") +
    button("canvas", "Canvas Cloth", "Pronounced weave") +
    button("newsprint", "Newsprint", "Coarse rough texture") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "smooth", function () { applyTexture("noise", { noise: 6 }, "Smooth Bristol"); });
  api.ui.onPanelAction(PANEL_ID, "watercolor", function () { applyTexture("noise", { noise: 14 }, "Watercolor Paper"); });
  api.ui.onPanelAction(PANEL_ID, "canvas", function () { applyTexture("noise", { noise: 26 }, "Canvas Cloth"); });
  api.ui.onPanelAction(PANEL_ID, "newsprint", function () { applyTexture("pixelate", { blocksize: 2 }, "Newsprint"); });

  api.ui.addToolbarButton({
    id: "textures-canvas-watercolor",
    tooltip: "Canvas & Paper (Watercolor)",
    icon: "Grid3x3",
    onClick: function () { applyTexture("noise", { noise: 14 }, "Watercolor Paper"); },
  });
})();