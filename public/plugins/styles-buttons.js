// Beveled Button Kit — kaypaint plugin (styles-buttons)
// Glossy, matte and embossed button looks via filters.

(function () {
  var PANEL_ID = "styles-buttons-panel";

  function applyButton(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Button Kit: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to style", "warning");
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
    "Beveled Button Kit",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>UI-grade button finishing looks.</p>" +
    button("glossy", "Glossy Push", "Bright top sheen") +
    button("matte", "Matte Flat", "Soft muted finish") +
    button("emboss", "Embossed", "Raised tactile feel") +
    button("pressed", "Pressed State", "Darker engaged look") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "glossy", function () { applyButton("brightness", { brightness: 0.18 }, "Glossy Push"); });
  api.ui.onPanelAction(PANEL_ID, "matte", function () { applyButton("saturation", { saturation: 0.7 }, "Matte Flat"); });
  api.ui.onPanelAction(PANEL_ID, "emboss", function () { applyButton("contrast", { contrast: 0.18 }, "Embossed"); });
  api.ui.onPanelAction(PANEL_ID, "pressed", function () { applyButton("brightness", { brightness: -0.14 }, "Pressed State"); });

  api.ui.addToolbarButton({
    id: "styles-buttons-glossy",
    tooltip: "Button Kit (Glossy)",
    icon: "Droplets",
    onClick: function () { applyButton("brightness", { brightness: 0.18 }, "Glossy Push"); },
  });
})();