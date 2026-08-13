// Barcode Generator — kaypaint plugin (tools-barcode)
// Pure-JS barcode encoders: EAN-13, UPC-A and Code 128 (set B), rendered
// as SVG bars and inserted via the canvas.addSvg API.

(function () {
  var PANEL_ID = "tools-barcode-panel";
  var state = { type: "ean13", value: "590123412345", color: "#000000", height: 60 };

  function digitsOf(value) {
    var out = [];
    for (var i = 0; i < value.length; i++) {
      var c = value.charCodeAt(i);
      if (c < 48 || c > 57) return null;
      out.push(c - 48);
    }
    return out;
  }

  /* ---------------- EAN-13 / UPC-A ---------------- */

  var L_CODE = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  var G_CODE = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
  var R_CODE = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
  var PARITY = [
    "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
    "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
  ];

  function eanChecksum(digits) {
    var sum = 0;
    for (var i = 0; i < digits.length; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10;
  }

  function encodeEan13(digits12) {
    var first = digits12[0];
    var parity = PARITY[first];
    var payload = digits12.slice(1);
    var left = "", right = "";
    for (var i = 0; i < 6; i++) {
      left += (parity[i] === "L" ? L_CODE : G_CODE)[payload[i]];
      right += R_CODE[payload[i + 6]];
    }
    return "101" + left + "01010" + right + "101";
  }

  /* ---------------- Code 128 (set B) ---------------- */

  var C128_SET_B = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
  var C128_PATTERNS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
  ];
  var START_B = 104;
  var STOP = 106;

  function encodeCode128(text) {
    var values = [], i;
    for (i = 0; i < text.length; i++) {
      var idx = C128_SET_B.indexOf(text.charAt(i));
      if (idx < 0) return null;
      values.push(idx);
    }
    var sum = START_B;
    for (i = 0; i < values.length; i++) sum += values[i] * (i + 1);
    var check = sum % 103;
    values.push(check);
    var parts = [C128_PATTERNS[START_B]];
    for (i = 0; i < values.length; i++) parts.push(C128_PATTERNS[values[i]]);
    parts.push(C128_PATTERNS[STOP]);
    return parts.join("");
  }

  /* ---------------- SVG ---------------- */

  var QUIET = {
    ean13: 11,
    upca: 11,
    code128: 10,
  };

  function widthsToBinary(widths) {
    var bar = true;
    var out = [];
    for (var i = 0; i < widths.length; i++) {
      var w = widths.charCodeAt(i) - 48;
      for (var k = 0; k < w; k++) out.push(bar ? "1" : "0");
      bar = !bar;
    }
    return out.join("");
  }

  function binaryToSvg(binary, height, quiet, color) {
    var px = quiet;
    var parts = [];
    for (var i = 0; i < binary.length; i++) {
      if (binary.charAt(i) === "1") {
        var run = 0;
        while (i + run < binary.length && binary.charAt(i + run) === "1") run++;
        parts.push('<rect x="' + px + '" y="' + quiet + '" width="' + run + '" height="' + height + '" fill="' + color + '"/>');
        px += run;
        i += run - 1;
      } else {
        px += 1;
      }
    }
    var total = px + quiet;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="' + (height + quiet * 2) + '" viewBox="0 0 ' + total + ' ' + (height + quiet * 2) + '">' +
      '<rect width="' + total + '" height="' + (height + quiet * 2) + '" fill="#ffffff"/>' +
      parts.join("") +
      "</svg>";
    return svg;
  }

  /* ---------------- Panel UI ---------------- */

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render(preview) {
    var html =
      "<label class='block text-[10px] text-gray-500 mb-1'>SYMBOLOGY</label>" +
      "<select data-plugin-action='type' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200 mb-2'>" +
      "<option value='ean13' " + (state.type === "ean13" ? "selected" : "") + ">EAN-13 (13 digits)</option>" +
      "<option value='upca' " + (state.type === "upca" ? "selected" : "") + ">UPC-A (12 digits)</option>" +
      "<option value='code128' " + (state.type === "code128" ? "selected" : "") + ">Code 128</option>" +
      "</select>" +
      "<label class='block text-[10px] text-gray-500 mb-1'>VALUE</label>" +
      "<input data-plugin-action='value' value='" + esc(state.value) + "' placeholder='590123412345' class='w-full text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600 mb-2' />" +
      "<div class='grid grid-cols-3 gap-2 mb-2'>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>BAR HEIGHT</label>" +
      "<select data-plugin-action='height' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='40' " + (state.height === 40 ? "selected" : "") + ">Short</option>" +
      "<option value='60' " + (state.height === 60 ? "selected" : "") + ">Medium</option>" +
      "<option value='90' " + (state.height === 90 ? "selected" : "") + ">Tall</option>" +
      "</select></div>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>COLOR</label>" +
      "<input type='color' data-plugin-action='color' value='" + state.color + "' class='w-8 h-8 rounded-md bg-white/5 border border-white/10 cursor-pointer' /></div>" +
      "<div class='flex items-end'><button data-plugin-action='generate' data-value='1' class='w-full text-left px-2 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Generate</span></button></div>" +
      "</div>";
    if (preview) {
      html += "<div class='rounded-md border border-white/10 bg-white px-1.5 py-2 mb-2'>" + preview + "</div>";
    }
    api.ui.createPanel(PANEL_ID, "Barcode Generator", html);
  }

  function normalizeValue(type, value) {
    value = String(value || "").trim();
    if (type === "ean13") {
      var d = digitsOf(value);
      if (!d) return { error: "EAN-13 must be digits only" };
      if (d.length === 12) d.push(eanChecksum(d));
      if (d.length !== 13) return { error: "EAN-13 needs 12 digits (check digit is added automatically)" };
      if (eanChecksum(d.slice(0, 12)) !== d[12]) return { error: "EAN-13 check digit does not match" };
      return { digits: d, label: "EAN-13" };
    }
    if (type === "upca") {
      var u = digitsOf(value);
      if (!u) return { error: "UPC-A must be digits only" };
      if (u.length === 11) u.push(eanChecksum([0].concat(u)));
      if (u.length !== 12) return { error: "UPC-A needs 11 digits (check digit is added automatically)" };
      if (eanChecksum([0].concat(u.slice(0, 11))) !== u[11]) return { error: "UPC-A check digit does not match" };
      return { digits: u, label: "UPC-A" };
    }
    if (!value.length) return { error: "Enter some text to encode" };
    return { text: value, label: "Code 128" };
  }

  function generate() {
    var norm = normalizeValue(state.type, state.value);
    if (norm.error) {
      api.ui.showNotification("Barcode: " + norm.error, "warning");
      return;
    }
    var pattern, quiet = QUIET[state.type];
    if (norm.digits) {
      if (state.type === "upca") {
        pattern = encodeEan13([0].concat(norm.digits));
      } else {
        pattern = encodeEan13(norm.digits);
      }
    } else {
      var widths = encodeCode128(norm.text);
      if (!widths) {
        api.ui.showNotification("Barcode: the text contains characters Code 128 cannot encode", "warning");
        return;
      }
      pattern = widthsToBinary(widths);
    }
    var svg = binaryToSvg(pattern, state.height, quiet, state.color);
    var previewNum = norm.digits ? norm.digits.join("") : norm.text;
    var preview = binaryToSvg(pattern, Math.min(36, state.height), quiet, "#18181b");
    render(preview);
    api.canvas.addSvg(svg, { name: state.label + " barcode", scale: 1 }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("Barcode added (" + previewNum + ")", "info");
      } else {
        api.ui.showNotification("Barcode: could not insert — select a layer first", "warning");
      }
    });
  }

  api.ui.onPanelAction(PANEL_ID, "type", function (value) {
    if (value) { state.type = value; render(null); }
  });
  api.ui.onPanelAction(PANEL_ID, "value", function (value) { state.value = value; });
  api.ui.onPanelAction(PANEL_ID, "height", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) { state.height = n; render(null); }
  });
  api.ui.onPanelAction(PANEL_ID, "color", function (value) { if (value) state.color = value; });
  api.ui.onPanelAction(PANEL_ID, "generate", generate);

  render(null);

  api.ui.addToolbarButton({
    id: "tools-barcode-generate",
    tooltip: "Barcode Generator",
    icon: "Barcode",
    onClick: generate,
  });
})();