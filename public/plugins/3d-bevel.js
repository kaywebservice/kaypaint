// Bevel & Extrude — kaypaint plugin (3d-bevel)
// Depth-revealing bevel and extrusion looks for shapes and text.

(function () {
  var PANEL_ID = "3d-bevel-panel";

  function applyBevel(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Bevel & Extrude: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to bevel", "warning");
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
    "Bevel & Extrude",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Raised dimensional looks.</p>" +
    button("chisel", "Chisel Bevel", "Sharp angular edge") +
    button("soft", "Soft Bevel", "Rounded emboss") +
    button("extrude", "Extrude Depth", "Pulled-forward depth") +
    button("gloss", "Glossy Bevel", "Polished raised look") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "chisel", function () { applyBevel("contrast", { contrast: 0.3 }, "Chisel Bevel"); });
  api.ui.onPanelAction(PANEL_ID, "soft", function () { applyBevel("contrast", { contrast: 0.12 }, "Soft Bevel"); });
  api.ui.onPanelAction(PANEL_ID, "extrude", function () { applyBevel("brightness", { brightness: -0.08 }, "Extrude Depth"); });
  api.ui.onPanelAction(PANEL_ID, "gloss", function () { applyBevel("brightness", { brightness: 0.2 }, "Glossy Bevel"); });

  api.ui.addToolbarButton({
    id: "3d-bevel-extrude",
    tooltip: "Bevel & Extrude (Depth)",
    icon: "Box",
    onClick: function () { applyBevel("brightness", { brightness: -0.08 }, "Extrude Depth"); },
  });
})();