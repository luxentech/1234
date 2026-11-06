/* Elevate extras:
   1) أي شخص يقدر يرسل فرصة -> تظهر للمدير في ملفه الشخصي
   2) تصويت المستخدمين على الفرص -> نتائجه تظهر للمدير
   3) المدير يقدر يعدّل رقم عدد المستخدمين الظاهر في الموقع
   كل البيانات بتتخزن في نفس قاعدة البيانات عبر db-sync (site_store). */
(function () {
  var K_SUB = "luxen_submissions";
  var K_VOTES = "luxen_votes";
  var K_SET = "luxen_settings";

  function read(key, def) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v === null || v === undefined ? def : v;
    } catch (e) {
      return def;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
  function esc(v) {
    return String(v === undefined || v === null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function user() {
    try {
      return window.App ? App.getUser() : null;
    } catch (e) {
      return null;
    }
  }
  function isAdmin() {
    var u = user();
    return !!(u && u.isAdmin === true);
  }
  function voterId() {
    var u = user();
    if (u && (u.username || u.email)) return u.username || u.email;
    var id = localStorage.getItem("elevate_voter_id");
    if (!id) {
      id = "guest_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("elevate_voter_id", id);
    }
    return id;
  }
  function voterName() {
    var u = user();
    return (u && (u.fullName || u.username)) || "زائر";
  }
  function today() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  /* ============ 1) إرسال فرصة من أي شخص ============ */
  var CATS = [
    ["competitions", "مسابقات"],
    ["scholarships", "منح دراسية"],
    ["volunteering", "تطوع"],
    ["jobs", "وظائف"],
    ["events", "فعاليات"],
    ["courses", "كورسات مجانية"],
    ["workshops", "ورش عمل"],
    ["travel", "فرص سفر ممولة"],
    ["admission", "قبول جامعي"],
    ["live", "ورش عمل مباشر"],
    ["videos", "فيديوهات"],
  ];

  function ensureSubmitUI() {
    if (document.getElementById("elv-submit-fab")) return;
    var fab = document.createElement("button");
    fab.id = "elv-submit-fab";
    fab.type = "button";
    fab.innerHTML = '<i class="fas fa-paper-plane"></i> أرسل فرصة';
    fab.onclick = openSubmitModal;
    document.body.appendChild(fab);

    var wrap = document.createElement("div");
    wrap.id = "elv-submit-modal";
    wrap.className = "elv-modal";
    wrap.innerHTML =
      '<div class="elv-modal-box" dir="rtl">' +
      '<div class="elv-modal-head"><h3><i class="fas fa-paper-plane"></i> إرسال فرصة للإدارة</h3>' +
      '<button type="button" class="elv-x" onclick="ElevateExtras.closeSubmit()">&times;</button></div>' +
      '<p class="elv-hint">املأ البيانات وسيتم مراجعة الفرصة من فريق الإدارة قبل نشرها.</p>' +
      '<form id="elv-submit-form">' +
      '<label>عنوان الفرصة *</label><input required name="name" type="text" placeholder="مثال: منحة تدريب صيفي">' +
      '<label>القسم *</label><select name="type">' +
      CATS.map(function (c) {
        return '<option value="' + c[0] + '">' + c[1] + "</option>";
      }).join("") +
      "</select>" +
      '<label>الجهة المنظمة</label><input name="category" type="text" placeholder="اسم الجهة">' +
      '<label>رابط التقديم</label><input name="link" type="url" dir="ltr" placeholder="https://...">' +
      '<label>آخر موعد للتقديم</label><input name="deadline" type="date">' +
      '<label>تفاصيل الفرصة *</label><textarea required name="description" rows="4" placeholder="اكتب تفاصيل الفرصة..."></textarea>' +
      '<label>اسمك</label><input name="senderName" type="text" placeholder="اختياري">' +
      '<label>وسيلة تواصل (بريد / هاتف)</label><input name="senderContact" type="text" dir="ltr" placeholder="اختياري">' +
      '<button class="elv-btn" type="submit"><i class="fas fa-paper-plane"></i> إرسال للإدارة</button>' +
      "</form></div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) closeSubmit();
    });
    document.getElementById("elv-submit-form").addEventListener("submit", submitOpportunity);
  }

  /* ============ بطاقة الترحيب عند فتح الموقع ============ */
  var WHATSAPP_URL = "https://whatsapp.com/channel/0029VbCaSol8fews70Y9FQ2l";

  var welcomeTimer = null;
  function ensureWelcomeCard() {
    if (document.getElementById("elv-welcome")) return;
    var loggedIn = false;
    try {
      loggedIn = !!(window.App && App.isLoggedIn());
    } catch (e) {}
    var wrap = document.createElement("div");
    wrap.id = "elv-welcome";
    wrap.className = "elv-modal open";
    wrap.innerHTML =
      '<div class="elv-modal-box elv-welcome-box elv-wa-card" dir="rtl">' +
      '<span class="elv-wa-topbar"></span>' +
      '<button type="button" class="elv-x" onclick="ElevateExtras.closeWelcome()">&times;</button>' +
      '<div class="elv-wa-icon"><i class="fab fa-whatsapp"></i></div>' +
      '<div class="elv-wa-pill"><span class="elv-wa-dot"></span> خطوة مهمة (تختفي خلال 5 ثوانٍ)</div>' +
      '<h3>الفرص على واتساب <span class="elv-wa-hl">أول بأول</span></h3>' +
      '<p class="elv-wa-sub">عشان توصلك الفرص فور نزولها! تابع قناتنا على واتساب.</p>' +
      '<div class="elv-wa-chips">' +
      '<span class="elv-wa-chip"><i class="fas fa-bolt"></i> فرص فورية</span>' +
      '<span class="elv-wa-chip"><i class="fas fa-bell"></i> إشعارات لحظية</span>' +
      '<span class="elv-wa-chip"><i class="fas fa-check"></i> مجاني</span>' +
      "</div>" +
      '<a class="elv-wa-follow" href="' +
      WHATSAPP_URL +
      '" target="_blank" rel="noopener" onclick="ElevateExtras.followedWa()">تابعنا دلوقتي <i class="fas fa-arrow-left"></i></a>' +
      '<div class="elv-wa-lock"><i class="fas fa-lock"></i> مطلوب للمتابعة</div>' +
      '<div class="elv-wa-links">' +
      (loggedIn
        ? ""
        : '<button type="button" onclick="ElevateExtras.goLogin()">تسجيل الدخول</button><span>·</span>') +
      '<button type="button" onclick="ElevateExtras.closeWelcome()">تصفح الموقع</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) closeWelcome();
    });

    // تختفي بعد 5 ثواني بالضبط
    if (welcomeTimer) clearTimeout(welcomeTimer);
    welcomeTimer = setTimeout(function () {
      closeWelcome();
    }, 5000);
  }
  function closeWelcome() {
    if (welcomeTimer) {
      clearTimeout(welcomeTimer);
      welcomeTimer = null;
    }
    var w = document.getElementById("elv-welcome");
    if (w) {
      w.style.transition = "opacity 0.4s ease";
      w.style.opacity = "0";
      setTimeout(function () {
        if (w.parentNode) w.remove();
      }, 400);
    }
    try {
      sessionStorage.setItem("elv_welcomed", "1");
    } catch (e) {}
  }
  function followedWa() {
    try {
      sessionStorage.setItem("elv_welcomed", "1");
    } catch (e) {}
    setTimeout(function () {
      var w = document.getElementById("elv-welcome");
      if (w) w.remove();
    }, 400);
  }
  function goLogin() {
    closeWelcome();
    window.location.href = "?view=login";
  }

  function openSubmitModal() {
    ensureSubmitUI();
    document.getElementById("elv-submit-modal").classList.add("open");
  }
  function closeSubmit() {
    var m = document.getElementById("elv-submit-modal");
    if (m) m.classList.remove("open");
  }

  function submitOpportunity(e) {
    e.preventDefault();
    var f = e.target;
    var u = user();
    var item = {
      id: "sub_" + Date.now(),
      name: f.name.value.trim(),
      type: f.type.value,
      category: f.category.value.trim(),
      link: f.link.value.trim(),
      deadline: f.deadline.value,
      description: f.description.value.trim(),
      senderName: f.senderName.value.trim() || (u && (u.fullName || u.username)) || "زائر",
      senderContact: f.senderContact.value.trim() || (u && (u.username || u.email)) || "",
      date: today(),
      status: "pending",
    };
    if (!item.name || !item.description) return;
    var list = read(K_SUB, []);
    if (!Array.isArray(list)) list = [];
    list.push(item);
    write(K_SUB, list);
    f.reset();
    closeSubmit();
    alert("تم إرسال الفرصة للإدارة، شكرًا لك! سيتم مراجعتها قريبًا.");
    renderAdminExtras();
  }

  /* ============ 2) التصويت ============ */
  function votesData() {
    var v = read(K_VOTES, {});
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  }
  function voteCount(id) {
    return (votesData()[id] || []).length;
  }
  function hasVoted(id) {
    var me = voterId();
    return (votesData()[id] || []).some(function (x) {
      return (x && x.u) === me;
    });
  }
  function toggleVote(id) {
    var v = votesData();
    var me = voterId();
    if (!Array.isArray(v[id])) v[id] = [];
    var i = v[id].findIndex(function (x) {
      return (x && x.u) === me;
    });
    if (i > -1) v[id].splice(i, 1);
    else v[id].push({ u: me, n: voterName(), d: today() });
    write(K_VOTES, v);
    decorateCards();
    decorateDetail();
    renderAdminExtras();
  }

  function voteButtonHTML(id) {
    var voted = hasVoted(id);
    return (
      '<button type="button" class="elv-vote' +
      (voted ? " voted" : "") +
      '" ' +
      "onclick=\"event.stopPropagation(); ElevateExtras.vote('" +
      esc(id) +
      "')\">" +
      '<i class="fas fa-arrow-up"></i> ' +
      (voted ? "صوتك مُسجل" : "صوّت لهذه الفرصة") +
      ' <span class="elv-vote-count">' +
      voteCount(id) +
      "</span></button>"
    );
  }

  function decorateCards() {
    var cards = document.querySelectorAll("#opp-cards-container .opp-card");
    cards.forEach(function (card) {
      var id = card.getAttribute("data-id");
      if (!id) return;
      var old = card.querySelector(".elv-vote-bar");
      if (old) old.remove();
      var bar = document.createElement("div");
      bar.className = "elv-vote-bar";
      bar.innerHTML = voteButtonHTML(id);
      (card.querySelector(".opp-card-body") || card).appendChild(bar);
    });
  }

  function decorateDetail() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");
    if (!id) return;
    var likeBtn = document.getElementById("like-btn");
    if (!likeBtn) return;
    var old = document.getElementById("elv-detail-vote");
    if (old) old.remove();
    var holder = document.createElement("span");
    holder.id = "elv-detail-vote";
    holder.innerHTML = voteButtonHTML(id);
    likeBtn.parentNode.insertBefore(holder, likeBtn.nextSibling);
  }

  /* ============ 3) إعدادات المدير (عدد المستخدمين) ============ */
  function settings() {
    var s = read(K_SET, {});
    return s && typeof s === "object" && !Array.isArray(s) ? s : {};
  }
  function realUsersCount() {
    var users = read("luxen_all_users", []);
    return Array.isArray(users)
      ? users.filter(function (u) {
          return !u.isAdmin;
        }).length
      : 0;
  }
  function shownUsersCount() {
    var s = settings();
    var n = Number(s.usersCount);
    return s.usersCount === undefined || s.usersCount === null || s.usersCount === "" || isNaN(n)
      ? realUsersCount()
      : n;
  }
  function applyUsersCount() {
    var n = shownUsersCount();
    var a = document.getElementById("stat-users");
    if (a) a.textContent = n;
    var b = document.getElementById("admin-users-count");
    if (b) b.textContent = n;
  }
  function setUsersCount(val) {
    var s = settings();
    if (val === null) delete s.usersCount;
    else s.usersCount = val;
    write(K_SET, s);
    applyUsersCount();
    renderAdminExtras();
  }
  function saveUsersCount() {
    var el = document.getElementById("elv-users-count-input");
    if (!el) return;
    var n = Math.max(0, Math.round(Number(el.value) || 0));
    setUsersCount(n);
    alert("تم تحديث عدد المستخدمين الظاهر في الموقع إلى " + n);
  }
  function bumpUsersCount(delta) {
    setUsersCount(Math.max(0, shownUsersCount() + delta));
  }
  function resetUsersCount() {
    setUsersCount(null);
  }

  /* ============ لوحة المدير: القسم الجديد ============ */
  function ensureAdminSection() {
    var nav = document.getElementById("admin-nav");
    if (!nav || document.getElementById("elv-adm-btn")) return !!nav;
    var btn = document.createElement("button");
    btn.id = "elv-adm-btn";
    btn.className = "admin-nav-btn";
    btn.setAttribute("data-sec", "adm-sec-inbox");
    btn.innerHTML = '<i class="fas fa-inbox"></i> الفرص المرسلة والتصويت';
    btn.onclick = function () {
      Admin.switchSection("adm-sec-inbox");
    };
    nav.appendChild(btn);

    var sec = document.createElement("section");
    sec.className = "admin-section";
    sec.id = "adm-sec-inbox";
    sec.innerHTML =
      '<div class="prof-card" style="margin-bottom:20px;">' +
      '<div class="prof-card-header"><span>عدد المستخدمين الظاهر في الموقع</span><i class="fas fa-users-cog"></i></div>' +
      '<div id="elv-users-box"></div></div>' +
      '<div class="prof-card" style="margin-bottom:20px;">' +
      '<div class="prof-card-header"><span>فرص مرسلة من المستخدمين</span><i class="fas fa-inbox"></i></div>' +
      '<div id="elv-subs-box" class="admin-manage-list custom-scrollbar"></div></div>' +
      '<div class="prof-card">' +
      '<div class="prof-card-header"><span>نتائج تصويت المستخدمين</span><i class="fas fa-poll"></i></div>' +
      '<div id="elv-votes-box" class="admin-manage-list custom-scrollbar"></div></div>';
    var last = document.getElementById("adm-sec-team");
    if (last && last.parentNode) last.parentNode.insertBefore(sec, last.nextSibling);
    else nav.parentNode.appendChild(sec);
    // إعادة تطبيق الصلاحيات بعد إضافة القسم الجديد
    try {
      if (window.Admin && typeof Admin.applyPermissions === "function") Admin.applyPermissions();
    } catch (e) {}
    return true;
  }

  function renderAdminExtras() {
    if (!document.getElementById("admin-nav")) return;
    if (!ensureAdminSection()) return;

    var uBox = document.getElementById("elv-users-box");
    if (uBox && document.activeElement !== document.getElementById("elv-users-count-input")) {
      var s = settings();
      var manual = s.usersCount !== undefined && s.usersCount !== null && s.usersCount !== "";
      uBox.innerHTML =
        '<p style="color:var(--text-muted); font-size:.85rem; margin-bottom:12px;">العدد الحقيقي للمسجلين: <b>' +
        realUsersCount() +
        "</b>" +
        (manual ? " — الرقم الظاهر حاليًا مضبوط يدويًا." : " — الرقم الظاهر تلقائي.") +
        "</p>" +
        '<div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">' +
        '<button class="admin-m-btn" onclick="ElevateExtras.bumpUsers(-1)"><i class="fas fa-minus"></i></button>' +
        '<input id="elv-users-count-input" type="number" min="0" value="' +
        shownUsersCount() +
        '" ' +
        'style="width:120px; padding:10px; border-radius:10px; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-primary); text-align:center;">' +
        '<button class="admin-m-btn" onclick="ElevateExtras.bumpUsers(1)"><i class="fas fa-plus"></i></button>' +
        '<button class="admin-cat-btn" onclick="ElevateExtras.saveUsers()"><i class="fas fa-save"></i> حفظ</button>' +
        '<button class="admin-m-btn delete" onclick="ElevateExtras.resetUsers()">إرجاع للتلقائي</button>' +
        "</div>";
    }

    var sBox = document.getElementById("elv-subs-box");
    if (sBox) {
      var list = read(K_SUB, []);
      if (!Array.isArray(list)) list = [];
      var pending = list.slice().reverse();
      sBox.innerHTML = pending.length
        ? pending
            .map(function (it) {
              var label = (CATS.find(function (c) {
                return c[0] === it.type;
              }) || [null, it.type])[1];
              var done = it.status === "approved";
              return (
                '<div class="admin-manage-item" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:12px;">' +
                '<div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">' +
                '<h4 style="margin:0;">' +
                esc(it.name) +
                "</h4>" +
                '<span style="padding:5px 10px;border-radius:8px;font-size:.8rem;background:' +
                (done
                  ? "rgba(16,185,129,.15);color:#10b981"
                  : "rgba(245,158,11,.15);color:#f59e0b") +
                ';">' +
                (done ? "تمت الإضافة" : "بانتظار المراجعة") +
                "</span></div>" +
                '<div style="font-size:.85rem;color:var(--text-muted); display:flex; gap:12px; flex-wrap:wrap;">' +
                '<span><i class="fas fa-layer-group"></i> ' +
                esc(label) +
                "</span>" +
                '<span><i class="fas fa-building"></i> ' +
                esc(it.category || "—") +
                "</span>" +
                '<span><i class="fas fa-calendar"></i> ' +
                esc(it.deadline || "بدون موعد") +
                "</span>" +
                '<span><i class="fas fa-user"></i> ' +
                esc(it.senderName) +
                "</span>" +
                (it.senderContact
                  ? '<span dir="ltr"><i class="fas fa-envelope"></i> ' +
                    esc(it.senderContact) +
                    "</span>"
                  : "") +
                '<span><i class="fas fa-clock"></i> ' +
                esc(it.date) +
                "</span></div>" +
                '<div style="font-size:.9rem; line-height:1.7;">' +
                esc(it.description) +
                "</div>" +
                (it.link
                  ? '<a href="' +
                    esc(it.link) +
                    '" target="_blank" rel="noopener" dir="ltr" style="color:#8b5cf6;font-size:.85rem;">' +
                    esc(it.link) +
                    "</a>"
                  : "") +
                '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                (done
                  ? ""
                  : '<button class="admin-cat-btn" onclick="ElevateExtras.approve(\'' +
                    esc(it.id) +
                    '\')"><i class="fas fa-check"></i> اعتماد ونشر</button>') +
                '<button class="admin-m-btn delete" onclick="ElevateExtras.removeSub(\'' +
                esc(it.id) +
                '\')"><i class="fas fa-trash"></i> حذف</button>' +
                "</div></div>"
              );
            })
            .join("")
        : '<div style="text-align:center;padding:24px;color:var(--text-muted);">لا توجد فرص مرسلة حتى الآن.</div>';
    }

    var vBox = document.getElementById("elv-votes-box");
    if (vBox) {
      var cards = read("luxen_general_cards", []);
      if (!Array.isArray(cards)) cards = [];
      var v = votesData();
      var rows = Object.keys(v)
        .map(function (id) {
          var card = cards.find(function (c) {
            return String(c.id) === String(id);
          });
          return { id: id, name: card ? card.name : "فرصة محذوفة", voters: v[id] || [] };
        })
        .filter(function (r) {
          return r.voters.length;
        })
        .sort(function (a, b) {
          return b.voters.length - a.voters.length;
        });

      vBox.innerHTML = rows.length
        ? rows
            .map(function (r, i) {
              var names = r.voters
                .slice(-15)
                .map(function (x) {
                  return esc(x.n || x.u);
                })
                .join("، ");
              return (
                '<div class="admin-manage-item" style="flex-direction:column; align-items:stretch; gap:8px; margin-bottom:10px;">' +
                '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">' +
                '<h4 style="margin:0;">#' +
                (i + 1) +
                " " +
                esc(r.name) +
                "</h4>" +
                '<span style="background:rgba(99,102,241,.15);color:#8b5cf6;padding:6px 12px;border-radius:8px;font-weight:bold;">' +
                r.voters.length +
                " صوت</span></div>" +
                '<div style="font-size:.82rem;color:var(--text-muted);">المصوتون: ' +
                names +
                (r.voters.length > 15 ? " ..." : "") +
                "</div>" +
                "</div>"
              );
            })
            .join("")
        : '<div style="text-align:center;padding:24px;color:var(--text-muted);">لا توجد أصوات حتى الآن.</div>';
    }
  }

  function approve(subId) {
    var list = read(K_SUB, []);
    if (!Array.isArray(list)) list = [];
    var it = list.find(function (x) {
      return x.id === subId;
    });
    if (!it) return;
    var cards = read("luxen_general_cards", []);
    if (!Array.isArray(cards)) cards = [];
    cards.push({
      id: Date.now().toString(),
      type: it.type,
      category: it.category || "",
      name: it.name,
      imgInner: "",
      imgOuter: "",
      isFeatured: false,
      tags: "",
      deadline: it.deadline || "",
      startDate: "",
      noDeadline: !it.deadline,
      noDates: !it.deadline,
      openNow: false,
      description: it.description + (it.link ? "\n\nرابط التقديم: " + it.link : ""),
      status: "visible",
      partnerId: null,
      submittedBy: it.senderName || "",
    });
    write("luxen_general_cards", cards);
    it.status = "approved";
    write(K_SUB, list);
    try {
      if (window.App) {
        App.renderOpportunities();
        App.updateHomeStats();
      }
    } catch (e) {}
    try {
      if (window.Admin && document.getElementById("admin-manage-list")) Admin.init();
    } catch (e) {}
    renderAdminExtras();
    alert("تم نشر الفرصة على الموقع.");
  }

  function removeSub(subId) {
    if (!confirm("حذف هذه الرسالة؟")) return;
    var list = read(K_SUB, []);
    if (!Array.isArray(list)) list = [];
    write(
      K_SUB,
      list.filter(function (x) {
        return x.id !== subId;
      }),
    );
    renderAdminExtras();
  }

  /* ============ الربط مع التطبيق القديم ============ */
  function hook() {
    if (!window.App) return false;
    if (App.__elvHooked) return true;
    App.__elvHooked = true;

    var origRender = App.renderOpportunities;
    App.renderOpportunities = function () {
      var r = origRender.apply(this, arguments);
      try {
        decorateCards();
      } catch (e) {}
      return r;
    };

    var origStats = App.updateHomeStats;
    App.updateHomeStats = function () {
      var r = origStats.apply(this, arguments);
      try {
        applyUsersCount();
      } catch (e) {}
      return r;
    };

    if (typeof App.renderLikes === "function") {
      var origLikes = App.renderLikes;
      App.renderLikes = function () {
        var r = origLikes.apply(this, arguments);
        try {
          decorateDetail();
        } catch (e) {}
        return r;
      };
    }

    if (window.Admin && typeof Admin.init === "function") {
      var origInit = Admin.init;
      Admin.init = function () {
        var r = origInit.apply(this, arguments);
        try {
          renderAdminExtras();
          applyUsersCount();
        } catch (e) {}
        return r;
      };
    }
    return true;
  }

  function injectStyles() {
    if (document.getElementById("elv-styles")) return;
    var st = document.createElement("style");
    st.id = "elv-styles";
    st.textContent = [
      "#elv-submit-fab{position:fixed;left:20px;bottom:20px;z-index:9000;border:0;cursor:pointer;",
      "background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:12px 18px;border-radius:50px;",
      "font-family:inherit;font-size:.9rem;font-weight:700;box-shadow:0 10px 24px rgba(99,102,241,.35);display:flex;gap:8px;align-items:center}",
      "#elv-submit-fab:hover{transform:translateY(-2px)}",
      ".elv-modal{display:none;position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.75);backdrop-filter:blur(6px);",
      "align-items:center;justify-content:center;padding:16px}",
      ".elv-modal.open{display:flex}",
      ".elv-modal-box{background:#0f172a;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:22px;",
      "width:min(560px,100%);max-height:88vh;overflow:auto;color:#e2e8f0}",
      ".elv-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}",
      ".elv-modal-head h3{margin:0;font-size:1.1rem;color:#c4b5fd}",
      ".elv-x{background:none;border:0;color:#94a3b8;font-size:1.6rem;cursor:pointer;line-height:1}",
      ".elv-hint{color:#94a3b8;font-size:.85rem;margin:0 0 14px}",
      ".elv-modal-box label{display:block;font-size:.85rem;margin:12px 0 6px;color:#cbd5e1}",
      ".elv-modal-box input,.elv-modal-box select,.elv-modal-box textarea{width:100%;padding:11px 12px;border-radius:12px;",
      "background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#e2e8f0;font-family:inherit;outline:none}",
      ".elv-modal-box textarea{resize:vertical}",
      ".elv-btn{margin-top:18px;width:100%;border:0;cursor:pointer;padding:13px;border-radius:12px;font-family:inherit;",
      "font-weight:700;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6)}",
      ".elv-vote-bar{margin-top:10px}",
      ".elv-vote{width:100%;cursor:pointer;font-family:inherit;font-size:.85rem;font-weight:700;padding:9px 12px;",
      "border-radius:10px;background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.35);",
      "display:flex;gap:8px;align-items:center;justify-content:center}",
      ".elv-vote.voted{background:rgba(16,185,129,.14);color:#34d399;border-color:rgba(16,185,129,.4)}",
      ".elv-vote-count{background:rgba(255,255,255,.1);padding:2px 9px;border-radius:20px}",
      ".elv-welcome-box{text-align:center}",
      ".elv-wa-card{position:relative;overflow:hidden;padding:34px 26px 22px !important;",
      "background:radial-gradient(120% 90% at 50% 0%,#151b45 0%,#0a0e27 55%,#070a1d 100%) !important;",
      "border:1px solid rgba(120,130,255,.18) !important;border-radius:24px !important;",
      "box-shadow:0 30px 80px -20px rgba(0,0,0,.75),0 0 120px -30px rgba(34,197,94,.25) !important}",
      ".elv-wa-topbar{position:absolute;top:0;left:50%;transform:translateX(-50%);width:64px;height:4px;",
      "border-radius:0 0 6px 6px;background:linear-gradient(90deg,#34d399,#22c55e,#a3e635);box-shadow:0 2px 14px rgba(34,197,94,.7)}",
      ".elv-wa-icon{width:64px;height:64px;margin:6px auto 16px;border-radius:18px;display:flex;align-items:center;justify-content:center;",
      "font-size:1.8rem;color:#a5b4fc;background:linear-gradient(160deg,#1b2352,#10163a);",
      "border:1px solid rgba(129,140,248,.3);box-shadow:0 8px 24px -8px rgba(99,102,241,.5),inset 0 1px 0 rgba(255,255,255,.08)}",
      ".elv-wa-pill{display:inline-flex;align-items:center;gap:7px;font-size:.78rem;font-weight:700;color:#9aa7ff;",
      "background:rgba(99,102,241,.14);border:1px solid rgba(129,140,248,.35);padding:6px 14px;border-radius:999px;margin-bottom:16px}",
      ".elv-wa-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;animation:elvPulse 1.6s infinite}",
      "@keyframes elvPulse{0%,100%{opacity:1}50%{opacity:.35}}",
      ".elv-wa-card h3{margin:0 0 10px;font-size:1.7rem;line-height:1.4;font-weight:800;color:#f1f5ff;letter-spacing:-.01em}",
      ".elv-wa-hl{color:#22c55e;text-shadow:0 0 24px rgba(34,197,94,.45)}",
      ".elv-wa-sub{margin:0 0 18px;font-size:.92rem;color:#8b96c2;line-height:1.8}",
      ".elv-wa-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:20px}",
      ".elv-wa-chip{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:600;color:#c3cbf0;",
      "background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);padding:7px 13px;border-radius:999px}",
      ".elv-wa-chip i{color:#22c55e;font-size:.72rem}",
      ".elv-wa-follow{display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;cursor:pointer;",
      "font-family:inherit;font-size:1.05rem;font-weight:800;color:#04170b;padding:15px 20px;border-radius:14px;",
      "background:linear-gradient(135deg,#4ade80,#22c55e);box-shadow:0 12px 32px -8px rgba(34,197,94,.55),inset 0 1px 0 rgba(255,255,255,.35);",
      "transition:transform .15s ease,box-shadow .15s ease}",
      ".elv-wa-follow:hover{transform:translateY(-2px);box-shadow:0 18px 40px -8px rgba(34,197,94,.65),inset 0 1px 0 rgba(255,255,255,.35)}",
      ".elv-wa-lock{margin-top:12px;font-size:.78rem;font-weight:700;color:#fb7185}",
      ".elv-wa-lock i{font-size:.72rem;margin-inline-end:5px}",
      ".elv-wa-links{margin-top:16px;display:flex;gap:10px;justify-content:center;align-items:center}",
      ".elv-wa-links button{background:none;border:none;cursor:pointer;font-family:inherit;font-size:.8rem;color:#8b96c2;text-decoration:underline;padding:2px 4px}",
      ".elv-wa-links button:hover{color:#c3cbf0}",
      ".elv-wa-links span{color:#3b4468}",
      "#elv-detail-vote .elv-vote{width:auto;display:inline-flex;margin-inline-start:8px}",
    ].join("");
    document.head.appendChild(st);
  }

  function boot() {
    injectStyles();
    ensureSubmitUI();
    var welcomed = false;
    try {
      welcomed = !!sessionStorage.getItem("elv_welcomed");
    } catch (e) {}
    if (!welcomed && !isAdmin()) ensureWelcomeCard();
    hook();
    decorateCards();
    decorateDetail();
    applyUsersCount();
    renderAdminExtras();
  }

  window.ElevateExtras = {
    vote: toggleVote,
    openSubmit: openSubmitModal,
    closeWelcome: closeWelcome,
    followedWa: followedWa,
    goLogin: goLogin,
    closeSubmit: closeSubmit,
    approve: approve,
    removeSub: removeSub,
    saveUsers: saveUsersCount,
    bumpUsers: bumpUsersCount,
    resetUsers: resetUsersCount,
    refresh: boot,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(boot, 60);
    });
  } else {
    setTimeout(boot, 60);
  }
  // إعادة الرسم بعد أي مزامنة مع قاعدة البيانات
  setInterval(function () {
    try {
      decorateCards();
      applyUsersCount();
      if (isAdmin()) renderAdminExtras();
    } catch (e) {}
  }, 15000);
})();
