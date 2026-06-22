/*
 * Inline-SVG national flags.
 *
 * Emoji flags (🇧🇷 …) don't render on Windows browsers — they show as letter
 * codes or blank boxes. So instead of relying on emoji we draw small, clean,
 * recognisable SVG flags that render identically everywhere and keep the game
 * fully self-contained (no external image requests).
 *
 *   Flags.get("Brazil")  ->  '<svg class="flag" ...>…</svg>'
 *
 * Keyed by nation/opponent name (e.g. "West Germany" maps to the German flag).
 * Unknown names fall back to a neutral placeholder.
 */
window.Flags = (function () {
  function svg(body) {
    return '<svg class="flag" viewBox="0 0 3 2" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + body + "</svg>";
  }
  function R(x, y, w, h, c) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>'; }
  function C(cx, cy, r, c) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c + '"/>'; }
  function poly(pts, c) { return '<polygon points="' + pts + '" fill="' + c + '"/>'; }
  function star(cx, cy, r, c) {
    var p = [];
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      p.push((cx + r * Math.cos(a)).toFixed(3) + "," + (cy + r * Math.sin(a)).toFixed(3));
      var a2 = a + Math.PI / 5;
      p.push((cx + r * 0.4 * Math.cos(a2)).toFixed(3) + "," + (cy + r * 0.4 * Math.sin(a2)).toFixed(3));
    }
    return poly(p.join(" "), c);
  }
  function vbody(a, b, c) { return R(0, 0, 1, 2, a) + R(1, 0, 1, 2, b) + R(2, 0, 1, 2, c); }
  function hbody(a, b, c) { return R(0, 0, 3, 0.6667, a) + R(0, 0.6667, 3, 0.6666, b) + R(0, 1.3333, 3, 0.6667, c); }
  function V(a, b, c) { return svg(vbody(a, b, c)); }
  function H(a, b, c) { return svg(hbody(a, b, c)); }

  // Scandinavian cross (offset toward hoist)
  function nordic(field, cross) {
    return svg(R(0, 0, 3, 2, field) + R(0.85, 0, 0.35, 2, cross) + R(0, 0.83, 3, 0.34, cross));
  }
  // St George style cross
  function georgeCross(field, cross, extra) {
    return svg(R(0, 0, 3, 2, field) + R(1.3, 0, 0.4, 2, cross) + R(0, 0.8, 3, 0.4, cross) + (extra || ""));
  }
  // US / Liberia striped builder
  function striped(n, red, white, canton) {
    var s = "";
    for (var i = 0; i < n; i++) s += R(0, i * (2 / n), 3, 2 / n, i % 2 === 0 ? red : white);
    return s + canton;
  }

  var GERMANY = H("#000000", "#dd0000", "#ffce00");

  var F = {
    // CONMEBOL
    Brazil: svg(R(0, 0, 3, 2, "#009b3a") + poly("1.5,0.22 2.78,1 1.5,1.78 0.22,1", "#fedf00") + C(1.5, 1, 0.43, "#002776")),
    Argentina: svg(hbody("#74acdf", "#ffffff", "#74acdf") + C(1.5, 1, 0.18, "#f6b40e")),
    Uruguay: svg(R(0, 0, 3, 2, "#ffffff") + R(0, 0.9, 3, 0.17, "#0038a8") + R(0, 1.46, 3, 0.17, "#0038a8") + R(0, 0, 1.1, 0.72, "#0038a8") + C(0.55, 0.36, 0.2, "#fcd116")),
    Colombia: svg(R(0, 0, 3, 1, "#fcd116") + R(0, 1, 3, 0.5, "#003893") + R(0, 1.5, 3, 0.5, "#ce1126")),
    Chile: svg(R(0, 0, 3, 1, "#ffffff") + R(0, 1, 3, 1, "#d52b1e") + R(0, 0, 1, 1, "#0039a6") + star(0.5, 0.5, 0.3, "#ffffff")),

    // UEFA
    England: georgeCross("#ffffff", "#ce1126"),
    "N. Ireland": georgeCross("#ffffff", "#ce1126", C(1.5, 1, 0.28, "#ffffff") + star(1.5, 1, 0.22, "#ce1126")),
    Italy: V("#009246", "#ffffff", "#ce2b37"),
    France: V("#0055a4", "#ffffff", "#ef4135"),
    Belgium: V("#000000", "#fae042", "#ed2939"),
    Germany: GERMANY,
    "West Germany": GERMANY,
    Spain: svg(R(0, 0, 3, 0.5, "#aa151b") + R(0, 0.5, 3, 1, "#f1bf00") + R(0, 1.5, 3, 0.5, "#aa151b")),
    Netherlands: H("#ae1c28", "#ffffff", "#21468b"),
    Portugal: svg(R(0, 0, 1.2, 2, "#006600") + R(1.2, 0, 1.8, 2, "#ff0000") + C(1.2, 1, 0.3, "#ffcc00") + C(1.2, 1, 0.16, "#003399")),
    Croatia: svg(R(0, 0, 3, 0.6667, "#ff0000") + R(0, 0.6667, 3, 0.6666, "#ffffff") + R(0, 1.3333, 3, 0.6667, "#171796") + R(1.28, 0.62, 0.44, 0.76, "#ffffff") + R(1.28, 0.62, 0.22, 0.38, "#ff0000") + R(1.5, 1.0, 0.22, 0.38, "#ff0000")),
    Denmark: nordic("#c8102e", "#ffffff"),
    Sweden: nordic("#006aa7", "#fecc00"),
    Poland: svg(R(0, 0, 3, 1, "#ffffff") + R(0, 1, 3, 1, "#dc143c")),
    Hungary: H("#cd2a3e", "#ffffff", "#436f4d"),
    USSR: svg(R(0, 0, 3, 2, "#cc0000") + star(0.6, 0.5, 0.24, "#ffd700")),
    Czechoslovakia: svg(R(0, 0, 3, 1, "#ffffff") + R(0, 1, 3, 1, "#d7141a") + poly("0,0 1.3,1 0,2", "#11457e")),
    Romania: V("#002b7f", "#fcd116", "#ce1126"),

    // CAF
    Nigeria: V("#008751", "#ffffff", "#008751"),
    Cameroon: svg(vbody("#007a5e", "#ce1126", "#fcd116") + star(1.5, 1, 0.22, "#fcd116")),
    "Ivory Coast": V("#f77f00", "#ffffff", "#009e60"),
    Egypt: svg(hbody("#ce1126", "#ffffff", "#000000") + C(1.5, 1, 0.14, "#c8a13a")),
    Senegal: svg(vbody("#00853f", "#fdef42", "#e31b23") + star(1.5, 1, 0.22, "#00853f")),
    Ghana: svg(hbody("#ce1126", "#fcd116", "#006b3f") + star(1.5, 1, 0.24, "#000000")),
    Algeria: svg(R(0, 0, 1.5, 2, "#006233") + R(1.5, 0, 1.5, 2, "#ffffff") + C(1.62, 1, 0.34, "#d21034") + C(1.74, 1, 0.27, "#ffffff") + star(1.95, 1, 0.18, "#d21034")),
    Morocco: svg(R(0, 0, 3, 2, "#c1272d") + star(1.5, 1, 0.46, "#006233")),
    Liberia: svg(striped(11, "#bf0a30", "#ffffff", R(0, 0, 0.86, 0.86, "#002868") + star(0.43, 0.43, 0.3, "#ffffff"))),

    // CONCACAF
    Mexico: svg(vbody("#006847", "#ffffff", "#ce1126") + C(1.5, 1, 0.13, "#8b5a2b")),
    USA: svg(striped(13, "#b22234", "#ffffff", R(0, 0, 1.25, 14 / 13, "#3c3b6e"))),
    "Costa Rica": svg(R(0, 0, 3, 0.36, "#002b7f") + R(0, 0.36, 3, 0.28, "#ffffff") + R(0, 0.64, 3, 0.72, "#ce1126") + R(0, 1.36, 3, 0.28, "#ffffff") + R(0, 1.64, 3, 0.36, "#002b7f")),

    // AFC
    Japan: svg(R(0, 0, 3, 2, "#ffffff") + C(1.5, 1, 0.5, "#bc002d")),
    "South Korea": svg(R(0, 0, 3, 2, "#ffffff") + C(1.5, 1, 0.42, "#003478") + '<path d="M1.08,1 a0.42,0.42 0 0 1 0.84,0 z" fill="#c60c30"/>'),
    Iran: svg(hbody("#239f40", "#ffffff", "#da0000") + C(1.5, 1, 0.1, "#da0000")),
    Australia: svg(R(0, 0, 3, 2, "#00247d") + R(0, 0, 1.2, 0.78, "#0a17a7") + R(0.5, 0, 0.2, 0.78, "#ffffff") + R(0, 0.29, 1.2, 0.2, "#ffffff") + star(0.6, 1.5, 0.22, "#ffffff") + star(2.35, 0.55, 0.12, "#ffffff") + star(2.55, 1, 0.12, "#ffffff") + star(2.2, 1.35, 0.12, "#ffffff") + star(2.7, 1.5, 0.1, "#ffffff")),
  };

  var DEFAULT = svg(R(0, 0, 3, 2, "#2a3b34") + R(0, 0, 3, 2, "none"));

  function get(name) {
    return F[name] || DEFAULT;
  }

  return { get: get };
})();
