// Dodge & Burn Panel — kaypaint plugin (retouch-dodgeburn)
// Luminosity dodge and burn adjustments on the selected object.

(function () {
  var PANEL_ID = "retouch-dodgeburn-panel";

  function apply(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Dodge & Burn: " + label, "info");
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
    "Dodge & Burn",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Lighten or deepen the selected object.</p>" +
    button("dodge-subtle", "Dodge +10%", "Gentle highlight lift") +
    button("dodge-strong", "Dodge +25%", "Strong exposure lift") +
    button("burn-subtle", "Burn -10%", "Gentle shadow deepen") +
    button("burn-strong", "Burn -25%", "Strong darkening") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "dodge-subtle", function () { apply("brightness", { brightness: 0.1 }, "Dodge +10%"); });
  api.ui.onPanelAction(PANEL_ID, "dodge-strong", function () { apply("brightness", { brightness: 0.25 }, "Dodge +25%"); });
  api.ui.onPanelAction(PANEL_ID, "burn-subtle", function () { apply("brightness", { brightness: -0.1 }, "Burn -10%"); });
  api.ui.onPanelAction(PANEL_ID, "burn-strong", function () { apply("brightness", { brightness: -0.25 }, "Burn -25%"); });

  api.ui.addToolbarButton({
    id: "retouch-dodgeburn-dodge",
    tooltip: "Dodge & Burn (Dodge +10%)",
    icon: "Sun",
    onClick: function () { apply("brightness", { brightness: 0.1 }, "Dodge +10%"); },
  });
})();