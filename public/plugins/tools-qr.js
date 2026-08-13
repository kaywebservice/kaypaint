// QR Code Generator — kaypaint plugin (tools-qr)
// Pure-JS QR encoder (ISO/IEC 18004 basics: byte mode, versions 1-10,
// ECC levels L/M/Q/H, 8 mask patterns with penalty scoring) that inserts
// a real QR artwork onto the canvas via the canvas.addSvg API.

(function () {
  var PANEL_ID = "tools-qr-panel";
  var state = { text: "https://kaypaint.app", level: "M", dark: "#000000", light: "#ffffff", scale: 6 };

  /* ---------------- GF(256) + Reed-Solomon ---------------- */

  var GF_EXP = [], GF_LOG = [];
  (function () {
    var x = 1;
    for (var i = 0; i < 256; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 256; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var lo = str.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) {
          var cp = 0x10000 + ((code - 0xd800) << 10) + (lo - 0xdc00);
          bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          i++;
        } else {
          bytes.push(0xef, 0xbf, 0xbd);
        }
      } else if (code >= 0xd800 && code <= 0xdfff) {
        bytes.push(0xef, 0xbf, 0xbd);
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return bytes;
  }

  function rsGenerator(eccLen) {
    var poly = [1], i, j;
    for (i = 0; i < eccLen; i++) {
      var next = [];
      for (j = 0; j <= poly.length; j++) next[j] = 0;
      for (j = 0; j < poly.length; j++) {
        next[j] = next[j] ^ poly[j];
        next[j + 1] = next[j + 1] ^ gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, eccLen) {
    var gen = rsGenerator(eccLen);
    var rem = [];
    var i, j;
    for (i = 0; i < eccLen; i++) rem[i] = 0;
    for (i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      for (j = 0; j < eccLen - 1; j++) rem[j] = rem[j + 1];
      rem[eccLen - 1] = 0;
      if (factor !== 0) {
        for (j = 0; j < eccLen; j++) {
          rem[j] = rem[j] ^ gfMul(gen[j + 1], factor);
        }
      }
    }
    return rem;
  }

  /* ---------------- Version / level tables (v1..v10) ---------------- */

  var RAW_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  var ECC_PER_BLOCK = {
    L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
  };
  var NUM_BLOCKS = {
    L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
  };
  var ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var VERSION_BITS = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };

  function pickVersion(text, level) {
    var bytes = utf8Bytes(text);
    for (var v = 1; v <= 10; v++) {
      var maxData = RAW_CODEWORDS[v - 1] - NUM_BLOCKS[level][v - 1] * ECC_PER_BLOCK[level][v - 1];
      var countBits = v < 10 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 <= maxData * 8) return v;
    }
    return 0;
  }

  /* ---------------- Data codewords (byte mode) ---------------- */

  function encodeData(text, version, level) {
    var bytes = utf8Bytes(text);
    var maxData = RAW_CODEWORDS[version - 1] - NUM_BLOCKS[level][version - 1] * ECC_PER_BLOCK[level][version - 1];
    var countBits = version < 10 ? 8 : 16;
    var bits = [];
    function append(value, length) {
      for (var i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }
    append(4, 4);
    append(bytes.length, countBits);
    for (var c = 0; c < bytes.length; c++) append(bytes[c], 8);
    var capacity = maxData * 8;
    if (bits.length > capacity) return null;
    var term = Math.min(4, capacity - bits.length);
    for (var t = 0; t < term; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    var pads = [0xec, 0x11];
    var p = 0;
    while (bits.length < capacity) {
      append(pads[p], 8);
      p = 1 - p;
    }
    var bytes = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0;
      for (var s = 0; s < 8; s++) v = (v << 1) | bits[b + s];
      bytes.push(v);
    }
    return bytes;
  }

  function addEccAndInterleave(data, version, level) {
    var numBlocks = NUM_BLOCKS[level][version - 1];
    var eccLen = ECC_PER_BLOCK[level][version - 1];
    var base = Math.floor(data.length / numBlocks);
    var extra = data.length % numBlocks;
    var dc = [], ec = [];
    var pos = 0;
    for (var b = 0; b < numBlocks; b++) {
      var size = base + (b >= numBlocks - extra ? 1 : 0);
      var block = data.slice(pos, pos + size);
      pos += size;
      dc.push(block);
      ec.push(rsEncode(block, eccLen));
    }
    var out = [];
    var maxDc = base + (extra > 0 ? 1 : 0);
    for (var i = 0; i < maxDc; i++) {
      for (var j = 0; j < numBlocks; j++) {
        if (i < dc[j].length) out.push(dc[j][i]);
      }
    }
    for (var k = 0; k < eccLen; k++) {
      for (var m = 0; m < numBlocks; m++) out.push(ec[m][k]);
    }
    return out;
  }

  /* ---------------- Masking ---------------- */

  function maskCondition(id, i, j) {
    switch (id) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return ((i * j) % 2 + (i * j) % 3) === 0;
      case 6: return (((i * j) % 2 + (i * j) % 3) % 2) === 0;
      case 7: return (((i + j) % 2 + (i * j) % 3) % 2) === 0;
    }
    return false;
  }

  var PATTERN_1011101 = [1, 0, 1, 1, 1, 0, 1];

  function maskPenalty(m) {
    var n = m.length;
    var score = 0;
    var dark = 0;
    var i, j, k;

    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        if (m[i][j]) dark++;
      }
    }

    function addRun(run) {
      if (run >= 5) score += 3 + (run - 5);
    }

    for (i = 0; i < n; i++) {
      var run = 1;
      for (j = 1; j < n; j++) {
        if (m[i][j] === m[i][j - 1]) run++;
        else { addRun(run); run = 1; }
      }
      addRun(run);
    }
    for (j = 0; j < n; j++) {
      var run2 = 1;
      for (i = 1; i < n; i++) {
        if (m[i][j] === m[i - 1][j]) run2++;
        else { addRun(run2); run2 = 1; }
      }
      addRun(run2);
    }

    for (i = 0; i < n - 1; i++) {
      for (j = 0; j < n - 1; j++) {
        var v = m[i][j];
        if (m[i][j + 1] === v && m[i + 1][j] === v && m[i + 1][j + 1] === v) score += 3;
      }
    }

    function scan(seq) {
      var s;
      for (s = 0; s <= seq.length - 11; s++) {
        var ok = true;
        for (k = 0; k < 7; k++) {
          if (seq[s + k] !== PATTERN_1011101[k]) { ok = false; break; }
        }
        if (!ok) continue;
        var left = 0, right = 0;
        for (k = 1; k <= 4; k++) {
          if (s - k >= 0 && seq[s - k] === 0) left++;
          else break;
        }
        for (k = 0; k < 4; k++) {
          if (s + 7 + k < seq.length && seq[s + 7 + k] === 0) right++;
          else break;
        }
        if (left >= 4 || right >= 4) score += 40;
      }
    }
    for (i = 0; i < n; i++) scan(m[i]);
    for (j = 0; j < n; j++) {
      var col = [];
      for (i = 0; i < n; i++) col.push(m[i][j]);
      scan(col);
    }

    var ratio = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return score;
  }

  /* ---------------- Matrix ---------------- */

  function buildMatrix(version, codewords, maskId, level) {
    var n = 21 + 4 * (version - 1);
    var m = [];
    var i, j;
    for (i = 0; i < n; i++) {
      var row = [];
      for (j = 0; j < n; j++) row.push(null);
      m.push(row);
    }

    function set(r, c, v) { m[r][c] = v; }

    function probe(trow, tcol) {
      for (var r = -1; r <= 7; r++) {
        if (trow + r < 0 || trow + r >= n) continue;
        for (var c = -1; c <= 7; c++) {
          if (tcol + c < 0 || tcol + c >= n) continue;
          if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
              (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
              (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            set(trow + r, tcol + c, 1);
          } else {
            set(trow + r, tcol + c, 0);
          }
        }
      }
    }

    function timing() {
      for (var r = 8; r < n - 8; r++) {
        if (m[r][6] === null) set(r, 6, r % 2 === 0 ? 1 : 0);
      }
      for (var c = 8; c < n - 8; c++) {
        if (m[6][c] === null) set(6, c, c % 2 === 0 ? 1 : 0);
      }
    }

    function alignment() {
      var pos = ALIGN[version - 1];
      for (var a = 0; a < pos.length; a++) {
        for (var b = 0; b < pos.length; b++) {
          var trow = pos[a], tcol = pos[b];
          if (m[trow][tcol] !== null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                set(trow + r, tcol + c, 1);
              } else {
                set(trow + r, tcol + c, 0);
              }
            }
          }
        }
      }
    }

    function format() {
      var levelBits = { L: 1, M: 0, Q: 3, H: 2 }[level];
      var data = (levelBits << 3) | maskId;
      var rem = data << 10;
      for (var b = 14; b >= 10; b--) {
        if (rem & (1 << b)) rem ^= 0x537 << (b - 10);
      }
      var bits = ((data << 10) | rem) ^ 0x5412;
      for (var f = 0; f < 15; f++) {
        var mod = (bits >> f) & 1;
        if (f < 6) set(f, 8, mod);
        else if (f < 8) set(f + 1, 8, mod);
        else set(n - 15 + f, 8, mod);
        if (f < 8) set(8, n - f - 1, mod);
        else if (f < 9) set(8, 15 - f - 1 + 1, mod);
        else set(8, 15 - f - 1, mod);
      }
      set(n - 8, 8, 1);
    }

    function versionInfo() {
      if (version < 7) return;
      var bits = VERSION_BITS[version];
      for (var v = 0; v < 18; v++) {
        var mod = (bits >> v) & 1;
        set(Math.floor(v / 3), (v % 3) + n - 8 - 3, mod);
        set((v % 3) + n - 8 - 3, Math.floor(v / 3), mod);
      }
    }

    function mapData() {
      var inc = -1;
      var row = n - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      for (var col = n - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (;;) {
          for (var c = 0; c < 2; c++) {
            if (m[row][col - c] === null) {
              var dark = false;
              if (byteIndex < codewords.length) {
                dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
              }
              if (maskCondition(maskId, row, col - c)) dark = !dark;
              set(row, col - c, dark ? 1 : 0);
              bitIndex--;
              if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
            }
          }
          row += inc;
          if (row < 0 || row >= n) { row -= inc; inc = -inc; break; }
        }
      }
    }

    probe(0, 0);
    probe(n - 7, 0);
    probe(0, n - 7);
    alignment();
    timing();
    versionInfo();
    format();
    mapData();
    return m;
  }

  /* ---------------- Encoding entry point ---------------- */

  function encode(text, level) {
    var version = pickVersion(text, level);
    if (!version) return null;
    var data = encodeData(text, version, level);
    if (!data) return null;
    var codewords = addEccAndInterleave(data, version, level);
    var best = null;
    var bestScore = 1e9;
    for (var mask = 0; mask < 8; mask++) {
      var m = buildMatrix(version, codewords, mask, level);
      var s = maskPenalty(m);
      if (s < bestScore) { bestScore = s; best = m; }
    }
    return { version: version, matrix: best };
  }

  /* ---------------- SVG output ---------------- */

  function toSvg(result, dark, light, margin) {
    var m = result.matrix;
    var n = m.length;
    var total = n + margin * 2;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="' + total + '" viewBox="0 0 ' + total + ' ' + total + '">');
    parts.push('<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>');
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (m[r][c]) {
          parts.push('<rect x="' + (c + margin) + '" y="' + (r + margin) + '" width="1" height="1" fill="' + dark + '"/>');
        }
      }
    }
    parts.push("</svg>");
    return parts.join("");
  }

  /* ---------------- Panel UI ---------------- */

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render(preview) {
    var html =
      "<label class='block text-[10px] text-gray-500 mb-1'>TEXT OR URL</label>" +
      "<input data-plugin-action='text' value='" + esc(state.text) + "' placeholder='https://…' class='w-full text-sm bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 placeholder:text-gray-600 mb-2' />" +
      "<div class='grid grid-cols-3 gap-2 mb-2'>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>ECC</label>" +
      "<select data-plugin-action='level' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='L' " + (state.level === "L" ? "selected" : "") + ">Low</option>" +
      "<option value='M' " + (state.level === "M" ? "selected" : "") + ">Medium</option>" +
      "<option value='Q' " + (state.level === "Q" ? "selected" : "") + ">Quartile</option>" +
      "<option value='H' " + (state.level === "H" ? "selected" : "") + ">High</option>" +
      "</select></div>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>SIZE</label>" +
      "<select data-plugin-action='scale' class='w-full text-xs bg-white/5 border border-white/10 rounded-md px-1.5 py-1.5 text-gray-200'>" +
      "<option value='4' " + (state.scale === 4 ? "selected" : "") + ">Small</option>" +
      "<option value='6' " + (state.scale === 6 ? "selected" : "") + ">Medium</option>" +
      "<option value='10' " + (state.scale === 10 ? "selected" : "") + ">Large</option>" +
      "</select></div>" +
      "<div><label class='block text-[10px] text-gray-500 mb-1'>MODULES</label>" +
      "<div class='flex gap-1'>" +
      "<input type='color' data-plugin-action='dark' value='" + state.dark + "' title='Dark' class='w-8 h-8 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
      "<input type='color' data-plugin-action='light' value='" + state.light + "' title='Light' class='w-8 h-8 rounded-md bg-white/5 border border-white/10 cursor-pointer' />" +
      "</div></div></div>";
    if (preview) {
      var size = state.scale >= 6 ? 140 : 110;
      html += "<div class='rounded-md border border-white/10 bg-white/5 p-1.5 mb-2'>" + preview + "</div>";
    }
    html +=
      "<button data-plugin-action='generate' data-value='1' class='w-full text-left px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 transition-colors'><span class='block text-gray-100 text-sm'>Generate QR Code</span><span class='block text-[10px] text-gray-500'>Inserts a scalable QR artwork at canvas center</span></button>";
    api.ui.createPanel(PANEL_ID, "QR Code Generator", html);
  }

  function generate() {
    var text = state.text;
    if (!text || !text.length) {
      api.ui.showNotification("QR Code: enter some text or a URL first", "warning");
      return;
    }
    var result = encode(text, state.level);
    if (!result) {
      api.ui.showNotification("QR Code: content is too long for this error-correction level", "error");
      return;
    }
    var svg = toSvg(result, state.dark, state.light, 4);
    var preview = toSvg(result, "#18181b", "#ffffff", 3);
    render(preview);
    api.canvas.addSvg(svg, { name: "QR Code", scale: state.scale }).then(function (ok) {
      if (ok) {
        api.ui.showNotification("QR Code v" + result.version + " added at canvas center", "info");
      } else {
        api.ui.showNotification("QR Code: could not insert — select a layer with an active object", "warning");
      }
    });
  }

  api.ui.onPanelAction(PANEL_ID, "text", function (value) { state.text = value; });
  api.ui.onPanelAction(PANEL_ID, "level", function (value) {
    if (value) { state.level = value; render(null); }
  });
  api.ui.onPanelAction(PANEL_ID, "scale", function (value) {
    var n = parseInt(value, 10);
    if (n > 0) { state.scale = n; render(null); }
  });
  api.ui.onPanelAction(PANEL_ID, "dark", function (value) { if (value) state.dark = value; });
  api.ui.onPanelAction(PANEL_ID, "light", function (value) { if (value) state.light = value; });
  api.ui.onPanelAction(PANEL_ID, "generate", generate);

  render(null);

  api.ui.addToolbarButton({
    id: "tools-qr-generate",
    tooltip: "QR Code Generator",
    icon: "QrCode",
    onClick: generate,
  });
})();