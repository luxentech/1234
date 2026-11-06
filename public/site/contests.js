/**
 * Elevate Platform Live Competitions & Battles
 * مسابقات المنصة المباشرة والتحديات وجهاً لوجه
 */

(function () {
  "use strict";

  // Default state template
  const DEFAULT_STATE = {
    status: "registration", // 'registration' | 'scheduled' | 'live' | 'ended'
    contestant1: { name: "", age: "", score: 0, status: "idle" },
    contestant2: { name: "", age: "", score: 0, status: "idle" },
    schedule: { day: "", date: "", time: "", targetTimestamp: 0 },
    isTimerRunning: false,
    activeSpeaker: null, // { name: '', text: '' }
    currentQuestion: null, // { text: '', options: [], correctIndex: 0 }
    winner: null,
  };

  const PlatformContests = {
    countdownInterval: null,
    spectatorCount: 245,

    // ==========================================
    // Visibility & Coming Soon Status
    // ==========================================
    getVisibility() {
      return localStorage.getItem("luxen_contests_visibility") || "active"; // 'active' | 'coming_soon' | 'hidden'
    },

    setVisibility(val) {
      localStorage.setItem("luxen_contests_visibility", val);
      this.applySiteVisibility();
      if (window.App && typeof App.injectNavbar === "function") {
        App.injectNavbar();
      }
    },

    showComingSoonNotice(e) {
      if (e) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopPropagation === "function") e.stopPropagation();
      }
      const modalId = "contest-coming-soon-modal";
      let modal = document.getElementById(modalId);
      if (!modal) {
        modal = document.createElement("div");
        modal.id = modalId;
        modal.className = "contest-coming-soon-backdrop";
        document.body.appendChild(modal);
      }
      modal.innerHTML = `
        <div class="contest-coming-soon-box">
          <div class="contest-cs-icon">
            <i class="fas fa-trophy"></i>
          </div>
          <div class="contest-cs-badge">✨ ترقبوا التحديات الكبرى</div>
          <h3 class="contest-cs-title">سيتم فتحها قريباً!</h3>
          <p class="contest-cs-desc">
            نحن نقوم الآن بالتجهيزات النهائية لافتتاح أضخم مسابقات وتحديات تفاعلية مباشرة بين الشباب والطلاب على منصة Elevate.<br>
            ترقبوا الإطلاق الحصري وأول مواجهة مباشرة قريباً جداً 🚀
          </p>
          <button type="button" class="contest-cs-btn" onclick="document.getElementById('${modalId}').remove()">
            <i class="fas fa-check"></i> حسناً، في انتظاركم!
          </button>
        </div>
      `;

      modal.onclick = (evt) => {
        if (evt.target === modal) modal.remove();
      };

      if (window.App && typeof App.showToast === "function") {
        App.showToast("🏆 سيتم فتح مسابقات المنصة قريباً!");
      }
    },

    renderComingSoonPage() {
      const container = document.getElementById("contests-view");
      if (!container) return;
      container.innerHTML = `
        <div class="arena-wrapper" style="min-height:75vh; display:flex; align-items:center; justify-content:center; padding:50px 20px;">
          <div class="contest-coming-soon-box" style="margin:0 auto; max-width:540px;">
            <div class="contest-cs-icon">
              <i class="fas fa-trophy"></i>
            </div>
            <div class="contest-cs-badge">✨ ترقبوا التحديات الكبرى</div>
            <h2 class="contest-cs-title">سيتم فتحها قريباً!</h2>
            <p class="contest-cs-desc">
              نحن نقوم الآن بالتجهيزات النهائية لافتتاح أضخم مسابقات وتحديات تفاعلية مباشرة بين الشباب والطلاب على منصة Elevate.<br>
              ترقبوا الإطلاق الحصري وأول مواجهة مباشرة قريباً جداً!
            </p>
            <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:20px;">
              <a href="index.html" class="contest-cs-btn">
                <i class="fas fa-home"></i> العودة للرئيسية
              </a>
              <button type="button" class="contest-cs-btn" style="background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.2);" onclick="PlatformContests.showComingSoonNotice(event)">
                <i class="fas fa-bell"></i> تنبيهي عند الفتح
              </button>
            </div>
          </div>
        </div>
      `;
    },

    applySiteVisibility() {
      const vis = this.getVisibility();

      // Hero button
      const heroBtn = document.getElementById("hero-contest-btn");
      if (heroBtn) {
        if (vis === "hidden") {
          heroBtn.style.display = "none";
        } else if (vis === "coming_soon") {
          heroBtn.style.display = "";
          heroBtn.onclick = (e) => {
            PlatformContests.showComingSoonNotice(e);
            return false;
          };
          let badge = heroBtn.querySelector(".contest-soon-pill");
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "contest-soon-pill";
            badge.textContent = "قريباً";
            heroBtn.appendChild(badge);
          }
        } else {
          heroBtn.style.display = "";
          heroBtn.onclick = null;
          heroBtn.href = "?view=contests";
          const badge = heroBtn.querySelector(".contest-soon-pill");
          if (badge) badge.remove();
        }
      }

      // Other links on page
      const allLinks = document.querySelectorAll('a[href*="view=contests"]');
      allLinks.forEach((link) => {
        if (link === heroBtn) return;
        if (vis === "hidden") {
          link.style.display = "none";
        } else if (vis === "coming_soon") {
          link.style.display = "";
          link.onclick = (e) => {
            PlatformContests.showComingSoonNotice(e);
            return false;
          };
          let badge = link.querySelector(".contest-soon-pill");
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "contest-soon-pill";
            badge.textContent = "قريباً";
            link.appendChild(badge);
          }
        } else {
          link.style.display = "";
          link.onclick = null;
          const badge = link.querySelector(".contest-soon-pill");
          if (badge) badge.remove();
        }
      });
    },

    // ==========================================
    // Storage Getters / Setters
    // ==========================================
    getState() {
      const stored = localStorage.getItem("luxen_contests_state");
      if (!stored) {
        localStorage.setItem("luxen_contests_state", JSON.stringify(DEFAULT_STATE));
        return DEFAULT_STATE;
      }
      try {
        return JSON.parse(stored);
      } catch (e) {
        return DEFAULT_STATE;
      }
    },

    saveState(state) {
      localStorage.setItem("luxen_contests_state", JSON.stringify(state));
    },

    getApplicants() {
      const stored = localStorage.getItem("luxen_contests_applicants");
      return stored ? JSON.parse(stored) : [];
    },

    saveApplicants(list) {
      localStorage.setItem("luxen_contests_applicants", JSON.stringify(list));
    },

    getChat() {
      const stored = localStorage.getItem("luxen_contests_chat");
      return stored ? JSON.parse(stored) : [];
    },

    saveChat(chat) {
      localStorage.setItem("luxen_contests_chat", JSON.stringify(chat));
    },

    getLikes() {
      return parseInt(localStorage.getItem("luxen_contests_likes") || "142", 10);
    },

    setLikes(num) {
      localStorage.setItem("luxen_contests_likes", String(num));
    },

    getHistory() {
      const stored = localStorage.getItem("luxen_contests_history");
      return stored ? JSON.parse(stored) : [];
    },

    saveHistory(history) {
      localStorage.setItem("luxen_contests_history", JSON.stringify(history));
    },

    getCurrentUser() {
      if (typeof App !== "undefined" && typeof App.getUser === "function") {
        const u = App.getUser();
        if (u && u.username) return u;
      }
      return {
        username: "مشارك_" + Math.random().toString(36).substr(2, 4),
        fullName: "زائر المنصة",
      };
    },

    // ==========================================
    // Initialization
    // ==========================================
    init() {
      this.render();
      if (this.countdownInterval) clearInterval(this.countdownInterval);
      const state = this.getState();
      if (state.status === "scheduled" && state.schedule && state.schedule.targetTimestamp) {
        this.initCountdown(state.schedule.targetTimestamp);
      }
    },

    // ==========================================
    // Public View Rendering
    // ==========================================
    render() {
      const container = document.getElementById("contests-view");
      if (!container) return;

      const state = this.getState();
      const applicants = this.getApplicants();

      container.innerHTML = `
        <div class="arena-bg-effects"></div>
        <div class="arena-container">
          <!-- Hero Header -->
          <div class="arena-hero">
            <div class="arena-badge">
              <i class="fas fa-trophy"></i>
              <span>ساحة مسابقات وتحديات Elevate الرسمية</span>
            </div>
            <h1 class="arena-title">
              مسابقات المنصة المباشرة <span>وجهاً لوجه ⚔️</span>
            </h1>
            <p class="arena-subtitle">
              المواجهات الثنائية المباشرة في الثقافة والمهارات والعلوم بين طلاب وأعضاء المنصة، مع بث حي، أسئلة مباشرة، وتحديات صوتية حماسية!
            </p>
          </div>

          <!-- Dynamic Phase Content -->
          ${
            state.status === "live"
              ? this.renderLivePhase(state)
              : state.status === "scheduled"
                ? this.renderScheduledPhase(state)
                : state.status === "ended"
                  ? this.renderEndedPhase(state)
                  : this.renderRegistrationPhase(applicants)
          }
        </div>
      `;

      if (state.status === "live") {
        this.initSpectatorStream();
      }
    },

    // ==========================================
    // Phase 1: Registration (التقديم في المسابقة)
    // ==========================================
    renderRegistrationPhase(applicants) {
      const count = applicants.length;

      return `
        <!-- Applicant Counter Card -->
        <div class="arena-reg-card">
          <div class="arena-reg-counter-box">
            <span style="font-size:0.9rem; font-weight:800; color:#cbd5e1;">إجمالي المتقدمين للمنافسة القادمة</span>
            <div class="arena-reg-counter-number" id="arena-live-applicants-count">${count}</div>
            <span style="font-size:0.8rem; color:#10b981; font-weight:700;"><i class="fas fa-arrow-trend-up"></i> باب التقديم مفتوح لجميع الأعضاء الآن</span>
          </div>

          <h3 style="font-size:1.25rem; font-weight:900; color:#fff; text-align:center; margin:0 0 10px 0;">
            <i class="fas fa-file-pen" style="color:#f59e0b; margin-left:8px;"></i> استمارة التقديم في مسابقات المنصة
          </h3>
          <p style="text-align:center; color:#94a3b8; font-size:0.85rem; margin:0 0 24px 0;">
            املأ بياناتك بدقة ليتم اختيارك بواسطة إدارة المنصة للمواجهة الحية القادمة أمام المشاهدين!
          </p>

          <form onsubmit="PlatformContests.handleApplicantSubmit(event)">
            <div class="arena-field-group">
              <label class="arena-label">الاسم الكامل *</label>
              <input type="text" id="arena-app-name" class="arena-input" placeholder="مثال: أحمد محمد مصطفى" required>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
              <div class="arena-field-group">
                <label class="arena-label">السن *</label>
                <input type="number" id="arena-app-age" class="arena-input" placeholder="مثال: 21" min="12" max="65" required>
              </div>
              <div class="arena-field-group">
                <label class="arena-label">رقم الهاتف / واتساب *</label>
                <input type="tel" id="arena-app-phone" class="arena-input" placeholder="010XXXXXXXX" required>
              </div>
            </div>

            <div class="arena-field-group">
              <label class="arena-label">المجالات والتخصص الأكاديمي أو المهني *</label>
              <input type="text" id="arena-app-field" class="arena-input" placeholder="مثال: حاسبات ومعلومات، لغات وترجمة، طب، ثقافة عامة..." required>
            </div>

            <div class="arena-field-group">
              <label class="arena-label">الخبرات والمهارات السابقة أو الجوائز</label>
              <textarea id="arena-app-exp" rows="3" class="arena-textarea" placeholder="اذكر نبذة عن خبراتك أو المسابقات التي شاركت بها سابقاً..."></textarea>
            </div>

            <button type="submit" class="arena-submit-btn">
              <i class="fas fa-paper-plane"></i> إرسال طلب الاشتراك في المسابقة
            </button>
          </form>
        </div>
      `;
    },

    handleApplicantSubmit(e) {
      e.preventDefault();

      const name = document.getElementById("arena-app-name").value.trim();
      const age = document.getElementById("arena-app-age").value.trim();
      const phone = document.getElementById("arena-app-phone").value.trim();
      const field = document.getElementById("arena-app-field").value.trim();
      const exp = document.getElementById("arena-app-exp").value.trim();

      const user = this.getCurrentUser();
      const applicants = this.getApplicants();

      const newApplicant = {
        id: "app_" + Date.now(),
        name: name,
        age: age,
        phone: phone,
        field: field,
        experience: exp,
        username: user.username,
        timestamp: Date.now(),
        dateFormatted: new Date().toLocaleDateString("ar-EG"),
      };

      applicants.push(newApplicant);
      this.saveApplicants(applicants);

      alert(
        `🎉 تم تسجيل طلبك بنجاح يا ${name}!\n\nأنت الآن في قائمة المرشحين لمسابقات Elevate القادمة. ستتواصل الإدارة معك فور اختيارك وتحديد موعد المواجهة!`,
      );
      this.render();
    },

    // ==========================================
    // Phase 2: Scheduled Match & Countdown (تحديد الموعد والعداد)
    // ==========================================
    renderScheduledPhase(state) {
      const c1 = state.contestant1 || { name: "المتسابق الأول", age: "—" };
      const c2 = state.contestant2 || { name: "المتسابق الثاني", age: "—" };
      const sch = state.schedule || {};

      return `
        <div class="arena-countdown-card">
          <div class="arena-countdown-header">
            <span class="arena-badge" style="margin-bottom:8px;"><i class="fas fa-calendar-check"></i> تم اعتماد المواجهة وتحديد الموعد</span>
            <h3>المواجهة الحية القادمة على منصة Elevate</h3>
            <p>يوم ${this.escapeHtml(sch.day || "القادم")} (${this.escapeHtml(sch.date || "")}) — الساعة ${this.escapeHtml(sch.time || "8:00 مساءً")}</p>
          </div>

          <!-- The Two Contestant Preview Cards -->
          <div class="arena-vs-grid" style="max-width:850px; margin:24px auto;">
            <!-- Contestant 1 -->
            <div class="arena-contestant-card contestant-1">
              <div class="arena-contestant-avatar">${this.escapeHtml((c1.name || "?").charAt(0).toUpperCase())}</div>
              <h4 class="arena-contestant-name">${this.escapeHtml(c1.name)}</h4>
              <span class="arena-contestant-age">السن: ${this.escapeHtml(c1.age)} سنة</span>
              <span class="arena-mic-status"><i class="fas fa-user-check"></i> متنافس معتمد</span>
            </div>

            <!-- VS -->
            <div class="arena-vs-badge-wrap">
              <div class="arena-vs-badge">VS</div>
            </div>

            <!-- Contestant 2 -->
            <div class="arena-contestant-card contestant-2">
              <div class="arena-contestant-avatar">${this.escapeHtml((c2.name || "?").charAt(0).toUpperCase())}</div>
              <h4 class="arena-contestant-name">${this.escapeHtml(c2.name)}</h4>
              <span class="arena-contestant-age">السن: ${this.escapeHtml(c2.age)} سنة</span>
              <span class="arena-mic-status"><i class="fas fa-user-check"></i> متنافس معتمد</span>
            </div>
          </div>

          <!-- Live Countdown Timer Boxes -->
          <div class="arena-timer-grid" id="arena-timer-container">
            <div class="arena-timer-box">
              <div class="arena-timer-number" id="arena-cd-days">00</div>
              <div class="arena-timer-label">أيام</div>
            </div>
            <div class="arena-timer-box">
              <div class="arena-timer-number" id="arena-cd-hours">00</div>
              <div class="arena-timer-label">ساعات</div>
            </div>
            <div class="arena-timer-box">
              <div class="arena-timer-number" id="arena-cd-minutes">00</div>
              <div class="arena-timer-label">دقائق</div>
            </div>
            <div class="arena-timer-box">
              <div class="arena-timer-number" id="arena-cd-seconds">00</div>
              <div class="arena-timer-label">ثواني</div>
            </div>
          </div>

          <p style="color:#94a3b8; font-size:0.85rem; margin:16px 0 0 0;">
            <i class="fas fa-bell"></i> سيتم فتح البث المباشر وبدء التحدي والمايك فور انتهاء العداد وتأكيد الإدارة!
          </p>
        </div>
      `;
    },

    initCountdown(targetTimestamp) {
      const updateTimer = () => {
        const now = Date.now();
        const diff = targetTimestamp - now;

        if (diff <= 0) {
          if (this.countdownInterval) clearInterval(this.countdownInterval);
          const d = document.getElementById("arena-cd-days");
          const h = document.getElementById("arena-cd-hours");
          const m = document.getElementById("arena-cd-minutes");
          const s = document.getElementById("arena-cd-seconds");
          if (d) d.textContent = "00";
          if (h) h.textContent = "00";
          if (m) m.textContent = "00";
          if (s) s.textContent = "00";
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const d = document.getElementById("arena-cd-days");
        const h = document.getElementById("arena-cd-hours");
        const m = document.getElementById("arena-cd-minutes");
        const s = document.getElementById("arena-cd-seconds");
        if (d) d.textContent = String(days).padStart(2, "0");
        if (h) h.textContent = String(hours).padStart(2, "0");
        if (m) m.textContent = String(minutes).padStart(2, "0");
        if (s) s.textContent = String(seconds).padStart(2, "0");
      };

      updateTimer();
      this.countdownInterval = setInterval(updateTimer, 1000);
    },

    // ==========================================
    // Phase 3: LIVE BATTLE ARENA (المسابقة جارية الآن)
    // ==========================================
    renderLivePhase(state) {
      const c1 = state.contestant1 || { name: "المتسابق الأول", age: "—", score: 0 };
      const c2 = state.contestant2 || { name: "المتسابق الثاني", age: "—", score: 0 };
      const likes = this.getLikes();
      const chat = this.getChat();

      const q = state.currentQuestion;
      const spk = state.activeSpeaker;

      return `
        <div class="arena-stage-wrapper">
          <!-- Live Status Bar -->
          <div class="arena-stage-topbar">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="arena-live-pill"><span class="arena-live-dot"></span> بث مباشر وتحدي حي</span>
              <span class="arena-spectators-pill" id="arena-spectators-count">
                <i class="fas fa-eye" style="color:#60a5fa;"></i> <span>${this.spectatorCount}</span> يشاهدون الآن
              </span>
            </div>

            <div style="display:flex; align-items:center; gap:10px;">
              <button class="arena-reaction-btn" onclick="PlatformContests.sendLiveLike()" style="background:rgba(239,68,68,0.2); border-color:rgba(239,68,68,0.4); color:#f87171; font-weight:800; font-size:0.85rem; padding:6px 16px;">
                <i class="fas fa-heart"></i> <span id="arena-live-likes-counter">${likes}</span> إعجاب
              </button>
            </div>
          </div>

          <!-- Active Announcement (First Speaker / Correct Answer) -->
          ${
            spk
              ? `
            <div class="arena-active-announcement">
              <i class="fas fa-bullhorn" style="font-size:22px;"></i>
              <span>🎯 <strong>${this.escapeHtml(spk.name)}</strong>: ${this.escapeHtml(spk.text)}</span>
            </div>
          `
              : ""
          }

          <!-- Two Contestant Cards (VS Battle Grid) -->
          <div class="arena-vs-grid">
            <!-- Contestant 1 Card -->
            <div class="arena-contestant-card contestant-1 ${spk && spk.name === c1.name ? "active-speaker" : ""}">
              <div class="arena-contestant-avatar">${this.escapeHtml((c1.name || "?").charAt(0).toUpperCase())}</div>
              <h3 class="arena-contestant-name">${this.escapeHtml(c1.name)}</h3>
              <span class="arena-contestant-age">السن: ${this.escapeHtml(c1.age)} سنة</span>
              <div class="arena-contestant-score">
                <i class="fas fa-star" style="color:#fbbf24;"></i>
                <span>${c1.score || 0}</span> <span style="font-size:0.9rem; color:#94a3b8; font-weight:normal;">نقاط</span>
              </div>
              <span class="arena-mic-status ${spk && spk.name === c1.name ? "speaking" : ""}">
                <i class="fas ${spk && spk.name === c1.name ? "fa-microphone-lines" : "fa-microphone"}"></i>
                ${spk && spk.name === c1.name ? "تكلّم أولاً!" : "المايك جاهز"}
              </span>
            </div>

            <!-- VS Badge -->
            <div class="arena-vs-badge-wrap">
              <div class="arena-vs-badge">VS</div>
              <span style="font-size:0.75rem; color:#94a3b8; font-weight:800; margin-top:6px;">مواجهة مباشرة</span>
            </div>

            <!-- Contestant 2 Card -->
            <div class="arena-contestant-card contestant-2 ${spk && spk.name === c2.name ? "active-speaker" : ""}">
              <div class="arena-contestant-avatar">${this.escapeHtml((c2.name || "?").charAt(0).toUpperCase())}</div>
              <h3 class="arena-contestant-name">${this.escapeHtml(c2.name)}</h3>
              <span class="arena-contestant-age">السن: ${this.escapeHtml(c2.age)} سنة</span>
              <div class="arena-contestant-score">
                <i class="fas fa-star" style="color:#fbbf24;"></i>
                <span>${c2.score || 0}</span> <span style="font-size:0.9rem; color:#94a3b8; font-weight:normal;">نقاط</span>
              </div>
              <span class="arena-mic-status ${spk && spk.name === c2.name ? "speaking" : ""}">
                <i class="fas ${spk && spk.name === c2.name ? "fa-microphone-lines" : "fa-microphone"}"></i>
                ${spk && spk.name === c2.name ? "تكلّم أولاً!" : "المايك جاهز"}
              </span>
            </div>
          </div>

          <!-- Live Round Box (Questions & Voice Challenge) -->
          <div class="arena-question-box">
            <div class="arena-question-header">
              <span style="color:#fbbf24; font-weight:800; font-size:0.85rem;">
                <i class="fas fa-circle-question"></i> السؤال الحي والمباشر الحالي
              </span>
              <span class="arena-badge" style="margin:0; padding:3px 10px; font-size:0.75rem;">تحدي النقاط</span>
            </div>

            ${
              q
                ? `
              <h3 class="arena-question-text">${this.escapeHtml(q.text)}</h3>
              <div class="arena-options-grid">
                ${(q.options || [])
                  .map(
                    (opt, i) => `
                  <button type="button" class="arena-option-btn ${q.revealed && i === q.correctIndex ? "correct" : ""}">
                    <strong>${["أ", "ب", "ج", "د"][i] || i + 1})</strong> ${this.escapeHtml(opt)}
                  </button>
                `,
                  )
                  .join("")}
              </div>
            `
                : `
              <div style="text-align:center; padding:25px; color:#94a3b8;">
                <i class="fas fa-spinner fa-spin" style="font-size:24px; color:#f59e0b; margin-bottom:10px; display:block;"></i>
                جارٍ طرح السؤال التالي من قِبل إدارة المنصة... استعدوا!
              </div>
            `
            }
          </div>

          <!-- Spectators Area: Live Chat & Reactions -->
          <div class="arena-spectators-area">
            <!-- Spectator Comments Stream -->
            <div class="arena-chat-box">
              <div class="arena-chat-header">
                <span><i class="fas fa-comments" style="color:#818cf8; margin-left:6px;"></i> تعليقات المشاهدين المباشرة</span>
                <span style="font-size:0.75rem; color:#94a3b8;">بث تفاعلي</span>
              </div>

              <div class="arena-chat-stream custom-scrollbar" id="arena-chat-stream">
                ${chat
                  .map(
                    (m) => `
                  <div class="arena-chat-msg">
                    <span class="arena-chat-sender">@${this.escapeHtml(m.sender)}:</span>
                    <span class="arena-chat-body">${this.escapeHtml(m.text)}</span>
                  </div>
                `,
                  )
                  .join("")}

                ${
                  chat.length === 0
                    ? `
                  <div style="text-align:center; padding:30px; color:#64748b; font-size:0.82rem;">
                    لا توجد تعليقات بعد، اكتب تشجيعك للمتسابقين الآن!
                  </div>
                `
                    : ""
                }
              </div>

              <div class="arena-chat-footer">
                <input type="text" id="arena-chat-input" class="arena-chat-input" placeholder="اكتب تعليقك وتشجيعك المباشر..." onkeydown="if(event.key==='Enter') PlatformContests.sendLiveComment()">
                <button type="button" class="arena-chat-send-btn" onclick="PlatformContests.sendLiveComment()"><i class="fas fa-paper-plane"></i></button>
              </div>
            </div>

            <!-- Spectator Fast Reactions Box -->
            <div style="background:#111827; border:1px solid var(--arena-border); border-radius:20px; padding:20px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
              <h4 style="font-size:0.95rem; font-weight:800; color:#fff; margin:0 0 6px 0;"><i class="fas fa-fire" style="color:#ef4444;"></i> تفاعل الجمهور المباشر</h4>
              <p style="font-size:0.8rem; color:#94a3b8; margin:0 0 16px 0;">أرسل تفاعلك وحماسك للمتنافسين لتشجيعهم لحظياً!</p>
              
              <div class="arena-reactions-bar">
                <button type="button" class="arena-reaction-btn" onclick="PlatformContests.sendReaction('🔥')">🔥</button>
                <button type="button" class="arena-reaction-btn" onclick="PlatformContests.sendReaction('👏')">👏</button>
                <button type="button" class="arena-reaction-btn" onclick="PlatformContests.sendReaction('🎯')">🎯</button>
                <button type="button" class="arena-reaction-btn" onclick="PlatformContests.sendReaction('💡')">💡</button>
                <button type="button" class="arena-reaction-btn" onclick="PlatformContests.sendReaction('❤️')">❤️</button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    // ==========================================
    // Phase 4: Ended Phase (تتويج الفائز)
    // ==========================================
    renderEndedPhase(state) {
      const winner = state.winner || state.contestant1;
      const c1 = state.contestant1;
      const c2 = state.contestant2;

      return `
        <div class="arena-countdown-card" style="border-color:#10b981;">
          <div style="font-size:60px; color:#fbbf24; margin-bottom:12px;"><i class="fas fa-trophy"></i></div>
          <h2 style="font-size:1.8rem; font-weight:900; color:#fff; margin:0 0 6px 0;">
            مبروك للفائز: <span style="color:#34d399;">${this.escapeHtml(winner ? winner.name : "البطل")}</span>!
          </h2>
          <p style="color:#94a3b8; font-size:0.92rem; margin:0 0 24px 0;">
            انتهت المواجهة الحية بروح رياضية وتنافس علمي وثقافي راقٍ.
          </p>

          <div style="display:flex; justify-content:center; gap:20px; flex-wrap:wrap; margin-bottom:24px;">
            <div class="arena-timer-box" style="border-color:rgba(59,130,246,0.3); min-width:140px;">
              <div style="font-size:0.8rem; color:#94a3b8;">${this.escapeHtml(c1 ? c1.name : "المتسابق 1")}</div>
              <div class="arena-timer-number" style="color:#60a5fa;">${c1 ? c1.score : 0}</div>
              <div class="arena-timer-label">نقاط</div>
            </div>
            <div class="arena-timer-box" style="border-color:rgba(245,158,11,0.3); min-width:140px;">
              <div style="font-size:0.8rem; color:#94a3b8;">${this.escapeHtml(c2 ? c2.name : "المتسابق 2")}</div>
              <div class="arena-timer-number" style="color:#fbbf24;">${c2 ? c2.score : 0}</div>
              <div class="arena-timer-label">نقاط</div>
            </div>
          </div>

          <p style="color:#cbd5e1; font-size:0.85rem; margin:0;">
            ترقبوا المواجهة والتحدي المباشر القادم قريباً في مسابقات Elevate!
          </p>
        </div>
      `;
    },

    // ==========================================
    // Spectator Interactions (Chat, Likes & Reactions)
    // ==========================================
    initSpectatorStream() {
      // Simulate realistic subtle live spectator fluctuation
      if (!this.spectatorInterval) {
        this.spectatorInterval = setInterval(() => {
          this.spectatorCount += (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3);
          if (this.spectatorCount < 180) this.spectatorCount = 185;
          const el = document.getElementById("arena-spectators-count");
          if (el)
            el.innerHTML = `<i class="fas fa-eye" style="color:#60a5fa;"></i> <span>${this.spectatorCount}</span> يشاهدون الآن`;
        }, 4000);
      }
    },

    sendLiveComment() {
      const input = document.getElementById("arena-chat-input");
      const text = input ? input.value.trim() : "";
      if (!text) return;

      const user = this.getCurrentUser();
      const chat = this.getChat();

      chat.push({
        id: "c_" + Date.now(),
        sender: user.fullName || user.username,
        text: text,
        timestamp: Date.now(),
      });

      // Keep last 40 comments
      if (chat.length > 40) chat.shift();
      this.saveChat(chat);

      if (input) input.value = "";
      this.renderChatStream();
    },

    renderChatStream() {
      const box = document.getElementById("arena-chat-stream");
      if (!box) return;
      const chat = this.getChat();

      box.innerHTML = chat
        .map(
          (m) => `
        <div class="arena-chat-msg">
          <span class="arena-chat-sender">@${this.escapeHtml(m.sender)}:</span>
          <span class="arena-chat-body">${this.escapeHtml(m.text)}</span>
        </div>
      `,
        )
        .join("");
      box.scrollTop = box.scrollHeight;
    },

    sendLiveLike() {
      const current = this.getLikes() + 1;
      this.setLikes(current);
      const el = document.getElementById("arena-live-likes-counter");
      if (el) el.textContent = current;
    },

    sendReaction(emoji) {
      this.sendLiveLike();
      const user = this.getCurrentUser();
      const chat = this.getChat();
      chat.push({
        id: "r_" + Date.now(),
        sender: user.fullName || user.username,
        text: emoji + " " + emoji + " " + emoji,
        timestamp: Date.now(),
      });
      if (chat.length > 40) chat.shift();
      this.saveChat(chat);
      this.renderChatStream();
    },

    escapeHtml(str) {
      return String(str || "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    },
  };

  // ==========================================================================
  // Platform Contests Admin Controller
  // (Integrated into Manager Dashboard #adm-sec-contests)
  // ==========================================================================
  const PlatformContestsAdmin = {
    activeTab: "control", // 'control' | 'applicants' | 'history'

    render() {
      const container = document.getElementById("adm-sec-contests");
      if (!container) return;

      const state = PlatformContests.getState();
      const applicants = PlatformContests.getApplicants();
      const history = PlatformContests.getHistory();

      // Update badge
      const badge = document.getElementById("admin-nav-contests-badge");
      if (badge) badge.textContent = applicants.length;

      container.innerHTML = `
        <div class="admin-contests-deck">
          <!-- State Banner -->
          <div class="admin-contests-state-banner">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-weight:900; font-size:1.15rem; color:#fff;">غرفة التحكم في مسابقات المنصة المباشرة</span>
                <span class="admin-chip-pro ${state.status === "live" ? "admin-chip-active" : "admin-chip-date"}">
                  ${state.status === "live" ? "🔴 بث حي مباشر جاري" : state.status === "scheduled" ? "⏳ مسابقة مجدولة بالعداد" : "📝 باب التقديم مفتوح"}
                </span>
              </div>
              <p style="margin:0; font-size:0.82rem; color:#94a3b8;">
                حدد المتنافسين، جدول المواعيد بالعداد التنازلي، اطرح الأسئلة الحية، وتحكم في المايك وإعلان الفائزين
              </p>
            </div>

            <!-- Tab Switcher -->
            <div style="display:flex; gap:8px;">
              <button class="admin-mini-btn ${this.activeTab === "control" ? "mini-on" : "mini-off"}" onclick="PlatformContestsAdmin.switchTab('control')">
                <i class="fas fa-sliders"></i> لوحة التحكم
              </button>
              <button class="admin-mini-btn ${this.activeTab === "applicants" ? "mini-on" : "mini-off"}" onclick="PlatformContestsAdmin.switchTab('applicants')">
                <i class="fas fa-users"></i> المتقدمين (${applicants.length})
              </button>
              <button class="admin-mini-btn ${this.activeTab === "history" ? "mini-on" : "mini-off"}" onclick="PlatformContestsAdmin.switchTab('history')">
                <i class="fas fa-box-archive"></i> سجل المسابقات (${history.length})
              </button>
            </div>
          </div>

          <!-- Main Content View -->
          ${
            this.activeTab === "control"
              ? this.renderControlView(state, applicants)
              : this.activeTab === "applicants"
                ? this.renderApplicantsView(applicants)
                : this.renderHistoryView(history)
          }
        </div>
      `;
    },

    switchTab(tab) {
      this.activeTab = tab;
      this.render();
    },

    // ==========================================
    // Control View (Matchmaking & Live Controls)
    // ==========================================
    renderControlView(state, applicants) {
      const c1 = state.contestant1 || {};
      const c2 = state.contestant2 || {};
      const sch = state.schedule || {};
      const vis = PlatformContests.getVisibility();

      return `
        <div style="display:flex; flex-direction:column; gap:20px;">
          <!-- 0. Master Site Visibility Controller -->
          <div class="admin-deck-full" style="padding:18px 22px; border-right: 4px solid #f59e0b; background: linear-gradient(135deg, rgba(245,158,11,0.06), rgba(0,0,0,0.4));">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
              <div>
                <div style="font-weight:900; color:#fff; font-size:1.05rem; display:flex; align-items:center; gap:8px;">
                  <i class="fas fa-eye" style="color:#f59e0b;"></i>
                  <span>التحكم في ظهور مسابقات المنصة في الموقع:</span>
                </div>
                <p style="margin:4px 0 0 0; font-size:0.82rem; color:#94a3b8;">
                  حدد ما إذا كانت المسابقات ظاهرة للجميع، أو مؤجلة تحت شارة "قريباً"، أو مخفية تماماً من الموقع.
                </p>
              </div>
              <div>
                <span class="admin-chip-pro" style="background:${vis === "active" ? "rgba(16,185,129,0.2)" : vis === "coming_soon" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}; border-color:${vis === "active" ? "#10b981" : vis === "coming_soon" ? "#f59e0b" : "#ef4444"}; color:${vis === "active" ? "#34d399" : vis === "coming_soon" ? "#fbbf24" : "#f87171"}; font-size:0.85rem; padding:6px 14px;">
                  ${vis === "active" ? "🟢 ظاهرة ومفعلة حالياً" : vis === "coming_soon" ? '🟡 في وضع "قريباً"' : "🔴 مخفية تماماً من الموقع"}
                </span>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
              <!-- Option 1: Active -->
              <div onclick="PlatformContestsAdmin.setVisibility('active')" class="contest-vis-card ${vis === "active" ? "active-vis" : ""}" style="cursor:pointer; padding:15px; border-radius:14px; border:2px solid ${vis === "active" ? "#10b981" : "rgba(255,255,255,0.08)"}; background:${vis === "active" ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)"}; box-shadow:${vis === "active" ? "0 0 15px rgba(16,185,129,0.25)" : "none"};">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <i class="fas fa-circle-check" style="color:#10b981; font-size:1.15rem;"></i>
                  <strong style="color:#fff; font-size:0.95rem;">ظاهرة ومفعلة للجميع</strong>
                </div>
                <p style="margin:0; font-size:0.78rem; color:#94a3b8; line-height:1.45;">
                  الأزرار والروابط ظاهرة في كل مكان، وتفتح صفحة المسابقات المباشرة فوراً.
                </p>
              </div>

              <!-- Option 2: Coming Soon -->
              <div onclick="PlatformContestsAdmin.setVisibility('coming_soon')" class="contest-vis-card ${vis === "coming_soon" ? "active-vis" : ""}" style="cursor:pointer; padding:15px; border-radius:14px; border:2px solid ${vis === "coming_soon" ? "#f59e0b" : "rgba(255,255,255,0.08)"}; background:${vis === "coming_soon" ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.03)"}; box-shadow:${vis === "coming_soon" ? "0 0 15px rgba(245,158,11,0.25)" : "none"};">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <i class="fas fa-hourglass-half" style="color:#f59e0b; font-size:1.15rem;"></i>
                  <strong style="color:#fff; font-size:0.95rem;">وضع "قريباً"</strong>
                </div>
                <p style="margin:0; font-size:0.78rem; color:#94a3b8; line-height:1.45;">
                  تظهر للمستخدمين مع شارة "قريباً"، وعند الضغط على الزر تظهر رسالة: "سيتم فتحها قريباً".
                </p>
              </div>

              <!-- Option 3: Hidden -->
              <div onclick="PlatformContestsAdmin.setVisibility('hidden')" class="contest-vis-card ${vis === "hidden" ? "active-vis" : ""}" style="cursor:pointer; padding:15px; border-radius:14px; border:2px solid ${vis === "hidden" ? "#ef4444" : "rgba(255,255,255,0.08)"}; background:${vis === "hidden" ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.03)"}; box-shadow:${vis === "hidden" ? "0 0 15px rgba(239,68,68,0.25)" : "none"};">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <i class="fas fa-eye-slash" style="color:#ef4444; font-size:1.15rem;"></i>
                  <strong style="color:#fff; font-size:0.95rem;">إخفاء تام من الموقع</strong>
                </div>
                <p style="margin:0; font-size:0.78rem; color:#94a3b8; line-height:1.45;">
                  تختفي الأزرار تماماً من الموقع (الهيدر، الموبايل، والصفحة الرئيسية) كأنها غير موجودة.
                </p>
              </div>
            </div>
          </div>

          <!-- 1. Quick Master Switcher -->
          <div class="admin-deck-full" style="padding:16px 20px;">
            <div style="font-weight:800; color:#fff; margin-bottom:12px; font-size:0.95rem;"><i class="fas fa-power-off" style="color:#f59e0b; margin-left:6px;"></i> تحديد حالة ساحة المسابقات الحالية:</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="admin-mini-btn ${state.status === "registration" ? "mini-on" : "mini-off"}" onclick="PlatformContestsAdmin.setMatchStatus('registration')">
                <i class="fas fa-file-pen"></i> فتح باب التقديم للمنافسة
              </button>
              <button class="admin-mini-btn ${state.status === "scheduled" ? "mini-on" : "mini-off"}" onclick="PlatformContestsAdmin.setMatchStatus('scheduled')">
                <i class="fas fa-clock"></i> تفعيل الموعد والعداد التنازلي
              </button>
              <button class="admin-mini-btn ${state.status === "live" ? "mini-on" : "mini-off"}" style="${state.status === "live" ? "background:#ef4444; color:#fff;" : ""}" onclick="PlatformContestsAdmin.setMatchStatus('live')">
                <i class="fas fa-circle-play"></i> فتح المسابقة وبدء البث المباشر فوراً!
              </button>
              <button class="admin-mini-btn mini-del" onclick="PlatformContestsAdmin.endAndArchiveMatch()">
                <i class="fas fa-stop"></i> إيقاف وحفظ في السجل
              </button>
              <button class="admin-mini-btn" style="background:#64748b; color:#fff;" onclick="PlatformContestsAdmin.resetToNewContest()">
                <i class="fas fa-rotate-right"></i> مسابقة جديدة تماماً
              </button>
            </div>
          </div>

          <!-- 2. Matchmaking Deck: Pick Contestants & Schedule -->
          <div class="admin-two-cols-grid">
            <!-- Form Card -->
            <div class="admin-deck-full">
              <div class="prof-card-header" style="color:#f59e0b; margin-bottom:14px;">
                <span><i class="fas fa-user-plus"></i> تعيين المتنافسين وموعد المواجهة</span>
              </div>

              <form onsubmit="PlatformContestsAdmin.saveMatchmaking(event)">
                <!-- Contestant 1 -->
                <div style="background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.3); border-radius:12px; padding:12px; margin-bottom:12px;">
                  <strong style="color:#60a5fa; font-size:0.85rem; display:block; margin-bottom:8px;">المتسابق الأول (الطرف الأزرق):</strong>
                  <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                    <input type="text" id="adm-c1-name" class="admin-search-input-pro" placeholder="اسم المتسابق الأول" value="${PlatformContests.escapeHtml(c1.name || "")}" required>
                    <input type="number" id="adm-c1-age" class="admin-search-input-pro" placeholder="السن" value="${PlatformContests.escapeHtml(c1.age || "")}" required>
                  </div>
                </div>

                <!-- Contestant 2 -->
                <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:12px; padding:12px; margin-bottom:12px;">
                  <strong style="color:#fbbf24; font-size:0.85rem; display:block; margin-bottom:8px;">المتسابق الثاني (الطرف البرتقالي):</strong>
                  <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                    <input type="text" id="adm-c2-name" class="admin-search-input-pro" placeholder="اسم المتسابق الثاني" value="${PlatformContests.escapeHtml(c2.name || "")}" required>
                    <input type="number" id="adm-c2-age" class="admin-search-input-pro" placeholder="السن" value="${PlatformContests.escapeHtml(c2.age || "")}" required>
                  </div>
                </div>

                <!-- Schedule Details -->
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--arena-border); border-radius:12px; padding:12px; margin-bottom:14px;">
                  <strong style="color:#cbd5e1; font-size:0.85rem; display:block; margin-bottom:8px;">تحديد موعد المسابقة:</strong>
                  <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
                    <input type="text" id="adm-sch-day" class="admin-search-input-pro" placeholder="اليوم (مثل: الخميس)" value="${PlatformContests.escapeHtml(sch.day || "")}">
                    <input type="date" id="adm-sch-date" class="admin-search-input-pro" value="${PlatformContests.escapeHtml(sch.date || "")}">
                    <input type="text" id="adm-sch-time" class="admin-search-input-pro" placeholder="الوقت (مثل: 8:00 م)" value="${PlatformContests.escapeHtml(sch.time || "")}">
                  </div>
                </div>

                <div style="display:flex; gap:10px;">
                  <button type="submit" class="a-submit-btn" style="flex:1; margin:0; background:var(--arena-gold-gradient); color:#000;">
                    <i class="fas fa-save"></i> حفظ البيانات وتشغيل العداد
                  </button>
                  <button type="button" class="admin-mini-btn" style="background:#3b82f6; color:#fff;" onclick="PlatformContestsAdmin.notifyContestants()">
                    <i class="fas fa-paper-plane"></i> إرسال إشعار للمتسابقين
                  </button>
                </div>
              </form>
            </div>

            <!-- Live Match Operations Deck -->
            <div class="admin-deck-full">
              <div class="prof-card-header" style="color:#ef4444; margin-bottom:14px;">
                <span><i class="fas fa-gamepad"></i> إدارة المواجهة الحية (أثناء البث)</span>
              </div>

              <!-- Push Question Box -->
              <div style="background:rgba(255,255,255,0.04); border:1px solid var(--arena-border); border-radius:12px; padding:14px; margin-bottom:14px;">
                <label class="admin-field-label">طرح سؤال حي على المتسابقين:</label>
                <input type="text" id="adm-live-q-text" class="admin-search-input-pro" placeholder="اكتب نص السؤال هنا..." style="margin-bottom:8px;">
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-bottom:8px;">
                  <input type="text" id="adm-live-opt-0" class="admin-search-input-pro" placeholder="الخيار أ">
                  <input type="text" id="adm-live-opt-1" class="admin-search-input-pro" placeholder="الخيار ب">
                  <input type="text" id="adm-live-opt-2" class="admin-search-input-pro" placeholder="الخيار ج">
                  <input type="text" id="adm-live-opt-3" class="admin-search-input-pro" placeholder="الخيار د">
                </div>

                <div style="display:flex; gap:10px; align-items:center;">
                  <select id="adm-live-q-correct" class="admin-select-pro" style="flex:1;">
                    <option value="0">الخيار (أ) هو الصحيح</option>
                    <option value="1">الخيار (ب) هو الصحيح</option>
                    <option value="2">الخيار (ج) هو الصحيح</option>
                    <option value="3">الخيار (د) هو الصحيح</option>
                  </select>
                  <button type="button" class="admin-mini-btn" style="background:#10b981; color:#fff;" onclick="PlatformContestsAdmin.pushQuestion()">
                    <i class="fas fa-bullhorn"></i> طرح السؤال للجمهور
                  </button>
                </div>
              </div>

              <!-- Voice & Buzzer Award Controllers -->
              <div style="background:rgba(255,255,255,0.04); border:1px solid var(--arena-border); border-radius:12px; padding:14px; margin-bottom:14px;">
                <label class="admin-field-label">التحدي الصوتي وتأكيد الإجابة الصحيحة:</label>
                <div style="display:flex; gap:10px; flex-direction:column;">
                  <button type="button" class="admin-mini-btn" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; padding:10px; font-weight:800;" onclick="PlatformContestsAdmin.awardSpeakerPoint(1)">
                    <i class="fas fa-microphone"></i> ${c1.name || "المتسابق 1"} تكلّم أولاً وإجابته صحيحة (+1 نقطة)
                  </button>
                  <button type="button" class="admin-mini-btn" style="background:linear-gradient(135deg,#f59e0b,#d97706); color:#000; padding:10px; font-weight:800;" onclick="PlatformContestsAdmin.awardSpeakerPoint(2)">
                    <i class="fas fa-microphone"></i> ${c2.name || "المتسابق 2"} تكلّم أولاً وإجابته صحيحة (+1 نقطة)
                  </button>
                  <button type="button" class="admin-mini-btn" style="background:rgba(255,255,255,0.08); color:#cbd5e1;" onclick="PlatformContestsAdmin.clearSpeaker()">
                    <i class="fas fa-times"></i> مسح شريط التحدث الصوتي
                  </button>
                </div>
              </div>

              <!-- Final Winner Declaration -->
              <div style="display:flex; gap:8px;">
                <button type="button" class="admin-mini-btn" style="background:#10b981; color:#fff; flex:1;" onclick="PlatformContestsAdmin.declareWinner(1)">
                  <i class="fas fa-crown"></i> تتويج ${c1.name || "المتسابق 1"} فائزاً
                </button>
                <button type="button" class="admin-mini-btn" style="background:#10b981; color:#fff; flex:1;" onclick="PlatformContestsAdmin.declareWinner(2)">
                  <i class="fas fa-crown"></i> تتويج ${c2.name || "المتسابق 2"} فائزاً
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    saveMatchmaking(e) {
      e.preventDefault();

      const name1 = document.getElementById("adm-c1-name").value.trim();
      const age1 = document.getElementById("adm-c1-age").value.trim();
      const name2 = document.getElementById("adm-c2-name").value.trim();
      const age2 = document.getElementById("adm-c2-age").value.trim();

      const day = document.getElementById("adm-sch-day").value.trim();
      const date = document.getElementById("adm-sch-date").value.trim();
      const time = document.getElementById("adm-sch-time").value.trim();

      let targetTimestamp = 0;
      if (date) {
        targetTimestamp = new Date(date + "T20:00:00").getTime();
      }

      const state = PlatformContests.getState();
      state.contestant1 = {
        name: name1,
        age: age1,
        score: state.contestant1.score || 0,
        status: "ready",
      };
      state.contestant2 = {
        name: name2,
        age: age2,
        score: state.contestant2.score || 0,
        status: "ready",
      };
      state.schedule = { day: day, date: date, time: time, targetTimestamp: targetTimestamp };
      state.status = "scheduled";
      state.isTimerRunning = true;

      PlatformContests.saveState(state);
      alert("تم حفظ المتنافسين وتفعيل العداد التنازلي للمسابقة في الصفحة بنجاح!");
      this.render();
    },

    notifyContestants() {
      const state = PlatformContests.getState();
      const notifs = JSON.parse(localStorage.getItem("luxen_notifications") || "[]");

      notifs.push({
        id: "notif_" + Date.now(),
        title: "تم اختيارك لمسابقات Elevate المباشرة! ⚔️",
        message: `تم تحديد مواجهتك القادمة ضد ${state.contestant2.name || "المنافس"} يوم ${state.schedule.day || "القادم"} الساعة ${state.schedule.time || "8:00 مساءً"}. استعد جيداً!`,
        link: "?view=contests",
        date: new Date().toLocaleDateString("ar-EG"),
        timestamp: Date.now(),
        read: false,
      });

      localStorage.setItem("luxen_notifications", JSON.stringify(notifs));
      alert("تم إرسال إشعار التحديد للمتسابقين بنجاح!");
    },

    setMatchStatus(status) {
      const state = PlatformContests.getState();
      state.status = status;
      PlatformContests.saveState(state);
      this.render();
      alert(
        `تم تحويل حالة ساحة المسابقة إلى: ${status === "live" ? "بث حي مباشر" : status === "scheduled" ? "مجدولة بالعداد" : "باب التقديم مفتوح"}`,
      );
    },

    pushQuestion() {
      const text = document.getElementById("adm-live-q-text").value.trim();
      const opt0 = document.getElementById("adm-live-opt-0").value.trim();
      const opt1 = document.getElementById("adm-live-opt-1").value.trim();
      const opt2 = document.getElementById("adm-live-opt-2").value.trim();
      const opt3 = document.getElementById("adm-live-opt-3").value.trim();
      const correct = parseInt(document.getElementById("adm-live-q-correct").value, 10);

      if (!text) return alert("يرجى كتابة نص السؤال أولاً.");

      const state = PlatformContests.getState();
      state.currentQuestion = {
        text: text,
        options: [opt0 || "نعم", opt1 || "لا", opt2 || "غير محدد", opt3 || "كل ما سبق"],
        correctIndex: correct,
        revealed: false,
      };
      state.activeSpeaker = null;

      PlatformContests.saveState(state);
      alert("تم طرح السؤال مباشرة في ساحة المسابقة أمام الجميع!");
      this.render();
    },

    awardSpeakerPoint(contestantNum) {
      const state = PlatformContests.getState();
      const target = contestantNum === 1 ? state.contestant1 : state.contestant2;
      target.score = (target.score || 0) + 1;

      state.activeSpeaker = {
        name: target.name,
        text: `تكلّم أولاً وإجابته صحيحة بنجاح! (+1 نقطة)`,
      };
      if (state.currentQuestion) state.currentQuestion.revealed = true;

      PlatformContests.saveState(state);
      this.render();
    },

    clearSpeaker() {
      const state = PlatformContests.getState();
      state.activeSpeaker = null;
      PlatformContests.saveState(state);
      this.render();
    },

    declareWinner(contestantNum) {
      const state = PlatformContests.getState();
      const winner = contestantNum === 1 ? state.contestant1 : state.contestant2;
      state.winner = winner;
      state.status = "ended";
      PlatformContests.saveState(state);
      alert(`تم إعلان ${winner.name} فائزاً بالمسابقة وتتويجه بلقب البطل!`);
      this.render();
    },

    endAndArchiveMatch() {
      if (!confirm("هل تريد إنهاء المسابقة الحالية وحفظ نتائجها في السجل الخاص بك؟")) return;

      const state = PlatformContests.getState();
      const history = PlatformContests.getHistory();

      history.unshift({
        id: "hist_" + Date.now(),
        date: new Date().toLocaleDateString("ar-EG"),
        contestant1: state.contestant1,
        contestant2: state.contestant2,
        winner:
          state.winner ||
          (state.contestant1.score >= state.contestant2.score
            ? state.contestant1
            : state.contestant2),
        scoreSummary: `${state.contestant1.score} : ${state.contestant2.score}`,
      });

      PlatformContests.saveHistory(history);
      state.status = "registration";
      state.activeSpeaker = null;
      state.currentQuestion = null;
      PlatformContests.saveState(state);

      alert("تم حفظ المسابقة في سجلك الخاص بنجاح، وعادت الساحة لوضع التقديم للمسابقة التالية.");
      this.render();
    },

    resetToNewContest() {
      if (!confirm("هل تريد إفراغ بيانات المتنافسين والبدء في مسابقة جديدة كلياً؟")) return;
      PlatformContests.saveState(DEFAULT_STATE);
      alert("تمت إعادة ضبط الساحة بالكامل وجاهزة لمسابقة جديدة.");
      this.render();
    },

    // ==========================================
    // Applicants Management View
    // ==========================================
    renderApplicantsView(applicants) {
      return `
        <div class="admin-deck-full">
          <div class="prof-card-header" style="margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:900; color:#fff;"><i class="fas fa-users" style="color:#f59e0b; margin-left:6px;"></i> قائمة المتقدمين للمسابقات (${applicants.length})</span>
            </div>
          </div>

          <div class="admin-scroll-area custom-scrollbar" style="max-height:550px;">
            ${applicants
              .map(
                (a) => `
              <div class="admin-user-row" style="background:#111827; border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:12px 16px; margin-bottom:10px;">
                <div style="flex:1;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <strong style="color:#fff; font-size:0.95rem;">${PlatformContests.escapeHtml(a.name)}</strong>
                    <span style="background:rgba(245,158,11,0.2); color:#fbbf24; padding:1px 6px; border-radius:6px; font-size:0.75rem;">${PlatformContests.escapeHtml(a.age)} سنة</span>
                    <span style="color:#94a3b8; font-size:0.75rem;">(${PlatformContests.escapeHtml(a.dateFormatted || "")})</span>
                  </div>
                  <div style="color:#818cf8; font-size:0.82rem; margin-bottom:2px;">
                    <i class="fas fa-graduation-cap"></i> ${PlatformContests.escapeHtml(a.field)}
                  </div>
                  <div style="color:#cbd5e1; font-size:0.8rem; line-height:1.4;">
                    ${PlatformContests.escapeHtml(a.experience || "لا توجد خبرات مسجلة")}
                  </div>
                  <div style="color:#64748b; font-size:0.75rem; margin-top:4px;">
                    <i class="fas fa-phone"></i> ${PlatformContests.escapeHtml(a.phone)}
                  </div>
                </div>

                <div style="display:flex; gap:6px; flex-direction:column;">
                  <button type="button" class="admin-mini-btn" style="background:#3b82f6; color:#fff;" onclick="PlatformContestsAdmin.pickApplicantAsContestant('${a.id}', 1)">
                    اختيار كمتسابق 1
                  </button>
                  <button type="button" class="admin-mini-btn" style="background:#f59e0b; color:#000;" onclick="PlatformContestsAdmin.pickApplicantAsContestant('${a.id}', 2)">
                    اختيار كمتسابق 2
                  </button>
                  <button type="button" class="admin-mini-btn mini-del" onclick="PlatformContestsAdmin.deleteApplicant('${a.id}')">
                    حذف
                  </button>
                </div>
              </div>
            `,
              )
              .join("")}

            ${
              applicants.length === 0
                ? `
              <div style="text-align:center; padding:40px; color:#64748b;">
                لا يوجد متقدمين مسجلين في المسابقة بعد.
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    },

    pickApplicantAsContestant(appId, contestantNum) {
      const applicants = PlatformContests.getApplicants();
      const a = applicants.find((x) => x.id === appId);
      if (!a) return;

      const state = PlatformContests.getState();
      if (contestantNum === 1) {
        state.contestant1 = { name: a.name, age: a.age, score: 0, status: "ready" };
      } else {
        state.contestant2 = { name: a.name, age: a.age, score: 0, status: "ready" };
      }

      PlatformContests.saveState(state);
      this.activeTab = "control";
      this.render();
      alert(`تم تعيين ${a.name} كمتسابق ${contestantNum} بنجاح!`);
    },

    deleteApplicant(appId) {
      if (!confirm("هل تريد حذف هذا المتقدم؟")) return;
      let applicants = PlatformContests.getApplicants();
      applicants = applicants.filter((x) => x.id !== appId);
      PlatformContests.saveApplicants(applicants);
      this.render();
    },

    // ==========================================
    // History View (Archived Matches - Admin only)
    // ==========================================
    renderHistoryView(history) {
      return `
        <div class="admin-deck-full">
          <div class="prof-card-header" style="margin-bottom:16px;">
            <span style="font-weight:900; color:#fff;"><i class="fas fa-box-archive" style="color:#10b981; margin-left:6px;"></i> سجل أرشيف المسابقات السابقة (${history.length})</span>
          </div>

          <div class="admin-scroll-area custom-scrollbar" style="max-height:550px;">
            ${history
              .map(
                (h) => `
              <div class="admin-user-row" style="background:#111827; border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:14px 18px; margin-bottom:10px;">
                <div style="flex:1;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <strong style="color:#fff; font-size:1rem;">
                      ${PlatformContests.escapeHtml(h.contestant1 ? h.contestant1.name : "طرف 1")} ⚔️ ${PlatformContests.escapeHtml(h.contestant2 ? h.contestant2.name : "طرف 2")}
                    </strong>
                    <span style="font-size:0.75rem; color:#94a3b8;">(${PlatformContests.escapeHtml(h.date || "")})</span>
                  </div>
                  <div style="color:#34d399; font-weight:800; font-size:0.85rem; margin-bottom:2px;">
                    <i class="fas fa-crown"></i> الفائز: ${PlatformContests.escapeHtml(h.winner ? h.winner.name : "—")}
                  </div>
                  <div style="color:#94a3b8; font-size:0.82rem;">
                    النتيجة النهائية: <strong>${PlatformContests.escapeHtml(h.scoreSummary || "")}</strong>
                  </div>
                </div>

                <button type="button" class="admin-mini-btn mini-del" onclick="PlatformContestsAdmin.deleteHistoryRecord('${h.id}')">
                  <i class="fas fa-trash"></i> حذف
                </button>
              </div>
            `,
              )
              .join("")}

            ${
              history.length === 0
                ? `
              <div style="text-align:center; padding:40px; color:#64748b;">
                لم يتم أرشفة أي مسابقات سابقة بعد.
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    },

    deleteHistoryRecord(id) {
      if (!confirm("هل تريد حذف هذا السجل من الأرشيف؟")) return;
      let history = PlatformContests.getHistory();
      history = history.filter((x) => x.id !== id);
      PlatformContests.saveHistory(history);
      this.render();
    },

    setVisibility(val) {
      PlatformContests.setVisibility(val);
      this.render();
      if (window.App && typeof App.showToast === "function") {
        const msg =
          val === "active"
            ? "🟢 تم تفعيل مسابقات المنصة وإظهارها للجميع في الموقع"
            : val === "coming_soon"
              ? '🟡 تم تعيين مسابقات المنصة في وضع "قريباً" وسيظهر تنبيه عند الضغط عليها'
              : "🔴 تم إخفاء مسابقات المنصة تماماً من الموقع";
        App.showToast(msg);
      }
    },
  };

  // Expose to window
  window.PlatformContests = PlatformContests;
  window.PlatformContestsAdmin = PlatformContestsAdmin;

  // Auto-apply site visibility on load
  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => PlatformContests.applySiteVisibility());
    } else {
      PlatformContests.applySiteVisibility();
    }
  } catch (e) {}
})();
