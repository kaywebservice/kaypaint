// Film Emulation — kaypaint plugin (luts-film)
// Kodak, Fuji and Cinestill look film grades with grain pairing.

(function () {
  var PANEL_ID = "luts-film-panel";

  function applyFilm(name, options, label) {
    api.filters.apply(name, options).then(function (ok) {
      if (ok) api.ui.showNotification("Film Emulation: " + label + " applied", "info");
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
    "Film Emulation",
    "<div class='space-y-1.5'>" +
    "<p class='text-gray-400 mb-2'>Classic stock film looks.</p>" +
    button("kodak", "Kodak Gold", "Warm consumer color") +
    button("fuji", "Fuji Velvia", "Saturated slide film") +
    button("cinestill", "Cinestill", "Halation-tinted look") +
    button("polaroid", "Polaroid Instant", "Soft retro print") +
    "</div>"
  );

  api.ui.onPanelAction(PANEL_ID, "kodak", function () { applyFilm("kodachrome", {}, "Kodak Gold"); });
  api.ui.onPanelAction(PANEL_ID, "fuji", function () { applyFilm("saturation", { saturation: 1.5 }, "Fuji Velvia"); });
  api.ui.onPanelAction(PANEL_ID, "cinestill", function () { applyFilm("polaroid", {}, "Cinestill"); });
  api.ui.onPanelAction(PANEL_ID, "polaroid", function () { applyFilm("vintage", {}, "Polaroid Instant"); });

  api.ui.addToolbarButton({
    id: "luts-film-kodak",
    tooltip: "Film Emulation (Kodak Gold)",
    icon: "Palette",
    onClick: function () { applyFilm("kodachrome", {}, "Kodak Gold"); },
  });
})();