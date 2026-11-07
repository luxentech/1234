/* Elevate — قسم الأسئلة الشائعة (FAQ)
   - يظهر في الصفحة الرئيسية كأكورديون
   - المدير يضيف / يعدّل / يحذف الأسئلة من لوحة الإدارة (تبويب الأسئلة الشائعة)
   - البيانات محفوظة في قاعدة البيانات عبر db-sync (المفتاح luxen_faq) */
(function () {
  var KEY = "luxen_faq";
  var DEFAULTS = [
    {
      id: "faq_default_1",
      q: "هل استخدام منصة Elevate مجاني؟",
      a: "نعم، المنصة مجانية بالكامل لكل الطلاب والخريجين، وكل الفرص المنشورة عليها يمكن التقديم لها بدون أي رسوم من طرفنا.",
    },
    {
      id: "faq_default_2",
      q: "كيف أتقدم لفرصة معينة؟",
      a: "ادخل على بطاقة الفرصة واضغط «عرض التفاصيل»، وستجد زر التقديم الذي يحولك مباشرة لصفحة الجهة المنظمة.",
    },
    {
      id: "faq_default_3",
      q: "هل يمكنني اقتراح فرصة أو مشاركة رأيي؟",
      a: "بالتأكيد، يمكنك التواصل معنا من خلال أيقونة واتساب أسفل الصفحة أو من خلال قسم التعليقات على أي فرصة.",
    },
    {
      id: "faq_default_4",
      q: "كيف أحضر الورش المباشرة وهل يوجد تسجيل لها؟",
      a: "من قسم «الورش المباشرة» اضغط «دخول للورشة» في ميعادها لتنضم مباشرة، ولو فاتتك الورشة هتلاقي زر «تسجيل المحاضرة» على البطاقة بعد انتهائها.",
    },
    {
      id: "faq_default_5",
      q: "هل أحصل على شهادة بعد إتمام الكورسات أو الورش؟",
      a: "الشهادات بتصدر من الجهة المنظمة للفرصة أو الورشة نفسها، وبنوضح في تفاصيل كل فرصة إذا كانت بتمنح شهادة معتمدة أو لا.",
    },
  ];

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      return Array.isArray(v) ? v : null;
    } catch (e) {
      return null;
    }
  }
  function list() {
    var v = read();
    if (v === null) return DEFAULTS.slice();
    var removed = {};
    try {
      (JSON.parse(localStorage.getItem(KEY + "_removed") || "[]") || []).forEach(function (id) {
        removed[id] = 1;
      });
    } catch (e) {}
    var have = {};
    v.forEach(function (it) {
      if (it && it.id) have[it.id] = 1;
    });
    var extra = DEFAULTS.filter(function (d) {
      return !have[d.id] && !removed[d.id];
    });
    return v.concat(extra);
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }
  function esc(v) {
    return String(v === undefined || v === null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function nl2br(v) {
    return esc(v).replace(/\n/g, "<br>");
  }
  function isAdmin() {
    try {
      var u = window.App ? App.getUser() : null;
      return !!(u && u.isAdmin === true);
    } catch (e) {
      return false;
    }
  }
  function uid() {
    return "faq_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ============ الصفحة الرئيسية ============ */
  function renderHome() {
    var box = document.getElementById("faq-list");
    var sec = document.getElementById("faq-section");
    if (!box) return;
    var items = list();
    if (!items.length) {
      if (sec) sec.style.display = "none";
      return;
    }
    if (sec) sec.style.display = "";
    var sig = JSON.stringify(items);
    if (box.getAttribute("data-sig") === sig) return;
    box.setAttribute("data-sig", sig);
    box.innerHTML = items
      .map(function (it, i) {
        return (
          '<div class="faq-item" data-id="' +
          esc(it.id) +
          '">' +
          '<button type="button" class="faq-q" aria-expanded="false">' +
          '<span class="faq-num">' +
          (i + 1) +
          "</span>" +
          '<span class="faq-q-text">' +
          esc(it.q) +
          "</span>" +
          '<i class="fas fa-chevron-down faq-arrow"></i></button>' +
          '<div class="faq-a"><div class="faq-a-inner">' +
          nl2br(it.a) +
          "</div></div>" +
          "</div>"
        );
      })
      .join("");
    Array.prototype.forEach.call(box.querySelectorAll(".faq-q"), function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.parentNode;
        var open = item.classList.contains("open");
        Array.prototype.forEach.call(box.querySelectorAll(".faq-item.open"), function (o) {
          o.classList.remove("open");
          o.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        });
        if (!open) {
          item.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* ============ لوحة المدير ============ */
  function renderAdmin() {
    var box = document.getElementById("faq-admin-list");
    if (!box) return;
    var items = list();
    var sig = JSON.stringify(items);
    if (box.getAttribute("data-sig") === sig) return;
    box.setAttribute("data-sig", sig);
    if (!items.length) {
      box.innerHTML =
        '<p style="text-align:center;color:var(--text-secondary);padding:20px">لا توجد أسئلة بعد. أضف أول سؤال من النموذج.</p>';
      return;
    }
    box.innerHTML = items
      .map(function (it) {
        return (
          '<div class="faq-admin-item">' +
          '<div class="faq-admin-text"><strong>' +
          esc(it.q) +
          "</strong><p>" +
          nl2br(it.a) +
          "</p></div>" +
          '<div class="faq-admin-actions">' +
          '<button type="button" class="elv-mini-btn" title="تعديل" onclick="ElevateFAQ.edit(\'' +
          esc(it.id) +
          '\')"><i class="fas fa-pen"></i></button>' +
          '<button type="button" class="elv-mini-btn danger" title="حذف" onclick="ElevateFAQ.remove(\'' +
          esc(it.id) +
          '\')"><i class="fas fa-trash"></i></button>' +
          "</div></div>"
        );
      })
      .join("");
  }

  function form() {
    return document.getElementById("faq-admin-form");
  }

  function save(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!isAdmin()) {
      alert("هذه الخاصية للمدير فقط");
      return false;
    }
    var f = form();
    if (!f) return false;
    var q = f.q.value.trim(),
      a = f.a.value.trim(),
      id = f.id.value;
    if (!q || !a) {
      alert("من فضلك اكتب السؤال والإجابة");
      return false;
    }
    var items = list().slice();
    if (id) {
      items = items.map(function (it) {
        return it.id === id ? { id: id, q: q, a: a } : it;
      });
    } else {
      items.push({ id: uid(), q: q, a: a });
    }
    write(items);
    reset();
    refresh();
    return false;
  }

  function edit(id) {
    var it = list().filter(function (x) {
      return x.id === id;
    })[0];
    var f = form();
    if (!it || !f) return;
    f.id.value = it.id;
    f.q.value = it.q;
    f.a.value = it.a;
    var c = document.getElementById("faq-admin-cancel");
    if (c) c.style.display = "";
    f.scrollIntoView({ behavior: "smooth", block: "center" });
    f.q.focus();
  }

  function remove(id) {
    if (!isAdmin()) {
      alert("هذه الخاصية للمدير فقط");
      return;
    }
    if (!confirm("هل تريد حذف هذا السؤال؟")) return;
    try {
      var rm = JSON.parse(localStorage.getItem(KEY + "_removed") || "[]") || [];
      if (rm.indexOf(id) === -1) {
        rm.push(id);
        localStorage.setItem(KEY + "_removed", JSON.stringify(rm));
      }
    } catch (e) {}
    write(
      list().filter(function (x) {
        return x.id !== id;
      }),
    );
    refresh();
  }

  function reset() {
    var f = form();
    if (!f) return;
    f.reset();
    f.id.value = "";
    var c = document.getElementById("faq-admin-cancel");
    if (c) c.style.display = "none";
  }

  function refresh() {
    renderHome();
    renderAdmin();
  }

  function injectStyles() {
    if (document.getElementById("elv-faq-styles")) return;
    var st = document.createElement("style");
    st.id = "elv-faq-styles";
    st.textContent = [
      ".faq-section{padding:90px 0;position:relative;overflow:hidden}",
      '.faq-section::before{content:"";position:absolute;top:10%;right:-140px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.20),transparent 70%);filter:blur(20px);pointer-events:none}',
      '.faq-section::after{content:"";position:absolute;bottom:0;left:-140px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.14),transparent 70%);filter:blur(20px);pointer-events:none}',
      ".faq-section .container{position:relative;z-index:1}",
      ".faq-list{display:flex;flex-direction:column;gap:14px;max-width:880px;margin:0 auto}",
      ".faq-item{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));border:1px solid var(--border-color,rgba(255,255,255,.09));border-radius:18px;overflow:hidden;backdrop-filter:blur(8px);transition:border-color .3s,box-shadow .3s,transform .3s}",
      '.faq-item::before{content:"";position:absolute;inset-inline-start:0;top:14px;bottom:14px;width:3px;border-radius:3px;background:linear-gradient(180deg,#6366f1,#8b5cf6);opacity:0;transition:opacity .3s}',
      ".faq-item:hover{transform:translateY(-2px);border-color:rgba(99,102,241,.45)}",
      ".faq-item.open{border-color:rgba(99,102,241,.65);box-shadow:0 18px 40px -18px rgba(99,102,241,.55)}",
      ".faq-item.open::before{opacity:1}",
      ".faq-q{width:100%;display:flex;align-items:center;gap:14px;background:none;border:0;color:var(--text-primary,#fff);font:inherit;font-weight:700;font-size:1.06rem;line-height:1.7;padding:20px 22px;cursor:pointer;text-align:right}",
      ".faq-num{flex:0 0 36px;height:36px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.9rem;font-weight:800;box-shadow:0 6px 16px -6px rgba(99,102,241,.9);transition:transform .3s}",
      ".faq-item.open .faq-num{transform:scale(1.06) rotate(-4deg)}",
      ".faq-q-text{flex:1}",
      ".faq-arrow{flex:0 0 30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.06);font-size:.8rem;transition:transform .35s,background .3s,color .3s;color:var(--text-secondary,#94a3b8)}",
      ".faq-item.open .faq-arrow{transform:rotate(180deg);background:rgba(99,102,241,.25);color:#c7d2fe}",
      ".faq-a{max-height:0;overflow:hidden;opacity:0;transition:max-height .4s cubic-bezier(.4,0,.2,1),opacity .3s}",
      ".faq-item.open .faq-a{max-height:800px;opacity:1}",
      ".faq-a-inner{margin:0 22px 20px;padding-top:16px;border-top:1px dashed rgba(255,255,255,.12);color:var(--text-secondary,#cbd5e1);line-height:2;font-size:.98rem}",
      ".faq-admin-item{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:14px;border:1px solid var(--border-color,rgba(255,255,255,.1));border-radius:12px;margin-bottom:10px;background:rgba(255,255,255,.02)}",
      ".faq-admin-text{flex:1;min-width:0}",
      ".faq-admin-text strong{display:block;margin-bottom:6px;color:var(--text-primary,#fff)}",
      ".faq-admin-text p{margin:0;color:var(--text-secondary,#94a3b8);font-size:.9rem;line-height:1.7}",
      ".faq-admin-actions{display:flex;gap:6px;flex-shrink:0}",
      ".elv-mini-btn{width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#e2e8f0;cursor:pointer}",
      ".elv-mini-btn:hover{background:rgba(99,102,241,.25)}",
      ".elv-mini-btn.danger{color:#f87171}",
      ".elv-mini-btn.danger:hover{background:rgba(239,68,68,.2)}",
      "#faq-admin-form{display:flex;flex-direction:column;gap:8px}",
      "#faq-admin-form label{font-weight:700;color:var(--text-secondary,#94a3b8);font-size:.9rem;margin-top:6px}",
      "#faq-admin-form input,#faq-admin-form textarea{width:100%;padding:11px 13px;border-radius:10px;border:1px solid var(--border-color,rgba(255,255,255,.12));background:rgba(0,0,0,.2);color:var(--text-primary,#fff);font:inherit;resize:vertical}",
      "#faq-admin-form .elv-btn{margin-top:8px;padding:11px 16px;border:0;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;cursor:pointer}",
      "@media (max-width:640px){.faq-q{font-size:.95rem;padding:16px 14px;gap:10px}.faq-a-inner{margin:0 14px 16px}.faq-section{padding:56px 0}}",
    ].join("");
    document.head.appendChild(st);
  }

  function boot() {
    injectStyles();
    refresh();
  }

  window.ElevateFAQ = {
    save: save,
    edit: edit,
    remove: remove,
    reset: reset,
    refresh: refresh,
    list: list,
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
      refresh();
    } catch (e) {}
  }, 5000);
})();
