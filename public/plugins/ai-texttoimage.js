// Text-to-Image — kaypaint plugin (ai-texttoimage)
// Generates images from prompts using the app's server-side Gemini proxy
// (api.network), then inserts the result onto the canvas via
// canvas.addImage. Requires GEMINI_API_KEY to be configured.

(function () {
  var PANEL_ID = "ai-texttoimage-panel";
  var state = { prompt: "", size: 1024, style: "none" };

  var STYLES = {
    none: "",
    photoreal: "photorealistic, natural lighting, sharp detail",
    painterly: "painterly, expressive brushwork, rich color",
    minimal: "minimalist, clean lines, flat colors",
    fantasy: "epic fantasy art, dramatic lighting",
    isometric: "isometric 3D illustration, soft shadows",
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function generate() {
    var prompt = String(state.prompt || "").trim();
    if (!prompt) {
      api.ui.showNotification("Text-to-Image: enter a prompt first", "warning");
      return;
    }
    var styleSuffix = STYLES[state.style] || "";
    var fullPrompt = styleSuffix ? prompt + ", " + styleSuffix : prompt;
    api.ui.showNotification("Generating image…", "info");
    api.network.request("/api/gemini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "generate", prompt: fullPrompt, width: state.size, height: state.size }),
    }).then(function (res) {
      if (!res || !res.ok) {
        api.ui.showNotification(
          res && res.status === 503
            ? "Text-to-Image: AI backend is not configured (GEMINI_API_KEY)"
            : "Text-to-Image: generation failed (" + (res ? res.status : "network") + ")",
          "warning"
        );
        return;
      }
      var data = res.json();
      var dataUrl = data && data.dataUrl;
      if (!dataUrl) {
        api.ui.showNotification("Text-to-Image: no image was returned", "warning");
        return;
      }
      api.canvas.addImage(dataUrl, { name: "AI image: " + prompt.slice(0, 24), scale: 1 }).then(function (ok) {
        if (ok) {
          api.ui.showNotification("Generated image inserted onto the canvas", "info");
        } else {
          api.ui.showNotification("Text-to-Image: could not insert the image", "warning");
        }
      });
    });
  }

  function render() {
    var html =
      "<div class='space-y-1.5'>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>PROMPT</label>" +
      "<textarea data-plugin-action='prompt' rows='3' placeholder='A neon-lit city street in the rain…' class='w-full text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600 mb-2'>" + esc(state.prompt) + "</textarea>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>STYLE</label>" +
      "<select data-plugin-action='style' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='none' " + (state.style === "none" ? "selected" : "") + ">No style</option>" +
      "<option value='photoreal' " + (state.style === "photoreal" ? "selected" : "") + ">Photorealistic</option>" +
      "<option value='painterly' " + (state.style === "painterly" ? "selected" : "") + ">Painterly</option>" +
      "<option value='minimal' " + (state.style === "minimal" ? "selected" : "") + ">Minimal</option>" +
      "<option value='fantasy' " + (state.style === "fantasy" ? "selected" : "") + ">Fantasy</option>" +
      "<option value='isometric' " + (state.style === "isometric" ? "selected" : "") + ">Isometric</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>SIZE</label>" +
      "<select data-plugin-action='size' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='512' " + (state.size === 512 ? "selected" : "") + ">512 × 512</option>" +
      "<option value='1024' " + (state.size === 1024 ? "selected" : "") + ">1024 × 1024</option>" +
      "</select>" +
      "<button data-plugin-action='generate' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Generate Image</span></button>" +
      "<p class='text-[10px] text-gray-600 mt-1'>Uses the built-in Gemini proxy. Set GEMINI_API_KEY to enable generation.</p>" +
      "</div>";
    api.ui.createPanel(PANEL_ID, "Text-to-Image", html);
  }

  api.ui.onPanelAction(PANEL_ID, "prompt", function (value) { state.prompt = value; });
  api.ui.onPanelAction(PANEL_ID, "style", function (value) { if (value) { state.style = value; render(); } });
  api.ui.onPanelAction(PANEL_ID, "size", function (value) {
    var n = parseInt(value, 10);
    if (n === 512 || n === 1024) { state.size = n; render(); }
  });
  api.ui.onPanelAction(PANEL_ID, "generate", generate);

  render();

  api.ui.addToolbarButton({
    id: "ai-texttoimage-generate",
    tooltip: "Text-to-Image",
    icon: "Sparkles",
    onClick: generate,
  });
})();