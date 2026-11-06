/* Elevate — قسم الفيديوهات (videos)
   - نموذج المدير: اسم الفيديو / الهاشتاج (كورسات، فيديوهات..) / الصورة الخارجية والداخلية / تابع لمين (قناة/جهة) / لينك الفيديو / وصف
   - أعلى القسم: شرائط هاشتاجات للتصفية
   - البطاقة بزرار «شاهد الفيديو» + عدد المشاهدات
   - صفحة الفيديو: المشغّل + لايك + مشاهدات + البيانات + الوصف + تعليقات
   كل البيانات بتتخزن في قاعدة البيانات عبر db-sync. */
(function () {
  var K_CARDS = "luxen_general_cards";
  var K_LIKES = "luxen_video_likes";
  var K_VIEWS = "luxen_video_views";
  var K_COMMENTS = "luxen_comments";
  var DEFAULT_TAGS = ["كورسات", "فيديوهات", "محاضرات", "شروحات"];
  var activeTag = "all";

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
  function viewerId() {
    var u = user();
    if (u && (u.username || u.email)) return u.username || u.email;
    var id = localStorage.getItem("elevate_voter_id");
    if (!id) {
      id = "guest_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("elevate_voter_id", id);
    }
    return id;
  }
  function objStore(key) {
    var j = read(key, {});
    return j && typeof j === "object" && !Array.isArray(j) ? j : {};
  }
  function isVideoPage() {
    try {
      return new URLSearchParams(location.search).get("category") === "videos";
    } catch (e) {
      return false;
    }
  }

  /* ============ تحويل لينك الفيديو لمشغّل ============ */
  function embed(link) {
    var v = String(link || "").trim();
    if (!v) return "";
    try {
      var u = new URL(v);
      var host = u.hostname
        .replace(/^www\./, "")
        .replace(/^m\./, "")
        .toLowerCase();
      var id;
      if (host === "youtu.be") {
        id = u.pathname.slice(1);
        return (
          '<iframe src="https://www.youtube.com/embed/' +
          esc(id) +
          '" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>'
        );
      }
      if (host.indexOf("youtube.com") > -1) {
        id = u.searchParams.get("v");
        if (!id && /^\/(embed|shorts|live)\//.test(u.pathname)) id = u.pathname.split("/")[2];
        if (id)
          return (
            '<iframe src="https://www.youtube.com/embed/' +
            esc(id) +
            '" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>'
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
      if (host.indexOf("facebook.com") > -1 || host === "fb.watch") {
        return (
          '<iframe src="https://www.facebook.com/plugins/video.php?href=' +
          encodeURIComponent(v) +
          '&show_text=false" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>'
        );
      }
      if (host.indexOf("tiktok.com") > -1) {
        var tm = u.pathname.match(/\/video\/(\d+)/);
        if (tm)
          return (
            '<iframe src="https://www.tiktok.com/embed/v2/' +
            esc(tm[1]) +
            '" allowfullscreen></iframe>'
          );
      }
      if (/\.(mp4|webm|ogg|m4v|mov)$/i.test(u.pathname)) {
        return '<video src="' + esc(v) + '" controls playsinline></video>';
      }
      return '<iframe src="' + esc(v) + '" allowfullscreen></iframe>';
    } catch (e) {
      return "";
    }
  }

  /* ============ مشاهدات ولايكات ============ */
  function viewCount(id) {
    var l = objStore(K_VIEWS)[id];
    return Array.isArray(l) ? l.length : 0;
  }
  function recordView(id) {
    var all = objStore(K_VIEWS);
    var list = Array.isArray(all[id]) ? all[id] : [];
    var me = viewerId();
    if (list.indexOf(me) === -1) {
      list.push(me);
      all[id] = list;
      write(K_VIEWS, all);
    }
    return list.length;
  }
  function likeCount(id) {
    var l = objStore(K_LIKES)[id];
    return Array.isArray(l) ? l.length : 0;
  }
  function liked(id) {
    var l = objStore(K_LIKES)[id];
    return Array.isArray(l) && l.indexOf(viewerId()) !== -1;
  }
  function toggleLike(id) {
    var all = objStore(K_LIKES);
    var list = Array.isArray(all[id]) ? all[id] : [];
    var me = viewerId();
    var i = list.indexOf(me);
    if (i === -1) list.push(me);
    else list.splice(i, 1);
    all[id] = list;
    write(K_LIKES, all);
    var btn = document.getElementById("elv-vid-like");
    if (btn) {
      btn.classList.toggle("liked", i === -1);
      btn.innerHTML =
        (i === -1 ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>') +
        " <span>" +
        list.length +
        "</span> إعجاب";
    }
  }

  function getCard(id) {
    var cards = read(K_CARDS, []);
    if (!Array.isArray(cards)) return null;
    for (var i = 0; i < cards.length; i++) if (String(cards[i].id) === String(id)) return cards[i];
    return null;
  }
  function allVideos() {
    var cards = read(K_CARDS, []);
    return Array.isArray(cards)
      ? cards.filter(function (c) {
          return c.type === "videos";
        })
      : [];
  }
  function tagsOf(c) {
    var out = [];
    if (c.kind) out.push(String(c.kind).trim());
    String(c.tags || "")
      .split(/[,\s،#]+/)
      .forEach(function (t) {
        t = t.trim();
        if (t && out.indexOf(t) === -1) out.push(t);
      });
    return out;
  }

  /* ============ التعليقات ============ */
  function commentsOf(id) {
    var all = read(K_COMMENTS, []);
    if (!Array.isArray(all)) return [];
    return all.filter(function (c) {
      return String(c.cardId) === String(id);
    });
  }
  function renderComments(id) {
    var box = document.getElementById("elv-vid-comments");
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
  function addComment(id) {
    var input = document.getElementById("elv-vid-comment-input");
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
    renderComments(id);
  }

  /* ============ صفحة الفيديو ============ */
  function ensureWatch() {
    if (document.getElementById("elv-vid-watch")) return;
    var wrap = document.createElement("div");
    wrap.id = "elv-vid-watch";
    wrap.className = "elv-modal";
    wrap.innerHTML =
      '<div class="elv-modal-box elv-watch-box" dir="rtl"><div id="elv-vid-body"></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) closeWatch();
    });
  }
  function closeWatch() {
    var m = document.getElementById("elv-vid-watch");
    if (m) {
      m.classList.remove("open");
      var b = document.getElementById("elv-vid-body");
      if (b) b.innerHTML = "";
    }
  }
  function watch(id) {
    var c = getCard(id);
    if (!c) return;
    ensureWatch();
    var n = recordView(id);
    var badge = document.querySelector('.elv-vid-views[data-id="' + id + '"] .elv-vid-views-num');
    if (badge) badge.textContent = n;
    var isLiked = liked(id);
    var desc = esc(c.description || "").replace(/\n/g, "<br>");
    var player = embed(c.videoLink);

    document.getElementById("elv-vid-body").innerHTML =
      '<div class="elv-modal-head"><h3><i class="fas fa-clapperboard"></i> ' +
      esc(c.name || "فيديو") +
      "</h3>" +
      '<button type="button" class="elv-x" onclick="ElevateVideos.closeWatch()">&times;</button></div>' +
      '<div class="elv-watch-stage">' +
      (player ||
        (c.imgInner
          ? '<img src="' + esc(c.imgInner) + '" alt="">'
          : '<div class="elv-room-fallback">لا يوجد فيديو.</div>')) +
      "</div>" +
      '<div class="elv-watch-bar">' +
      '<button id="elv-vid-like" type="button" class="elv-like-btn' +
      (isLiked ? " liked" : "") +
      '" onclick="ElevateVideos.like(\'' +
      esc(id) +
      "')\">" +
      (isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>') +
      " <span>" +
      likeCount(id) +
      "</span> إعجاب</button>" +
      '<span class="elv-watch-stat"><i class="fas fa-eye"></i> ' +
      n +
      " مشاهدة</span>" +
      (c.videoLink
        ? '<a class="elv-btn elv-open-ext" target="_blank" rel="noopener" href="' +
          esc(c.videoLink) +
          '"><i class="fas fa-up-right-from-square"></i> فتح في صفحة جديدة</a>'
        : "") +
      "</div>" +
      '<div class="elv-watch-info">' +
      "<h4>" +
      esc(c.name || "") +
      "</h4>" +
      '<div class="elv-watch-meta">' +
      (c.category
        ? '<span><i class="fas fa-building"></i> تابع لـ: ' + esc(c.category) + "</span>"
        : "") +
      tagsOf(c)
        .map(function (t) {
          return '<span class="elv-watch-tag">#' + esc(t) + "</span>";
        })
        .join("") +
      "</div>" +
      (desc ? '<div class="elv-watch-desc">' + desc + "</div>" : "") +
      "</div>" +
      '<div class="elv-room-comments-wrap"><h4><i class="fas fa-comments"></i> التعليقات</h4>' +
      '<div id="elv-vid-comments"></div>' +
      '<div class="elv-room-add"><input id="elv-vid-comment-input" type="text" placeholder="اكتب تعليقك..."><button class="elv-btn" type="button" onclick="ElevateVideos.comment(\'' +
      esc(id) +
      "')\">إرسال</button></div>" +
      "</div>";
    renderComments(id);
    document.getElementById("elv-vid-watch").classList.add("open");
  }

  /* ============ شريط الهاشتاجات أعلى القسم ============ */
  function renderTagBar() {
    var old = document.getElementById("elv-vid-tagbar");
    if (!isVideoPage()) {
      if (old) old.remove();
      return;
    }
    var container = document.getElementById("opp-cards-container");
    if (!container) return;
    var tags = DEFAULT_TAGS.slice();
    allVideos().forEach(function (c) {
      tagsOf(c).forEach(function (t) {
        if (tags.indexOf(t) === -1) tags.push(t);
      });
    });
    var bar = old || document.createElement("div");
    bar.id = "elv-vid-tagbar";
    bar.setAttribute("dir", "rtl");
    bar.innerHTML = ["all"]
      .concat(tags)
      .map(function (t) {
        return (
          '<button type="button" class="elv-tag-chip' +
          (activeTag === t ? " active" : "") +
          '" data-tag="' +
          esc(t) +
          '">' +
          (t === "all" ? '<i class="fas fa-layer-group"></i> الكل' : "#" + esc(t)) +
          "</button>"
        );
      })
      .join("");
    if (!old) container.parentNode.insertBefore(bar, container);
    Array.prototype.forEach.call(bar.querySelectorAll(".elv-tag-chip"), function (b) {
      b.onclick = function () {
        activeTag = b.getAttribute("data-tag");
        renderTagBar();
        applyFilter();
      };
    });
  }
  function applyFilter() {
    if (!isVideoPage()) return;
    var cards = document.querySelectorAll('.opp-card[data-category="videos"]');
    var visible = 0;
    Array.prototype.forEach.call(cards, function (card) {
      var data = getCard(card.getAttribute("data-id"));
      var ok = activeTag === "all" || (data && tagsOf(data).indexOf(activeTag) !== -1);
      card.style.display = ok ? "flex" : "none";
      if (ok) visible++;
    });
    var msg = document.getElementById("no-opps-msg");
    if (msg) msg.style.display = visible === 0 ? "block" : "none";
  }

  /* ============ تزيين بطاقات الفيديوهات ============ */
  function decorate() {
    var cards = document.querySelectorAll('.opp-card[data-category="videos"]');
    Array.prototype.forEach.call(cards, function (card) {
      var id = card.getAttribute("data-id");
      if (!id) return;
      var data = getCard(id);
      if (!data) return;
      card.classList.add("elv-vid-card");

      var oldBadge = card.querySelector(".elv-vid-views");
      if (oldBadge) oldBadge.remove();
      var badge = document.createElement("div");
      badge.className = "elv-vid-views";
      badge.setAttribute("data-id", id);
      badge.innerHTML =
        '<i class="fas fa-eye"></i> <span class="elv-vid-views-num">' +
        viewCount(id) +
        "</span> مشاهدة";
      (card.querySelector(".opp-card-header-img") || card).appendChild(badge);

      var dateEl = card.querySelector(".opp-date-info");
      if (dateEl)
        dateEl.innerHTML =
          '<span><i class="fas fa-heart" style="color:#f87171"></i> ' +
          likeCount(id) +
          " إعجاب</span>" +
          (data.kind ? ' <span class="elv-vid-kind">#' + esc(data.kind) + "</span>" : "");

      var viewBtn = card.querySelector(".opp-view-btn:not(.elv-vid-watch-btn)");
      if (viewBtn) {
        var btn = document.createElement("button");
        btn.className = "opp-view-btn elv-vid-watch-btn";
        btn.innerHTML = '<i class="fas fa-play"></i> <span>شاهد الفيديو</span>';
        btn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          watch(id);
        };
        viewBtn.parentNode.replaceChild(btn, viewBtn);
      }
    });
    renderTagBar();
    applyFilter();
  }

  /* ============ نموذج المدير ============ */
  function ensureModal() {
    if (document.getElementById("elv-vid-modal")) return;
    var wrap = document.createElement("div");
    wrap.id = "elv-vid-modal";
    wrap.className = "elv-modal";
    wrap.innerHTML =
      '<div class="elv-modal-box" dir="rtl">' +
      '<div class="elv-modal-head"><h3><i class="fas fa-clapperboard"></i> <span id="elv-vid-title">إضافة فيديو</span></h3>' +
      '<button type="button" class="elv-x" onclick="ElevateVideos.close()">&times;</button></div>' +
      '<p class="elv-hint">هيظهر في قسم «فيديوهات» كبطاقة بزرار «شاهد الفيديو».</p>' +
      '<form id="elv-vid-form">' +
      '<input type="hidden" name="id">' +
      '<label>اسم الكورس / الفيديو *</label><input required name="name" type="text" placeholder="مثال: كورس أساسيات البرمجة">' +
      '<label>الهاشتاج الرئيسي *</label><input required name="kind" type="text" list="elv-vid-kinds" placeholder="كورسات / فيديوهات / محاضرات">' +
      '<datalist id="elv-vid-kinds">' +
      DEFAULT_TAGS.map(function (t) {
        return '<option value="' + esc(t) + '">';
      }).join("") +
      "</datalist>" +
      '<label>تابع لمين (قناة / جهة) *</label><input required name="category" type="text" placeholder="مثال: قناة Elevate">' +
      '<label>الصورة الخارجية (رابط)</label><input name="imgOuter" type="url" dir="ltr" placeholder="https://...">' +
      '<label>الصورة الداخلية (رابط)</label><input name="imgInner" type="url" dir="ltr" placeholder="https://...">' +
      '<label>لينك الفيديو * (يوتيوب / فيسبوك / درايف / أي لينك)</label><input required name="videoLink" type="url" dir="ltr" placeholder="https://youtu.be/...">' +
      '<label>هاشتاجات إضافية</label><input name="tags" type="text" placeholder="برمجة, مجاني, مبتدئين">' +
      '<label>وصف الفيديو</label><textarea name="description" rows="4" placeholder="اكتب وصف الفيديو..."></textarea>' +
      '<button class="elv-btn" type="submit"><i class="fas fa-save"></i> حفظ الفيديو</button>' +
      "</form></div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) close();
    });
    document.getElementById("elv-vid-form").addEventListener("submit", save);
  }
  function open(card) {
    ensureModal();
    var f = document.getElementById("elv-vid-form");
    f.reset();
    f.id.value = card ? card.id : "";
    document.getElementById("elv-vid-title").textContent = card ? "تعديل الفيديو" : "إضافة فيديو";
    if (card) {
      f.name.value = card.name || "";
      f.kind.value = card.kind || "";
      f.category.value = card.category || "";
      f.imgOuter.value = card.imgOuter || "";
      f.imgInner.value = card.imgInner || "";
      f.videoLink.value = card.videoLink || "";
      f.tags.value = card.tags || "";
      f.description.value = card.description || "";
    }
    document.getElementById("elv-vid-modal").classList.add("open");
  }
  function close() {
    var m = document.getElementById("elv-vid-modal");
    if (m) m.classList.remove("open");
  }

  function save(e) {
    e.preventDefault();
    var f = e.target;
    var cards = read(K_CARDS, []);
    if (!Array.isArray(cards)) cards = [];
    var id = f.id.value || Date.now().toString();
    var card = {
      id: id,
      type: "videos",
      name: f.name.value.trim(),
      kind: f.kind.value.trim(),
      category: f.category.value.trim(),
      imgOuter: f.imgOuter.value.trim(),
      imgInner: f.imgInner.value.trim(),
      videoLink: f.videoLink.value.trim(),
      tags: f.tags.value.trim(),
      description: f.description.value.trim(),
      deadline: "",
      noDeadline: true,
      noDates: true,
      openNow: false,
      status: "visible",
      isFeatured: false,
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
    alert("تم حفظ الفيديو بنجاح!");
  }

  /* ============ ربط لوحة المدير ============ */
  function hook() {
    if (!window.Admin || Admin.__elvVidHooked) return;
    Admin.__elvVidHooked = true;
    var origOpen = Admin.openModal;
    Admin.openModal = function (categoryId) {
      if (categoryId === "videos") {
        open(null);
        return;
      }
      return origOpen.apply(this, arguments);
    };
    if (typeof Admin.editOpp === "function") {
      var origEdit = Admin.editOpp;
      Admin.editOpp = function (id) {
        var c = getCard(id);
        if (c && c.type === "videos") {
          open(c);
          return;
        }
        return origEdit.apply(this, arguments);
      };
    }
    if (window.App && typeof App.renderOpportunities === "function" && !App.__elvVidHooked) {
      App.__elvVidHooked = true;
      var origRender = App.renderOpportunities;
      App.renderOpportunities = function () {
        var r = origRender.apply(this, arguments);
        try {
          decorate();
        } catch (err) {}
        return r;
      };
    }
  }

  function injectStyles() {
    if (document.getElementById("elv-vid-styles")) return;
    var st = document.createElement("style");
    st.id = "elv-vid-styles";
    st.textContent = [
      "#elv-vid-tagbar{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 24px}",
      ".elv-tag-chip{border:1px solid var(--border-color,rgba(255,255,255,.15));background:var(--bg-card,rgba(255,255,255,.05));color:var(--text-primary,#e2e8f0);",
      "padding:9px 18px;border-radius:999px;font:inherit;font-weight:800;font-size:.88rem;cursor:pointer;transition:.2s}",
      ".elv-tag-chip:hover{transform:translateY(-1px);border-color:#f59e0b}",
      ".elv-tag-chip.active{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-color:transparent;box-shadow:0 10px 24px -12px rgba(245,158,11,.8)}",
      ".elv-vid-card .opp-card-header-img{position:relative}",
      ".elv-vid-views{position:absolute;bottom:10px;inset-inline-start:10px;z-index:3;display:inline-flex;align-items:center;gap:6px;",
      "font-size:.75rem;font-weight:800;color:#fff;padding:6px 12px;border-radius:999px;background:rgba(2,6,23,.72);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.16)}",
      ".elv-vid-views i{color:#fbbf24;font-size:.72rem}.elv-vid-views-num{color:#fde68a}",
      ".elv-vid-kind{color:#fbbf24;font-weight:800;margin-inline-start:8px}",
      ".opp-view-btn.elv-vid-watch-btn{background:linear-gradient(135deg,#f59e0b,#d97706) !important;color:#fff !important;border:0 !important;box-shadow:0 10px 24px -10px rgba(245,158,11,.7)}",
      ".opp-view-btn.elv-vid-watch-btn:hover{transform:translateY(-1px)}",
      ".elv-watch-box{max-width:960px;width:96%}",
      ".elv-watch-stage{background:#000;border:1px solid rgba(255,255,255,.1);border-radius:14px;overflow:hidden;aspect-ratio:16/9;position:relative}",
      ".elv-watch-stage iframe,.elv-watch-stage video{width:100%;height:100%;border:0;display:block}",
      ".elv-watch-stage img{width:100%;height:100%;object-fit:cover;display:block}",
      ".elv-watch-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:14px 0}",
      ".elv-like-btn{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#e2e8f0;",
      "padding:10px 18px;border-radius:999px;font:inherit;font-weight:800;cursor:pointer;transition:.2s}",
      ".elv-like-btn i{color:#f87171}.elv-like-btn.liked{background:rgba(239,68,68,.18);border-color:#ef4444}",
      ".elv-like-btn:hover{transform:translateY(-1px)}",
      ".elv-watch-stat{color:#cbd5e1;font-weight:700;font-size:.9rem}.elv-watch-stat i{color:#fbbf24;margin-inline-end:4px}",
      ".elv-open-ext{width:auto !important;padding:10px 16px !important;text-decoration:none;display:inline-flex;align-items:center;gap:8px;margin-inline-start:auto}",
      ".elv-watch-info{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;margin-bottom:14px}",
      ".elv-watch-info h4{margin:0 0 8px;color:#fff;font-size:1.1rem}",
      ".elv-watch-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:.85rem;color:#cbd5e1}",
      ".elv-watch-meta i{color:#fbbf24;margin-inline-end:4px}",
      ".elv-watch-tag{color:#fbbf24;font-weight:800}",
      ".elv-watch-desc{margin-top:10px;color:#cbd5e1;font-size:.92rem;line-height:1.8;white-space:pre-wrap}",
      ".elv-room-comments-wrap h4{margin:8px 0;color:#c4b5fd;font-size:1rem}",
      "#elv-vid-comments{max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:8px}",
      "#elv-vid-form textarea{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#e2e8f0;border-radius:10px;padding:10px;font:inherit;resize:vertical;margin-bottom:12px}",
    ].join("");
    document.head.appendChild(st);
  }

  function boot() {
    injectStyles();
    hook();
    decorate();
  }

  window.ElevateVideos = {
    open: open,
    close: close,
    watch: watch,
    closeWatch: closeWatch,
    like: toggleLike,
    comment: addComment,
    filter: function (t) {
      activeTag = t || "all";
      renderTagBar();
      applyFilter();
    },
    refresh: boot,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(boot, 120);
    });
  } else {
    setTimeout(boot, 120);
  }
  setInterval(function () {
    try {
      hook();
      decorate();
    } catch (e) {}
  }, 10000);
})();
