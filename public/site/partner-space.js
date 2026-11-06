/* Elevate — مساحة الشريك:
   - فرص الشريك تظهر في صفحته فقط (مش في الموقع العام)
   - عداد بعدد فرص كل شريك على كارت الشريك وفي صفحته
   - الشريك يقدر يضيف حسابات السوشيال ميديا من ملفه الشخصي
   لا يتم حذف أي بيانات موجودة. */
(function () {
  function read(key, def) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? def : v;
    } catch (e) {
      return def;
    }
  }
  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icon(platform) {
    if (window.App && typeof App.socialIcon === "function") return App.socialIcon(platform);
    return "fas fa-link";
  }
  var LABELS = {
    facebook: "فيسبوك",
    instagram: "إنستجرام",
    x: "إكس",
    twitter: "إكس",
    linkedin: "لينكد إن",
    youtube: "يوتيوب",
    tiktok: "تيك توك",
    telegram: "تيليجرام",
    whatsapp: "واتساب",
    snapchat: "سناب شات",
    discord: "ديسكورد",
    website: "موقع إلكتروني",
    email: "بريد إلكتروني",
    phone: "رقم هاتف",
  };
  function label(p) {
    return LABELS[String(p || "").toLowerCase()] || p || "رابط";
  }

  function normalize(platform, value) {
    var v = String(value || "").trim();
    if (!v) return "";
    var p = String(platform || "").toLowerCase();
    if (p === "email") return v.indexOf("mailto:") === 0 ? v : "mailto:" + v;
    if (p === "phone") return v.indexOf("tel:") === 0 ? v : "tel:" + v;
    if (p === "whatsapp" && /^[+0-9\s-]+$/.test(v))
      return "https://wa.me/" + v.replace(/[^0-9]/g, "");
    if (!/^https?:\/\//i.test(v)) return "https://" + v;
    return v;
  }

  function partners() {
    var p = read("luxen_partners", []);
    return Array.isArray(p) ? p : [];
  }
  function cards() {
    var c = read("luxen_general_cards", []);
    return Array.isArray(c) ? c : [];
  }
  function partnerById(id) {
    return (
      partners().filter(function (p) {
        return String(p.id) === String(id);
      })[0] || null
    );
  }
  function partnerCards(id, includeHidden) {
    return cards().filter(function (c) {
      if (!c || !c.partnerId || String(c.partnerId) !== String(id)) return false;
      if (!includeHidden && c.status === "hidden") return false;
      return true;
    });
  }

  /* ---------- حسابات التواصل في لوحة الشريك ---------- */
  function socialsOf(id) {
    var p = partnerById(id);
    return p && Array.isArray(p.socials) ? p.socials : [];
  }
  function saveSocials(id, list) {
    var all = partners();
    var i = all.findIndex(function (p) {
      return String(p.id) === String(id);
    });
    if (i < 0) return false;
    all[i] = Object.assign({}, all[i], { socials: list });
    write("luxen_partners", all);
    return true;
  }

  function renderSocialsEditor() {
    var box = document.getElementById("partner-socials-list");
    if (!box || !window.Partner || !Partner.partnerId) return;
    var list = socialsOf(Partner.partnerId);
    if (!list.length) {
      box.innerHTML =
        '<div style="text-align:center; padding:20px; color:var(--text-muted); border:1px dashed var(--border-color); border-radius:12px;">لا توجد حسابات مضافة حتى الآن.</div>';
      return;
    }
    box.innerHTML = list
      .map(function (s, i) {
        return (
          '<div class="admin-manage-item" style="justify-content:space-between; align-items:center;">' +
          '<div style="display:flex; align-items:center; gap:10px; min-width:0;">' +
          '<i class="' +
          icon(s.platform) +
          '" style="color:#8b5cf6; font-size:1.1rem;"></i>' +
          '<div style="min-width:0;"><h4 style="margin:0;">' +
          esc(label(s.platform)) +
          "</h4>" +
          '<div style="color:var(--text-muted); font-size:.8rem; word-break:break-all;">' +
          esc(s.url) +
          "</div></div></div>" +
          '<button class="admin-m-btn delete" onclick="Partner.removeSocial(' +
          i +
          ')"><i class="fas fa-trash"></i></button>' +
          "</div>"
        );
      })
      .join("");
  }

  function installPartnerExtensions() {
    if (!window.Partner || Partner.__spaceReady) return;
    Partner.__spaceReady = true;

    Partner.addSocial = function () {
      if (!this.partnerId) return;
      var sel = document.getElementById("partner-social-platform");
      var inp = document.getElementById("partner-social-url");
      var platform = sel ? sel.value : "website";
      var url = normalize(platform, inp ? inp.value : "");
      if (!url) {
        alert("من فضلك اكتب الرابط أو البيانات أولاً.");
        return;
      }
      var list = socialsOf(this.partnerId).slice();
      list.push({ platform: platform, url: url });
      if (!saveSocials(this.partnerId, list)) {
        alert("تعذر الحفظ.");
        return;
      }
      if (inp) inp.value = "";
      renderSocialsEditor();
      if (window.App && typeof App.renderPartners === "function") App.renderPartners();
    };

    Partner.removeSocial = function (index) {
      if (!this.partnerId) return;
      if (!confirm("حذف هذا الحساب؟")) return;
      var list = socialsOf(this.partnerId).slice();
      list.splice(index, 1);
      saveSocials(this.partnerId, list);
      renderSocialsEditor();
      if (window.App && typeof App.renderPartners === "function") App.renderPartners();
    };

    var baseRender = Partner.render.bind(Partner);
    Partner.render = function () {
      baseRender();
      renderSocialsEditor();
    };
  }

  /* ---------- صفحة الشريك العامة ---------- */
  function oppCard(c) {
    var expired =
      window.App && typeof App.isCardExpired === "function" ? App.isCardExpired(c) : false;
    var img = c.imgOuter
      ? '<img src="' +
        esc(c.imgOuter) +
        '" style="width:100%; height:100%; object-fit:cover;" alt="">'
      : '<i class="fa-solid fa-trophy main-icon"></i>';
    return (
      '<div class="opp-card" data-id="' +
      esc(c.id) +
      '">' +
      (expired
        ? '<div class="expired-ribbon"><i class="fa-regular fa-calendar-times"></i> هذه الفرصة منتهية</div>'
        : "") +
      '<div class="opp-card-header-img"><div class="opp-badges">' +
      (c.isFeatured
        ? '<span class="opp-badge featured"><i class="fa-solid fa-star"></i> مميز</span>'
        : "") +
      (expired
        ? '<span class="opp-badge expired-badge"><i class="fa-regular fa-calendar-times"></i> منتهية</span>'
        : "") +
      "</div>" +
      img +
      "</div>" +
      '<div class="opp-card-body"><h3 class="opp-card-title">' +
      esc(c.name) +
      "</h3>" +
      '<div class="opp-card-subtitle">' +
      esc(c.category || "عام") +
      ' <i class="fa-solid fa-building"></i></div>' +
      '<div class="opp-card-footer"><div class="opp-date-info"><span>' +
      esc(c.deadline || "غير محدد") +
      '</span> <i class="fa-regular fa-calendar"></i></div>' +
      '<div class="opp-actions"><button class="opp-view-btn" onclick="window.location.href=\'?id=' +
      esc(c.id) +
      '\'"><i class="fa-solid fa-arrow-left"></i> <span>عرض التفاصيل</span></button></div>' +
      "</div></div></div>"
    );
  }

  function renderPartnerPage() {
    var view = document.getElementById("partner-view");
    if (!view || view.style.display === "none") return;
    var pid = new URLSearchParams(window.location.search).get("pid");
    if (!pid) return;

    var list = partnerCards(pid, false).filter(function (c) {
      return c.status !== "soon";
    });
    var statsEl = document.getElementById("partner-view-stats");
    if (statsEl) {
      var active = list.filter(function (c) {
        return !(window.App && typeof App.isCardExpired === "function" && App.isCardExpired(c));
      }).length;
      statsEl.innerHTML =
        '<div class="partner-stat"><span class="partner-stat-icon"><i class="fas fa-layer-group"></i></span><span><b>' +
        list.length +
        "</b><small>إجمالي الفرص</small></span></div>" +
        '<div class="partner-stat"><span class="partner-stat-icon active"><i class="fas fa-bolt"></i></span><span><b>' +
        active +
        "</b><small>فرص سارية</small></span></div>";
    }

    var socialsEl = document.getElementById("partner-view-socials");
    if (socialsEl) {
      var socials = socialsOf(pid);
      socialsEl.innerHTML = socials
        .map(function (s) {
          return (
            '<a href="' +
            esc(s.url) +
            '" target="_blank" rel="noopener noreferrer" title="' +
            esc(label(s.platform)) +
            '"><i class="' +
            icon(s.platform) +
            '"></i></a>'
          );
        })
        .join("");
    }

    var oppsEl = document.getElementById("partner-view-opps");
    if (oppsEl) {
      oppsEl.innerHTML = list.length
        ? list.map(oppCard).join("")
        : '<div class="partner-empty-state"><span><i class="fas fa-folder-open"></i></span><h3>لا توجد فرص منشورة حالياً</h3><p>ستظهر فرص هذا الشريك هنا فور نشرها.</p></div>';
    }
  }

  function install() {
    installPartnerExtensions();
    if (window.App && typeof App.renderPartners === "function" && !App.__partnerSpaceWrapped) {
      App.__partnerSpaceWrapped = true;
      var base = App.renderPartners.bind(App);
      App.renderPartners = function () {
        base();
        renderPartnerPage();
      };
    }
    renderPartnerPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(install, 0);
    });
  } else {
    setTimeout(install, 0);
  }
  setTimeout(install, 800);
  setTimeout(install, 2000);
  window.ElevatePartnerSpace = { refresh: renderPartnerPage };
})();
