/* Elevate — Profile Plus
   Upgrades the normal user's profile page (admins/partners untouched):
   - Profile completion meter + checklist
   - Edit profile window (bio, study, city, interests, links, avatar color)
   - "About me" card, achievements, recommended opportunities, recent comments
   Only ADDS fields to the user record; never removes or rewrites existing data. */
(function () {
  "use strict";

  var CATS = [
    ["competitions", "مسابقات", "fa-trophy"],
    ["scholarships", "منح دراسية", "fa-graduation-cap"],
    ["volunteering", "تطوع", "fa-hand-holding-heart"],
    ["jobs", "وظائف وتدريب", "fa-briefcase"],
    ["events", "فعاليات", "fa-calendar-star"],
    ["courses", "كورسات مجانية", "fa-book-open"],
    ["workshops", "ورش عمل", "fa-chalkboard-teacher"],
    ["travel", "سفر ممول", "fa-plane"],
    ["admission", "قبول جامعي", "fa-university"],
  ];
  var COLORS = [
    "#6366f1",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#14b8a6",
    "#8b5cf6",
  ];
  var YEARS = [
    "ثانوي",
    "الفرقة الأولى",
    "الفرقة الثانية",
    "الفرقة الثالثة",
    "الفرقة الرابعة",
    "الفرقة الخامسة",
    "خريج",
    "دراسات عليا",
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function readJSON(k, f) {
    try {
      var v = JSON.parse(localStorage.getItem(k) || "null");
      return v == null ? f : v;
    } catch (e) {
      return f;
    }
  }
  function user() {
    return readJSON("ns_user", null);
  }
  function toast(m) {
    if (window.App && App.showToast) {
      try {
        App.showToast(m);
        return;
      } catch (e) {}
    }
    alert(m);
  }
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return /^https?:\/\/[^\s<>"']+$/i.test(u) ? u : "";
  }

  function isSpecial(u) {
    if (!u) return true;
    if (u.username === "admin@elevate.com") return true;
    var all = readJSON("luxen_all_users", []) || [];
    return all.some(function (r) {
      return r && r.username === u.username && r.isActive !== false && (r.isTeam || r.isPartner);
    });
  }

  /* Merge new fields into ns_user and the shared users list (keeps everything else). */
  function saveProfile(patch) {
    var u = user();
    if (!u) return;
    var merged = Object.assign({}, u, patch);
    localStorage.setItem("ns_user", JSON.stringify(merged));
    var all = readJSON("luxen_all_users", []);
    if (Array.isArray(all)) {
      var changed = false;
      all = all.map(function (r) {
        if (r && u.username && r.username === u.username) {
          changed = true;
          var p = Object.assign({}, patch);
          if (patch.name) p.fullName = patch.name;
          return Object.assign({}, r, p);
        }
        return r;
      });
      if (changed) localStorage.setItem("luxen_all_users", JSON.stringify(all));
    }
  }

  function checklist(u) {
    return [
      ["الاسم الكامل", !!u.name],
      ["رقم الهاتف", !!u.phone],
      ["نبذة عنك", !!u.bio],
      ["الجامعة / المدرسة", !!u.university],
      ["التخصص", !!u.major],
      ["المدينة", !!u.city],
      ["اهتماماتك", Array.isArray(u.interests) && u.interests.length > 0],
      ["رابط احترافي", !!(u.linkedin || u.github || u.website)],
    ];
  }

  function el(id) {
    return document.getElementById(id);
  }

  function ensureLayout() {
    if (el("pp-root")) return;
    var overview = el("prof-overview-tab");
    if (!overview) return;
    var root = document.createElement("div");
    root.id = "pp-root";
    overview.insertBefore(root, overview.firstChild);

    var tabs = el("prof-tabs-container");
    if (tabs && !el("tab-activity-btn")) {
      var t = document.createElement("div");
      t.className = "prof-tab";
      t.id = "tab-activity-btn";
      t.dataset.target = "prof-activity-tab";
      t.textContent = "نشاطي";
      t.onclick = function () {
        App.switchProfTab("prof-activity-tab");
      };
      var saved = el("tab-saved-btn");
      saved && saved.nextSibling ? tabs.insertBefore(t, saved.nextSibling) : tabs.appendChild(t);
      var c = document.createElement("div");
      c.id = "prof-activity-tab";
      c.className = "prof-tab-content";
      el("prof-saved-tab").parentNode.insertBefore(c, el("prof-saved-tab").nextSibling);
    }

    var left = document.querySelector("#prof-header .prof-header-left");
    if (left && !el("pp-edit-btn")) {
      var b = document.createElement("button");
      b.id = "pp-edit-btn";
      b.className = "prof-btn prof-btn-white";
      b.innerHTML = '<i class="fa-solid fa-pen"></i> تعديل الملف';
      b.onclick = openEditor;
      left.insertBefore(b, left.firstChild);
    }

    var sidebar = el("prof-normal-sidebar");
    if (sidebar && !el("pp-side")) {
      var s = document.createElement("div");
      s.id = "pp-side";
      sidebar.appendChild(s);
    }
  }

  function render() {
    var u = user();
    if (!u || isSpecial(u)) return;
    ensureLayout();
    var root = el("pp-root");
    if (!root) return;

    var color = u.avatarColor || COLORS[0];
    var av = el("prof-avatar-char");
    if (av) {
      av.style.background = "linear-gradient(135deg," + color + "," + color + "cc)";
    }

    var list = checklist(u);
    var done = list.filter(function (x) {
      return x[1];
    }).length;
    var pct = Math.round((done / list.length) * 100);

    var interests = Array.isArray(u.interests) ? u.interests : [];
    var catName = {};
    CATS.forEach(function (c) {
      catName[c[0]] = c;
    });

    var links = [
      ["linkedin", "fa-brands fa-linkedin", "LinkedIn"],
      ["github", "fa-brands fa-github", "GitHub"],
      ["website", "fa-solid fa-globe", "الموقع / البورتفوليو"],
    ].filter(function (l) {
      return safeUrl(u[l[0]]);
    });

    var bioRole = [u.major, u.university].filter(Boolean).join(" — ");
    var handle = el("prof-handle-disp");
    if (handle && bioRole)
      handle.innerHTML =
        "@" + esc(u.username) + ' <span class="pp-sub">· ' + esc(bioRole) + "</span>";

    root.innerHTML =
      (pct < 100
        ? '<div class="prof-card pp-complete">' +
          '<div class="pp-complete-top"><div><b>اكتمال ملفك الشخصي</b><span>' +
          pct +
          "%</span></div>" +
          '<button class="pp-btn" id="pp-complete-btn"><i class="fa-solid fa-wand-magic-sparkles"></i> أكمل ملفك</button></div>' +
          '<div class="pp-bar"><i style="width:' +
          pct +
          '%"></i></div>' +
          '<div class="pp-checks">' +
          list
            .map(function (x) {
              return (
                '<span class="' +
                (x[1] ? "ok" : "") +
                '"><i class="fa-solid ' +
                (x[1] ? "fa-circle-check" : "fa-circle") +
                '"></i> ' +
                x[0] +
                "</span>"
              );
            })
            .join("") +
          "</div>" +
          '<p class="pp-hint">ملف مكتمل = ترشيحات فرص أدق ليك.</p>' +
          "</div>"
        : "") +
      '<div class="prof-card">' +
      '<div class="prof-card-header"><span>عني</span><i class="fa-solid fa-id-card"></i></div>' +
      '<p class="pp-bio">' +
      (u.bio
        ? esc(u.bio)
        : '<span class="pp-muted">لسه ما كتبتش نبذة عنك. اضغط "تعديل الملف" وعرّف الناس بيك.</span>') +
      "</p>" +
      '<div class="pp-facts">' +
      fact("fa-building-columns", "الجامعة", u.university) +
      fact("fa-book", "التخصص", u.major) +
      fact("fa-layer-group", "السنة الدراسية", u.studyYear) +
      fact("fa-location-dot", "المدينة", u.city) +
      fact("fa-envelope", "البريد", u.email) +
      fact("fa-cake-candles", "تاريخ الميلاد", u.birthDate) +
      "</div>" +
      (interests.length
        ? '<div class="pp-label">اهتماماتي</div><div class="pp-chips">' +
          interests
            .map(function (k) {
              var c = catName[k];
              return c
                ? '<span class="pp-chip"><i class="fa-solid ' + c[2] + '"></i> ' + c[1] + "</span>"
                : "";
            })
            .join("") +
          "</div>"
        : "") +
      (links.length
        ? '<div class="pp-label">روابطي</div><div class="pp-links">' +
          links
            .map(function (l) {
              return (
                '<a href="' +
                esc(safeUrl(u[l[0]])) +
                '" target="_blank" rel="noopener noreferrer"><i class="' +
                l[1] +
                '"></i> ' +
                l[2] +
                "</a>"
              );
            })
            .join("") +
          "</div>"
        : "") +
      "</div>" +
      recommended(interests);

    var cb = el("pp-complete-btn");
    if (cb) cb.onclick = openEditor;
    renderSide(u, pct);
    renderActivity(u);
  }

  function fact(icon, label, val) {
    if (!val) return "";
    return (
      '<div class="pp-fact"><i class="fa-solid ' +
      icon +
      '"></i><div><small>' +
      label +
      "</small><b>" +
      esc(val) +
      "</b></div></div>"
    );
  }

  function recommended(interests) {
    var cards = readJSON("luxen_general_cards", []);
    if (!Array.isArray(cards) || !cards.length) return "";
    var saved = (readJSON("ns_saved_opps", []) || []).map(function (s) {
      return String(s && s.id != null ? s.id : s);
    });
    var pool = cards.filter(function (c) {
      return c && c.status !== "hidden" && saved.indexOf(String(c.id)) === -1;
    });
    if (interests.length) {
      var m = pool.filter(function (c) {
        return interests.indexOf(c.category || c.type || c.cat) !== -1;
      });
      if (m.length) pool = m;
    }
    pool = pool.slice(-4).reverse();
    if (!pool.length) return "";
    return (
      '<div class="prof-card">' +
      '<div class="prof-card-header"><span>' +
      (interests.length ? "فرص مناسبة لاهتماماتك" : "أحدث الفرص ليك") +
      '</span><i class="fa-solid fa-sparkles"></i></div>' +
      '<div class="pp-recs">' +
      pool
        .map(function (c) {
          return (
            '<a class="pp-rec" href="?card=' +
            encodeURIComponent(c.id) +
            '">' +
            "<b>" +
            esc(c.name || c.title || "فرصة") +
            "</b>" +
            (c.deadline
              ? '<small><i class="fa-regular fa-clock"></i> آخر موعد: ' +
                esc(c.deadline) +
                "</small>"
              : "") +
            "</a>"
          );
        })
        .join("") +
      "</div>" +
      (interests.length
        ? ""
        : '<p class="pp-hint">اختار اهتماماتك من "تعديل الملف" عشان نرشحلك فرص أدق.</p>') +
      "</div>"
    );
  }

  function renderSide(u, pct) {
    var side = el("pp-side");
    if (!side) return;
    var saved = (readJSON("ns_saved_opps", []) || []).length;
    var comments = (readJSON("luxen_comments", []) || []).filter(function (c) {
      return c && c.username === u.username;
    }).length;
    var days = u.join_timestamp
      ? Math.max(1, Math.ceil((Date.now() - u.join_timestamp) / 86400000))
      : 1;
    var badges = [
      ["fa-seedling", "عضو جديد", true],
      ["fa-bookmark", "جامع الفرص (5 محفوظات)", saved >= 5],
      ["fa-comments", "صوت المجتمع (3 تعليقات)", comments >= 3],
      ["fa-user-check", "ملف مكتمل", pct === 100],
      ["fa-fire", "مستمر (30 يوم)", days >= 30],
    ];
    side.innerHTML =
      '<div class="prof-card" style="margin-top:20px">' +
      '<div class="prof-card-header"><span>إنجازاتي</span><i class="fa-solid fa-medal"></i></div>' +
      '<div class="pp-badges">' +
      badges
        .map(function (b) {
          return (
            '<div class="pp-badge ' +
            (b[2] ? "on" : "") +
            '" title="' +
            b[1] +
            '"><i class="fa-solid ' +
            b[0] +
            '"></i><span>' +
            b[1] +
            "</span></div>"
          );
        })
        .join("") +
      "</div></div>";
  }

  function renderActivity(u) {
    var box = el("prof-activity-tab");
    if (!box) return;
    var cards = readJSON("luxen_general_cards", []) || [];
    var byId = {};
    cards.forEach(function (c) {
      if (c) byId[String(c.id)] = c;
    });
    var mine = (readJSON("luxen_comments", []) || [])
      .filter(function (c) {
        return c && c.username === u.username;
      })
      .slice(-15)
      .reverse();
    box.innerHTML =
      '<div class="prof-card"><div class="prof-card-header"><span>آخر تعليقاتي</span><i class="fa-solid fa-clock-rotate-left"></i></div>' +
      (mine.length
        ? '<div class="pp-acts">' +
          mine
            .map(function (c) {
              var cid = c.cardId || c.card_id || c.oppId;
              var card = byId[String(cid)];
              return (
                '<div class="pp-act"><p>' +
                esc(c.text || c.comment || c.content || "") +
                "</p>" +
                (card
                  ? '<a href="?card=' +
                    encodeURIComponent(cid) +
                    '"><i class="fa-solid fa-arrow-up-right-from-square"></i> ' +
                    esc(card.name || card.title || "الفرصة") +
                    "</a>"
                  : "") +
                (c.date || c.time ? "<small>" + esc(c.date || c.time) + "</small>" : "") +
                "</div>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="pp-muted">لسه ما علقتش على أي فرصة.</p>') +
      "</div>";
  }

  /* ---------- editor ---------- */
  function openEditor() {
    var u = user();
    if (!u) return;
    var interests = Array.isArray(u.interests) ? u.interests : [];
    var ov = document.createElement("div");
    ov.className = "pp-overlay";
    ov.setAttribute("dir", "rtl");
    ov.innerHTML =
      '<form class="pp-modal" novalidate>' +
      '<div class="pp-modal-head"><b><i class="fa-solid fa-user-pen"></i> تعديل الملف الشخصي</b><button type="button" class="pp-x" aria-label="إغلاق">&times;</button></div>' +
      '<div class="pp-modal-body">' +
      '<div class="pp-label">لون الصورة</div><div class="pp-colors">' +
      COLORS.map(function (c) {
        return (
          '<label><input type="radio" name="avatarColor" value="' +
          c +
          '"' +
          ((u.avatarColor || COLORS[0]) === c ? " checked" : "") +
          '><span style="background:' +
          c +
          '"></span></label>'
        );
      }).join("") +
      "</div>" +
      '<div class="pp-grid">' +
      inp("name", "الاسم الكامل", u.name, "text", 60) +
      inp("phone", "رقم الهاتف", u.phone, "tel", 20) +
      inp("email", "البريد الإلكتروني", u.email, "email", 100) +
      inp("city", "المدينة", u.city, "text", 40) +
      inp("university", "الجامعة / المدرسة", u.university, "text", 80) +
      inp("major", "التخصص / الكلية", u.major, "text", 80) +
      '<label class="pp-field"><span>السنة الدراسية</span><select name="studyYear"><option value="">اختار</option>' +
      YEARS.map(function (y) {
        return "<option" + (u.studyYear === y ? " selected" : "") + ">" + y + "</option>";
      }).join("") +
      "</select></label>" +
      inp("birthDate", "تاريخ الميلاد", u.birthDate, "date", 10) +
      "</div>" +
      '<label class="pp-field"><span>نبذة عنك <small id="pp-bio-count"></small></span><textarea name="bio" maxlength="300" rows="3" placeholder="مثال: طالب هندسة مهتم بالذكاء الاصطناعي والتطوع">' +
      esc(u.bio) +
      "</textarea></label>" +
      '<div class="pp-label">اهتماماتك</div><div class="pp-pick">' +
      CATS.map(function (c) {
        return (
          '<label><input type="checkbox" name="interests" value="' +
          c[0] +
          '"' +
          (interests.indexOf(c[0]) !== -1 ? " checked" : "") +
          '><span><i class="fa-solid ' +
          c[2] +
          '"></i> ' +
          c[1] +
          "</span></label>"
        );
      }).join("") +
      "</div>" +
      '<div class="pp-grid">' +
      inp("linkedin", "LinkedIn", u.linkedin, "url", 200) +
      inp("github", "GitHub", u.github, "url", 200) +
      inp("website", "موقعك / البورتفوليو", u.website, "url", 200) +
      "</div>" +
      '<p class="pp-err" id="pp-err"></p>' +
      "</div>" +
      '<div class="pp-modal-foot"><button type="button" class="pp-btn pp-ghost pp-cancel">إلغاء</button><button type="submit" class="pp-btn"><i class="fa-solid fa-check"></i> حفظ التغييرات</button></div>' +
      "</form>";
    document.body.appendChild(ov);
    var f = ov.querySelector("form");
    var bio = f.elements.bio,
      cnt = ov.querySelector("#pp-bio-count");
    function upd() {
      cnt.textContent = "(" + bio.value.length + "/300)";
    }
    upd();
    bio.oninput = upd;
    function close() {
      ov.remove();
    }
    ov.querySelector(".pp-x").onclick = close;
    ov.querySelector(".pp-cancel").onclick = close;
    ov.onclick = function (e) {
      if (e.target === ov) close();
    };
    f.onsubmit = function (e) {
      e.preventDefault();
      var g = function (n) {
        return String(f.elements[n].value || "").trim();
      };
      var err = ov.querySelector("#pp-err");
      var name = g("name"),
        phone = g("phone"),
        email = g("email");
      if (name.length < 2) {
        err.textContent = "اكتب اسمك (حرفين على الأقل).";
        return;
      }
      if (phone && !/^[+\d][\d\s-]{6,19}$/.test(phone)) {
        err.textContent = "رقم الهاتف مش صحيح.";
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err.textContent = "البريد الإلكتروني مش صحيح.";
        return;
      }
      var bad = ["linkedin", "github", "website"].filter(function (k) {
        return g(k) && !safeUrl(g(k));
      });
      if (bad.length) {
        err.textContent = "في رابط مش صحيح، راجعه.";
        return;
      }
      var picks = Array.prototype.slice
        .call(f.querySelectorAll("input[name=interests]:checked"))
        .map(function (i) {
          return i.value;
        });
      var color = (f.querySelector("input[name=avatarColor]:checked") || {}).value || COLORS[0];
      saveProfile({
        name: name,
        phone: phone,
        email: email,
        city: g("city"),
        university: g("university"),
        major: g("major"),
        studyYear: g("studyYear"),
        birthDate: g("birthDate"),
        bio: g("bio").slice(0, 300),
        interests: picks,
        linkedin: safeUrl(g("linkedin")),
        github: safeUrl(g("github")),
        website: safeUrl(g("website")),
        avatarColor: color,
        profileUpdatedAt: Date.now(),
      });
      close();
      if (window.App && App.renderProfile) App.renderProfile();
      toast("تم حفظ ملفك الشخصي ✓");
    };
  }
  function inp(n, label, val, type, max) {
    return (
      '<label class="pp-field"><span>' +
      label +
      '</span><input name="' +
      n +
      '" type="' +
      type +
      '" maxlength="' +
      max +
      '" value="' +
      esc(val) +
      '"' +
      (type === "url" || type === "tel" || type === "email" ? ' dir="ltr"' : "") +
      "></label>"
    );
  }

  function hook() {
    if (!window.App || !App.renderProfile || App.__ppHooked) return false;
    var orig = App.renderProfile;
    App.renderProfile = function () {
      var r = orig.apply(this, arguments);
      try {
        render();
      } catch (e) {
        console.error(e);
      }
      return r;
    };
    App.__ppHooked = true;
    var pv = el("profile-view");
    if (pv && pv.style.display !== "none") {
      try {
        render();
      } catch (e) {}
    }
    return true;
  }
  if (!hook()) {
    var n = 0,
      t = setInterval(function () {
        if (hook() || ++n > 50) clearInterval(t);
      }, 100);
  }
})();
