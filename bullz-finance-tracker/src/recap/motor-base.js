/* Motor do palco, parte 1: o FC mínimo de que recap/render.js, recap/audio.js
 * e promo/promo.js precisam (html, icone, logo, local, ui, $, $$) e o canal de
 * mensagens com o app. scripts/gera-palco.js troca __ICONES__ e __LOGO__. */
(function(){
  var envia = function (m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage({ palco: s }, location.origin);
  };
  window.__envia = envia;
  window.onerror = function (msg, src, l, c, err) { envia({ ev: "aviso", texto: "Erro no player: " + msg, tipo: "erro" }); };
  var P = __ICONES__;
  var cru = function (s) { return { __html: s, toString: function () { return s; } }; };
  var html = function (str) {
    var vals = [].slice.call(arguments, 1), out = "";
    str.forEach(function (s, i) { out += s; if (i < vals.length) out += vals[i] == null || vals[i] === false ? "" : String(vals[i]); });
    return cru(out);
  };
  var prefs = {};
  window.__prefs = function (p) { for (var k in p) prefs[k] = p[k]; };
  window.LOGO_PALCO = __LOGO__;
  window.FC = {
    html: html,
    icone: function (n, tam) { tam = tam || 20; return cru('<svg xmlns="http://www.w3.org/2000/svg" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>"); },
    logo: function (tam) { return cru('<img src="' + window.LOGO_PALCO + '" width="' + tam + '" height="' + tam + '" alt="Bullz" style="display:block;width:' + tam + "px;height:" + tam + 'px;object-fit:contain">'); },
    local: { ler: function (k, p) { return k in prefs ? prefs[k] : p; }, gravar: function (k, v) { prefs[k] = v; envia({ ev: "pref", chave: k, valor: v }); } },
    ui: { aviso: function (texto, tipo) { envia({ ev: "aviso", texto: texto, tipo: tipo }); }, erro: function (e) { envia({ ev: "aviso", texto: String((e && e.message) || e), tipo: "erro" }); }, segmentado: function () {} },
    $: function (s, el) { return (el || document).querySelector(s); },
    $$: function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); },
    estado: {}, modulo: function () { return false; }, datas: {}, auth: { usuario: { user_metadata: {} } },
  };
})();
