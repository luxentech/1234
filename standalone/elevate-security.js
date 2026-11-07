/**
 * Elevate — Security Shield & Code Protection Engine
 * Protects frontend assets, blocks unauthorized inspection shortcuts,
 * mitigates Self-XSS, provides anti-tampering guards and input sanitization.
 */
(function () {
  "use strict";

  // 1. Console Security Warning (Anti-Self-XSS)
  try {
    const isAr = (document.documentElement.lang || "ar") === "ar";
    const title = "🛑 تحذير أمني هام! | SECURITY ALERT!";
    const warning = isAr
      ? "هذه النافذة مخصصة للمطورين وفحص النظام فقط.\nإذا طلب منك أي شخص نسخ أي كود ولصقه هنا، فهذا محاولة لاختراق حسابك وسرقة بياناتك!\nElevate Security Shield active."
      : "This tool is for developer debugging only.\nNever paste any code or tokens here. Doing so may allow attackers to steal your account!\nElevate Security Shield active.";

    console.log(
      "%c" + title,
      "color: #ffffff; background: #dc2626; font-size: 20px; font-weight: 900; padding: 10px 18px; border-radius: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.4);",
    );
    console.log(
      "%c" + warning,
      "color: #f59e0b; font-size: 13px; font-weight: 700; line-height: 1.6; padding: 6px 0;",
    );
  } catch (e) {}

  // 2. Custom Security Toast
  function showSecurityNotice(msg) {
    let toast = document.getElementById("elevate-sec-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "elevate-sec-toast";
      toast.style.cssText =
        "position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(20px);" +
        "background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.95));" +
        "color: #ffffff; padding: 12px 24px; border-radius: 50px;" +
        "box-shadow: 0 10px 35px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.4);" +
        "border: 1px solid rgba(99, 102, 241, 0.4); font-size: 0.9rem; font-weight: 700;" +
        "z-index: 2147483647; display: flex; align-items: center; gap: 10px;" +
        "opacity: 0; pointer-events: none; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);" +
        "font-family: var(--font-ar, system-ui, sans-serif); text-align: center; direction: rtl;";
      document.body.appendChild(toast);
    }

    const defaultMsg =
      (document.documentElement.lang || "ar") === "ar"
        ? "🛡️ محتوى وأكواد المنصة محمية لأمان النظام والبيانات."
        : "🛡️ Platform assets and code are protected for security.";

    toast.innerHTML =
      '<i class="fas fa-shield-alt" style="color: #6366f1; font-size: 1.1rem;"></i> <span>' +
      (msg || defaultMsg) +
      "</span>";
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
    }, 2800);
  }

  // 3. Disable DevTools & Inspection Shortcuts
  window.addEventListener(
    "keydown",
    function (e) {
      const key = e.key || "";
      const keyCode = e.keyCode || e.which;

      // F12
      if (keyCode === 123 || key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        showSecurityNotice();
        return false;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl + Shift + I / J / C (Inspect / DevTools)
      if (
        ctrlOrCmd &&
        e.shiftKey &&
        (key === "I" ||
          key === "i" ||
          key === "J" ||
          key === "j" ||
          key === "C" ||
          key === "c" ||
          keyCode === 73 ||
          keyCode === 74 ||
          keyCode === 67)
      ) {
        e.preventDefault();
        e.stopPropagation();
        showSecurityNotice();
        return false;
      }

      // Ctrl + U (View Source)
      if (ctrlOrCmd && (key === "U" || key === "u" || keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        showSecurityNotice();
        return false;
      }

      // Ctrl + S (Save Page)
      if (ctrlOrCmd && (key === "S" || key === "s" || keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        showSecurityNotice();
        return false;
      }
    },
    true,
  );

  // 4. Context Menu Protection (Right-Click)
  document.addEventListener("contextmenu", function (e) {
    // Allow right click on native input / textarea for copying user's own typed text
    const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) {
      return true;
    }
    e.preventDefault();
    showSecurityNotice();
    return false;
  });

  // 5. Prevent Dragging Media
  document.addEventListener("dragstart", function (e) {
    const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    if (
      tag === "img" ||
      tag === "video" ||
      (e.target && e.target.classList && e.target.classList.contains("no-drag"))
    ) {
      e.preventDefault();
      return false;
    }
  });

  // 6. Global Sanitizer Utility
  window.ElevateSanitize = function (str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
      .replace(/javascript\s*:\s*[^\s"'>]+/gi, "")
      .replace(/data:\s*text\/html[^\s"'>]*/gi, "");
  };

  // 7. Sanitize forms on submit
  document.addEventListener(
    "submit",
    function (e) {
      const form = e.target;
      if (!form || !form.elements) return;
      for (let i = 0; i < form.elements.length; i++) {
        const el = form.elements[i];
        if (
          (el.tagName === "INPUT" || el.tagName === "TEXTAREA") &&
          el.type !== "password" &&
          typeof el.value === "string"
        ) {
          el.value = window.ElevateSanitize(el.value);
        }
      }
    },
    true,
  );

  // 8. Protect against Clickjacking if not framed by top or same-origin
  try {
    if (window.top !== window.self) {
      // Check if ancestor is same origin
      try {
        if (window.top.location.origin !== window.location.origin) {
          // If framed by a foreign untrusted site, break out of iframe
          window.top.location.href = window.location.href;
        }
      } catch (err) {
        // Cross-origin ancestor detected -> prevent clickjacking
        window.top.location.href = window.location.href;
      }
    }
  } catch (e) {}

  window.ElevateSecurity = {
    version: "2.0.0",
    status: "active",
    showNotice: showSecurityNotice,
  };
})();
