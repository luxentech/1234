/* Elevate home extras: more hero counters, leaderboard, quick-entry bar.
   Read-only on existing data; only appends to luxen_app_installs. */
(function () {
  function read(k, d) {
    try {
      var v = JSON.parse(localStorage.getItem(k) || "null");
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }
  function user() {
    try {
      return JSON.parse(localStorage.getItem("ns_user") || "null");
    } catch (e) {
      return null;
    }
  }

  /* ---------- installs ---------- */
  function deviceId() {
    var id = localStorage.getItem("ns_device_id");
    if (!id) {
      id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ns_device_id", id);
    }
    return id;
  }
  function recordInstall() {
    try {
      var list = read("luxen_app_installs", []);
      if (!Array.isArray(list)) list = [];
      var id = deviceId();
      if (
        list.some(function (x) {
          return x && x.id === id;
        })
      )
        return;
      list.push({ id: id, t: Date.now() });
      localStorage.setItem("luxen_app_installs", JSON.stringify(list));
      updateStats();
    } catch (e) {}
  }
  try {
    var top = window.parent || window;
    var standalone =
      (top.matchMedia && top.matchMedia("(display-mode: standalone)").matches) ||
      top.navigator.standalone;
    if (standalone) setTimeout(recordInstall, 3000);
    top.addEventListener("appinstalled", function () {
      setTimeout(recordInstall, 500);
    });
  } catch (e) {}

  /* ---------- stats ---------- */
  function totalViews() {
    var v = read("luxen_views", {}),
      n = 0;
    if (v && typeof v === "object")
      for (var k in v) {
        var x = v[k];
        n += Array.isArray(x) ? x.length : typeof x === "number" ? x : 0;
      }
    return n;
  }
  function addStat(id, en, ar, icon) {
    var wrap = document.querySelector(".hero-stats");
    if (!wrap || document.getElementById(id)) return;
    var d = document.createElement("div");
    d.className = "hero-stat-item";
    d.innerHTML =
      '<div class="hero-stat-number" id="' +
      id +
      '">0</div><div class="hero-stat-label" data-en="' +
      en +
      '" data-ar="' +
      ar +
      '"><i class="fas ' +
      icon +
      '" style="opacity:.7;margin-inline-end:4px"></i>' +
      ar +
      "</div>";
    wrap.appendChild(d);
  }
  function updateStats() {
    addStat("stat-views", "Opportunity Views", "مشاهدة للفرص", "fa-eye");
    addStat("stat-installs", "App Installs", "حمّلوا التطبيق", "fa-mobile-screen-button");
    addStat("stat-partners", "Partners", "شريك", "fa-handshake");
    var p = read("luxen_partners", []),
      ins = read("luxen_app_installs", []);
    var set = function (id, n) {
      var el = document.getElementById(id);
      if (el) el.textContent = fmt(n);
    };
    set("stat-views", totalViews());
    set("stat-installs", Array.isArray(ins) ? ins.length : 0);
    set("stat-partners", Array.isArray(p) ? p.length : 0);
  }

  /* ---------- leaderboard ---------- */
  function scores() {
    var users = read("luxen_all_users", []),
      comments = read("luxen_comments", []),
      views = read("luxen_views", {}),
      likes = read("luxen_likes", {});
    var map = {};
    function get(u, name) {
      if (!u) return null;
      var k = String(u).toLowerCase();
      if (!map[k]) map[k] = { u: k, name: name || u, c: 0, v: 0, l: 0 };
      if (name && map[k].name === u) map[k].name = name;
      return map[k];
    }
    (Array.isArray(users) ? users : []).forEach(function (x) {
      if (x && !x.isAdmin && !x.isTeam && x.username) get(x.username, x.name);
    });
    (Array.isArray(comments) ? comments : []).forEach(function (c) {
      var r = c && map[String(c.username || "").toLowerCase()];
      if (r) r.c++;
    });
    for (var id in views)
      (Array.isArray(views[id]) ? views[id] : []).forEach(function (v) {
        var r = v && map[String(v.u || "").toLowerCase()];
        if (r) r.v++;
      });
    for (var id2 in likes) {
      var arr = likes[id2];
      (Array.isArray(arr) ? arr : []).forEach(function (u) {
        var r = map[String((u && (u.u || u.username)) || u || "").toLowerCase()];
        if (r) r.l++;
      });
    }
    return Object.keys(map)
      .map(function (k) {
        var r = map[k];
        r.pts = r.c * 10 + r.l * 3 + r.v;
        return r;
      })
      .filter(function (r) {
        return r.pts > 0;
      })
      .sort(function (a, b) {
        return b.pts - a.pts;
      });
  }
  function lbCfg() {
    var st = read("luxen_settings", {});
    var c = (st && st.lb) || {};
    return { hidden: c.hidden || {}, pins: c.pins || {} };
  }
  function saveCfg(c) {
    var st = read("luxen_settings", {});
    if (!st || typeof st !== "object") st = {};
    st.lb = c;
    localStorage.setItem("luxen_settings", JSON.stringify(st));
  }
  function isAdmin() {
    var u = user();
    return !!(u && (u.isAdmin || u.role === "admin"));
  }
  function ranked() {
    var all = scores(),
      c = lbCfg(),
      by = {};
    all.forEach(function (r) {
      by[r.u] = r;
    });
    var users = read("luxen_all_users", []);
    (Array.isArray(users) ? users : []).forEach(function (x) {
      if (x && x.username) {
        var k = String(x.username).toLowerCase();
        if (!by[k]) by[k] = { u: k, name: x.name || x.username, pts: 0 };
      }
    });
    var vis = all.filter(function (r) {
      return !c.hidden[r.u];
    });
    var out = [],
      used = {};
    [1, 2, 3].forEach(function (n) {
      var k = c.pins[n];
      if (k && by[k] && !c.hidden[k] && !used[k]) {
        out[n - 1] = by[k];
        used[k] = 1;
      }
    });
    var rest = vis.filter(function (r) {
        return !used[r.u];
      }),
      j = 0;
    for (var i = 0; i < 10; i++) {
      if (!out[i]) {
        if (j < rest.length) out[i] = rest[j++];
      }
    }
    return { rows: out.filter(Boolean).slice(0, 10), all: by, cfg: c };
  }
  function renderBoard() {
    var hero = document.querySelector(".hero-stats");
    var section = hero && hero.closest("section");
    if (!section) return;
    var box = document.getElementById("hp-leaderboard");
    if (!box) {
      box = document.createElement("section");
      box.id = "hp-leaderboard";
      box.className = "hp-board";
      box.setAttribute("dir", "rtl");
      section.parentNode.appendChild(box);
    }
    var R = ranked(),
      rows = R.rows,
      me = user(),
      medals = ["🥇", "🥈", "🥉"];
    box.innerHTML =
      '<div class="hp-board-inner"><h2><i class="fas fa-trophy"></i> لوحة المتصدرين</h2><p class="hp-sub">النقاط: تعليق = 10 · إعجاب = 3 · مشاهدة فرصة = 1</p>' +
      (rows.length
        ? "<ol>" +
          rows
            .map(function (r, i) {
              var mine = me && String(me.username || "").toLowerCase() === r.u;
              return (
                '<li class="' +
                (mine ? "me" : "") +
                '"><span class="rk">' +
                (i + 1) +
                '</span><span class="av">' +
                esc((r.name || "?").trim().charAt(0)) +
                '</span><span class="nm">' +
                esc(r.name) +
                (mine ? " <small>(أنت)</small>" : "") +
                '</span><span class="pt">' +
                fmt(r.pts) +
                " نقطة</span></li>"
              );
            })
            .join("") +
          "</ol>"
        : '<div class="hp-empty">لسه مفيش متصدرين — كن أول واحد يتفاعل!</div>') +
      "</div>";
    renderAdminProfile(R);
  }
  function adminPanel(R) {
    var opts = Object.keys(R.all)
      .map(function (k) {
        return (
          '<option value="' + esc(k) + '">' + esc(R.all[k].name) + " (@" + esc(k) + ")</option>"
        );
      })
      .join("");
    var pins = [1, 2, 3]
      .map(function (n) {
        return (
          "<label>المركز " +
          n +
          ': <select data-pin="' +
          n +
          '"><option value="">تلقائي</option>' +
          opts +
          "</select></label>"
        );
      })
      .join("");
    var hidden = Object.keys(R.cfg.hidden).filter(function (k) {
      return R.cfg.hidden[k];
    });
    return (
      '<div class="hp-admin"><h3><i class="fas fa-user-shield"></i> تحكم المدير</h3><div class="hp-pins">' +
      pins +
      "</div>" +
      '<div class="hp-hide"><select id="hp-hide-sel"><option value="">اختار عضو تشيله…</option>' +
      opts +
      '</select><button id="hp-hide-btn">شيله من اللوحة</button></div>' +
      (hidden.length
        ? '<div class="hp-hidden">المخفيين: ' +
          hidden
            .map(function (k) {
              return (
                "<span>" +
                esc((R.all[k] || { name: k }).name) +
                ' <button data-unhide="' +
                esc(k) +
                '">رجّعه</button></span>'
              );
            })
            .join("") +
          "</div>"
        : "") +
      "</div>"
    );
  }
  function renderAdminProfile(R) {
    var old = document.getElementById("hp-admin-prof");
    if (old) old.remove();
    var nav = document.getElementById("admin-nav");
    if (nav && isAdmin() && !document.getElementById("hp-lb-btn")) {
      var btn = document.createElement("button");
      btn.id = "hp-lb-btn";
      btn.className = "admin-nav-btn";
      btn.type = "button";
      btn.innerHTML = '<i class="fas fa-trophy"></i> لوحة المتصدرين';
      btn.onclick = openLbModal;
      nav.appendChild(btn);
    }
    var ov = document.getElementById("hp-lb-modal");
    if (ov && !ov.contains(document.activeElement)) fillModal(ov);
  }
  function fillModal(ov) {
    var body = ov.querySelector(".hp-lb-body");
    body.innerHTML = adminPanel(ranked());
    bindAdmin(body);
  }
  function openLbModal() {
    var ov = document.getElementById("hp-lb-modal");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "hp-lb-modal";
      ov.setAttribute("dir", "rtl");
      ov.innerHTML =
        '<div class="hp-lb-card"><button class="hp-lb-x" aria-label="إغلاق">×</button><div class="hp-lb-body"></div></div>';
      ov.onclick = function (e) {
        if (e.target === ov || e.target.classList.contains("hp-lb-x")) ov.remove();
      };
      document.body.appendChild(ov);
    }
    fillModal(ov);
  }
  function bindAdmin(box) {
    var rerender = function () {
      renderBoard();
      var ov = document.getElementById("hp-lb-modal");
      if (ov) fillModal(ov);
    };
    var c = lbCfg();
    box.querySelectorAll("select[data-pin]").forEach(function (sel) {
      sel.value = c.pins[sel.getAttribute("data-pin")] || "";
      sel.onchange = function () {
        var cc = lbCfg();
        cc.pins[sel.getAttribute("data-pin")] = sel.value;
        saveCfg(cc);
        rerender();
      };
    });
    var hb = box.querySelector("#hp-hide-btn");
    if (hb)
      hb.onclick = function () {
        var v = box.querySelector("#hp-hide-sel").value;
        if (!v) return;
        var cc = lbCfg();
        cc.hidden[v] = true;
        saveCfg(cc);
        rerender();
      };
    box.querySelectorAll("[data-unhide]").forEach(function (b) {
      b.onclick = function () {
        var cc = lbCfg();
        cc.hidden[b.getAttribute("data-unhide")] = false;
        saveCfg(cc);
        rerender();
      };
    });
  }

  /* ---------- quick entry ---------- */
  function quickBar() {
    var existing = document.getElementById("hp-quick");
    if (user()) {
      if (existing) existing.remove();
      return;
    }
    if (existing || sessionStorage.getItem("hp_quick_closed")) return;
    var b = document.createElement("div");
    b.id = "hp-quick";
    b.setAttribute("dir", "rtl");
    b.innerHTML =
      '<span><i class="fas fa-bolt"></i> ادخل المنصة في ثواني واحفظ فرصك</span><a href="?view=login" class="go">ادخل الآن</a><button aria-label="إغلاق">×</button>';
    b.querySelector("button").onclick = function () {
      sessionStorage.setItem("hp_quick_closed", "1");
      b.remove();
    };
    document.body.appendChild(b);

    // يختفي تلقائياً بعد 5 ثوانٍ بالضبط
    setTimeout(function () {
      var el = document.getElementById("hp-quick");
      if (el) {
        el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        el.style.opacity = "0";
        el.style.transform = "translateX(-50%) translateY(20px)";
        setTimeout(function () {
          if (el.parentNode) el.remove();
        }, 500);
      }
    }, 5000);
  }

  function css() {
    if (document.getElementById("hp-css")) return;
    var s = document.createElement("style");
    s.id = "hp-css";
    s.textContent =
      ".hero-stats{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px!important;max-width:1000px!important;width:100%}.hero-stats .hero-stat-item{min-width:0!important;padding:14px 8px!important;flex:none!important}.hero-stats .hero-stat-number{font-size:clamp(1.3rem,2.4vw,2rem)}.hero-stats .hero-stat-label{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "@media(max-width:768px){.hero-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-stats .hero-stat-item:last-child{grid-column:1/-1}}" +
      ".hp-board{padding:48px 16px 96px;width:100%;box-sizing:border-box}.hp-board-inner{max-width:640px;box-sizing:border-box;margin:0 auto;background:var(--bg-glass,rgba(255,255,255,.04));border:1px solid var(--border-color,rgba(255,255,255,.1));border-radius:20px;padding:24px;box-shadow:0 8px 30px rgba(0,0,0,.08)}" +
      ".hp-board h2{margin:0 0 4px;font-size:1.4rem;text-align:center}.hp-sub{text-align:center}.hp-board .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:600px){.hp-board-inner{padding:16px}.hp-board li{padding:8px 10px;gap:8px}.hp-board .pt{font-size:.8rem}}" +
      ".hp-board h2 i{color:#fbbf24}.hp-sub{opacity:.6;font-size:.85rem;margin:0 0 16px}" +
      ".hp-board ol{list-style:none;margin:0;padding:0;display:grid;gap:8px}.hp-board li{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:var(--bg-card,rgba(127,127,127,.06));border:1px solid var(--border-color,rgba(127,127,127,.15))}" +
      ".hp-board li.me{outline:2px solid #8b5cf6}.hp-board .rk{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:rgba(127,127,127,.15)}.hp-board li:nth-child(1) .rk{background:#fbbf24;color:#000}.hp-board li:nth-child(2) .rk{background:#cbd5e1;color:#000}.hp-board li:nth-child(3) .rk{background:#d97706;color:#fff}.hp-board .av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;font-weight:700}" +
      ".hp-board .nm{flex:1;font-weight:600}.hp-board .pt{color:#d97706;font-weight:700;font-size:.9rem;white-space:nowrap}.hp-empty{text-align:center;opacity:.7;padding:20px}" +
      "#hp-quick{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9998;display:flex;align-items:center;gap:12px;background:#111827;color:#fff;border:1px solid rgba(139,92,246,.5);padding:10px 14px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.4);font-size:.9rem;max-width:calc(100% - 24px)}" +
      "#hp-quick i{color:#fbbf24}#hp-quick .go{background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;padding:7px 16px;border-radius:999px;font-weight:700;text-decoration:none;white-space:nowrap}#hp-quick button{background:none;border:0;color:#9ca3af;font-size:20px;cursor:pointer}";
    s.textContent +=
      ".hp-admin{margin-top:20px;padding:16px;border-radius:14px;border:1px dashed rgba(139,92,246,.6)}.hp-admin h3{margin:0 0 10px;font-size:1rem}.hp-pins{display:grid;gap:8px;margin-bottom:10px}.hp-admin select{width:100%;padding:6px;border-radius:8px;margin-top:4px}.hp-hide{display:flex;gap:8px}.hp-admin button{background:#8b5cf6;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;white-space:nowrap}.hp-hidden{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;font-size:.85rem}.hp-hidden span{background:rgba(127,127,127,.15);padding:4px 8px;border-radius:8px}.hp-hidden button{padding:2px 8px;margin-inline-start:4px}";
    s.textContent +=
      "#hp-lb-modal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px}.hp-lb-card{position:relative;width:100%;max-width:520px;max-height:90vh;overflow:auto;background:var(--bg-secondary,#111827);color:var(--text-primary,#fff);border:1px solid var(--border-color,rgba(255,255,255,.1));border-radius:20px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.5)}.hp-lb-x{position:absolute;top:12px;left:12px;background:none;border:0;color:inherit;font-size:26px;cursor:pointer;opacity:.7}.hp-lb-card .hp-admin{margin:0;border:0;padding:0}.hp-lb-card .hp-admin h3{font-size:1.25rem;margin-bottom:16px}.hp-lb-card label{display:block;font-weight:600}.hp-lb-card select{padding:10px;border-radius:12px;background:var(--bg-primary,rgba(127,127,127,.1));color:inherit;border:1px solid var(--border-color,rgba(127,127,127,.3));font-family:inherit}.hp-lb-card .hp-hide select{flex:1;margin:0}";
    document.head.appendChild(s);
  }

  function run() {
    css();
    updateStats();
    renderBoard();
    renderAdminProfile();
    quickBar();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(run, 300);
    });
  else setTimeout(run, 300);
  setInterval(function () {
    updateStats();
    renderBoard();
  }, 20000);
  setTimeout(run, 2500);
})();
