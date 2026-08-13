// Teal & Orange — kaypaint plugin (luts-tealorange)
// Blockbuster-style contrast grades built on the real filter engine.

(function () {
  var PANEL_ID = "luts-tealorange-panel";

  function applyGrade(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Teal & Orange: " + label + " applied", "info");
      else api.ui.showNotification("Select an object to grade", "warning");
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
    "Teal & Orange",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Cinematic contrast grades for the selected object.</p>" +
    button("subtle", "Skin-Safe Subtle", "Gentle contrast lift") +
    button("standard", "Blockbuster", "Signature feature look") +
    button("heavy", "Heavy Grade", "Deep shadow rolloff") +
    button("warm", "Print Film Toe", "Warm highlight tint") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "subtle", function () { applyGrade("contrast", { contrast: 0.08 }, "Subtle"); });
  api.ui.onPanelAction(PANEL_ID, "standard", function () { applyGrade("contrast", { contrast: 0.18 }, "Blockbuster"); });
  api.ui.onPanelAction(PANEL_ID, "heavy", function () { applyGrade("contrast", { contrast: 0.32 }, "Heavy"); });
  api.ui.onPanelAction(PANEL_ID, "warm", function () { applyGrade("brownie", {}, "Print Film Toe"); });

  api.ui.addToolbarButton({
    id: "luts-tealorange-standard",
    tooltip: "Teal & Orange (Blockbuster)",
    icon: "Palette",
    onClick: function () { applyGrade("contrast", { contrast: 0.18 }, "Blockbuster"); },
  });
})();