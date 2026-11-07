/* Elevate — ورش عمل مباشر (قسم live)
   - نموذج المدير: اسم الورشة / التصنيف / الصورة الخارجية / اسم المحاضر / تاريخ ووقت الميت / هاشتاجات / لينك الميت / لينك تسجيل المحاضرة
   - البطاقة زي باقي البطاقات بس بزرارين: «دخول للورشة» و«تسجيل المحاضرة»
   - الدخول بيفتح صفحة داخل المنصة فيها الميت + تعليقات
   كل البيانات بتتخزن في نفس قاعدة البيانات عبر db-sync. */
(function () {
  var K_CARDS = "luxen_general_cards";
  var K_JOINS = "luxen_live_joins";
  var K_COMMENTS = "luxen_comments";

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
  function joinerId() {
    var u = user();
    if (u && (u.username || u.email)) return u.username || u.email;
    var id = localStorage.getItem("elevate_voter_id");
    if (!id) {
      id = "guest_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("elevate_voter_id", id);
    }
    return id;
  }

  /* ============ صلاحية لينك الميت ============ */
  function isWorkingMeetLink(link) {
    if (!link) return false;
    var v = String(link).trim();
    if (!/^https?:\/\//i.test(v)) return false;
    try {
      var u = new URL(v);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "meet.google.com") {
        return (
          /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(u.pathname) ||
          /^\/lookup\/[a-z0-9-]+\/?$/i.test(u.pathname)
        );
      }
      return /(zoom\.us|teams\.microsoft\.com|meet\.jit\.si|whereby\.com|webex\.com)$/.test(host);
    } catch (e) {
      return false;
    }
  }

  /* ============ تحويل لينك التسجيل لمشغّل ============ */
  function recordEmbed(link) {
    var v = String(link || "").trim();
    if (!v) return "";
    try {
      var u = new URL(v);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      var id;
      if (host === "youtu.be") {
        id = u.pathname.slice(1);
        return (
          '<iframe src="https://www.youtube.com/embed/' +
          esc(id) +
          '" allowfullscreen allow="autoplay; encrypted-media"></iframe>'
        );
      }
      if (host.indexOf("youtube.com") > -1) {
        id = u.searchParams.get("v");
        if (!id && u.pathname.indexOf("/embed/") === 0) id = u.pathname.split("/")[2];
        if (id)
          return (
            '<iframe src="https://www.youtube.com/embed/' +
            esc(id) +
            '" allowfullscreen allow="autoplay; encrypted-media"></iframe>'
          );
      }
      if (host === "drive.google.com") {
        var m = u.pathname.match(/\/d\/([^/]+)/);
        var fid = m ? m[1] : u.searchParams.get("id");
        if (fid)
          return (
            '<iframe src="https://drive.google.com/file/d/' +
            esc(fid) +
            '/preview" allowfullscreen></iframe>'
          );
      }
      if (host.indexOf("vimeo.com") > -1) {
        id = u.pathname.split("/").filter(Boolean)[0];
        if (id)
          return (
            '<iframe src="https://player.vimeo.com/video/' + esc(id) + '" allowfullscreen></iframe>'
          );
      }
      if (/\.(mp4|webm|ogg|m4v|mov)$/i.test(u.pathname)) {
        return '<video src="' + esc(v) + '" controls autoplay playsinline></video>';
      }
      return '<iframe src="' + esc(v) + '" allowfullscreen></iframe>';
    } catch (e) {
      return "";
    }
  }

  /* ============ عدّاد الدخول ============ */
  function joins() {
    var j = read(K_JOINS, {});
    return j && typeof j === "object" && !Array.isArray(j) ? j : {};
  }
  function joinCount(id) {
    var list = joins()[id];
    return Array.isArray(list) ? list.length : 0;
  }
  function recordJoin(id) {
    var all = joins();
    var list = Array.isArray(all[id]) ? all[id] : [];
    var me = joinerId();
    if (list.indexOf(me) === -1) {
      list.push(me);
      all[id] = list;
      write(K_JOINS, all);
    }
    return list.length;
  }

  function getCard(id) {
    var cards = read(K_CARDS, []);
    if (!Array.isArray(cards)) return null;
    for (var i = 0; i < cards.length; i++) if (String(cards[i].id) === String(id)) return cards[i];
    return null;
  }

  /* ============ صفحة الورشة داخل المنصة ============ */
  function ensureRoom() {
    if (document.getElementById("elv-live-room")) return;
    var wrap = document.createElement("div");
    wrap.id = "elv-live-room";
    wrap.className = "elv-modal";
    wrap.innerHTML =
      '<div class="elv-modal-box elv-room-box" dir="rtl"><div id="elv-room-body"></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) closeRoom();
    });
  }
  function closeRoom() {
    var m = document.getElementById("elv-live-room");
    if (m) {
      m.classList.remove("open");
      var b = document.getElementById("elv-room-body");
      if (b) b.innerHTML = "";
    }
  }

  function commentsOf(id) {
    var all = read(K_COMMENTS, []);
    if (!Array.isArray(all)) return [];
    return all.filter(function (c) {
      return String(c.cardId) === String(id);
    });
  }
  function renderRoomComments(id) {
    var box = document.getElementById("elv-room-comments");
    if (!box) return;
    var list = commentsOf(id);
    if (!list.length) {
      box.innerHTML =
        '<div class="elv-room-empty">لا توجد تعليقات حتى الآن. كن أول من يشارك!</div>';
      return;
    }
    box.innerHTML = list
      .map(function (c) {
        return (
          '<div class="elv-room-comment"><b>' +
          esc(c.name || c.username || "مستخدم") +
          "</b>" +
          "<span>" +
          esc(c.date || "") +
          "</span><p>" +
          esc(c.text || c.comment || "") +
          "</p></div>"
        );
      })
      .join("");
  }
  function addRoomComment(id) {
    var input = document.getElementById("elv-room-comment-input");
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    var u = user();
    if (!u) {
      alert("سجّل دخولك الأول عشان تقدر تعلّق.");
      return;
    }
    var all = read(K_COMMENTS, []);
    if (!Array.isArray(all)) all = [];
    all.push({
      id: Date.now().toString(),
      cardId: id,
      username: u.username || u.email || "user",
      name: u.name || u.username || "مستخدم",
      text: text,
      date: new Date().toLocaleString("ar-EG"),
    });
    write(K_COMMENTS, all);
    input.value = "";
    renderRoomComments(id);
  }

  function openRoom(id) {
    var c = getCard(id);
    if (!c) return;
    ensureRoom();
    var n = recordJoin(id);
    var badge = document.querySelector('.elv-live-joins[data-id="' + id + '"] .elv-live-joins-num');
    if (badge) badge.textContent = n;

    var meta = [];
    if (c.lecturer)
      meta.push('<span><i class="fas fa-chalkboard-user"></i> ' + esc(c.lecturer) + "</span>");
    if (c.workshopDate)
      meta.push('<span><i class="fa-regular fa-calendar"></i> ' + esc(c.workshopDate) + "</span>");
    if (c.workshopTime)
      meta.push('<span><i class="fa-regular fa-clock"></i> ' + esc(c.workshopTime) + "</span>");

    document.getElementById("elv-room-body").innerHTML =
      '<div class="elv-modal-head"><h3><i class="fas fa-video"></i> ' +
      esc(c.name || "ورشة مباشرة") +
      "</h3>" +
      '<button type="button" class="elv-x" onclick="ElevateLive.closeRoom()">&times;</button></div>' +
      '<div class="elv-room-meta">' +
      meta.join("") +
      "</div>" +
      '<div class="elv-room-stage">' +
      (c.imgInner
        ? '<img src="' + esc(c.imgInner) + '" alt="' + esc(c.name || "صورة الورشة") + '">'
        : '<div class="elv-room-fallback">لا توجد صورة للورشة.</div>') +
      "</div>" +
      '<div class="elv-room-actions">' +
      (c.meetLink
        ? '<a class="elv-btn" target="_blank" rel="noopener" href="' +
          esc(c.meetLink) +
          '"><i class="fas fa-up-right-from-square"></i> فتح الميت في صفحة جديدة</a>'
        : "") +
      (c.recordLink
        ? '<button class="elv-btn elv-btn-rec" type="button" onclick="ElevateLive.playRecord(\'' +
          esc(id) +
          '\')"><i class="fas fa-circle-play"></i> تسجيل المحاضرة</button>'
        : "") +
      "</div>" +
      '<div class="elv-room-comments-wrap"><h4><i class="fas fa-comments"></i> التعليقات</h4>' +
      '<div id="elv-room-comments"></div>' +
      '<div class="elv-room-add"><input id="elv-room-comment-input" type="text" placeholder="اكتب تعليقك..."><button class="elv-btn" type="button" onclick="ElevateLive.comment(\'' +
      esc(id) +
      "')\">إرسال</button></div>" +
      "</div>";
    renderRoomComments(id);
    document.getElementById("elv-live-room").classList.add("open");
    setTimeout(decorate, 200);
  }

  /* ============ مشغّل تسجيل المحاضرة ============ */
  function ensurePlayer() {
    if (document.getElementById("elv-live-player")) return;
    var wrap = document.createElement("div");
    wrap.id = "elv-live-player";
    wrap.className = "elv-modal";
    wrap.innerHTML =
      '<div class="elv-modal-box elv-player-box" dir="rtl">' +
      '<div class="elv-modal-head"><h3><i class="fas fa-circle-play"></i> <span id="elv-player-title">تسجيل المحاضرة</span></h3>' +
      '<button type="button" class="elv-x" onclick="ElevateLive.closePlayer()">&times;</button></div>' +
      '<div class="elv-player-stage" id="elv-player-stage"></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) closePlayer();
    });
  }
  function closePlayer() {
    var m = document.getElementById("elv-live-player");
    if (m) {
      m.classList.remove("open");
      document.getElementById("elv-player-stage").innerHTML = "";
    }
  }
  function playRecord(id) {
    var c = getCard(id);
    if (!c || !c.recordLink) {
      alert("تسجيل المحاضرة مش متاح حالياً.");
      return;
    }
    ensurePlayer();
    document.getElementById("elv-player-title").textContent = "تسجيل: " + (c.name || "المحاضرة");
    document.getElementById("elv-player-stage").innerHTML =
      recordEmbed(c.recordLink) || '<div class="elv-room-fallback">مش قادر أشغّل التسجيل.</div>';
    document.getElementById("elv-live-player").classList.add("open");
  }

  /* ============ تزيين بطاقات الورش المباشرة ============ */
  function decorate() {
    var cards = document.querySelectorAll('.opp-card[data-category="live"]');
    Array.prototype.forEach.call(cards, function (card) {
      var id = card.getAttribute("data-id");
      if (!id) return;
      var data = getCard(id);
      if (!data) return;
      card.classList.add("elv-live-card");

      // عدّاد اللي دخلوا
      var oldBadge = card.querySelector(".elv-live-joins");
      if (oldBadge) oldBadge.remove();
      var badge = document.createElement("div");
      badge.className = "elv-live-joins";
      badge.setAttribute("data-id", id);
      badge.innerHTML =
        '<i class="fas fa-user-group"></i> <span class="elv-live-joins-num">' +
        joinCount(id) +
        "</span> دخلوا الورشة";
      (card.querySelector(".opp-card-header-img") || card).appendChild(badge);

      // اسم المحاضر
      var sub = card.querySelector(".opp-card-subtitle");
      if (sub && data.lecturer && !card.querySelector(".elv-live-lect")) {
        var lect = document.createElement("div");
        lect.className = "elv-live-lect";
        lect.innerHTML = '<i class="fas fa-chalkboard-user"></i> ' + esc(data.lecturer);
        sub.parentNode.insertBefore(lect, sub.nextSibling);
      }

      // التاريخ + الوقت
      var dateEl = card.querySelector(".opp-date-info span");
      if (dateEl) {
        dateEl.textContent =
          (data.workshopDate || data.deadline || "غير محدد") +
          (data.workshopTime ? " • " + data.workshopTime : "");
      }

      // زرار الدخول بدل عرض التفاصيل + زرار التسجيل
      var actions = card.querySelector(".opp-actions");
      var viewBtn = card.querySelector(".opp-view-btn:not(.elv-live-join)");
      if (viewBtn) {
        var btn = document.createElement("button");
        btn.className = "opp-view-btn elv-live-join";
        btn.innerHTML = '<i class="fas fa-video"></i> <span>دخول للورشة</span>';
        btn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          openRoom(id);
        };
        viewBtn.parentNode.replaceChild(btn, viewBtn);
      }
      var recOld = card.querySelector(".elv-live-rec");
      if (recOld) recOld.remove();
      if (actions && data.recordLink) {
        var rec = document.createElement("button");
        rec.className = "opp-view-btn elv-live-rec";
        rec.innerHTML = '<i class="fas fa-circle-play"></i> <span>تسجيل المحاضرة</span>';
        rec.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          playRecord(id);
        };
        actions.insertBefore(rec, actions.firstChild);
      }
    });
  }

  /* ============ نموذج المدير الخاص بالورش ============ */
  function ensureModal() {
    if (document.getElementById("elv-live-modal")) return;
    var wrap = document.createElement("div");
    wrap.id = "elv-live-modal";
    wrap.className = "elv-modal";
    wrap.innerHTML =
      '<div class="elv-modal-box" dir="rtl">' +
      '<div class="elv-modal-head"><h3><i class="fas fa-video"></i> <span id="elv-live-title">إضافة ورشة مباشرة</span></h3>' +
      '<button type="button" class="elv-x" onclick="ElevateLive.close()">&times;</button></div>' +
      '<p class="elv-hint">بيانات الورشة المباشرة فقط — هتظهر كبطاقة بزرار «دخول للورشة».</p>' +
      '<form id="elv-live-form">' +
      '<input type="hidden" name="id">' +
      '<label>اسم الورشة *</label><input required name="name" type="text" placeholder="مثال: ورشة تصميم واجهات">' +
      '<label>التصنيف *</label><input required name="category" type="text" placeholder="مثال: تصميم / برمجة / تسويق">' +
      '<label>الصورة الخارجية (رابط)</label><input name="imgOuter" type="url" dir="ltr" placeholder="https://...">' +
      '<label>صورة صفحة الورشة (رابط)</label><input name="imgInner" type="url" dir="ltr" placeholder="https://...">' +
      '<label>اسم المحاضر *</label><input required name="lecturer" type="text" placeholder="مثال: أحمد محمد">' +
      '<label>تاريخ الميت *</label><input required name="workshopDate" type="date">' +
      '<label>وقت الميت *</label><input required name="workshopTime" type="time">' +
      '<label>هاشتاجات</label><input name="tags" type="text" placeholder="تصميم, UX, مجاني">' +
      '<label>رابط جوجل ميت *</label><input required name="meetLink" type="url" dir="ltr" placeholder="https://meet.google.com/abc-defg-hij">' +
      '<label>لينك تسجيل المحاضرة</label><input name="recordLink" type="url" dir="ltr" placeholder="https://youtu.be/... أو رابط فيديو">' +
      '<button class="elv-btn" type="submit"><i class="fas fa-save"></i> حفظ الورشة</button>' +
      "</form></div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) close();
    });
    document.getElementById("elv-live-form").addEventListener("submit", save);
  }

  function open(card) {
    ensureModal();
    var f = document.getElementById("elv-live-form");
    f.reset();
    f.id.value = card ? card.id : "";
    document.getElementById("elv-live-title").textContent = card
      ? "تعديل الورشة المباشرة"
      : "إضافة ورشة مباشرة";
    if (card) {
      f.name.value = card.name || "";
      f.category.value = card.category || "";
      f.imgOuter.value = card.imgOuter || "";
      f.imgInner.value = card.imgInner || "";
      f.lecturer.value = card.lecturer || "";
      f.workshopDate.value = card.workshopDate || "";
      f.workshopTime.value = card.workshopTime || "";
      f.tags.value = card.tags || "";
      f.meetLink.value = card.meetLink || "";
      f.recordLink.value = card.recordLink || "";
    }
    document.getElementById("elv-live-modal").classList.add("open");
  }
  function close() {
    var m = document.getElementById("elv-live-modal");
    if (m) m.classList.remove("open");
  }

  function save(e) {
    e.preventDefault();
    var f = e.target;
    var link = f.meetLink.value.trim();
    if (!isWorkingMeetLink(link)) {
      alert("رابط الاجتماع غير صحيح. مثال صحيح: https://meet.google.com/abc-defg-hij");
      return;
    }
    var cards = read(K_CARDS, []);
    if (!Array.isArray(cards)) cards = [];
    var id = f.id.value || Date.now().toString();
    var card = {
      id: id,
      type: "live",
      name: f.name.value.trim(),
      category: f.category.value.trim(),
      imgOuter: f.imgOuter.value.trim(),
      imgInner: f.imgInner.value.trim(),
      lecturer: f.lecturer.value.trim(),
      tags: f.tags.value.trim(),
      workshopDate: f.workshopDate.value,
      workshopTime: f.workshopTime.value,
      meetLink: link,
      recordLink: f.recordLink.value.trim(),
      deadline: f.workshopDate.value,
      description:
        "ورشة مباشرة عبر جوجل ميت" +
        (f.lecturer.value.trim() ? " مع " + f.lecturer.value.trim() : ""),
      status: "visible",
      isFeatured: false,
      noDeadline: false,
      noDates: false,
      openNow: false,
      isLive: true,
    };
    var idx = -1;
    for (var i = 0; i < cards.length; i++) if (String(cards[i].id) === String(id)) idx = i;
    if (idx > -1) cards[idx] = Object.assign({}, cards[idx], card);
    else cards.push(card);
    write(K_CARDS, cards);
    close();
    try {
      if (window.Admin && document.getElementById("admin-manage-list")) Admin.init();
      if (window.App) {
        App.renderOpportunities();
        App.updateHomeStats();
      }
    } catch (err) {}
    setTimeout(decorate, 200);
    alert("تم حفظ الورشة المباشرة بنجاح!");
  }

  /* ============ ربط لوحة المدير ============ */
  function hook() {
    if (!window.Admin || Admin.__elvLiveHooked) return !!(window.Admin && Admin.__elvLiveHooked);
    Admin.__elvLiveHooked = true;

    var origOpen = Admin.openModal;
    Admin.openModal = function (categoryId) {
      if (categoryId === "live") {
        open(null);
        return;
      }
      return origOpen.apply(this, arguments);
    };

    if (typeof Admin.editOpp === "function") {
      var origEdit = Admin.editOpp;
      Admin.editOpp = function (id) {
        var c = getCard(id);
        if (c && c.type === "live") {
          open(c);
          return;
        }
        return origEdit.apply(this, arguments);
      };
    }

    if (window.App && typeof App.renderOpportunities === "function" && !App.__elvLiveHooked) {
      App.__elvLiveHooked = true;
      var origRender = App.renderOpportunities;
      App.renderOpportunities = function () {
        var r = origRender.apply(this, arguments);
        try {
          decorate();
        } catch (err) {}
        return r;
      };
    }
    return true;
  }

  function injectStyles() {
    if (document.getElementById("elv-live-styles")) return;
    var st = document.createElement("style");
    st.id = "elv-live-styles";
    st.textContent = [
      ".elv-live-card .opp-card-header-img{position:relative}",
      ".elv-live-joins{position:absolute;bottom:10px;inset-inline-start:10px;z-index:3;display:inline-flex;align-items:center;gap:6px;",
      "font-size:.75rem;font-weight:800;color:#fff;padding:6px 12px;border-radius:999px;",
      "background:rgba(2,6,23,.72);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.16)}",
      ".elv-live-joins i{color:#f87171;font-size:.72rem}",
      ".elv-live-joins-num{color:#fca5a5}",
      ".elv-live-lect{font-size:.82rem;font-weight:700;color:#fca5a5;margin:2px 0 6px;display:flex;align-items:center;gap:6px}",
      ".opp-view-btn.elv-live-join{background:linear-gradient(135deg,#ef4444,#dc2626) !important;color:#fff !important;",
      "border:0 !important;box-shadow:0 10px 24px -10px rgba(239,68,68,.7)}",
      ".opp-view-btn.elv-live-rec{background:rgba(255,255,255,.08) !important;color:#e2e8f0 !important;border:1px solid rgba(255,255,255,.18) !important}",
      ".opp-view-btn.elv-live-join:hover,.opp-view-btn.elv-live-rec:hover{transform:translateY(-1px)}",
      ".elv-room-box{max-width:960px;width:96%}",
      ".elv-room-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:.85rem;color:#cbd5e1;margin:6px 0 12px}",
      ".elv-room-meta i{color:#f87171;margin-inline-end:4px}",
      ".elv-room-stage{position:relative;background:#020617;border:1px solid rgba(255,255,255,.1);border-radius:14px;overflow:hidden;aspect-ratio:16/9}",
      ".elv-room-stage iframe{width:100%;height:100%;border:0}",
      ".elv-room-stage img{width:100%;height:100%;object-fit:cover;display:block}",
      ".elv-room-fallback{position:absolute;inset:auto 0 0 0;background:rgba(2,6,23,.8);color:#cbd5e1;font-size:.8rem;padding:8px;text-align:center}",
      ".elv-room-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}",
      ".elv-room-actions .elv-btn{width:auto;padding:10px 16px;text-decoration:none;display:inline-flex;align-items:center;gap:8px}",
      ".elv-btn-rec{background:rgba(255,255,255,.08) !important;border:1px solid rgba(255,255,255,.18) !important}",
      ".elv-room-comments-wrap h4{margin:8px 0;color:#c4b5fd;font-size:1rem}",
      "#elv-room-comments{max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:8px}",
      ".elv-room-comment{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px}",
      ".elv-room-comment b{color:#e2e8f0;font-size:.85rem}",
      ".elv-room-comment span{color:#64748b;font-size:.7rem;margin-inline-start:8px}",
      ".elv-room-comment p{margin:6px 0 0;color:#cbd5e1;font-size:.88rem}",
      ".elv-room-empty{color:#64748b;font-size:.85rem;text-align:center;padding:14px}",
      ".elv-room-add{display:flex;gap:8px;margin-top:10px}",
      ".elv-room-add input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#e2e8f0;border-radius:10px;padding:10px}",
      ".elv-room-add .elv-btn{width:auto;padding:10px 18px}",
      ".elv-player-box{max-width:900px;width:94%}",
      ".elv-player-stage{background:#000;border-radius:14px;overflow:hidden;aspect-ratio:16/9}",
      ".elv-player-stage iframe,.elv-player-stage video{width:100%;height:100%;border:0;display:block}",
    ].join("");
    document.head.appendChild(st);
  }

  function boot() {
    injectStyles();
    hook();
    decorate();
  }

  window.ElevateLive = {
    open: open,
    close: close,
    join: openRoom,
    openRoom: openRoom,
    closeRoom: closeRoom,
    playRecord: playRecord,
    closePlayer: closePlayer,
    comment: addRoomComment,
    refresh: boot,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(boot, 90);
    });
  } else {
    setTimeout(boot, 90);
  }
  setInterval(function () {
    try {
      hook();
      decorate();
    } catch (e) {}
  }, 10000);
})();
