/* Elevate — Student Hub
   Adds four student-focused sections to the home page:
   1) Deadline radar (countdown + calendar file + reminders)
   2) Free learning tracks with saved progress
   3) Application helper (instant motivation letter + CV bullets)
   4) Student Q&A board (shared through the site store)
   Pure vanilla JS, no extra dependencies, no layout rewrites. */
(function () {
  "use strict";

  var QNA_KEY = "luxen_qna";
  var REMIND_KEY = "ns_reminders";
  var TRACK_KEY = "ns_track_progress";

  /* ---------- small helpers ---------- */
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
  function loggedIn() {
    return !!user();
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
  function daysLeft(dateStr) {
    var end = new Date(dateStr + "T23:59:59").getTime();
    if (isNaN(end)) return null;
    return Math.ceil((end - Date.now()) / 86400000);
  }

  /* ---------- 1) deadline radar ---------- */
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

  function upcoming(limit) {
    var cards = readJSON("luxen_general_cards", []);
    if (!Array.isArray(cards)) return [];
    return cards
      .filter(function (c) {
        if (!c || c.partnerId || c.status === "hidden" || c.status === "soon") return false;
        if (c.noDeadline || c.noDates || !c.deadline) return false;
        var d = daysLeft(c.deadline);
        return d !== null && d >= 0 && d <= 60;
      })
      .sort(function (a, b) {
        return daysLeft(a.deadline) - daysLeft(b.deadline);
      })
      .slice(0, limit || 6);
  }

  function icsFor(card) {
    function stamp(dateStr) {
      return String(dateStr || "").replace(/-/g, "");
    }
    var end = new Date(card.deadline + "T00:00:00");
    end.setDate(end.getDate() + 1);
    var endStr = end.toISOString().slice(0, 10).replace(/-/g, "");
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Elevate//Opportunities//AR",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:elevate-" + (card.id || Date.now()) + "@elevate",
      "DTSTART;VALUE=DATE:" + stamp(card.deadline),
      "DTEND;VALUE=DATE:" + endStr,
      "SUMMARY:آخر موعد للتقديم — " + String(card.name || "فرصة").replace(/[\r\n]+/g, " "),
      "DESCRIPTION:" +
        String(card.description || "")
          .replace(/[\r\n]+/g, " ")
          .slice(0, 300),
      "BEGIN:VALARM",
      "TRIGGER:-P2D",
      "ACTION:DISPLAY",
      "DESCRIPTION:فاضل يومين على آخر موعد للتقديم",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return lines.join("\r\n");
  }

  function downloadCalendar(id) {
    var card = readJSON("luxen_general_cards", []).filter(function (c) {
      return String(c.id) === String(id);
    })[0];
    if (!card) return;
    var blob = new Blob([icsFor(card)], { type: "text/calendar;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "elevate-" +
      String(card.name || "opportunity")
        .slice(0, 30)
        .replace(/\s+/g, "-") +
      ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 4000);
    toast("تمت إضافة الموعد لتقويمك ✅");
  }

  function reminders() {
    var all = readJSON(REMIND_KEY, {});
    return all[userKey()] || [];
  }
  function setReminders(list) {
    var all = readJSON(REMIND_KEY, {});
    all[userKey()] = list;
    writeJSON(REMIND_KEY, all);
  }

  function toggleReminder(id, btn) {
    if (!loggedIn()) {
      toast("سجّل الدخول عشان نفكّرك بالمواعيد 🔔");
      window.location.href = "?view=login";
      return;
    }
    var list = reminders();
    var i = list.indexOf(String(id));
    if (i === -1) {
      list.push(String(id));
      toast("هنفكّرك قبل الميعاد بيومين 🔔");
    } else {
      list.splice(i, 1);
      toast("تم إلغاء التذكير");
    }
    setReminders(list);
    if (btn) paintReminderBtn(btn, list.indexOf(String(id)) !== -1);
  }
  function paintReminderBtn(btn, on) {
    btn.innerHTML = on
      ? '<i class="fas fa-bell"></i> التذكير مفعّل'
      : '<i class="far fa-bell"></i> فكّرني';
    btn.classList.toggle("sh-btn-main", on);
  }

  function renderDeadlines() {
    var box = document.getElementById("sh-deadline-grid");
    if (!box) return;
    var list = upcoming(6);
    if (!list.length) {
      box.innerHTML =
        '<div class="sh-empty">مفيش مواعيد قريبة دلوقتي — تابع الفرص الجديدة وهتلاقيها هنا أول بأول.</div>';
      return;
    }
    var mine = reminders();
    box.innerHTML = list
      .map(function (c) {
        var d = daysLeft(c.deadline);
        var tone = d <= 3 ? "hot" : d <= 10 ? "warm" : "calm";
        var pct = Math.max(4, Math.min(100, Math.round((1 - d / 60) * 100)));
        var on = mine.indexOf(String(c.id)) !== -1;
        return (
          '<article class="sh-card sh-reveal">' +
          '<div class="sh-card-top">' +
          '<span class="sh-pill">' +
          esc(TYPE_AR[c.type] || c.type || "فرصة") +
          "</span>" +
          '<span class="sh-pill ' +
          tone +
          '">' +
          (d === 0 ? "آخر يوم" : "فاضل " + d + " يوم") +
          "</span>" +
          "</div>" +
          "<h3>" +
          esc(c.name || "فرصة") +
          "</h3>" +
          '<div class="sh-countdown">' +
          (d === 0 ? "اليوم" : d) +
          "<small>" +
          (d === 0 ? "قدّم فورًا" : "يوم على آخر موعد") +
          "</small></div>" +
          '<div class="sh-bar"><i style="width:' +
          pct +
          '%"></i></div>' +
          '<div class="sh-meta">' +
          '<span><i class="far fa-building"></i> ' +
          esc(c.category || "جهة غير محددة") +
          "</span>" +
          '<span><i class="far fa-calendar"></i> ' +
          esc(c.deadline) +
          "</span>" +
          "</div>" +
          '<div class="sh-actions">' +
          '<a class="sh-btn sh-btn-main" href="?id=' +
          encodeURIComponent(c.id) +
          '"><i class="fas fa-arrow-left"></i> اعرف التفاصيل</a>' +
          '<button class="sh-btn" type="button" data-sh-cal="' +
          esc(c.id) +
          '"><i class="far fa-calendar-plus"></i> أضف للتقويم</button>' +
          '<button class="sh-btn' +
          (on ? " sh-btn-main" : "") +
          '" type="button" data-sh-remind="' +
          esc(c.id) +
          '">' +
          (on
            ? '<i class="fas fa-bell"></i> التذكير مفعّل'
            : '<i class="far fa-bell"></i> فكّرني') +
          "</button>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
    reveal(box);
  }

  function reminderBanner() {
    if (!loggedIn()) return;
    var mine = reminders();
    if (!mine.length) return;
    var soon = upcoming(50).filter(function (c) {
      return mine.indexOf(String(c.id)) !== -1 && daysLeft(c.deadline) <= 3;
    });
    if (!soon.length) return;
    var bar = document.createElement("div");
    bar.setAttribute("dir", "rtl");
    bar.style.cssText =
      "position:fixed;z-index:2147482000;bottom:18px;inset-inline-start:18px;max-width:340px;" +
      "background:linear-gradient(135deg,#0f172a,#132b3f);color:#e2e8f0;border:1px solid rgba(52,211,153,.4);" +
      "padding:14px 16px;border-radius:16px;font:700 13px/1.8 system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.45)";
    bar.innerHTML =
      '<div style="font-weight:900;margin-bottom:6px">🔔 مواعيد قربت تقفل</div>' +
      soon
        .slice(0, 3)
        .map(function (c) {
          var d = daysLeft(c.deadline);
          return (
            '<div><a style="color:#6ee7b7;text-decoration:none" href="?id=' +
            encodeURIComponent(c.id) +
            '">' +
            esc(c.name) +
            "</a> — " +
            (d === 0 ? "آخر يوم النهاردة" : "فاضل " + d + " يوم") +
            "</div>"
          );
        })
        .join("") +
      '<button type="button" style="margin-top:10px;background:none;border:0;color:#94a3b8;font:inherit;cursor:pointer">إخفاء</button>';
    bar.querySelector("button").onclick = function () {
      bar.remove();
    };
    document.body.appendChild(bar);
  }

  /* ---------- 2) learning tracks ---------- */
  var TRACKS = [
    {
      id: "frontend",
      icon: "fa-code",
      name: "تطوير الويب (Front-End)",
      desc: "من أول سطر HTML لحد ما تبني موقع كامل وتحطه في معرض أعمالك.",
      steps: [
        {
          t: "أساسيات HTML و CSS",
          url: "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
        },
        { t: "JavaScript من الصفر", url: "https://javascript.info/" },
        { t: "مشروع صغير: صفحة شخصية", url: "" },
        { t: "React ومكوّنات الواجهة", url: "https://react.dev/learn" },
        { t: "انشر مشروعك وشاركه في CV", url: "" },
      ],
    },
    {
      id: "data",
      icon: "fa-chart-simple",
      name: "تحليل البيانات",
      desc: "مهارة مطلوبة في كل مجال: Excel ثم SQL ثم Python والتصوّر البياني.",
      steps: [
        { t: "Excel للتحليل الأساسي", url: "https://edu.gcfglobal.org/en/excel/" },
        { t: "مقدمة SQL", url: "https://sqlbolt.com/" },
        { t: "Python للمبتدئين", url: "https://www.kaggle.com/learn/python" },
        { t: "تحليل بيانات بـ Pandas", url: "https://www.kaggle.com/learn/pandas" },
        { t: "مشروع تحليل حقيقي + تقرير", url: "" },
      ],
    },
    {
      id: "english",
      icon: "fa-language",
      name: "الإنجليزي والمقابلات",
      desc: "تحسّن لغتك وتتدرب على الإنترفيو والحديث عن نفسك بثقة.",
      steps: [
        { t: "تقوية القواعد والمفردات", url: "https://learnenglish.britishcouncil.org/" },
        { t: "تدريب يومي 10 دقائق", url: "https://www.duolingo.com/" },
        { t: "جهّز إجابة «Tell me about yourself»", url: "" },
        { t: "تدرّب على أسئلة الإنترفيو الشائعة", url: "" },
        { t: "سجّل نفسك واسمع أدائك", url: "" },
      ],
    },
    {
      id: "career",
      icon: "fa-briefcase",
      name: "مهارات الشغل والتقديم",
      desc: "CV محترم، لينكدإن مرتب، ومهارات تخليك جاهز لأول فرصة.",
      steps: [
        { t: "اكتب CV من صفحة واحدة", url: "" },
        { t: "رتّب بروفايل LinkedIn", url: "https://www.linkedin.com/" },
        { t: "أساسيات إدارة الوقت والمهام", url: "" },
        {
          t: "مهارات العرض والتقديم",
          url: "https://www.coursera.org/courses?query=presentation%20skills&productDifficultyLevel=Beginner",
        },
        { t: "قدّم على 3 فرص من الموقع", url: "" },
      ],
    },
  ];

  function trackProgress() {
    var all = readJSON(TRACK_KEY, {});
    return all[userKey()] || {};
  }
  function saveTrackProgress(p) {
    var all = readJSON(TRACK_KEY, {});
    all[userKey()] = p;
    writeJSON(TRACK_KEY, all);
  }

  function renderTracks() {
    var box = document.getElementById("sh-tracks-grid");
    if (!box) return;
    var prog = trackProgress();
    box.innerHTML = TRACKS.map(function (tr) {
      var done = prog[tr.id] || [];
      var pct = Math.round((done.length / tr.steps.length) * 100);
      return (
        '<article class="sh-card sh-reveal" data-track="' +
        tr.id +
        '">' +
        '<div class="sh-card-top">' +
        '<span class="sh-pill calm"><i class="fas ' +
        tr.icon +
        '"></i> مسار مجاني</span>' +
        '<span class="sh-progress-txt" data-pct>' +
        pct +
        "%</span>" +
        "</div>" +
        "<h3>" +
        esc(tr.name) +
        "</h3>" +
        "<p>" +
        esc(tr.desc) +
        "</p>" +
        '<div class="sh-bar"><i data-fill style="width:' +
        Math.max(2, pct) +
        '%"></i></div>' +
        '<ul class="sh-track-steps">' +
        tr.steps
          .map(function (s, i) {
            var on = done.indexOf(i) !== -1;
            return (
              '<li class="sh-step' +
              (on ? " done" : "") +
              '">' +
              '<input type="checkbox" data-step="' +
              i +
              '"' +
              (on ? " checked" : "") +
              ">" +
              "<span>" +
              esc(s.t) +
              (s.url
                ? ' — <a href="' + esc(s.url) + '" target="_blank" rel="noopener">ابدأ من هنا</a>'
                : "") +
              "</span>" +
              "</li>"
            );
          })
          .join("") +
        "</ul>" +
        '<div class="sh-hint">تقدّمك محفوظ على جهازك' +
        (loggedIn() ? " وباسمك" : " — سجّل الدخول لحفظه باسمك") +
        ".</div>" +
        "</article>"
      );
    }).join("");
    reveal(box);
  }

  function onTrackToggle(input) {
    var card = input.closest("[data-track]");
    if (!card) return;
    var id = card.getAttribute("data-track");
    var tr = TRACKS.filter(function (t) {
      return t.id === id;
    })[0];
    var idx = parseInt(input.getAttribute("data-step"), 10);
    var prog = trackProgress();
    var done = prog[id] || [];
    var at = done.indexOf(idx);
    if (input.checked && at === -1) done.push(idx);
    if (!input.checked && at !== -1) done.splice(at, 1);
    prog[id] = done;
    saveTrackProgress(prog);
    input.parentElement.classList.toggle("done", input.checked);
    var pct = Math.round((done.length / tr.steps.length) * 100);
    card.querySelector("[data-pct]").textContent = pct + "%";
    card.querySelector("[data-fill]").style.width = Math.max(2, pct) + "%";
    if (pct === 100) toast("مبروك! خلّصت مسار " + tr.name + " 🎉");
  }

  /* ---------- 3) application helper ---------- */
  function buildLetter(v) {
    var goalMap = {
      scholarship: "المنحة الدراسية",
      job: "الوظيفة",
      volunteering: "فرصة التطوع",
      competition: "المسابقة",
    };
    var kind = goalMap[v.kind] || "الفرصة";
    var skills = v.skills
      .split(/[,،\n]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    var bullets = skills
      .slice(0, 4)
      .map(function (s) {
        return "• " + s + " — استخدمتها في " + (v.experience || "مشاريع ودراسة عملية") + ".";
      })
      .join("\n");
    return (
      "السلام عليكم،\n\n" +
      "اسمي " +
      (v.name || "(اسمك)") +
      "، " +
      (v.study || "طالب/طالبة") +
      "، وأتقدّم إلى " +
      kind +
      " «" +
      (v.opp || "—") +
      "».\n\n" +
      "سبب تقديمي: " +
      (v.why || "أريد تطوير مهاراتي وتحويل ما درسته إلى أثر حقيقي، وهذه الفرصة أقرب خطوة لهدفي.") +
      "\n\n" +
      "أهم ما أقدّمه:\n" +
      (bullets || "• الالتزام والتعلّم السريع\n• العمل ضمن فريق\n• مهارات تنظيم الوقت") +
      "\n\n" +
      (v.experience ? "من خبرتي: " + v.experience + ".\n\n" : "") +
      "أنا جاهز/جاهزة للالتزام الكامل بالمواعيد والمتطلبات، ويسعدني تقديم أي مستندات إضافية.\n\n" +
      "شكرًا لوقتكم وتقديركم،\n" +
      (v.name || "(اسمك)") +
      "\n\n— — — — —\nنقاط جاهزة لسيرتك الذاتية (CV):\n" +
      (skills.length
        ? skills
            .slice(0, 5)
            .map(function (s) {
              return "- " + s + ": نتيجة ملموسة (اكتب رقم أو مثال قصير).";
            })
            .join("\n")
        : "- اكتب مهارة + نتيجة بالأرقام لكل سطر.") +
      "\n\nنصيحة سريعة: خصّص أول سطرين لاسم الجهة والفرصة، وراجع الإملاء قبل الإرسال."
    );
  }

  function renderHelper() {
    var out = document.getElementById("sh-helper-out");
    var form = document.getElementById("sh-helper-form");
    if (!form || !out) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = {
        name: form.elements["name"].value.trim(),
        study: form.elements["study"].value.trim(),
        kind: form.elements["kind"].value,
        opp: form.elements["opp"].value.trim(),
        skills: form.elements["skills"].value.trim(),
        experience: form.elements["experience"].value.trim(),
        why: form.elements["why"].value.trim(),
      };
      out.textContent = buildLetter(v);
      out.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    var copyBtn = document.getElementById("sh-helper-copy");
    if (copyBtn)
      copyBtn.addEventListener("click", function () {
        var txt = out.textContent || "";
        if (!txt.trim()) {
          toast("املأ البيانات واضغط «جهّز رسالتي» أول");
          return;
        }
        if (navigator.clipboard)
          navigator.clipboard.writeText(txt).then(function () {
            toast("تم نسخ الرسالة ✅");
          });
        else toast("انسخ النص يدويًا من الصندوق");
      });
    var u = user();
    if (u && u.username) form.elements["name"].value = u.username;
  }

  /* ---------- 4) student Q&A ---------- */
  function qna() {
    var v = readJSON(QNA_KEY, []);
    return Array.isArray(v) ? v : [];
  }
  function saveQna(list) {
    writeJSON(QNA_KEY, list);
  }

  function renderQna() {
    var box = document.getElementById("sh-qna-list");
    if (!box) return;
    var list = qna()
      .slice()
      .sort(function (a, b) {
        return (b.at || 0) - (a.at || 0);
      })
      .slice(0, 12);
    if (!list.length) {
      box.innerHTML =
        '<div class="sh-empty">مفيش أسئلة بعد — اسأل أول سؤال وساعد غيرك يستفيد من الإجابة.</div>';
    } else {
      box.innerHTML = list
        .map(function (q) {
          var initial = esc(
            String(q.author || "ط")
              .charAt(0)
              .toUpperCase(),
          );
          return (
            '<div class="sh-q" data-q="' +
            esc(q.id) +
            '">' +
            '<div class="sh-q-head"><div class="sh-q-avatar">' +
            initial +
            "</div>" +
            "<span>" +
            esc(q.author || "طالب") +
            "</span><span>•</span>" +
            "<span>" +
            esc(new Date(q.at || Date.now()).toLocaleDateString("ar-EG")) +
            "</span>" +
            (q.topic ? '<span class="sh-pill">' + esc(q.topic) + "</span>" : "") +
            "</div>" +
            '<div class="sh-q-body">' +
            esc(q.text) +
            "</div>" +
            (q.answers && q.answers.length
              ? '<div class="sh-answers">' +
                q.answers
                  .slice(0, 5)
                  .map(function (a) {
                    return (
                      '<div class="sh-answer"><b>' +
                      esc(a.author || "طالب") +
                      ":</b> " +
                      esc(a.text) +
                      "</div>"
                    );
                  })
                  .join("") +
                "</div>"
              : "") +
            '<div class="sh-actions" style="margin-top:12px">' +
            (loggedIn()
              ? '<button class="sh-btn" type="button" data-sh-answer="' +
                esc(q.id) +
                '"><i class="far fa-comment-dots"></i> جاوب</button>'
              : '<a class="sh-btn" href="?view=login"><i class="fas fa-sign-in-alt"></i> سجّل الدخول للإجابة</a>') +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    }
    var ask = document.getElementById("sh-qna-ask");
    if (ask) ask.style.display = loggedIn() ? "flex" : "none";
    var cta = document.getElementById("sh-qna-cta");
    if (cta) cta.style.display = loggedIn() ? "none" : "block";
  }

  function addQuestion(text, topic) {
    var u = user();
    var list = qna();
    list.push({
      id: "q" + Date.now() + Math.floor(Math.random() * 1000),
      text: text,
      topic: topic || "",
      author: (u && u.username) || "طالب",
      at: Date.now(),
      answers: [],
    });
    saveQna(list);
    renderQna();
    toast("تم نشر سؤالك ✅");
  }

  function addAnswer(qid, text) {
    var u = user();
    var list = qna();
    var q = list.filter(function (x) {
      return String(x.id) === String(qid);
    })[0];
    if (!q) return;
    q.answers = q.answers || [];
    q.answers.push({ text: text, author: (u && u.username) || "طالب", at: Date.now() });
    saveQna(list);
    renderQna();
    toast("شكرًا! إجابتك هتفيد غيرك 🙌");
  }

  /* ---------- markup ---------- */
  function sectionsHtml() {
    return (
      "" +
      '<section class="sh-section" id="deadlines" dir="rtl">' +
      '<div class="sh-wrap">' +
      '<div class="sh-head sh-reveal">' +
      '<span class="sh-kicker"><i class="fas fa-hourglass-half"></i> رادار المواعيد</span>' +
      '<h2 class="sh-title">فرص قربت تقفل — متفوّتهاش</h2>' +
      '<p class="sh-sub">أقرب المواعيد النهائية في مكان واحد، مع عدّاد وإضافة للتقويم وتذكير قبل الميعاد بيومين.</p>' +
      "</div>" +
      '<div class="sh-grid sh-grid-3" id="sh-deadline-grid"></div>' +
      "</div>" +
      "</section>" +
      '<section class="sh-section" id="learning" dir="rtl">' +
      '<div class="sh-wrap">' +
      '<div class="sh-head sh-reveal">' +
      '<span class="sh-kicker"><i class="fas fa-graduation-cap"></i> مسارات تعلّم</span>' +
      '<h2 class="sh-title">اتعلّم مهارة تخليك تقبل بسهولة</h2>' +
      '<p class="sh-sub">مسارات مجانية بخطوات مرتبة ومصادر مفتوحة، وعلّم كل خطوة خلّصتها وتقدّمك بيتحفظ.</p>' +
      "</div>" +
      '<div class="sh-grid sh-grid-2" id="sh-tracks-grid"></div>' +
      "</div>" +
      "</section>" +
      '<section class="sh-section" id="apply-helper" dir="rtl">' +
      '<div class="sh-wrap">' +
      '<div class="sh-head sh-reveal">' +
      '<span class="sh-kicker"><i class="fas fa-wand-magic-sparkles"></i> مساعد التقديم</span>' +
      '<h2 class="sh-title">جهّز رسالة تقديمك في دقيقة</h2>' +
      '<p class="sh-sub">اكتب بياناتك باختصار، وهنطلعلك رسالة تقديم منظّمة + نقاط جاهزة لسيرتك الذاتية.</p>' +
      "</div>" +
      '<div class="sh-grid sh-grid-2">' +
      '<form class="sh-card sh-form sh-reveal" id="sh-helper-form">' +
      '<div class="sh-field"><label>اسمك</label><input class="sh-input" name="name" placeholder="مثال: عمر محمود" required></div>' +
      '<div class="sh-field"><label>دراستك أو مجالك</label><input class="sh-input" name="study" placeholder="طالب هندسة حاسبات - سنة ثالثة"></div>' +
      '<div class="sh-field"><label>نوع الفرصة</label>' +
      '<select class="sh-select" name="kind">' +
      '<option value="scholarship">منحة دراسية</option>' +
      '<option value="job">وظيفة أو تدريب</option>' +
      '<option value="volunteering">تطوع</option>' +
      '<option value="competition">مسابقة</option>' +
      "</select></div>" +
      '<div class="sh-field"><label>اسم الفرصة أو الجهة</label><input class="sh-input" name="opp" placeholder="مثال: منحة فولبرايت"></div>' +
      '<div class="sh-field"><label>مهاراتك (افصل بينها بفاصلة)</label><input class="sh-input" name="skills" placeholder="تحليل بيانات، عمل جماعي، إنجليزي"></div>' +
      '<div class="sh-field"><label>خبرة أو مشروع (اختياري)</label><input class="sh-input" name="experience" placeholder="مشروع تخرّج، تدريب صيفي، نشاط طلابي"></div>' +
      '<div class="sh-field"><label>ليه بتقدّم؟ (اختياري)</label><textarea class="sh-textarea" name="why" placeholder="اكتب سببك بجملة أو جملتين"></textarea></div>' +
      '<div class="sh-actions">' +
      '<button class="sh-btn sh-btn-main" type="submit"><i class="fas fa-bolt"></i> جهّز رسالتي</button>' +
      '<button class="sh-btn" type="button" id="sh-helper-copy"><i class="far fa-copy"></i> انسخ النص</button>' +
      "</div>" +
      "</form>" +
      '<div class="sh-card sh-reveal">' +
      '<div class="sh-card-top"><span class="sh-pill calm"><i class="far fa-file-lines"></i> النتيجة</span></div>' +
      '<div class="sh-output" id="sh-helper-out">هتلاقي رسالتك هنا بعد ما تملأ البيانات وتضغط «جهّز رسالتي».</div>' +
      '<div class="sh-hint" style="margin-top:12px">راجع الرسالة وزوّدها بلمستك الشخصية قبل الإرسال — الجهات بتحب الصدق والتفاصيل الحقيقية.</div>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="sh-section" id="student-qna" dir="rtl">' +
      '<div class="sh-wrap">' +
      '<div class="sh-head sh-reveal">' +
      '<span class="sh-kicker"><i class="far fa-comments"></i> مجتمع الطلاب</span>' +
      '<h2 class="sh-title">اسأل واستفيد من تجارب غيرك</h2>' +
      '<p class="sh-sub">أسئلة حقيقية عن التقديم والقبول والمنح — والإجابات من طلاب عدّوا نفس الطريق.</p>' +
      "</div>" +
      '<div class="sh-card sh-reveal" style="margin-bottom:18px">' +
      '<form class="sh-form" id="sh-qna-ask" style="display:none">' +
      '<div class="sh-field"><label>سؤالك</label><textarea class="sh-textarea" name="text" placeholder="مثال: إيه المستندات المطلوبة لمنحة دراسية بره؟" required></textarea></div>' +
      '<div class="sh-field"><label>الموضوع (اختياري)</label><input class="sh-input" name="topic" placeholder="منح / وظائف / تطوع"></div>' +
      '<div class="sh-actions"><button class="sh-btn sh-btn-main" type="submit"><i class="far fa-paper-plane"></i> انشر سؤالك</button></div>' +
      "</form>" +
      '<div id="sh-qna-cta" style="display:none">' +
      '<div class="sh-q-body" style="margin:0 0 12px">سجّل الدخول تقدر تسأل وتجاوب وتحفظ متابعتك.</div>' +
      '<a class="sh-btn sh-btn-main" href="?view=login"><i class="fas fa-user-plus"></i> سجّل دلوقتي</a>' +
      "</div>" +
      "</div>" +
      '<div id="sh-qna-list"></div>' +
      "</div>" +
      "</section>"
    );
  }

  /* ---------- reveal on scroll (light) ---------- */
  var io = null;
  function reveal(root) {
    var nodes = (root || document).querySelectorAll(".sh-reveal:not(.in)");
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, function (n) {
        n.classList.add("in");
      });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io.unobserve(en.target);
            }
          });
        },
        { rootMargin: "0px 0px -60px 0px", threshold: 0.05 },
      );
    }
    Array.prototype.forEach.call(nodes, function (n) {
      io.observe(n);
    });
  }

  /* ---------- boot ---------- */
  function mount() {
    var home = document.getElementById("home-view");
    if (!home || document.getElementById("sh-deadline-grid")) return;
    var anchor = home.querySelector(".partners-section") || home.querySelector(".faq-section");
    var holder = document.createElement("div");
    holder.id = "sh-root";
    holder.innerHTML = sectionsHtml();
    if (anchor) anchor.parentNode.insertBefore(holder, anchor);
    else home.appendChild(holder);

    renderDeadlines();
    renderTracks();
    renderHelper();
    renderQna();
    reveal(document);
    setTimeout(reminderBanner, 1500);

    // one delegated listener for everything
    holder.addEventListener("click", function (e) {
      var cal = e.target.closest("[data-sh-cal]");
      if (cal) {
        downloadCalendar(cal.getAttribute("data-sh-cal"));
        return;
      }
      var rem = e.target.closest("[data-sh-remind]");
      if (rem) {
        toggleReminder(rem.getAttribute("data-sh-remind"), rem);
        return;
      }
      var ans = e.target.closest("[data-sh-answer]");
      if (ans) {
        var txt = window.prompt("اكتب إجابتك للسؤال:");
        if (txt && txt.trim()) addAnswer(ans.getAttribute("data-sh-answer"), txt.trim());
      }
    });
    holder.addEventListener("change", function (e) {
      if (e.target.matches(".sh-step input[type=checkbox]")) onTrackToggle(e.target);
    });
    var askForm = document.getElementById("sh-qna-ask");
    if (askForm)
      askForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = askForm.elements["text"].value.trim();
        if (!text) return;
        addQuestion(text, askForm.elements["topic"].value.trim());
        askForm.reset();
      });

    // refresh countdowns and shared data periodically (cheap)
    setInterval(renderDeadlines, 5 * 60 * 1000);
  }

  function boot() {
    // wait until the legacy app filled localStorage from the store
    var tries = 0;
    (function wait() {
      var ready = readJSON("luxen_general_cards", null) !== null || tries > 4;
      if (ready) {
        mount();
        return;
      }
      tries++;
      setTimeout(wait, 300);
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.StudentHub = {
    refresh: function () {
      renderDeadlines();
      renderQna();
      renderTracks();
    },
  };
})();
