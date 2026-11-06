/* Elevate — فلترة الفرص وترتيبها
 *
 * يضيف شريط اختيار فوق قائمة الفرص: النوع، الحالة، والترتيب.
 * يشتغل على الكروت المعروضة فقط (إظهار/إخفاء وإعادة ترتيب في الصفحة)
 * ولا يغيّر أي بيانات ولا يرسل أي شيء للسيرفر.
 * البحث في الصندوق الأصلي بيعدي من هنا عشان كل الفلاتر تتطبّق مع بعض.
 */
(function () {
  "use strict";

  var STORE_KEY = "ns_opp_filters";
  var DAY = 86400000;

  var TYPE_LABELS = {
    competitions: "مسابقات",
    scholarships: "منح",
    volunteering: "تطوع",
    jobs: "وظائف",
    events: "فعاليات",
    courses: "كورسات",
    workshops: "ورش",
    travel: "سفر",
    admission: "قبول جامعي",
    live: "بث مباشر",
    videos: "فيديوهات",
  };

  var STATUS_OPTIONS = [
    { key: "all", label: "كل الفرص" },
    { key: "open", label: "مفتوحة الآن" },
    { key: "soon", label: "قريبًا" },
    { key: "week", label: "تنتهي خلال أسبوع" },
    { key: "days3", label: "تنتهي خلال ٣ أيام" },
    { key: "expired", label: "منتهية" },
  ];

  var SORT_OPTIONS = [
    { key: "newest", label: "الأحدث أولًا" },
    { key: "deadline", label: "الأقرب انتهاءً" },
    { key: "views", label: "الأكثر مشاهدة" },
    { key: "title", label: "أبجديًا" },
  ];

  var state = { type: "all", status: "all", sort: "newest" };
  var built = false;

  /* ------------------------------ helpers ------------------------------ */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved && typeof saved === "object") {
        if (typeof saved.type === "string") state.type = saved.type;
        if (typeof saved.status === "string") state.status = saved.status;
        if (typeof saved.sort === "string") state.sort = saved.sort;
      }
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function searchValue() {
    var box = document.getElementById("fast-search");
    return box && typeof box.value === "string" ? box.value.trim().toLowerCase() : "";
  }

  function deadlineTime(value) {
    if (!value || typeof value !== "string") return 0;
    var parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (parts) return new Date(+parts[1], +parts[2] - 1, +parts[3], 23, 59, 59).getTime();
    var parsed = Date.parse(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  function viewCounts() {
    try {
      var views = JSON.parse(localStorage.getItem("luxen_views") || "{}");
      var out = {};
      if (views && typeof views === "object") {
        Object.keys(views).forEach(function (id) {
          out[id] = Array.isArray(views[id]) ? views[id].length : 0;
        });
      }
      return out;
    } catch (e) {
      return {};
    }
  }

  /* ------------------------------ reading ------------------------------ */

  function readCards(container) {
    var views = viewCounts();
    var now = Date.now();
    return Array.prototype.map.call(
      container.querySelectorAll(".opp-card"),
      function (card, index) {
        var id = card.getAttribute("data-id") || "";
        var deadline = deadlineTime(card.getAttribute("data-date"));
        return {
          card: card,
          index: index,
          id: id,
          numId: /^\d+$/.test(id) ? Number(id) : 0,
          type: card.getAttribute("data-category") || "",
          typeName: (card.getAttribute("data-type") || "").toLowerCase(),
          expired: card.getAttribute("data-expired") === "1",
          soon: !!card.querySelector(".soon-overlay"),
          title: (card.getAttribute("data-title") || "").toLowerCase(),
          company: (card.getAttribute("data-company") || "").toLowerCase(),
          tags: (card.getAttribute("data-tags") || "").toLowerCase(),
          deadline: deadline,
          daysLeft: deadline ? Math.ceil((deadline - now) / DAY) : 0,
          views: views[id] || 0,
        };
      },
    );
  }

  function matches(row, query) {
    if (state.type !== "all" && row.type !== state.type) return false;
    if (state.status === "open" && (row.expired || row.soon)) return false;
    if (state.status === "soon" && !row.soon) return false;
    if (state.status === "week" && (row.expired || !row.deadline || row.daysLeft > 7)) return false;
    if (state.status === "days3" && (row.expired || !row.deadline || row.daysLeft > 3))
      return false;
    if (state.status === "expired" && !row.expired) return false;
    if (query) {
      var q = query.trim().toLowerCase();
      var hit =
        row.title.indexOf(q) > -1 ||
        row.company.indexOf(q) > -1 ||
        row.tags.indexOf(q) > -1 ||
        (row.typeName && row.typeName.indexOf(q) > -1) ||
        (row.type && row.type.indexOf(q) > -1) ||
        (q.indexOf("تطوع") > -1 && (row.type === "volunteering" || (row.typeName && row.typeName.indexOf("تطوع") > -1))) ||
        ((q.indexOf("ايفينت") > -1 || q.indexOf("ايفنت") > -1 || q.indexOf("فعال") > -1) && (row.type === "events" || (row.typeName && row.typeName.indexOf("فعال") > -1))) ||
        (q.indexOf("مسابق") > -1 && (row.type === "competitions" || (row.typeName && row.typeName.indexOf("مسابق") > -1))) ||
        (q.indexOf("منح") > -1 && (row.type === "scholarships" || (row.typeName && row.typeName.indexOf("منح") > -1))) ||
        (q.indexOf("وظي") > -1 && (row.type === "jobs" || (row.typeName && row.typeName.indexOf("وظي") > -1))) ||
        (q.indexOf("كورس") > -1 && (row.type === "courses" || (row.typeName && row.typeName.indexOf("كورس") > -1)));
      if (!hit) return false;
    }
    return true;
  }

  function sortRows(rows) {
    if (state.sort === "deadline") {
      rows.sort(function (a, b) {
        if (a.deadline && b.deadline) return a.deadline - b.deadline;
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return a.index - b.index;
      });
    } else if (state.sort === "views") {
      rows.sort(function (a, b) {
        return b.views - a.views || a.index - b.index;
      });
    } else if (state.sort === "title") {
      rows.sort(function (a, b) {
        return a.title.localeCompare(b.title, "ar");
      });
    } else {
      rows.sort(function (a, b) {
        return b.numId - a.numId || a.index - b.index;
      });
    }
  }

  /* ------------------------------ applying ------------------------------ */

  function apply() {
    var container = document.getElementById("opp-cards-container");
    if (!container) return;
    var rows = readCards(container);
    if (!rows.length) return;

    var query = searchValue();
    rows.forEach(function (row) {
      row.ok = matches(row, query);
    });
    sortRows(rows);

    var shown = rows.filter(function (r) {
      return r.ok;
    });
    var hidden = rows.filter(function (r) {
      return !r.ok;
    });

    var frag = document.createDocumentFragment();
    shown.concat(hidden).forEach(function (row) {
      row.card.style.display = row.ok ? "" : "none";
      frag.appendChild(row.card);
    });
    container.appendChild(frag);

    var num = document.querySelector(".opp-header-stats .num");
    if (num) num.textContent = shown.length;

    var msg = document.getElementById("no-opps-msg");
    if (msg) msg.style.display = shown.length ? "none" : "";

    renderChips(rows);
    syncControls();
  }

  /* ------------------------------ interface ------------------------------ */

  function chipHtml(key, label, count) {
    var active = state.type === key ? " on" : "";
    return (
      '<button type="button" class="of-chip' +
      active +
      '" data-type="' +
      esc(key) +
      '">' +
      "<span>" +
      esc(label) +
      "</span><b>" +
      count +
      "</b></button>"
    );
  }

  function renderChips(rows) {
    var wrap = document.getElementById("of-types");
    if (!wrap) return;
    var counts = {};
    rows.forEach(function (row) {
      if (!row.type) return;
      counts[row.type] = (counts[row.type] || 0) + 1;
    });
    var keys = Object.keys(counts).sort(function (a, b) {
      return (TYPE_LABELS[a] || a).localeCompare(TYPE_LABELS[b] || b, "ar");
    });
    var html = chipHtml("all", "كل الأنواع", rows.length);
    keys.forEach(function (key) {
      html += chipHtml(key, TYPE_LABELS[key] || key, counts[key]);
    });
    wrap.innerHTML = html;
  }

  function optionsHtml(list, current) {
    return list
      .map(function (item) {
        var selected = item.key === current ? " selected" : "";
        return (
          '<option value="' + esc(item.key) + '"' + selected + ">" + esc(item.label) + "</option>"
        );
      })
      .join("");
  }

  function syncControls() {
    var status = document.getElementById("of-status");
    if (status) status.value = state.status;
    var sort = document.getElementById("of-sort");
    if (sort) sort.value = state.sort;
  }

  function wire(bar) {
    var types = bar.querySelector("#of-types");
    if (types) {
      types.addEventListener("click", function (event) {
        var chip =
          event.target && event.target.closest ? event.target.closest("[data-type]") : null;
        if (!chip) return;
        state.type = chip.getAttribute("data-type") || "all";
        saveState();
        apply();
      });
    }

    var status = bar.querySelector("#of-status");
    if (status) {
      status.addEventListener("change", function () {
        state.status = status.value;
        saveState();
        apply();
      });
    }

    var sort = bar.querySelector("#of-sort");
    if (sort) {
      sort.addEventListener("change", function () {
        state.sort = sort.value;
        saveState();
        apply();
      });
    }

    var reset = bar.querySelector("#of-reset");
    if (reset) {
      reset.addEventListener("click", function () {
        state = { type: "all", status: "all", sort: "newest" };
        saveState();
        var box = document.getElementById("fast-search");
        if (box) box.value = "";
        syncControls();
        apply();
      });
    }

    var search = document.getElementById("fast-search");
    if (search)
      search.addEventListener("input", function () {
        apply();
      });
  }

  function build() {
    if (built) return;
    var view = document.getElementById("opportunities-view");
    if (!view) return;
    var anchor = view.querySelector(".opp-filter-bar") || view.querySelector(".opp-header-stats");
    if (!anchor || !anchor.parentNode) return;

    var bar = document.createElement("div");
    bar.className = "of-bar";
    bar.id = "of-bar";
    bar.innerHTML =
      '<div class="of-row"><span class="of-label">النوع</span><div class="of-chips" id="of-types"></div></div>' +
      '<div class="of-row of-row-2">' +
      '<label class="of-field"><span>الحالة</span><select id="of-status" class="of-select">' +
      optionsHtml(STATUS_OPTIONS, state.status) +
      "</select></label>" +
      '<label class="of-field"><span>الترتيب</span><select id="of-sort" class="of-select">' +
      optionsHtml(SORT_OPTIONS, state.sort) +
      "</select></label>" +
      '<button type="button" class="of-reset" id="of-reset"><i class="fas fa-rotate-left"></i> إلغاء الفلاتر</button>' +
      "</div>";

    anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    wire(bar);
    built = true;
  }

  /* ------------------------------ boot ------------------------------ */

  function hookRender() {
    if (typeof App === "undefined" || !App.renderOpportunities || App.__ofHooked) return;
    App.__ofHooked = true;
    var original = App.renderOpportunities;
    App.renderOpportunities = function () {
      var result = original.apply(this, arguments);
      try {
        apply();
      } catch (e) {}
      return result;
    };
  }

  function start() {
    loadState();
    build();
    hookRender();
    apply();
  }

  window.ElevateFilters = { apply: apply, refresh: apply };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
