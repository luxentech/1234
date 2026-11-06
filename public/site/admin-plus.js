/* Elevate — Admin backup & restore
   Adds a "النسخ الاحتياطي" section to the admin dashboard:
   - download a single file with every shared site data set
   - upload it again at any time: the server merges it with what already
     exists, never deletes, and duplicates are collapsed automatically
   Access is verified server-side with the admin credentials. */
(function () {
  "use strict";

  var TOKEN_KEY = "ns_backup_token";

  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function user() {
    return (window.App && App.getUser && App.getUser()) || readJSON("ns_user", null);
  }
  function isAdmin() {
    var u = user();
    return !!(u && u.isAdmin === true);
  }
  function setStatus(msg, kind) {
    var el = document.getElementById("bk-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "bk-status" + (kind ? " " + kind : "");
  }

  function call(payload) {
    return fetch("/api/public/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok) throw new Error((body && body.error) || "HTTP " + r.status);
        return body;
      });
    });
  }

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function ensureToken() {
    var t = token();
    if (t) return Promise.resolve(t);
    var u = user();
    var identifier = window.prompt("للتأكيد: بريد المدير", (u && u.username) || "");
    if (!identifier) return Promise.reject(new Error("تم الإلغاء"));
    var password = window.prompt("كلمة مرور المدير");
    if (!password) return Promise.reject(new Error("تم الإلغاء"));
    return call({ action: "token", identifier: identifier, password: password }).then(
      function (res) {
        try {
          localStorage.setItem(TOKEN_KEY, res.token);
        } catch (e) {}
        return res.token;
      },
    );
  }

  function withToken(run) {
    return ensureToken()
      .then(run)
      .catch(function (err) {
        if (err && /Unauthorized/i.test(err.message)) {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch (e) {}
          return ensureToken().then(run);
        }
        throw err;
      });
  }

  function doExport() {
    setStatus("جاري تجهيز الملف...", "");
    withToken(function (t) {
      return call({ action: "export", token: t }).then(function (res) {
        var blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download =
          "elevate-backup-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 1000);
        setStatus("تم تنزيل نسخة كاملة من بيانات الموقع ✅", "ok");
      });
    }).catch(function (err) {
      setStatus("فشل التنزيل: " + err.message, "bad");
    });
  }

  function doImport(file) {
    if (!file) return;
    setStatus("جاري قراءة الملف...", "");
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        setStatus("الملف غير صالح (ليس ملف نسخة احتياطية).", "bad");
        return;
      }
      var data = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
      setStatus("جاري دمج البيانات مع الموجود...", "");
      withToken(function (t) {
        return call({ action: "import", token: t, data: data }).then(function (res) {
          setStatus(
            "تم الدمج بنجاح (" + (res.merged || []).length + " مجموعة بيانات) بدون حذف أو تكرار ✅",
            "ok",
          );
          if (window.ElevateDB && typeof ElevateDB.refresh === "function") ElevateDB.refresh(false);
        });
      }).catch(function (err) {
        setStatus("فشل الرفع: " + err.message, "bad");
      });
    };
    reader.readAsText(file);
  }

  function sectionHtml() {
    return (
      "" +
      '<div class="admin-dashboard-grid" style="grid-template-columns: 1fr 1fr;">' +
      '<div class="prof-card" style="border-color: rgba(56,189,248,.35); height: fit-content;">' +
      '<div class="prof-card-header" style="color:#38bdf8; margin-bottom: 14px;"><span>تنزيل نسخة احتياطية شاملة</span><i class="fas fa-cloud-arrow-down"></i></div>' +
      '<p style="color: var(--text-muted); font-size:.88rem; line-height:1.75; margin-bottom:18px;">ملف واحد بصيغة JSON يحتوي على كامل بيانات المنصة: الأعضاء، الفرص، الشركاء، التعليقات، الإشعارات، والأسئلة الشائعة لحفظها بأمان تام في أي وقت.</p>' +
      '<button type="button" class="a-submit-btn" style="width:100%; margin:0; background: linear-gradient(135deg, #0ea5e9, #0284c7);" id="bk-export"><i class="fas fa-download"></i> تنزيل كل البيانات الآن</button>' +
      "</div>" +
      '<div class="prof-card" style="border-color: rgba(16,185,129,.35); height: fit-content;">' +
      '<div class="prof-card-header" style="color:#10b981; margin-bottom: 14px;"><span>رفع نسخة واستعادتها بأمان</span><i class="fas fa-cloud-arrow-up"></i></div>' +
      '<p style="color: var(--text-muted); font-size:.88rem; line-height:1.75; margin-bottom:15px;">ارفع ملف النسخة الاحتياطية في أي وقت: تُدمج البيانات مع الموجود حالياً بذكاء، دون حذف أي بيانات سابقة، والمكرر لا يُضاف ثانية.</p>' +
      '<input type="file" id="bk-file" accept="application/json,.json" class="admin-search-input-pro" style="margin-bottom:12px;">' +
      '<button type="button" class="a-submit-btn" style="width:100%; margin:0; background: linear-gradient(135deg,#10b981,#059669);" id="bk-import"><i class="fas fa-upload"></i> رفع ودمج البيانات بأمان</button>' +
      '<div id="bk-status" class="bk-status"></div>' +
      "</div>" +
      "</div>"
    );
  }

  function mount() {
    if (!isAdmin()) return;
    var nav = document.getElementById("admin-nav");
    if (!nav || document.getElementById("adm-sec-backup")) return;
    var faqSection = document.getElementById("adm-sec-faq");
    if (!faqSection) return;

    var btn = document.createElement("button");
    btn.className = "admin-nav-btn";
    btn.setAttribute("data-sec", "adm-sec-backup");
    btn.innerHTML = '<i class="fas fa-database"></i> النسخ الاحتياطي';
    btn.addEventListener("click", function () {
      if (window.Admin && typeof Admin.switchSection === "function")
        Admin.switchSection("adm-sec-backup");
    });
    nav.appendChild(btn);

    var sec = document.createElement("section");
    sec.className = "admin-section";
    sec.id = "adm-sec-backup";
    sec.innerHTML = sectionHtml();
    faqSection.parentNode.insertBefore(sec, faqSection.nextSibling);

    document.getElementById("bk-export").addEventListener("click", doExport);
    document.getElementById("bk-import").addEventListener("click", function () {
      var input = document.getElementById("bk-file");
      if (!input || !input.files || !input.files[0]) {
        setStatus("اختر الملف أولًا.", "bad");
        return;
      }
      doImport(input.files[0]);
    });
  }

  function boot() {
    var tries = 0;
    (function wait() {
      if (document.getElementById("admin-nav") || tries > 10) {
        mount();
        return;
      }
      tries++;
      setTimeout(wait, 300);
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.ElevateBackup = { mount: mount };
})();
