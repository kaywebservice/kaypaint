// Layer Organizer — kaypaint plugin (automation-organizer)
// Sort, reorder and tidy layers from a panel.

(function () {
  var PANEL_ID = "automation-organizer-panel";

  function refresh() {
    var layers = api.layers.getAll();
    var html = "<p class='text-gray-400 mb-2'>" + (layers.length || 0) + " layers on canvas.</p>" +
      "<div class='space-y-1.5'>" +
      "<button data-plugin-action='sort-alpha' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100'>Sort A→Z</span><span class='block text-[10px] text-gray-500'>Reorder layers by name</span></button>" +
      "<button data-plugin-action='sort-alpha-rev' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100'>Sort Z→A</span><span class='block text-[10px] text-gray-500'>Reverse by name</span></button>" +
      "<button data-plugin-action='hide-all' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100'>Show All</span><span class='block text-[10px] text-gray-500'>Reveal every layer</span></button>" +
      "<button data-plugin-action='hide-locked' class='w-full text-left px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors'><span class='block text-gray-100'>Hide Unlocked</span><span class='block text-[10px] text-gray-500'>Keep only locked layers visible</span></button>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Layer Organizer", "<div class='space-y-1.5'>" + html + "</div>");
  }

  function sortLayers(reverse) {
    var layers = api.layers.getAll();
    var sorted = layers.slice().sort(function (a, b) {
      var cmp = a.name.localeCompare(b.name);
      return reverse ? -cmp : cmp;
    });
    sorted.forEach(function (layer, index) {
      api.layers.reorder(layer.id, index);
    });
    api.ui.showNotification("Layer Organizer: sorted " + sorted.length + " layers", "info");
    refresh();
  }

  function setVisibleAll(visible) {
    api.layers.getAll().forEach(function (l) { api.layers.setVisibility(l.id, visible); });
    api.ui.showNotification("Layer Organizer: " + (visible ? "shown" : "changed visibility"), "info");
    refresh();
  }

  function hideUnlocked() {
    var changed = 0;
    api.layers.getAll().forEach(function (l) {
      if (!l.locked) { api.layers.setVisibility(l.id, false); changed++; }
    });
    api.ui.showNotification("Layer Organizer: hid " + changed + " unlocked layers", "info");
    refresh();
  }

  api.ui.onPanelAction(PANEL_ID, "sort-alpha", function () { sortLayers(false); });
  api.ui.onPanelAction(PANEL_ID, "sort-alpha-rev", function () { sortLayers(true); });
  api.ui.onPanelAction(PANEL_ID, "hide-all", function () { setVisibleAll(true); });
  api.ui.onPanelAction(PANEL_ID, "hide-locked", function () { hideUnlocked(); });

  refresh();

  api.ui.addToolbarButton({
    id: "automation-organizer-sort",
    tooltip: "Layer Organizer (Sort A→Z)",
    icon: "Cpu",
    onClick: function () { sortLayers(false); },
  });
})();