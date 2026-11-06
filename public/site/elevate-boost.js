/* Elevate Boost — card stats (views/likes/comments), deadline countdown, share,
   daily tip for youth, back-to-top, and brand logo. Read-only on stored data. */
(function () {
  "use strict";
  function read(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k) || "") || d;
    } catch (e) {
      return d;
    }
  }
  function fmt(n) {
    return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n);
  }

  function stats(id) {
    var views = read("luxen_views", {}),
      likes = read("luxen_likes", {}),
      comments = read("luxen_comments", []);
    var v = Array.isArray(views[id]) ? views[id].length : 0;
    var l = Array.isArray(likes[id]) ? likes[id].length : 0;
    var c = Array.isArray(comments)
      ? comments.filter(function (x) {
          return x && String(x.cardId) === String(id);
        }).length
      : 0;
    return { v: v, l: l, c: c };
  }

  function daysLeft(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d)) return null;
    return Math.ceil((d - new Date()) / 86400000);
  }

  function statsHTML(s) {
    return (
      '<span title="مشاهدات"><i class="fa-regular fa-eye"></i> ' +
      fmt(s.v) +
      "</span>" +
      '<span title="إعجابات"><i class="fa-solid fa-heart"></i> ' +
      fmt(s.l) +
      "</span>" +
      '<span title="تعليقات"><i class="fa-regular fa-comment"></i> ' +
      fmt(s.c) +
      "</span>"
    );
  }

  function enhanceCards() {
    document.querySelectorAll(".opp-card[data-id]").forEach(function (card) {
      var id = card.getAttribute("data-id");
      var s = stats(id);
      var sig = s.v + "-" + s.l + "-" + s.c;
      var body = card.querySelector(".opp-card-body");
      if (!body) return;
      var bar = card.querySelector(".eb-stats");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "eb-stats";
        var footer = body.querySelector(".opp-card-footer");
        body.insertBefore(bar, footer);
        var share = document.createElement("button");
        share.className = "eb-share";
        share.type = "button";
        share.title = "مشاركة الفرصة";
        share.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
        share.addEventListener("click", function (e) {
          e.stopPropagation();
          shareCard(id, card.getAttribute("data-title"));
        });
        bar.appendChild(document.createElement("div")).className = "eb-nums";
        bar.appendChild(share);
      }
      if (bar.getAttribute("data-sig") !== sig) {
        bar.querySelector(".eb-nums").innerHTML = statsHTML(s);
        bar.setAttribute("data-sig", sig);
      }
      if (!card.querySelector(".eb-countdown") && card.getAttribute("data-expired") !== "1") {
        var left = daysLeft(card.getAttribute("data-date"));
        if (left !== null && left >= 0) {
          var b = document.createElement("div");
          b.className = "eb-countdown" + (left <= 7 ? " urgent" : "");
          b.innerHTML =
            '<i class="fa-regular fa-clock"></i> ' +
            (left === 0 ? "آخر يوم!" : "باقي " + left + " يوم");
          var head = card.querySelector(".opp-card-header-img");
          if (head) head.appendChild(b);
        }
      }
    });
  }

  function enhanceDetail() {
    var id = new URLSearchParams(location.search).get("id");
    var likeBtn = document.getElementById("like-btn");
    if (!id || !likeBtn) return;
    var box = document.getElementById("eb-detail-stats");
    if (!box) {
      box = document.createElement("div");
      box.id = "eb-detail-stats";
      box.className = "eb-stats eb-detail";
      likeBtn.parentNode.insertBefore(box, likeBtn);
    }
    var s = stats(id),
      sig = s.v + "-" + s.l + "-" + s.c;
    if (box.getAttribute("data-sig") !== sig) {
      box.innerHTML = '<div class="eb-nums">' + statsHTML(s) + "</div>";
      box.setAttribute("data-sig", sig);
    }
  }

  function shareCard(id, title) {
    var url = location.origin + location.pathname + "?id=" + encodeURIComponent(id);
    var text = (title || "فرصة") + " — على Elevate";
    if (navigator.share) {
      navigator.share({ title: text, url: url }).catch(function () {});
      return;
    }
    try {
      navigator.clipboard.writeText(url);
      toast("تم نسخ رابط الفرصة ✓");
    } catch (e) {
      window.open("https://wa.me/?text=" + encodeURIComponent(text + " " + url));
    }
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "eb-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () {
      t.classList.add("show");
    }, 10);
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () {
        t.remove();
      }, 400);
    }, 2200);
  }

  var TIPS = [
    "اكتب سيرتك الذاتية في صفحة واحدة وركّز على إنجازاتك بالأرقام.",
    "قدّم على الفرصة قبل آخر موعد بأيام — المتأخرون بيخسروا كتير.",
    "خصّص 30 دقيقة يومياً لتعلّم مهارة جديدة، الاستمرار أهم من الكمية.",
    "التطوع بيبني خبرة وعلاقات حقيقية، ابدأ بأي فرصة قريبة منك.",
    "جهّز خطاب تحفيزي عام وعدّله لكل فرصة بدل ما تكتب من الصفر.",
    "اعمل حساب LinkedIn محترف وتواصل مع ناس في مجالك.",
    "الرفض مش نهاية — كل تقديم بيعلّمك حاجة للمرة الجاية.",
    "اسأل اللي سبقوك: خبرة شخص واحد ممكن توفر عليك شهور.",
    "نظّم مواعيد التقديم في تقويم واحد عشان ما تفوتكش فرصة.",
    "المسابقات فرصة ممتازة تبني بيها بورتفوليو حتى لو ما كسبتش.",
  ];

  function tipWidget() {
    if (document.getElementById("eb-tip")) return;
    try {
      if (sessionStorage.getItem("eb_tip_closed") === "1") return;
    } catch (e) {}
    var i = Math.floor(Date.now() / 86400000) % TIPS.length;
    var el = document.createElement("div");
    el.id = "eb-tip";
    el.innerHTML =
      '<div class="eb-tip-ic"><i class="fa-solid fa-lightbulb"></i></div>' +
      '<div class="eb-tip-tx"><b>نصيحة اليوم</b><p></p></div>' +
      '<button type="button" class="eb-tip-next" title="نصيحة أخرى"><i class="fa-solid fa-rotate"></i></button>' +
      '<button type="button" class="eb-tip-x" title="إغلاق">✕</button>';
    el.querySelector("p").textContent = TIPS[i];
    el.querySelector(".eb-tip-next").onclick = function () {
      i = (i + 1) % TIPS.length;
      el.querySelector("p").textContent = TIPS[i];
    };
    el.querySelector(".eb-tip-x").onclick = function () {
      el.remove();
      try {
        sessionStorage.setItem("eb_tip_closed", "1");
      } catch (e) {}
    };
    document.body.appendChild(el);
  }

  function progressBar() {
    var bar = document.createElement("div");
    bar.id = "eb-progress";
    document.body.appendChild(bar);
    window.addEventListener(
      "scroll",
      function () {
        var h = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
      },
      { passive: true },
    );
  }

  function brandLogo() {
    document.querySelectorAll(".logo-icon-box").forEach(function (box) {
      if (box.querySelector("img")) return;
      box.innerHTML = '<img src="images/logo.png" alt="Elevate">';
      box.classList.add("eb-has-logo");
    });
  }

  function lights() {
    if (document.getElementById("eb-lights")) return;
    var l = document.createElement("div");
    l.id = "eb-lights";
    l.innerHTML = "<span></span><span></span><span></span>";
    document.body.prepend(l);
  }

  var pending = false;
  var tickTimer = null;
  function tick() {
    if (tickTimer) clearTimeout(tickTimer);
    tickTimer = setTimeout(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        enhanceCards();
        enhanceDetail();
      });
    }, 120);
  }

  function start() {
    lights();
    brandLogo();
    progressBar();
    tipWidget();
    tick();

    var targetNode = document.getElementById("opportunities-grid") || document.body;
    var observer = new MutationObserver(function (mutations) {
      var shouldTick = false;
      for (var i = 0; i < mutations.length; i++) {
        var target = mutations[i].target;
        if (target && target.closest && (target.closest(".eb-stats") || target.closest(".eb-countdown") || target.closest("#eb-lights"))) {
          continue;
        }
        shouldTick = true;
        break;
      }
      if (shouldTick) tick();
    });

    observer.observe(targetNode, { childList: true, subtree: true });
    window.addEventListener("storage", tick);
    setInterval(tick, 10000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
