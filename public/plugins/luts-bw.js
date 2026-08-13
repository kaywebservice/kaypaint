// Fine-Art B&W — kaypaint plugin (luts-bw)
// Zone-system style black & white conversion for the selected object.

(function () {
  var PANEL_ID = "luts-bw-panel";

  function notify(result, okMsg, failMsg) {
    if (result) api.ui.showNotification(okMsg, "info");
    else api.ui.showNotification(failMsg, "warning");
  }

  function applyTone(tone) {
    api.filters.apply("grayscale", {}).then(function (ok) {
      if (!ok) {
        api.ui.showNotification("Select an object to convert", "warning");
        return;
      }
      var followUp = null;
      if (tone === "silver") followUp = api.filters.apply("contrast", { contrast: 20 });
      else if (tone === "selenium") followUp = api.filters.apply("sepia", {});
      else if (tone === "highkey") followUp = api.filters.apply("brightness", { brightness: 0.12 });
      else if (tone === "lowkey") followUp = api.filters.apply("brightness", { brightness: -0.12 });

      if (followUp) {
        followUp.then(function () {
          notify(true, "Fine-Art B&W: " + tone + " applied", "");
        });
      } else {
        notify(true, "Fine-Art B&W: " + tone + " applied", "");
      }
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

  function render() {
    api.ui.createPanel(
      PANEL_ID,
      "Fine-Art B&W",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Convert the selected object to archival-grade black &amp; white.</p>" +
      button("silver", "Silver Gelatin", "Neutral with lifted contrast") +
      button("selenium", "Selenium Toned", "Warm shadow roll-off") +
      button("highkey", "High Key", "Bright, airy exposure") +
      button("lowkey", "Low Key", "Deep, moody shadows") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "silver", function () { applyTone("silver"); });
  api.ui.onPanelAction(PANEL_ID, "selenium", function () { applyTone("selenium"); });
  api.ui.onPanelAction(PANEL_ID, "highkey", function () { applyTone("highkey"); });
  api.ui.onPanelAction(PANEL_ID, "lowkey", function () { applyTone("lowkey"); });

  api.ui.addToolbarButton({
    id: "luts-bw-silver",
    tooltip: "Fine-Art B&W (Silver)",
    icon: "Sparkles",
    onClick: function () { applyTone("silver"); },
  });

  render();
})();
