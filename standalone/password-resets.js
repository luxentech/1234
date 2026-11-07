/* Elevate — طلبات تغيير كلمة المرور (للإدارة)
 *
 * العضو يضغط "نسيت كلمة المرور؟" في صفحة الدخول فيوصل طلبه هنا.
 * المدير يقدر يعيّن للعضو كلمة مرور جديدة أو يرفض الطلب، وكل تنفيذ
 * بيتم على السيرفر بعد التحقق من صلاحية المدير — كلمة المرور بتتشفّر هناك.
 */
(function () {
  "use strict";

  var KEY = "luxen_reset_requests";
  var TOKEN_KEY = "ns_backup_token";
  var mounted = false;

  /* ------------------------------ helpers ------------------------------ */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function isAdmin() {
    try {
      var user = JSON.parse(localStorage.getItem("ns_user") || "null");
      return !!(user && user.isAdmin);
    } catch (e) {
      return false;
    }
  }

  function readList() {
    try {
      var value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (e) {
      return [];
    }
  }

  function pending() {
    return readList()
      .filter(function (row) {
        return row && row.status === "pending";
      })
      .sort(function (a, b) {
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
  }

  function when(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(
        date,
      );
    } catch (e) {
      return date.toLocaleString();
    }
  }

  function status(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = "pr-status bk-status" + (kind ? " " + kind : "");
  }

  /* ------------------------------ server ------------------------------ */

  function savedToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function ensureToken() {
    var token = savedToken();
    if (token) return Promise.resolve(token);

    var identifier = window.prompt("للمتابعة أدخل بيانات مدير:\nاسم المستخدم أو البريد الإلكتروني");
    if (!identifier) return Promise.reject(new Error("ملغى"));
    var password = window.prompt("كلمة المرور:");
    if (!password) return Promise.reject(new Error("ملغى"));

    return fetch("/api/public/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "token", identifier: identifier, password: password }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("بيانات المدير غير صحيحة");
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.token) throw new Error("تعذّر الحصول على صلاحية المدير");
        try {
          localStorage.setItem(TOKEN_KEY, data.token);
        } catch (e) {}
        return data.token;
      });
  }

  function call(action, payload) {
    return ensureToken().then(function (token) {
      var body = { action: action, token: token };
      Object.keys(payload || {}).forEach(function (field) {
        body[field] = payload[field];
      });
      return fetch("/api/public/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      });
    });
  }

  /* ------------------------------ interface ------------------------------ */

  function render() {
    var list = document.getElementById("pr-list");
    if (!list) return;
    var rows = pending();

    var badge = document.getElementById("pr-count");
    if (badge) badge.textContent = rows.length;

    if (!rows.length) {
      list.innerHTML =
        '<div class="sh-empty">لا توجد طلبات حاليًا. أي طلب جديد من صفحة الدخول هيظهر هنا فورًا.</div>';
      return;
    }

    list.innerHTML = rows
      .map(function (row) {
        return (
          '<div class="pr-row" data-user="' +
          esc(row.username) +
          '">' +
          '<div class="pr-head"><b>' +
          esc(row.username) +
          "</b><em>" +
          esc(when(row.created_at)) +
          "</em></div>" +
          '<div class="pr-act">' +
          '<input type="text" class="pr-pass" placeholder="كلمة مرور جديدة (٨ أحرف على الأقل)" autocomplete="new-password">' +
          '<button type="button" class="sh-btn sh-btn-main" data-act="set">تعيين كلمة المرور</button>' +
          '<button type="button" class="sh-btn" data-act="reject">رفض الطلب</button>' +
          "</div>" +
          '<div class="pr-status bk-status"></div>' +
          "</div>"
        );
      })
      .join("");
  }

  function run(row, action, button) {
    var username = row.getAttribute("data-user") || "";
    var box = row.querySelector(".pr-status");
    var passEl = row.querySelector(".pr-pass");
    var password = passEl ? passEl.value : "";

    if (action === "set" && String(password).trim().length < 8) {
      status(box, "كلمة المرور الجديدة يجب أن تكون ٨ أحرف على الأقل.", "err");
      return;
    }

    button.disabled = true;
    status(box, "جارٍ التنفيذ...", "");

    var payload =
      action === "set" ? { username: username, password: password } : { username: username };
    call(action === "set" ? "admin_reset_password" : "admin_reject_password_reset", payload)
      .then(function (res) {
        button.disabled = false;
        if (!res.ok || !res.data || res.data.ok === false) {
          status(box, (res.data && res.data.error) || "تعذّر التنفيذ.", "err");
          return;
        }
        status(
          box,
          action === "set" ? "تم تعيين كلمة المرور. بلّغ العضو بها ليتسجيل بها." : "تم رفض الطلب.",
          "ok",
        );
        row.style.opacity = ".45";
        if (window.ElevateDB && window.ElevateDB.refresh) {
          window.ElevateDB.refresh(false)
            .then(render)
            .catch(function () {});
        }
      })
      .catch(function (err) {
        button.disabled = false;
        status(box, (err && err.message) || "تعذّر الاتصال بالسيرفر.", "err");
      });
  }

  function wire(section) {
    section.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-act]") : null;
      if (!button) return;
      var row = button.closest ? button.closest(".pr-row") : null;
      if (!row) return;
      run(row, button.getAttribute("data-act"), button);
    });
  }

  function mount() {
    if (mounted || !isAdmin()) return;

    var navButtons = document.querySelectorAll(".admin-nav-btn");
    if (!navButtons.length) return;
    var navWrap = navButtons[navButtons.length - 1].parentElement;
    if (!navWrap) return;

    var sections = document.querySelectorAll(".admin-section");
    var lastSection = sections[sections.length - 1];
    if (!lastSection || !lastSection.parentElement) return;

    var button = document.createElement("button");
    button.className = "admin-nav-btn";
    button.id = "adm-btn-reset";
    button.setAttribute("data-sec", "adm-sec-reset");
    button.innerHTML =
      '<i class="fas fa-key"></i> طلبات كلمة المرور <span class="pr-badge" id="pr-count">0</span>';
    button.onclick = function () {
      Admin.switchSection("adm-sec-reset");
    };
    navWrap.appendChild(button);

    var section = document.createElement("div");
    section.className = "admin-section";
    section.id = "adm-sec-reset";
    section.innerHTML =
      '<div class="a-card">' +
      '<div class="a-card-head"><h3>طلبات تغيير كلمة المرور</h3>' +
      '<p class="a-note">العضو يطلب من صفحة الدخول، وأنت تعيين له كلمة مرور جديدة أو ترفض الطلب. كلمة المرور بتتشفّر على السيرفر ومبتفضلش ظاهرة في أي مكان.</p></div>' +
      '<div class="pr-list" id="pr-list"></div>' +
      "</div>";
    lastSection.parentElement.appendChild(section);

    wire(section);
    mounted = true;
    render();
  }

  /* ------------------------------ boot ------------------------------ */

  function retry(attempt) {
    if (mounted || attempt > 8) return;
    mount();
    if (!mounted)
      setTimeout(function () {
        retry(attempt + 1);
      }, 400);
  }

  function poll() {
    if (!mounted) return;
    var badge = document.getElementById("pr-count");
    if (!badge) return;
    if (Number(badge.textContent || "0") !== pending().length) render();
  }

  window.ElevateResets = { render: render, mount: mount };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      retry(0);
    });
  } else {
    retry(0);
  }
  setInterval(poll, 20000);
})();
