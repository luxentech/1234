/* Elevate — complete Arabic/English page translation without changing stored content. */
(function () {
  "use strict";

  var ARABIC = /[\u0600-\u06ff]/;
  var originals = new WeakMap();
  var pending = false;
  var translating = false;
  var cache = {};
  try {
    cache = JSON.parse(sessionStorage.getItem("elevate_translation_cache") || "{}") || {};
  } catch (e) {}

  function lang() {
    return window.App && App.lang ? App.lang : localStorage.getItem("ns_lang") || "ar";
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('script,style,noscript,[contenteditable="true"]')) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function remember(target, kind, value) {
    var state = originals.get(target) || {};
    if (state[kind] === undefined) state[kind] = value;
    originals.set(target, state);
  }

  function candidates() {
    var found = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue || "";
      var parent = node.parentElement;
      if (!ARABIC.test(text) || !visible(parent) || parent.closest("[data-ar][data-en]")) continue;
      remember(node, "text", text);
      found.push({ target: node, kind: "text", source: text.trim() });
    }
    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach(function (el) {
      if (!visible(el)) return;
      ["placeholder", "title", "aria-label"].forEach(function (attr) {
        var value = el.getAttribute(attr) || "";
        if (!ARABIC.test(value)) return;
        remember(el, attr, value);
        found.push({ target: el, kind: attr, source: value.trim() });
      });
    });
    return found;
  }

  function restoreArabic() {
    document.querySelectorAll("*").forEach(function (el) {
      var state = originals.get(el);
      if (!state) return;
      ["placeholder", "title", "aria-label"].forEach(function (attr) {
        if (state[attr] !== undefined) el.setAttribute(attr, state[attr]);
      });
    });
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var state = originals.get(node);
      if (state && state.text !== undefined) node.nodeValue = state.text;
    }
  }

  async function translateBatch(items) {
    var unique = [];
    var seen = {};
    items.forEach(function (item) {
      if (!cache[item.source] && !seen[item.source]) {
        seen[item.source] = true;
        unique.push(item.source);
      }
    });
    for (var start = 0; start < unique.length; start += 40) {
      if (lang() !== "en") return;
      var texts = unique.slice(start, start + 40);
      try {
        var response = await fetch("/api/public/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target: "en", texts: texts }),
        });
        if (!response.ok) continue;
        var data = await response.json();
        (data.translations || []).forEach(function (value, index) {
          if (value) cache[texts[index]] = value;
        });
      } catch (e) {}
    }
    try {
      sessionStorage.setItem("elevate_translation_cache", JSON.stringify(cache));
    } catch (e) {}
  }

  function apply(items) {
    if (lang() !== "en") return;
    items.forEach(function (item) {
      var value = cache[item.source];
      if (!value || !item.target.isConnected) return;
      if (item.kind === "text")
        item.target.nodeValue = item.target.nodeValue.replace(item.source, value);
      else item.target.setAttribute(item.kind, value);
    });
  }

  async function refresh() {
    if (translating) return;
    translating = true;
    try {
      if (lang() === "ar") {
        restoreArabic();
        return;
      }
      var items = candidates();
      apply(items);
      await translateBatch(items);
      apply(items);
    } finally {
      translating = false;
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      refresh();
    }, 120);
  }

  window.addEventListener("elevate:languagechange", schedule);
  document.addEventListener("DOMContentLoaded", function () {
    schedule();
    new MutationObserver(function (changes) {
      if (translating || lang() !== "en") return;
      if (
        changes.some(function (change) {
          return (
            change.type === "childList" ||
            change.attributeName === "style" ||
            change.attributeName === "class"
          );
        })
      )
        schedule();
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  });

  window.ElevateLanguage = { refresh: schedule };
})();
