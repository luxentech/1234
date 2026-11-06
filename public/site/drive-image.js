/* Elevate: يحوّل روابط صور Google Drive إلى روابط عرض مباشرة تلقائيًا. */
(function () {
  function driveId(url) {
    var m =
      url.match(/\/file\/d\/([-\w]{10,})/) ||
      url.match(/[?&]id=([-\w]{10,})/) ||
      url.match(/\/d\/([-\w]{10,})/) ||
      url.match(/\/uc\?[^#]*id=([-\w]{10,})/);
    return m ? m[1] : null;
  }

  function toDirect(url) {
    if (typeof url !== "string") return url;
    var u = url.trim();
    if (u.indexOf("drive.google.com") === -1 && u.indexOf("docs.google.com") === -1) return url;
    if (u.indexOf("drive.google.com/thumbnail") !== -1) return u;
    var id = driveId(u);
    return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000" : url;
  }

  window.toDirectImage = toDirect;

  var nativeSetAttr = Element.prototype.setAttribute;

  // 1) أي <img> يتعمل له src (سواء بالكود أو بـ innerHTML)
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (desc && desc.set) {
      Object.defineProperty(HTMLImageElement.prototype, "src", {
        get: function () {
          return desc.get.call(this);
        },
        set: function (v) {
          desc.set.call(this, toDirect(v));
        },
        configurable: true,
      });
    }
    nativeSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (this instanceof HTMLImageElement && String(name).toLowerCase() === "src") {
        value = toDirect(value);
      }
      return nativeSetAttr.call(this, name, value);
    };
  } catch (e) {}

  // 2) الصور اللي بتتولد من innerHTML (الـ parser بيتخطى الـ setter)
  function fix(node) {
    if (!node) return;
    if (node.tagName === "IMG") {
      var raw = setAttrGet(node);
      var next = toDirect(raw);
      if (raw && next !== raw) nativeSetAttr.call(node, "src", next);
    } else if (node.querySelectorAll) {
      var imgs = node.querySelectorAll("img");
      for (var i = 0; i < imgs.length; i++) fix(imgs[i]);
    }
  }
  function setAttrGet(el) {
    return el.getAttribute("src") || "";
  }

  var observe = function () {
    fix(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        for (var i = 0; i < m.addedNodes.length; i++) fix(m.addedNodes[i]);
        if (m.type === "attributes" && m.target.tagName === "IMG") fix(m.target);
      });
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe);
  else observe();
})();
