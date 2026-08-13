// Chrome Styles — kaypaint plugin (styles-chrome)
// Metallic chrome and polished bevel looks via the filter engine.

(function () {
  var PANEL_ID = "styles-chrome-panel";

  function applyChrome(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Chrome Styles: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to chrome", "warning");
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
    "Chrome Styles",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Metallic polish for the selected object.</p>" +
    button("silver", "Polished Chrome", "Bright reflective silver") +
    button("gold", "Liquid Gold", "Warm metallic gold") +
    button("titanium", "Titanium", "Cool gunmetal sheen") +
    button("copper", "Copper", "Rust-tinted metal") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "silver", function () { applyChrome("contrast", { contrast: 0.25 }, "Polished Chrome"); });
  api.ui.onPanelAction(PANEL_ID, "gold", function () { applyChrome("sepia", {}, "Liquid Gold"); });
  api.ui.onPanelAction(PANEL_ID, "titanium", function () { applyChrome("grayscale", {}, "Titanium"); });
  api.ui.onPanelAction(PANEL_ID, "copper", function () { applyChrome("brownie", {}, "Copper"); });

  api.ui.addToolbarButton({
    id: "styles-chrome-silver",
    tooltip: "Chrome (Polished)",
    icon: "Droplets",
    onClick: function () { applyChrome("contrast", { contrast: 0.25 }, "Polished Chrome"); },
  });
})();