// Product Mockup Studio — kaypaint plugin (mockups-product)
// Layered mockup surfaces: shirt, mug, phone and box canvases.

(function () {
  var PANEL_ID = "mockups-product-panel";

  function newSurface(name, sizeLabel) {
    api.layers.create(name).then(function (layer) {
      if (layer) {
        api.ui.showNotification("Mockup Studio: created \"" + name + "\" (" + sizeLabel + ")", "info");
        refresh();
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

  function refresh() {
    api.ui.createPanel(
      PANEL_ID,
      "Product Mockup Studio",
      "<div class='space-y-1.5'>" +
      "<p class='text-gray-400 mb-2'>Surface canvases for artwork placement.</p>" +
      button("shirt", "Shirt Surface", "Front chest artwork area") +
      button("mug", "Mug Surface", "Wrapped wrap area") +
      button("phone", "Phone Case", "Portrait case canvas") +
      button("box", "Box Face", "Shipping box face") +
      "</div>"
    );
  }

  api.ui.onPanelAction(PANEL_ID, "shirt", function () { newSurface("Shirt Surface", "2400 x 3200 @300dpi"); });
  api.ui.onPanelAction(PANEL_ID, "mug", function () { newSurface("Mug Surface", "1400 x 900 @300dpi"); });
  api.ui.onPanelAction(PANEL_ID, "phone", function () { newSurface("Phone Case", "1080 x 2280 @3x"); });
  api.ui.onPanelAction(PANEL_ID, "box", function () { newSurface("Box Face", "3000 x 3000 @300dpi"); });

  refresh();

  api.ui.addToolbarButton({
    id: "mockups-product-shirt",
    tooltip: "Mockup Studio (Shirt Surface)",
    icon: "Shirt",
    onClick: function () { newSurface("Shirt Surface", "2400 x 3200 @300dpi"); },
  });
})();