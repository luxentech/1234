/* Elevate — Student Plus
   Three extra student tools on the home page:
   1) Opportunity recommendations based on saved interests
   2) Application tracker (status per opportunity, saved per user)
   3) Quick share (WhatsApp / Telegram / copy link) on cards and detail page
   Reuses the existing .sh-* styles, vanilla JS only. */
(function () {
  "use strict";

  var INTERESTS_KEY = "ns_interests";
  var APPS_KEY = "ns_applications";

  var TYPE_AR = {
    competitions: "مسابقة",
    scholarships: "منحة",
    volunteering: "تطوع",
    jobs: "وظيفة",
    events: "فعالية",
    courses: "كورس مجاني",
    workshops: "ورشة عمل",
    travel: "سفر ممول",
    admission: "قبول جامعي",
    live: "ورشة مباشرة",
  };

  var STATUSES = [
    { id: "interested", label: "مهتم" },
    { id: "preparing", label: "بجهّز الأوراق" },
    { id: "applied", label: "قدّمت" },
    { id: "interview", label: "مقابلة" },
    { id: "accepted", label: "مقبول" },
    { id: "rejected", label: "مرفوض" },
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }
  function user() {
    return (window.App && App.getUser && App.getUser()) || readJSON("ns_user", null);
  }
  function userKey() {
    var u = user();
    return u ? u.username || u.phone || u.id || "me" : "guest";
  }
  function toast(msg) {
    if (window.App && typeof App.showToast === "function") {
      try {
        return App.showToast(msg);
      } catch (e) {}
    }
    var el = document.createElement("div");
    el.setAttribute("dir", "rtl");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;z-index:2147483000;bottom:22px;left:50%;transform:translateX(-50%);" +
      "background:#0f172a;color:#e2e8f0;border:1px solid rgba(255,255,255,.14);padding:12px 20px;border-radius:14px;" +
      "font:700 14px/1.6 system-ui,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.4);opacity:0;transition:opacity .25s ease";
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.opacity = "1";
    });
    setTimeout(function () {
      el.style.opacity = "0";
      setTimeout(function () {
        el.remove();
      }, 300);
    }, 2600);
  }
  function cards() {
    var c = readJSON("luxen_general_cards", []);
    return Array.isArray(c)
      ? c.filter(function (x) {
          return x && !x.partnerId && x.status !== "hidden";
        })
      : [];
  }
  function cardById(id) {
    var list = cards();
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function cardUrl(id) {
    return (
      location.origin +
      location.pathname.replace(/[^/]*$/, "index.html") +
      "?view=detail&id=" +
      encodeURIComponent(id)
    );
  }

  /* ---------------------- interests + recommendations ---------------------- */
  function interests() {
    var v = readJSON(INTERESTS_KEY, {});
    var list = v && v[userKey()];
    return Array.isArray(list) ? list : [];
  }
  function setInterests(list) {
    var v = readJSON(INTERESTS_KEY, {});
    if (!v || typeof v !== "object") v = {};
    v[userKey()] = list;
    writeJSON(INTERESTS_KEY, v);
  }

  function recommend(limit) {
    var picked = interests();
    var list = cards().filter(function (c) {
      return c.status !== "soon";
    });
    if (picked.length) {
      list = list.filter(function (c) {
        return picked.indexOf(c.type || c.category) !== -1;
      });
    }
    var views = readJSON("luxen_views", {}) || {};
    var likes = readJSON("luxen_likes", {}) || {};
    function score(c) {
      var s = 0;
      var v = views[c.id],
        l = likes[c.id];
      s += (typeof v === "number" ? v : 0) * 0.3;
      s += (Array.isArray(l) ? l.length : typeof l === "number" ? l : 0) * 2;
      if (c.deadline) {
        var d = Math.ceil((new Date(c.deadline + "T23:59:59").getTime() - Date.now()) / 86400000);
        if (!isNaN(d) && d >= 0 && d <= 30) s += 20 - Math.min(d, 20);
      }
      return s;
    }
    return list
      .sort(function (a, b) {
        return score(b) - score(a);
      })
      .slice(0, limit || 6);
  }

  function chipsHtml() {
    var picked = interests();
    return Object.keys(TYPE_AR)
      .map(function (t) {
        var on = picked.indexOf(t) !== -1;
        return (
          '<button type="button" class="sp-chip' +
          (on ? " on" : "") +
          '" data-sp-chip="' +
          t +
          '">' +
          esc(TYPE_AR[t]) +
          "</button>"
        );
      })
      .join("");
  }

  function renderRecs() {
    var chips = document.getElementById("sp-chips");
    if (chips) chips.innerHTML = chipsHtml();
    var box = document.getElementById("sp-rec-grid");
    if (!box) return;
    var list = recommend(6);
    if (!list.length) {
      box.innerHTML =
        '<div class="sh-card"><p style="margin:0">اختر مجالاتك المفضلة من الأعلى وسنقترح عليك أنسب الفرص المتاحة.</p></div>';
      return;
    }
    box.innerHTML = list
      .map(function (c) {
        var t = TYPE_AR[c.type || c.category] || "فرصة";
        return (
          '<article class="sh-card sp-reveal">' +
          '<div class="sh-card-top"><span class="sh-pill">' +
          esc(t) +
          "</span>" +
          (c.deadline ? '<span class="sh-pill calm">آخر موعد ' + esc(c.deadline) + "</span>" : "") +
          "</div>" +
          "<h3>" +
          esc(c.name || "فرصة") +
          "</h3>" +
          "<p>" +
          esc(String(c.description || "").slice(0, 130)) +
          "</p>" +
          '<div class="sh-actions">' +
          '<a class="sh-btn primary" href="?view=detail&id=' +
          encodeURIComponent(c.id) +
          '">التفاصيل</a>' +
          '<button type="button" class="sh-btn" data-sp-track="' +
          esc(c.id) +
          '">أضف للمتابعة</button>' +
          '<button type="button" class="sh-btn" data-sp-share="' +
          esc(c.id) +
          '">مشاركة</button>' +
          "</div></article>"
        );
      })
      .join("");
  }

  /* ----------------------------- tracker ----------------------------- */
  function apps() {
    var all = readJSON(APPS_KEY, {});
    var mine = all && all[userKey()];
    return Array.isArray(mine) ? mine : [];
  }
  function saveApps(list) {
    var all = readJSON(APPS_KEY, {});
    if (!all || typeof all !== "object") all = {};
    all[userKey()] = list;
    writeJSON(APPS_KEY, all);
  }
  function addToTracker(id) {
    var c = cardById(id);
    if (!c) return;
    var list = apps();
    if (
      list.some(function (a) {
        return String(a.id) === String(id);
      })
    ) {
      toast("الفرصة موجودة بالفعل في متابعة تقديماتك.");
      return;
    }
    list.unshift({
      id: c.id,
      name: c.name || "فرصة",
      type: c.type || c.category || "",
      deadline: c.deadline || "",
      status: "interested",
      note: "",
      added: Date.now(),
    });
    saveApps(list);
    renderTracker();
    toast("تمت الإضافة إلى متابعة تقديماتك ✅");
  }

  function renderTracker() {
    var box = document.getElementById("sp-track-list");
    if (!box) return;
    var list = apps();
    var counts = document.getElementById("sp-track-counts");
    if (counts) {
      var done = list.filter(function (a) {
        return a.status === "applied" || a.status === "interview" || a.status === "accepted";
      }).length;
      counts.textContent = list.length + " فرصة متابعة • " + done + " قدّمت فيها فعليًا";
    }
    if (!list.length) {
      box.innerHTML =
        '<div class="sh-card"><p style="margin:0">لسه مفيش فرص في المتابعة. اضغط «أضف للمتابعة» على أي فرصة وستظهر هنا مع حالتها.</p></div>';
      return;
    }
    box.innerHTML = list
      .map(function (a) {
        var options = STATUSES.map(function (s) {
          return (
            '<option value="' +
            s.id +
            '"' +
            (a.status === s.id ? " selected" : "") +
            ">" +
            esc(s.label) +
            "</option>"
          );
        }).join("");
        return (
          '<article class="sh-card sp-reveal">' +
          '<div class="sh-card-top"><span class="sh-pill">' +
          esc(TYPE_AR[a.type] || "فرصة") +
          "</span>" +
          (a.deadline ? '<span class="sh-pill warm">' + esc(a.deadline) + "</span>" : "") +
          "</div>" +
          "<h3>" +
          esc(a.name) +
          "</h3>" +
          '<select class="sp-select" data-sp-status="' +
          esc(a.id) +
          '">' +
          options +
          "</select>" +
          '<textarea class="sp-note" rows="2" placeholder="ملاحظاتك: الأوراق المطلوبة، مواعيد، روابط..." data-sp-note="' +
          esc(a.id) +
          '">' +
          esc(a.note || "") +
          "</textarea>" +
          '<div class="sh-actions">' +
          '<a class="sh-btn" href="?view=detail&id=' +
          encodeURIComponent(a.id) +
          '">فتح الفرصة</a>' +
          '<button type="button" class="sh-btn" data-sp-remove="' +
          esc(a.id) +
          '">حذف من المتابعة</button>' +
          "</div></article>"
        );
      })
      .join("");
  }

  /* ------------------------------ share ------------------------------ */
  function shareSheet(id) {
    var c = cardById(id);
    var url = cardUrl(id);
    var text = (c ? c.name : "فرصة على Elevate") + " — " + url;
    if (navigator.share) {
      navigator
        .share({ title: c ? c.name : "Elevate", text: c ? c.name : "", url: url })
        .catch(function () {});
      return;
    }
    var wrap = document.createElement("div");
    wrap.setAttribute("dir", "rtl");
    wrap.className = "sp-share-backdrop";
    wrap.innerHTML =
      '<div class="sp-share-box">' +
      "<h4>مشاركة الفرصة</h4>" +
      '<a class="sh-btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=' +
      encodeURIComponent(text) +
      '">واتساب</a>' +
      '<a class="sh-btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=' +
      encodeURIComponent(url) +
      "&text=" +
      encodeURIComponent(c ? c.name : "") +
      '">تليجرام</a>' +
      '<button type="button" class="sh-btn" data-sp-copy="1">نسخ الرابط</button>' +
      '<button type="button" class="sh-btn" data-sp-close="1">إغلاق</button>' +
      "</div>";
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest("[data-sp-close]")) {
        wrap.remove();
        return;
      }
      if (e.target.closest("[data-sp-copy]")) {
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
          .then(function () {
            toast("تم نسخ الرابط");
          })
          .catch(function () {
            window.prompt("انسخ الرابط:", url);
          });
        wrap.remove();
      }
    });
    document.body.appendChild(wrap);
  }

  function mountDetailShare() {
    var params = new URLSearchParams(location.search);
    if (params.get("view") !== "detail") return;
    var id = params.get("id");
    if (!id) return;
    var view = document.getElementById("detail-view");
    if (!view || view.querySelector("#sp-detail-bar")) return;
    var bar = document.createElement("div");
    bar.id = "sp-detail-bar";
    bar.className = "sp-detail-bar";
    bar.innerHTML =
      '<button type="button" class="sh-btn primary" data-sp-track="' +
      esc(id) +
      '">أضف لمتابعة تقديماتي</button>' +
      '<button type="button" class="sh-btn" data-sp-share="' +
      esc(id) +
      '">مشاركة الفرصة</button>';
    view.appendChild(bar);
  }

  /* ------------------------------ markup ------------------------------ */
  function sectionsHtml() {
    return (
      "" +
      '<section class="sh-section" id="sp-recs"><div class="sh-wrap">' +
      '<div class="sh-head"><span class="sh-kicker">مقترح لك</span>' +
      '<h2 class="sh-title">فرص تناسب مجالك</h2>' +
      '<p class="sh-sub">اختر المجالات التي تهمك وسنرتّب لك الفرص الأكثر تفاعلًا والأقرب في الموعد النهائي.</p></div>' +
      '<div class="sp-chips" id="sp-chips"></div>' +
      '<div class="sh-grid sh-grid-3" id="sp-rec-grid"></div>' +
      "</div></section>" +
      '<section class="sh-section" id="sp-tracker"><div class="sh-wrap">' +
      '<div class="sh-head"><span class="sh-kicker">متابعة التقديمات</span>' +
      '<h2 class="sh-title">تابع كل فرصة قدّمت فيها</h2>' +
      '<p class="sh-sub" id="sp-track-counts"></p></div>' +
      '<div class="sh-grid sh-grid-3" id="sp-track-list"></div>' +
      "</div></section>"
    );
  }

  /* ------------------------------- boot ------------------------------- */
  function mount() {
    var home = document.getElementById("home-view");
    mountDetailShare();
    if (!home || document.getElementById("sp-recs")) return;
    var holder = document.createElement("div");
    holder.id = "sp-root";
    holder.innerHTML = sectionsHtml();
    var anchor =
      document.getElementById("sh-root") ||
      home.querySelector(".partners-section") ||
      home.querySelector(".faq-section");
    if (anchor && anchor.parentNode)
      anchor.parentNode.insertBefore(holder, anchor.nextSibling || null);
    else home.appendChild(holder);

    renderRecs();
    renderTracker();

    document.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-sp-chip]");
      if (chip) {
        var t = chip.getAttribute("data-sp-chip");
        var list = interests();
        var i = list.indexOf(t);
        if (i === -1) list.push(t);
        else list.splice(i, 1);
        setInterests(list);
        renderRecs();
        return;
      }
      var track = e.target.closest("[data-sp-track]");
      if (track) {
        addToTracker(track.getAttribute("data-sp-track"));
        return;
      }
      var share = e.target.closest("[data-sp-share]");
      if (share) {
        shareSheet(share.getAttribute("data-sp-share"));
        return;
      }
      var rem = e.target.closest("[data-sp-remove]");
      if (rem) {
        var id = rem.getAttribute("data-sp-remove");
        saveApps(
          apps().filter(function (a) {
            return String(a.id) !== String(id);
          }),
        );
        renderTracker();
      }
    });

    document.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-sp-status]");
      if (sel) {
        var id = sel.getAttribute("data-sp-status");
        var list = apps().map(function (a) {
          if (String(a.id) === String(id)) a.status = sel.value;
          return a;
        });
        saveApps(list);
        renderTracker();
      }
    });

    document.addEventListener("input", function (e) {
      var note = e.target.closest("[data-sp-note]");
      if (!note) return;
      var id = note.getAttribute("data-sp-note");
      clearTimeout(note._t);
      note._t = setTimeout(function () {
        saveApps(
          apps().map(function (a) {
            if (String(a.id) === String(id)) a.note = note.value;
            return a;
          }),
        );
      }, 500);
    });
  }

  function boot() {
    var tries = 0;
    (function wait() {
      if (readJSON("luxen_general_cards", null) !== null || tries > 4) {
        mount();
        return;
      }
      tries++;
      setTimeout(wait, 300);
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.StudentPlus = {
    refresh: function () {
      renderRecs();
      renderTracker();
    },
  };
})();
