/**
 * Elevate — Community & Direct Messaging Engine
 * Elevate Signature Community with Audio Notes, Media, Reactions, Replies,
 * 1-on-1 Chats, Member Following, User Blocking & Reporting,
 * Automated Content Filter, and Master Password Protected Admin Vault.
 */

(function () {
  "use strict";

  // ==========================================
  // Automated Profanity & Inappropriate Filter
  // ==========================================
  const BAD_WORDS = [
    "شتم",
    "كلب",
    "حمار",
    "غبي",
    "حقير",
    "تافه",
    "سافل",
    "وسخ",
    "قذر",
    "منحط",
    "ابن الكلب",
    "يا حيوان",
    "يا ابن",
    "ابن الشرموطة",
    "شرموط",
    "شرموطة",
    "عرص",
    "خول",
    "منيك",
    "شاذ",
    "لوطي",
    "كس",
    "طيز",
    "زب",
    "نيك",
    "قحبة",
    "عاهرة",
    "دعارة",
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "dick",
    "pussy",
    "bastard",
    "slut",
    "whore",
    "cunt",
  ];

  const Community = {
    activeTab: "public", // 'public', 'private', 'members'
    activeChatUser: null, // target username for direct chat
    replyingTo: null, // message object
    audioRecorder: null,
    audioChunks: [],
    recordStartTime: null,
    recordInterval: null,
    currentMedia: null, // { type: 'image'|'video'|'audio', url: '' }

    // Helpers for current user
    getCurrentUser() {
      if (window.App && typeof App.getUser === "function") {
        const u = App.getUser();
        if (u) return u;
      }
      try {
        const session = JSON.parse(localStorage.getItem("luxen_current_user") || "null");
        return session;
      } catch (e) {
        return null;
      }
    },

    isLoggedIn() {
      const u = this.getCurrentUser();
      return !!(u && u.username);
    },

    escapeHtml(str) {
      return String(str == null ? "" : str).replace(
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

    // Check for bad words
    checkProfanity(text) {
      if (!text) return { clean: true };
      const normalized = text.toLowerCase().replace(/[\s\-_.\d]+/g, " ");
      for (const word of BAD_WORDS) {
        const regex = new RegExp(
          `(^|\\s|[^\u0621-\u064A\\w])${word}($|\\s|[^\u0621-\u064A\\w])`,
          "i",
        );
        if (regex.test(normalized) || normalized.includes(word)) {
          return { clean: false, matched: word };
        }
      }
      return { clean: true };
    },

    // Storage accessors for community messages
    getPublicMessages() {
      try {
        let msgs = JSON.parse(localStorage.getItem("luxen_community_messages") || "[]");
        if (!Array.isArray(msgs)) msgs = [];
        if (msgs.length === 0) {
          msgs = [
            {
              id: "msg_welcome_1",
              sender: "admin@elevate.com",
              senderName: "المدير العام",
              role: "admin",
              text: "أهلاً وسهلاً بجميع أعضاء Elevate في المجتمع الرسمي! هنا يمكنكم تبادل النصائح حول المسابقات والمنح ومشاركة تجاربكم بكل احترام وأخوّة. 🚀",
              type: "text",
              timestamp: Date.now() - 3600000,
              reactions: { "❤️": ["admin@elevate.com"], "🔥": ["admin@elevate.com"] },
            },
          ];
          localStorage.setItem("luxen_community_messages", JSON.stringify(msgs));
        }
        return msgs;
      } catch (e) {
        return [];
      }
    },

    savePublicMessages(msgs) {
      try {
        localStorage.setItem("luxen_community_messages", JSON.stringify(msgs));
      } catch (e) {
        if (msgs.length > 50) {
          localStorage.setItem("luxen_community_messages", JSON.stringify(msgs.slice(-50)));
        }
      }
    },

    getChatKey(u1, u2) {
      const sorted = [String(u1 || "").toLowerCase(), String(u2 || "").toLowerCase()].sort();
      return `chat_${sorted[0]}_${sorted[1]}`;
    },

    getPrivateChats() {
      try {
        return JSON.parse(localStorage.getItem("luxen_private_chats") || "{}");
      } catch (e) {
        return {};
      }
    },

    savePrivateChats(chats) {
      try {
        localStorage.setItem("luxen_private_chats", JSON.stringify(chats));
      } catch (e) {
        console.error("Error saving private chats", e);
      }
    },

    getChatMessages(u1, u2) {
      const chats = this.getPrivateChats();
      const key = this.getChatKey(u1, u2);
      return chats[key] || [];
    },

    saveChatMessage(u1, u2, msg) {
      const chats = this.getPrivateChats();
      const key = this.getChatKey(u1, u2);
      if (!chats[key]) chats[key] = [];
      chats[key].push(msg);
      this.savePrivateChats(chats);
    },

    isChatFrozen(u1, u2) {
      const frozen = JSON.parse(localStorage.getItem("luxen_frozen_chats") || "[]");
      const key = this.getChatKey(u1, u2);
      return frozen.includes(key);
    },

    toggleFreezeChat(u1, u2) {
      let frozen = JSON.parse(localStorage.getItem("luxen_frozen_chats") || "[]");
      const key = this.getChatKey(u1, u2);
      if (frozen.includes(key)) {
        frozen = frozen.filter((k) => k !== key);
      } else {
        frozen.push(key);
      }
      localStorage.setItem("luxen_frozen_chats", JSON.stringify(frozen));
      return frozen.includes(key);
    },

    isUserBanned(username) {
      const banned = JSON.parse(localStorage.getItem("luxen_banned_community_users") || "[]");
      return banned.includes(username);
    },

    toggleBanUser(username) {
      let banned = JSON.parse(localStorage.getItem("luxen_banned_community_users") || "[]");
      if (banned.includes(username)) {
        banned = banned.filter((u) => u !== username);
      } else {
        banned.push(username);
      }
      localStorage.setItem("luxen_banned_community_users", JSON.stringify(banned));
      return banned.includes(username);
    },

    // User blocks (User A blocks User B)
    getBlockedUsers(username) {
      try {
        const blocks = JSON.parse(localStorage.getItem("luxen_user_blocks") || "{}");
        return blocks[username] || [];
      } catch (e) {
        return [];
      }
    },

    isUserBlocked(byUser, targetUser) {
      const list = this.getBlockedUsers(byUser);
      return list.includes(targetUser);
    },

    toggleBlockUser(targetUser) {
      const user = this.getCurrentUser();
      if (!user) return alert("يرجى تسجيل الدخول أولاً");
      const blocks = JSON.parse(localStorage.getItem("luxen_user_blocks") || "{}");
      let myBlocks = blocks[user.username] || [];
      const wasBlocked = myBlocks.includes(targetUser);
      if (wasBlocked) {
        myBlocks = myBlocks.filter((u) => u !== targetUser);
        alert(`تم إلغاء حظر (@${targetUser}) بنجاح.`);
      } else {
        myBlocks.push(targetUser);
        alert(`تم حظر (@${targetUser}) بنجاح، لن يتمكن من إرسال رسائل إليك.`);
      }
      blocks[user.username] = myBlocks;
      localStorage.setItem("luxen_user_blocks", JSON.stringify(blocks));
      this.render();
    },

    // User reports
    openReportModal(targetUser) {
      const user = this.getCurrentUser();
      if (!user) return alert("يرجى تسجيل الدخول أولاً");
      const oldModal = document.getElementById("comm-report-modal");
      if (oldModal) oldModal.remove();

      const modal = document.createElement("div");
      modal.className = "comm-modal-overlay";
      modal.id = "comm-report-modal";
      modal.innerHTML = `
        <div class="comm-modal-card">
          <div class="comm-modal-head">
            <h3 class="comm-modal-title"><i class="fas fa-flag" style="color:#f59e0b;"></i> إرسال بلاغ عن المستخدم (@${this.escapeHtml(targetUser)})</h3>
            <button type="button" class="comm-modal-close" onclick="document.getElementById('comm-report-modal').remove()">×</button>
          </div>
          <p style="font-size:0.85rem; color:#94a3b8; margin:0 0 14px 0;">سيصل البلاغ مباشرة إلى إدارة المنصة وسنقوم بمراجعة المحادثة واتخاذ الإجراء اللازم.</p>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#e2e8f0; margin-bottom:6px;">سبب البلاغ:</label>
          <select id="report-reason-select" class="comm-modal-select">
            <option value="ألفاظ غير لائقة أو سب">ألفاظ غير لائقة أو سب وقذف</option>
            <option value="محتوى مسيء أو مخل">محتوى مسيء أو غير أخلاقي</option>
            <option value="إزعاج ومضايقة مستمرة">إزعاج ومضايقة مستمرة (Spam)</option>
            <option value="محاولة احتيال أو انتحال شخصية">محاولة احتيال أو انتحال شخصية</option>
            <option value="سبب آخر">سبب آخر</option>
          </select>
          <label style="display:block; font-size:0.82rem; font-weight:700; color:#e2e8f0; margin-bottom:6px;">تفاصيل إضافية (اختياري):</label>
          <textarea id="report-details-input" rows="3" class="comm-modal-textarea" placeholder="اكتب توضيحاً مختصراً عما حدث..."></textarea>
          <div class="comm-modal-actions">
            <button type="button" class="comm-topbar-action-btn" onclick="document.getElementById('comm-report-modal').remove()">إلغاء</button>
            <button type="button" class="comm-topbar-action-btn btn-warning" onclick="Community.submitReport('${this.escapeHtml(targetUser)}')"><i class="fas fa-paper-plane"></i> تقديم البلاغ</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    submitReport(targetUser) {
      const user = this.getCurrentUser();
      const reasonEl = document.getElementById("report-reason-select");
      const detailsEl = document.getElementById("report-details-input");
      const reason = reasonEl ? reasonEl.value : "مخالفة سلوك";
      const details = detailsEl ? detailsEl.value.trim() : "";

      const reports = JSON.parse(localStorage.getItem("luxen_user_reports") || "[]");
      reports.unshift({
        id: "rep_" + Date.now(),
        reporter: user.username,
        reporterName: user.fullName || user.username,
        reportedUser: targetUser,
        reason: reason,
        details: details,
        timestamp: Date.now(),
        status: "pending",
      });
      localStorage.setItem("luxen_user_reports", JSON.stringify(reports));

      const modal = document.getElementById("comm-report-modal");
      if (modal) modal.remove();

      alert(
        "تم إرسال البلاغ بنجاح إلى إدارة Elevate، سيتم مراجعة المحادثة واتخاذ الإجراء اللازم فوراً.",
      );
    },

    // User follows
    getFollows(username) {
      const follows = JSON.parse(localStorage.getItem("luxen_user_follows") || "{}");
      return follows[username] || [];
    },

    toggleFollow(targetUsername) {
      const currentUser = this.getCurrentUser();
      if (!currentUser) return alert("يرجى تسجيل الدخول أولاً للمتابعة");
      if (currentUser.username === targetUsername) return alert("لا يمكنك متابعة نفسك");

      const follows = JSON.parse(localStorage.getItem("luxen_user_follows") || "{}");
      let myFollows = follows[currentUser.username] || [];

      if (myFollows.includes(targetUsername)) {
        myFollows = myFollows.filter((u) => u !== targetUsername);
      } else {
        myFollows.push(targetUsername);
      }
      follows[currentUser.username] = myFollows;
      localStorage.setItem("luxen_user_follows", JSON.stringify(follows));

      this.render();
    },

    // Log security violation to secret admin queue
    logViolation(violation) {
      const violations = JSON.parse(localStorage.getItem("luxen_flagged_violations") || "[]");
      violations.unshift({
        id: "violation_" + Date.now(),
        sender: violation.sender,
        senderName: violation.senderName,
        text: violation.text,
        chatType: violation.chatType,
        recipient: violation.recipient || "عام",
        reason: violation.reason,
        timestamp: Date.now(),
      });
      localStorage.setItem("luxen_flagged_violations", JSON.stringify(violations.slice(0, 100)));
    },

    // ==========================================
    // UI Render Engine
    // ==========================================
    render() {
      const container = document.getElementById("community-view");
      if (!container) return;

      const user = this.getCurrentUser();
      const loggedIn = this.isLoggedIn();

      // Check if user is not logged in: Show Gated VIP Welcome
      if (!loggedIn || !user) {
        container.innerHTML = `
          <div class="comm-container">
            <div class="comm-gate-card">
              <div class="comm-gate-icon"><i class="fas fa-comments"></i></div>
              <h1 class="comm-gate-title">مجتمع Elevate مخصص للأعضاء فقط</h1>
              <p class="comm-gate-desc">
                تواصل مع الطلاب والخريجين، شارك استفساراتك حول المنح والمسابقات،
                وتبادل الخبرات في دردشات تفاعلية حية، رسائل صوتية، ومحادثات خاصة فورية.
              </p>
              <div class="comm-gate-actions">
                <a href="?view=login" class="btn btn-primary btn-xl btn-glow" style="display:inline-flex; align-items:center; gap:8px;">
                  <i class="fas fa-sign-in-alt"></i> تسجيل الدخول للمجتمع
                </a>
                <a href="?view=login" class="btn btn-secondary btn-xl btn-glow" style="display:inline-flex; align-items:center; gap:8px;">
                  <i class="fas fa-user-plus"></i> إنشاء حساب جديد مجاناً
                </a>
              </div>
            </div>
          </div>
        `;
        return;
      }

      // Check if user is banned from community
      if (this.isUserBanned(user.username)) {
        container.innerHTML = `
          <div class="comm-container">
            <div class="comm-gate-card" style="border-color: rgba(239, 68, 68, 0.4);">
              <div class="comm-gate-icon" style="background: linear-gradient(135deg, #ef4444, #991b1b);"><i class="fas fa-ban"></i></div>
              <h1 class="comm-gate-title" style="color:#ef4444;">تم حظرك من الدخول إلى المجتمع</h1>
              <p class="comm-gate-desc">
                تم تقييد وصول حسابك إلى مجتمع Elevate نظراً لمخالفة إرشادات وسياسات الاستخدام الخاصة بالمنصة.
                إذا كنت تعتقد أن هذا حدث بالخطأ، يرجى التواصل مع إدارة Elevate.
              </p>
              <div class="comm-gate-actions">
                <a href="index.html" class="btn btn-secondary btn-xl"><i class="fas fa-home"></i> العودة للرئيسية</a>
              </div>
            </div>
          </div>
        `;
        return;
      }

      // Render Active Community Dashboard
      const allUsers = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      const partnersList = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
      const partnerUsernames = new Set(
        partnersList.map((p) => (p.username || "").toLowerCase()).filter(Boolean),
      );

      // Filter members to exclude partners and root superadmin (staff/custom roles remain visible for communication)
      const regularMembers = allUsers.filter((u) => {
        if (!u || !u.username) return false;
        if (u.isPartner || u.role === "partner" || partnerUsernames.has(u.username.toLowerCase()))
          return false;
        if (u.username === "admin@elevate.com") return false;
        return true;
      });

      const isViewingPrivate = this.activeTab === "private" && this.activeChatUser;

      container.innerHTML = `
        <div class="comm-container">
          <!-- Hub Header -->
          <div class="comm-hub-header">
            <div class="comm-hub-brand">
              <div class="comm-hub-logo"><i class="fas fa-comments"></i></div>
              <div class="comm-hub-info">
                <h2>مجتمع Elevate التفاعلي <span class="comm-live-pill"><span class="comm-live-dot"></span> متصل ومباشر</span></h2>
                <p>تواصل مع أعضاء المنصة، شارك الفرص، وتبادل الرسائل الصوتية والوسائط</p>
              </div>
            </div>
            <!-- Navigation Tabs -->
            <div class="comm-tabs-nav">
              <button class="comm-tab-btn ${this.activeTab === "public" ? "active" : ""}" onclick="Community.switchTab('public')">
                <i class="fas fa-comments"></i> <span>المجتمع العام</span>
              </button>
              <button class="comm-tab-btn ${this.activeTab === "private" ? "active" : ""}" onclick="Community.switchTab('private')">
                <i class="fas fa-user-lock"></i> <span>دردشاتي الخاصة</span>
              </button>
              <button class="comm-tab-btn ${this.activeTab === "members" ? "active" : ""}" onclick="Community.switchTab('members')">
                <i class="fas fa-users"></i> <span>دليل الأعضاء</span>
                <span class="comm-tab-badge">${Math.max(regularMembers.length, 1)}</span>
              </button>
            </div>
          </div>

          <!-- Main Chat Frame -->
          ${this.activeTab === "members" ? this.renderMembersView(regularMembers) : this.renderChatView(isViewingPrivate)}
        </div>

        <!-- Hidden File Inputs -->
        <input type="file" id="comm-img-input" accept="image/*" style="display:none;" onchange="Community.handleFileSelect(event, 'image')">
        <input type="file" id="comm-video-input" accept="video/*" style="display:none;" onchange="Community.handleFileSelect(event, 'video')">
      `;

      // Auto scroll chat to bottom
      this.scrollToBottom();
    },

    switchTab(tab) {
      this.activeTab = tab;
      this.replyingTo = null;
      this.currentMedia = null;
      this.render();
    },

    openDirectChat(targetUsername) {
      this.activeTab = "private";
      this.activeChatUser = targetUsername;
      this.replyingTo = null;
      this.currentMedia = null;
      this.render();
    },

    // Render Chat View (Public or 1-on-1)
    renderChatView(isPrivate) {
      const user = this.getCurrentUser();
      const allUsers = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      const follows = this.getFollows(user.username);

      // Active Target Info
      let chatTitle = "غرفة Elevate العامة للجميع";
      let chatSubtitle = "تواصل مفتوح لجميع أعضاء المنصة المعتمدين";
      let isFrozen = false;
      let isBlockedByMe = false;
      let isBlockedByOther = false;

      let targetObj = null;
      if (isPrivate) {
        targetObj = allUsers.find((u) => u.username === this.activeChatUser);
        chatTitle = targetObj ? targetObj.fullName || targetObj.username : this.activeChatUser;
        chatSubtitle =
          targetObj && targetObj.customRoleTitle
            ? `المسمى الوظيفي: ${targetObj.customRoleTitle} | محادثة خاصة ومحمية`
            : "محادثة خاصة ومحمية بينكما فقط";
        isFrozen = this.isChatFrozen(user.username, this.activeChatUser);
        isBlockedByMe = this.isUserBlocked(user.username, this.activeChatUser);
        isBlockedByOther = this.isUserBlocked(this.activeChatUser, user.username);
      }

      const isBlocked = isBlockedByMe || isBlockedByOther;

      // Sidebar Conversations List
      const chatsData = this.getPrivateChats();
      const userChats = [];

      Object.keys(chatsData).forEach((key) => {
        if (key.includes(user.username.toLowerCase())) {
          const parts = key.replace("chat_", "").split("_");
          const other = parts.find((p) => p.toLowerCase() !== user.username.toLowerCase());
          if (other) {
            const msgs = chatsData[key];
            const lastMsg = msgs[msgs.length - 1];
            userChats.push({
              username: other,
              lastMsg: lastMsg
                ? lastMsg.type === "audio"
                  ? "🎤 تسجيل صوتي"
                  : lastMsg.type === "image"
                    ? "🖼️ صورة"
                    : lastMsg.type === "video"
                      ? "🎥 فيديو"
                      : lastMsg.text
                : "محادثة جديدة",
              time: lastMsg ? this.formatTime(lastMsg.timestamp) : "",
            });
          }
        }
      });

      return `
        <div class="comm-chat-frame ${isPrivate ? "viewing-chat" : "viewing-list"}">
          <!-- Sidebar -->
          <div class="comm-sidebar">
            <div class="comm-sidebar-header">
              <input type="text" class="comm-search-input" placeholder="بحث في المحادثات أو الأعضاء..." oninput="Community.filterSidebar(this.value)">
            </div>
            <div class="comm-convs-list custom-scrollbar">
              <!-- Public Room -->
              <div class="comm-conv-item ${!isPrivate ? "active" : ""}" onclick="Community.switchTab('public')">
                <div class="comm-conv-avatar public-room"><i class="fas fa-users"></i></div>
                <div class="comm-conv-info">
                  <div class="comm-conv-name-row">
                    <span class="comm-conv-name">مجتمع Elevate العام</span>
                    <span class="comm-conv-time">الآن</span>
                  </div>
                  <p class="comm-conv-preview">الغرفة المفتوحة لجميع أعضاء المنصة</p>
                </div>
              </div>

              <!-- Private Direct Chats -->
              ${userChats
                .map(
                  (c) => `
                <div class="comm-conv-item ${isPrivate && this.activeChatUser === c.username ? "active" : ""}" onclick="Community.openDirectChat('${c.username}')">
                  <div class="comm-conv-avatar">${this.escapeHtml(c.username.charAt(0).toUpperCase())}</div>
                  <div class="comm-conv-info">
                    <div class="comm-conv-name-row">
                      <span class="comm-conv-name">${this.escapeHtml(c.username)}</span>
                      <span class="comm-conv-time">${c.time}</span>
                    </div>
                    <p class="comm-conv-preview">${this.escapeHtml(c.lastMsg)}</p>
                  </div>
                </div>
              `,
                )
                .join("")}

              ${
                userChats.length === 0
                  ? `
                <div style="text-align:center; padding:30px 15px; color:#64748b; font-size:0.82rem;">
                  <i class="fas fa-user-friends" style="font-size:24px; opacity:0.4; margin-bottom:8px; display:block;"></i>
                  لا توجد محادثات خاصة بعد.<br>اختر عضواً من <a href="#" onclick="Community.switchTab('members'); return false;" style="color:#818cf8; font-weight:bold;">دليل الأعضاء</a> لبدء محادثة.
                </div>
              `
                  : ""
              }
            </div>
          </div>

          <!-- Main Chat Panel -->
          <div class="comm-main-panel">
            <!-- Topbar -->
            <div class="comm-chat-topbar">
              <div class="comm-chat-recipient">
                <button class="comm-back-mobile-btn" onclick="Community.switchTab('public')"><i class="fas fa-arrow-right"></i></button>
                <div class="comm-conv-avatar ${!isPrivate ? "public-room" : ""}">
                  ${!isPrivate ? '<i class="fas fa-users"></i>' : this.escapeHtml(this.activeChatUser.charAt(0).toUpperCase())}
                </div>
                <div>
                  <h3 class="comm-recipient-title">
                    ${this.escapeHtml(chatTitle)}
                    ${!isPrivate ? '<span class="comm-sender-badge">عام</span>' : targetObj && targetObj.customRoleTitle ? `<span class="comm-role-badge"><i class="fas fa-shield-halved"></i> ${this.escapeHtml(targetObj.customRoleTitle)}</span>` : ""}
                  </h3>
                  <p class="comm-recipient-sub">${this.escapeHtml(chatSubtitle)}</p>
                </div>
              </div>
              <div>
                ${
                  isPrivate
                    ? `
                  <div class="comm-topbar-actions">
                    <button type="button" class="comm-topbar-action-btn ${isBlockedByMe ? "btn-unblock" : "btn-danger"}" onclick="Community.toggleBlockUser('${this.escapeHtml(this.activeChatUser)}')">
                      <i class="fas ${isBlockedByMe ? "fa-check" : "fa-ban"}"></i>
                      <span>${isBlockedByMe ? "إلغاء الحظر" : "حظر"}</span>
                    </button>
                    <button type="button" class="comm-topbar-action-btn btn-warning" onclick="Community.openReportModal('${this.escapeHtml(this.activeChatUser)}')">
                      <i class="fas fa-flag"></i>
                      <span>بلاغ</span>
                    </button>
                    <button class="comm-member-btn comm-btn-follow ${follows.includes(this.activeChatUser) ? "following" : ""}" onclick="Community.toggleFollow('${this.escapeHtml(this.activeChatUser)}')">
                      <i class="fas ${follows.includes(this.activeChatUser) ? "fa-user-check" : "fa-user-plus"}"></i>
                      ${follows.includes(this.activeChatUser) ? "متابَع" : "متابعة"}
                    </button>
                  </div>
                `
                    : ""
                }
              </div>
            </div>

            <!-- Frozen or Blocked Warning Banner -->
            ${
              isFrozen
                ? `
              <div class="comm-frozen-banner">
                <i class="fas fa-snowflake" style="font-size:20px;"></i>
                <span>تم إيقاف وتجميد هذه المحادثة مؤقتاً من قِبل إدارة المنصة، لا يمكن تبادل الرسائل حالياً.</span>
              </div>
            `
                : ""
            }

            ${
              isBlocked
                ? `
              <div class="comm-frozen-banner" style="border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;">
                <i class="fas fa-ban" style="font-size:20px;"></i>
                <span>${isBlockedByMe ? "لقد قمت بحظر هذا المستخدم، لا يمكن تبادل الرسائل إلا بعد إلغاء الحظر." : "قام هذا المستخدم بحظرك، لا يمكنك إرسال رسائل إليه."}</span>
              </div>
            `
                : ""
            }

            <!-- Messages Stream -->
            <div class="comm-messages-stream custom-scrollbar" id="comm-messages-box">
              ${this.renderMessagesStream(isPrivate)}
            </div>

            <!-- Reply Preview Bar (If active) -->
            ${
              this.replyingTo
                ? `
              <div class="comm-replying-bar" id="comm-reply-bar">
                <div class="comm-replying-content">
                  <i class="fas fa-reply" style="color:#fbbf24;"></i>
                  <span>الرد على <strong>${this.escapeHtml(this.replyingTo.senderName || this.replyingTo.sender)}</strong>: ${this.escapeHtml((this.replyingTo.text || "مرفق").slice(0, 45))}</span>
                </div>
                <button class="comm-cancel-reply-btn" onclick="Community.cancelReply()"><i class="fas fa-times"></i></button>
              </div>
            `
                : ""
            }

            <!-- Input Deck -->
            <div class="comm-input-deck">
              ${
                isFrozen || isBlocked
                  ? `
                <div style="flex:1; text-align:center; color:#ef4444; font-weight:bold; font-size:0.9rem; padding:10px;">
                  ${isFrozen ? "المحادثة مجمدة من قِبل إدارة Elevate" : "لا يمكن إرسال رسائل نظراً لوجود حظر"}
                </div>
              `
                  : `
                <!-- Normal Mode -->
                <div style="display:flex; align-items:center; gap:8px; width:100%;" id="comm-normal-input-bar">
                  <!-- Emoji Button -->
                  <button type="button" class="comm-input-btn" onclick="Community.toggleEmojiPicker(event)" title="إيموجي"><i class="far fa-face-smile"></i></button>
                  
                  <!-- Attachment Button -->
                  <button type="button" class="comm-input-btn" onclick="Community.toggleAttachMenu(event)" title="إرفاق صورة أو فيديو"><i class="fas fa-paperclip"></i></button>

                  <!-- Text Input -->
                  <input type="text" class="comm-input-field" id="comm-text-input" placeholder="اكتب رسالتك هنا... (اضغط Enter للإرسال)" onkeydown="if(event.key === 'Enter' && !event.shiftKey){ event.preventDefault(); Community.sendMessage(); }">

                  <!-- Voice Record Button -->
                  <button type="button" class="comm-input-btn" style="color:#10b981;" onclick="Community.startVoiceRecording()" title="تسجيل صوتي (فويس)"><i class="fas fa-microphone"></i></button>

                  <!-- Send Button -->
                  <button type="button" class="comm-send-btn" onclick="Community.sendMessage()" title="إرسال"><i class="fas fa-paper-plane"></i></button>
                </div>

                <!-- Recording Bar (Hidden by default) -->
                <div class="comm-recording-bar" id="comm-recording-bar">
                  <div class="comm-recording-pulse">
                    <span class="comm-rec-dot"></span>
                    <span>جارٍ التسجيل الصوتي... <span id="comm-rec-timer">00:00</span></span>
                  </div>
                  <div style="display:flex; gap:10px;">
                    <button type="button" class="comm-rec-cancel-btn" onclick="Community.cancelVoiceRecording()"><i class="fas fa-times"></i> إلغاء</button>
                    <button type="button" class="comm-send-btn" onclick="Community.stopAndSendVoice()"><i class="fas fa-paper-plane"></i></button>
                  </div>
                </div>
              `
              }

              <!-- Emoji Popover -->
              <div class="comm-emoji-popover" id="comm-emoji-popover">
                ${[
                  "😀",
                  "😂",
                  "😍",
                  "😎",
                  "🔥",
                  "👍",
                  "❤️",
                  "🎉",
                  "🚀",
                  "👏",
                  "😮",
                  "💡",
                  "🙌",
                  "⭐",
                  "✨",
                  "💯",
                  "🤝",
                  "💪",
                  "🏆",
                  "🎯",
                  "👌",
                ]
                  .map(
                    (em) => `
                  <button type="button" class="comm-emoji-btn" onclick="Community.insertEmoji('${em}')">${em}</button>
                `,
                  )
                  .join("")}
              </div>

              <!-- Attach Popover -->
              <div class="comm-attach-popover" id="comm-attach-popover">
                <button type="button" class="comm-attach-item" onclick="document.getElementById('comm-img-input').click()"><i class="fas fa-image" style="color:#38bdf8;"></i> صورة</button>
                <button type="button" class="comm-attach-item" onclick="document.getElementById('comm-video-input').click()"><i class="fas fa-video" style="color:#a855f7;"></i> فيديو</button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    // Render Messages inside stream
    renderMessagesStream(isPrivate) {
      const user = this.getCurrentUser();
      const messages = isPrivate
        ? this.getChatMessages(user.username, this.activeChatUser)
        : this.getPublicMessages();

      if (!messages || messages.length === 0) {
        return `
          <div style="text-align:center; padding:60px 20px; color:#64748b;">
            <i class="fas fa-comments" style="font-size:36px; opacity:0.3; margin-bottom:12px; display:block;"></i>
            <h4 style="color:#94a3b8; margin:0 0 4px 0;">ابدأ المحادثة الآن</h4>
            <p style="font-size:0.85rem; margin:0;">شارك بأول رسالة، صورة، فيديو أو تسجيل صوتي مع أعضاء Elevate!</p>
          </div>
        `;
      }

      return messages
        .map((msg) => {
          const isSent = msg.sender === user.username;
          const isAdmin = msg.role === "admin" || msg.sender === "admin@elevate.com";
          const roleTitle = msg.roleTitle || "";
          const formattedTime = this.formatTime(msg.timestamp);

          // Reactions Html
          const reactionsObj = msg.reactions || {};
          const reactionsHtml = Object.keys(reactionsObj)
            .filter((em) => (reactionsObj[em] || []).length > 0)
            .map((em) => {
              const count = reactionsObj[em].length;
              const userReacted = reactionsObj[em].includes(user.username);
              return `
            <span class="comm-reaction-chip ${userReacted ? "user-reacted" : ""}" onclick="Community.toggleReaction('${msg.id}', '${em}', ${isPrivate})">
              ${em} <span>${count}</span>
            </span>
          `;
            })
            .join("");

          return `
          <div class="comm-msg-row ${isSent ? "sent" : "received"}" id="msg-row-${msg.id}">
            <div class="comm-msg-avatar ${isAdmin ? "admin-avatar" : roleTitle ? "staff-avatar" : ""}" title="${this.escapeHtml(msg.senderName || msg.sender)}">
              ${this.escapeHtml((msg.senderName || msg.sender || "?").charAt(0).toUpperCase())}
            </div>

            <div class="comm-msg-bubble">
              <!-- Header info if received in public room -->
              ${
                !isSent
                  ? `
                <div class="comm-msg-header">
                  <span class="comm-msg-sender" onclick="Community.openDirectChat('${this.escapeHtml(msg.sender)}')">${this.escapeHtml(msg.senderName || msg.sender)}</span>
                  ${roleTitle ? `<span class="comm-role-badge"><i class="fas fa-shield-halved"></i> ${this.escapeHtml(roleTitle)}</span>` : isAdmin ? '<span class="comm-sender-badge"><i class="fas fa-crown"></i> إدارة</span>' : ""}
                  <span class="comm-msg-time">${formattedTime}</span>
                </div>
              `
                  : `
                <div class="comm-msg-header">
                  ${roleTitle ? `<span class="comm-role-badge" style="margin-left:auto;"><i class="fas fa-shield-halved"></i> ${this.escapeHtml(roleTitle)}</span>` : ""}
                  <span class="comm-msg-time">${formattedTime}</span>
                </div>
              `
              }

              <!-- Quoted Reply Box -->
              ${
                msg.replyTo
                  ? `
                <div class="comm-quoted-box">
                  <div class="comm-quoted-author"><i class="fas fa-reply"></i> ${this.escapeHtml(msg.replyTo.senderName || msg.replyTo.sender)}</div>
                  <p class="comm-quoted-text">${this.escapeHtml(msg.replyTo.text || "مرفق")}</p>
                </div>
              `
                  : ""
              }

              <!-- Text Content -->
              ${msg.text ? `<div style="white-space:pre-wrap;">${this.escapeHtml(msg.text)}</div>` : ""}

              <!-- Media: Image -->
              ${
                msg.type === "image" && msg.mediaUrl
                  ? `
                <img src="${msg.mediaUrl}" class="comm-msg-image" alt="صورة" onclick="Community.viewMedia('${msg.mediaUrl}', 'image')">
              `
                  : ""
              }

              <!-- Media: Video -->
              ${
                msg.type === "video" && msg.mediaUrl
                  ? `
                <video src="${msg.mediaUrl}" controls class="comm-msg-video"></video>
              `
                  : ""
              }

              <!-- Media: Audio / Voice Note -->
              ${
                msg.type === "audio" && msg.mediaUrl
                  ? `
                <div class="comm-audio-player">
                  <button type="button" class="comm-audio-btn" onclick="Community.playAudio('${msg.id}', '${msg.mediaUrl}', this)"><i class="fas fa-play"></i></button>
                  <div class="comm-audio-wave">
                    <span class="comm-wave-bar" style="height:10px;"></span>
                    <span class="comm-wave-bar" style="height:18px;"></span>
                    <span class="comm-wave-bar" style="height:12px;"></span>
                    <span class="comm-wave-bar" style="height:22px;"></span>
                    <span class="comm-wave-bar" style="height:14px;"></span>
                    <span class="comm-wave-bar" style="height:20px;"></span>
                    <span class="comm-wave-bar" style="height:8px;"></span>
                  </div>
                  <span class="comm-audio-timer" id="audio-timer-${msg.id}">صوت</span>
                </div>
              `
                  : ""
              }

              <!-- Reactions Tray -->
              ${reactionsHtml ? `<div class="comm-reactions-tray">${reactionsHtml}</div>` : ""}

              <!-- Message Actions Toolbar (Hover) -->
              <div class="comm-msg-actions">
                <button type="button" class="comm-mini-action-btn" title="رد" onclick="Community.replyToMessage('${msg.id}', ${isPrivate})"><i class="fas fa-reply"></i></button>
                <button type="button" class="comm-mini-action-btn" title="إعجاب ❤️" onclick="Community.toggleReaction('${msg.id}', '❤️', ${isPrivate})">❤️</button>
                <button type="button" class="comm-mini-action-btn" title="نار 🔥" onclick="Community.toggleReaction('${msg.id}', '🔥', ${isPrivate})">🔥</button>
                <button type="button" class="comm-mini-action-btn" title="لايك 👍" onclick="Community.toggleReaction('${msg.id}', '👍', ${isPrivate})">👍</button>
                ${
                  isSent || user.isAdmin
                    ? `
                  <button type="button" class="comm-mini-action-btn del-btn" title="حذف الرسالة" onclick="Community.deleteMessage('${msg.id}', ${isPrivate})"><i class="fas fa-trash"></i></button>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        `;
        })
        .join("");
    },

    // Render Members Directory (Excluding Partners, Admin, and Staff)
    renderMembersView(members) {
      const user = this.getCurrentUser();
      const follows = this.getFollows(user.username);

      // Filter out self as well
      const displayMembers = (members || []).filter((m) => m.username !== user.username);

      return `
        <div style="background:#0f172a; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
            <div>
              <h3 style="font-size:1.2rem; font-weight:800; color:#fff; margin:0 0 4px 0;"><i class="fas fa-users" style="color:#6366f1; margin-left:8px;"></i> دليل أعضاء Elevate</h3>
              <p style="margin:0; font-size:0.85rem; color:#94a3b8;">اكتشف أعضاء المنصة، تابعهم، وتواصل معهم في محادثات خاصة حية</p>
            </div>
            <input type="text" class="comm-search-input" style="max-width:280px;" placeholder="بحث بالاسم أو اسم المستخدم..." oninput="Community.filterMembers(this.value)">
          </div>

          <div class="comm-members-grid" id="comm-members-grid-box">
            ${displayMembers
              .map((m) => {
                const isFollowing = follows.includes(m.username);
                const hasRole = Boolean(m.customRoleTitle);
                return `
                <div class="comm-member-card ${hasRole ? "is-staff-card" : ""}">
                  <div class="comm-member-avatar ${hasRole ? "staff-avatar" : ""}">
                    ${this.escapeHtml((m.fullName || m.username || "?").charAt(0).toUpperCase())}
                  </div>
                  <h4 class="comm-member-name">${this.escapeHtml(m.fullName || m.username)}</h4>
                  ${
                    hasRole
                      ? `
                    <div class="comm-custom-badge"><i class="fas fa-shield-halved"></i> ${this.escapeHtml(m.customRoleTitle)}</div>
                  `
                      : ""
                  }
                  <div class="comm-member-handle">@${this.escapeHtml(m.username)}</div>
                  <div class="comm-member-meta">
                    <i class="fas fa-calendar-alt"></i> انضم في ${this.escapeHtml(m.join_date || "مؤخراً")}
                  </div>
                  <div class="comm-member-actions">
                    <button type="button" class="comm-member-btn comm-btn-chat" onclick="Community.openDirectChat('${this.escapeHtml(m.username)}')">
                      <i class="fas fa-comment-dots"></i> دردشة
                    </button>
                    <button type="button" class="comm-member-btn comm-btn-follow ${isFollowing ? "following" : ""}" onclick="Community.toggleFollow('${this.escapeHtml(m.username)}')">
                      <i class="fas ${isFollowing ? "fa-user-check" : "fa-user-plus"}"></i> ${isFollowing ? "متابَع" : "متابعة"}
                    </button>
                  </div>
                </div>
              `;
              })
              .join("")}

            ${
              displayMembers.length === 0
                ? `
              <div style="grid-column: 1 / -1; text-align:center; padding:40px; color:#64748b;">
                لا يوجد أعضاء آخرين مسجلين حالياً.
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    },

    // ==========================================
    // Messaging Actions
    // ==========================================
    sendMessage() {
      const input = document.getElementById("comm-text-input");
      const text = input ? input.value.trim() : "";
      const media = this.currentMedia;

      if (!text && !media) return;

      const user = this.getCurrentUser();
      if (!user) return alert("يرجى تسجيل الدخول أولاً");

      // Check if user is banned
      if (this.isUserBanned(user.username)) {
        return alert("حسابك محظور من إرسال الرسائل في المجتمع.");
      }

      // Check for Bad Words / Profanity filter
      const check = this.checkProfanity(text);
      if (!check.clean) {
        alert(
          "⛔ عذراً! لا يمكن إرسال هذه الرسالة لأنها تحتوي على ألفاظ غير لائقة أو محظورة.\nتم رصد المحاولة وتسجيلها أمنياً لدى إدارة المنصة.",
        );

        this.logViolation({
          sender: user.username,
          senderName: user.fullName || user.username,
          text: text,
          chatType: this.activeTab === "private" ? "private" : "community",
          recipient: this.activeChatUser || "عام",
          reason: `لفظ محظور (${check.matched})`,
        });

        if (input) input.value = "";
        return;
      }

      const isPrivate = this.activeTab === "private" && this.activeChatUser;

      // Check frozen state in private chat
      if (isPrivate && this.isChatFrozen(user.username, this.activeChatUser)) {
        return alert("تم إيقاف هذه المحادثة من قِبل إدارة Elevate.");
      }

      // Check user blocks in private chat
      if (isPrivate) {
        if (this.isUserBlocked(user.username, this.activeChatUser)) {
          return alert("لقد قمت بحظر هذا المستخدم. يرجى إلغاء الحظر أولاً إذا أردت مراسلته.");
        }
        if (this.isUserBlocked(this.activeChatUser, user.username)) {
          return alert("قام هذا المستخدم بحظرك، لا يمكنك إرسال رسائل إليه.");
        }
      }

      const allUsers = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      const userObj = allUsers.find((u) => u.username === user.username) || user;
      const roleTitle =
        userObj.customRoleTitle || user.customRoleTitle || (user.isAdmin ? "إدارة Elevate" : null);

      const newMsg = {
        id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        sender: user.username,
        senderName: user.fullName || user.username,
        role: user.isAdmin ? "admin" : userObj.isTeam ? "staff" : "member",
        roleTitle: roleTitle,
        text: text,
        type: media ? media.type : "text",
        mediaUrl: media ? media.url : null,
        timestamp: Date.now(),
        replyTo: this.replyingTo
          ? {
              id: this.replyingTo.id,
              sender: this.replyingTo.sender,
              senderName: this.replyingTo.senderName,
              text: this.replyingTo.text,
            }
          : null,
        reactions: {},
      };

      if (isPrivate) {
        this.saveChatMessage(user.username, this.activeChatUser, newMsg);
      } else {
        const msgs = this.getPublicMessages();
        msgs.push(newMsg);
        this.savePublicMessages(msgs);
      }

      if (input) input.value = "";
      this.replyingTo = null;
      this.currentMedia = null;

      this.render();
    },

    deleteMessage(msgId, isPrivate) {
      if (!confirm("هل تريد حذف هذه الرسالة؟")) return;
      const user = this.getCurrentUser();

      if (isPrivate) {
        const chats = this.getPrivateChats();
        const key = this.getChatKey(user.username, this.activeChatUser);
        if (chats[key]) {
          chats[key] = chats[key].filter((m) => m.id !== msgId);
          this.savePrivateChats(chats);
        }
      } else {
        let msgs = this.getPublicMessages();
        msgs = msgs.filter((m) => m.id !== msgId);
        this.savePublicMessages(msgs);
      }

      this.render();
    },

    replyToMessage(msgId, isPrivate) {
      const user = this.getCurrentUser();
      const messages = isPrivate
        ? this.getChatMessages(user.username, this.activeChatUser)
        : this.getPublicMessages();

      const target = messages.find((m) => m.id === msgId);
      if (!target) return;

      this.replyingTo = target;
      this.render();

      const input = document.getElementById("comm-text-input");
      if (input) input.focus();
    },

    cancelReply() {
      this.replyingTo = null;
      const bar = document.getElementById("comm-reply-bar");
      if (bar) bar.remove();
    },

    toggleReaction(msgId, emoji, isPrivate) {
      const user = this.getCurrentUser();
      if (!user) return alert("يرجى تسجيل الدخول للتفاعل");

      const messages = isPrivate
        ? this.getChatMessages(user.username, this.activeChatUser)
        : this.getPublicMessages();

      const msg = messages.find((m) => m.id === msgId);
      if (!msg) return;

      if (!msg.reactions) msg.reactions = {};
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

      const list = msg.reactions[emoji];
      if (list.includes(user.username)) {
        msg.reactions[emoji] = list.filter((u) => u !== user.username);
      } else {
        list.push(user.username);
      }

      if (isPrivate) {
        const chats = this.getPrivateChats();
        const key = this.getChatKey(user.username, this.activeChatUser);
        chats[key] = messages;
        this.savePrivateChats(chats);
      } else {
        this.savePublicMessages(messages);
      }

      this.render();
    },

    // ==========================================
    // Media & Voice Recording Engine
    // ==========================================
    handleFileSelect(event, type) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      if (type === "image" && file.size > 5 * 1024 * 1024) {
        return alert("حجم الصورة كبير جداً، الحد الأقصى 5 ميجابايت.");
      }
      if (type === "video" && file.size > 15 * 1024 * 1024) {
        return alert("حجم الفيديو كبير جداً، الحد الأقصى 15 ميجابايت.");
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.currentMedia = { type: type, url: e.target.result };
        this.sendMessage();
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    },

    startVoiceRecording() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return alert("المتصفح لا يدعم التسجيل الصوتي المباشر.");
      }

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.audioChunks = [];
          this.audioRecorder = new MediaRecorder(stream);
          this.audioRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
          };

          this.audioRecorder.start();
          this.recordStartTime = Date.now();

          const normalBar = document.getElementById("comm-normal-input-bar");
          const recBar = document.getElementById("comm-recording-bar");
          if (normalBar) normalBar.style.display = "none";
          if (recBar) recBar.classList.add("active");

          const timerEl = document.getElementById("comm-rec-timer");
          this.recordInterval = setInterval(() => {
            const sec = Math.floor((Date.now() - this.recordStartTime) / 1000);
            const m = String(Math.floor(sec / 60)).padStart(2, "0");
            const s = String(sec % 60).padStart(2, "0");
            if (timerEl) timerEl.textContent = `${m}:${s}`;
          }, 500);
        })
        .catch((err) => {
          alert("تعذر الوصول إلى الميكروفون. يرجى السماح بصلاحية الصوت في المتصفح.");
        });
    },

    cancelVoiceRecording() {
      if (this.recordInterval) clearInterval(this.recordInterval);
      if (this.audioRecorder && this.audioRecorder.state !== "inactive") {
        this.audioRecorder.stop();
        if (this.audioRecorder.stream) {
          this.audioRecorder.stream.getTracks().forEach((t) => t.stop());
        }
      }
      this.audioChunks = [];
      const normalBar = document.getElementById("comm-normal-input-bar");
      const recBar = document.getElementById("comm-recording-bar");
      if (normalBar) normalBar.style.display = "flex";
      if (recBar) recBar.classList.remove("active");
    },

    stopAndSendVoice() {
      if (!this.audioRecorder) return;
      if (this.recordInterval) clearInterval(this.recordInterval);

      this.audioRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          this.currentMedia = { type: "audio", url: reader.result };
          this.sendMessage();
        };
        reader.readAsDataURL(audioBlob);

        if (this.audioRecorder.stream) {
          this.audioRecorder.stream.getTracks().forEach((t) => t.stop());
        }
      };

      this.audioRecorder.stop();
      const normalBar = document.getElementById("comm-normal-input-bar");
      const recBar = document.getElementById("comm-recording-bar");
      if (normalBar) normalBar.style.display = "flex";
      if (recBar) recBar.classList.remove("active");
    },

    playAudio(msgId, url, btn) {
      if (!window._commAudio) window._commAudio = new Audio();
      const audio = window._commAudio;
      const icon = btn.querySelector("i");

      if (!audio.paused && audio.currentMsgId === msgId) {
        audio.pause();
        if (icon) icon.className = "fas fa-play";
        return;
      }

      audio.src = url;
      audio.currentMsgId = msgId;
      audio.play();
      if (icon) icon.className = "fas fa-pause";

      audio.onended = () => {
        if (icon) icon.className = "fas fa-play";
      };
    },

    // Emoji Popover
    toggleEmojiPicker(e) {
      e.stopPropagation();
      const popover = document.getElementById("comm-emoji-popover");
      if (popover) popover.classList.toggle("open");
    },

    insertEmoji(emoji) {
      const input = document.getElementById("comm-text-input");
      if (input) {
        input.value += emoji;
        input.focus();
      }
      const popover = document.getElementById("comm-emoji-popover");
      if (popover) popover.classList.remove("open");
    },

    toggleAttachMenu(e) {
      e.stopPropagation();
      const popover = document.getElementById("comm-attach-popover");
      if (popover) popover.classList.toggle("open");
    },

    viewMedia(url, type) {
      window.open(url, "_blank");
    },

    formatTime(ts) {
      if (!ts) return "";
      const d = new Date(ts);
      return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    },

    scrollToBottom() {
      setTimeout(() => {
        const box = document.getElementById("comm-messages-box");
        if (box) box.scrollTop = box.scrollHeight;
      }, 50);
    },

    filterSidebar(q) {
      const query = (q || "").toLowerCase();
      document.querySelectorAll(".comm-conv-item").forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? "flex" : "none";
      });
    },

    filterMembers(q) {
      const query = (q || "").toLowerCase();
      document.querySelectorAll(".comm-member-card").forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? "flex" : "none";
      });
    },
  };

  // Close popovers on outside click
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#comm-emoji-popover") &&
      !e.target.closest('button[onclick*="toggleEmojiPicker"]')
    ) {
      const p = document.getElementById("comm-emoji-popover");
      if (p) p.classList.remove("open");
    }
    if (
      !e.target.closest("#comm-attach-popover") &&
      !e.target.closest('button[onclick*="toggleAttachMenu"]')
    ) {
      const p = document.getElementById("comm-attach-popover");
      if (p) p.classList.remove("open");
    }
  });

  // ==========================================================================
  // Secret Master Admin Vault: Community, Private Chats, & User Reports Control
  // Master Password: omaraymanaliluxentech
  // ==========================================================================
  const CommunityAdmin = {
    VAULT_PASSWORD: "omaraymanaliluxentech",
    activeTab: "community", // 'community' | 'private' | 'reports'
    selectedChatKey: null,

    isUnlocked() {
      return sessionStorage.getItem("luxen_vault_unlocked") === "true";
    },

    unlock() {
      const input = document.getElementById("admin-vault-input");
      const val = input ? input.value.trim() : "";
      if (val === this.VAULT_PASSWORD) {
        sessionStorage.setItem("luxen_vault_unlocked", "true");
        this.render();
      } else {
        alert("كلمة المرور غير صحيحة! يرجى إدخال كلمة سر الخزينة السرية.");
      }
    },

    lock() {
      sessionStorage.removeItem("luxen_vault_unlocked");
      this.render();
    },

    render() {
      const container = document.getElementById("adm-sec-vault");
      if (!container) return;

      if (!this.isUnlocked()) {
        container.innerHTML = `
          <div class="admin-vault-lock-screen">
            <div class="admin-vault-lock-icon"><i class="fas fa-user-secret"></i></div>
            <h2 style="font-size:1.4rem; font-weight:900; color:#fff; margin:0 0 8px 0;">خزينة الرقابة الحساسة (المجتمع والدردشات)</h2>
            <p style="font-size:0.9rem; color:#94a3b8; margin:0 0 20px 0;">
              هذه المنطقة مخصصة للمدير العام فقط لمراقبة وإدارة محادثات المجتمع، رصد المخالفات، وتدقيق الشاتات الخاصة.
            </p>
            <input type="password" id="admin-vault-input" class="admin-vault-pass-input" placeholder="أدخل كلمة سر الخزينة..." onkeydown="if(event.key === 'Enter') CommunityAdmin.unlock()">
            <button type="button" class="admin-vault-unlock-btn" onclick="CommunityAdmin.unlock()">
              <i class="fas fa-lock-open"></i> فتح الخزينة السرية
            </button>
          </div>
        `;
        return;
      }

      // Unlocked Dashboard
      const violations = JSON.parse(localStorage.getItem("luxen_flagged_violations") || "[]");
      const reports = JSON.parse(localStorage.getItem("luxen_user_reports") || "[]");
      const publicMsgs = Community.getPublicMessages();
      const privateChats = Community.getPrivateChats();
      const bannedUsers = JSON.parse(localStorage.getItem("luxen_banned_community_users") || "[]");

      container.innerHTML = `
        <div class="admin-vault-body">
          <!-- Header Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:#111827; border:1px solid rgba(239,68,68,0.3); border-radius:18px; padding:16px 20px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#ef4444,#b91c1c); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px;"><i class="fas fa-shield-halved"></i></span>
              <div>
                <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#fff;">غرفة العمليات والرقابة المركزية</h3>
                <p style="margin:0; font-size:0.8rem; color:#94a3b8;">إدارة المجتمع، فلترة الرسائل، ومراقبة الدردشات الخاصة وبلاغات المستخدمين</p>
              </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <span class="admin-meta-pill pill-gold"><i class="fas fa-lock-open"></i> الخزينة مفتوحة</span>
              <button type="button" class="admin-mini-btn mini-del" onclick="CommunityAdmin.lock()"><i class="fas fa-lock"></i> قفل الخزينة</button>
            </div>
          </div>

          <!-- Vault Navigation -->
          <div class="admin-vault-nav">
            <button class="admin-vault-nav-btn ${this.activeTab === "community" ? "active" : ""}" onclick="CommunityAdmin.switchTab('community')">
              <i class="fas fa-comments"></i> <span>قسم المجتمع (${publicMsgs.length})</span>
              ${violations.length > 0 ? `<span style="background:#ef4444; color:#fff; padding:2px 7px; border-radius:99px; font-size:0.75rem;">${violations.length} مخالفة</span>` : ""}
            </button>
            <button class="admin-vault-nav-btn ${this.activeTab === "private" ? "active" : ""}" onclick="CommunityAdmin.switchTab('private')">
              <i class="fas fa-user-lock"></i> <span>قسم الشاتات الخاصة (${Object.keys(privateChats).length})</span>
            </button>
            <button class="admin-vault-nav-btn ${this.activeTab === "reports" ? "active" : ""}" onclick="CommunityAdmin.switchTab('reports')">
              <i class="fas fa-flag" style="color:#f59e0b;"></i> <span>سجل البلاغات والشكاوى (${reports.length})</span>
              ${reports.length > 0 ? `<span style="background:#f59e0b; color:#000; font-weight:800; padding:2px 7px; border-radius:99px; font-size:0.75rem;">${reports.length}</span>` : ""}
            </button>
          </div>

          <!-- View Content -->
          ${
            this.activeTab === "community"
              ? this.renderCommunityModeration(publicMsgs, violations, bannedUsers)
              : this.activeTab === "reports"
                ? this.renderReportsModeration(reports)
                : this.renderPrivateChatsModeration(privateChats)
          }
        </div>
      `;
    },

    switchTab(tab) {
      this.activeTab = tab;
      this.render();
    },

    renderCommunityModeration(publicMsgs, violations, bannedUsers) {
      return `
        <!-- Flagged Violations Section -->
        <div class="admin-deck-full" style="border-color: rgba(239, 68, 68, 0.4);">
          <div class="prof-card-header" style="color:#ef4444; margin-bottom:12px;">
            <span><i class="fas fa-triangle-exclamation"></i> سجل المخالفات المفلترة والمحجوبة فورياً (${violations.length})</span>
            ${violations.length > 0 ? `<button class="admin-mini-btn mini-del" onclick="CommunityAdmin.clearViolations()"><i class="fas fa-trash"></i> مسح السجل</button>` : ""}
          </div>
          <div class="admin-violations-stream custom-scrollbar">
            ${violations
              .map(
                (v) => `
              <div class="admin-violation-item">
                <div class="admin-violation-meta">
                  <span class="admin-violation-user">
                    <i class="fas fa-user-slash"></i> ${Community.escapeHtml(v.senderName || v.sender)} (@${Community.escapeHtml(v.sender)})
                    <span style="font-size:0.75rem; color:#f87171; margin-right:8px;">[في: ${v.chatType === "private" ? "دردشة خاصة" : "المجتمع العام"}]</span>
                  </span>
                  <div class="admin-violation-text"><strong>النص المحظور:</strong> "${Community.escapeHtml(v.text)}"</div>
                  <span style="font-size:0.72rem; color:#94a3b8;"><i class="fas fa-clock"></i> ${new Date(v.timestamp).toLocaleString("ar-EG")} · السبب: ${Community.escapeHtml(v.reason)}</span>
                </div>
                <div>
                  <button type="button" class="admin-mini-btn mini-del" onclick="CommunityAdmin.banUser('${Community.escapeHtml(v.sender)}')">
                    <i class="fas fa-ban"></i> حظر وطرد نهائي
                  </button>
                </div>
              </div>
            `,
              )
              .join("")}

            ${
              violations.length === 0
                ? `
              <div style="text-align:center; padding:25px; color:#10b981;">
                <i class="fas fa-shield-check" style="font-size:24px; display:block; margin-bottom:6px;"></i>
                لم يتم رصد أي محاولات شتم أو مخالفات حتى الآن! النظام يعمل بكفاءة 100%.
              </div>
            `
                : ""
            }
          </div>
        </div>

        <!-- Community Live Stream -->
        <div class="admin-deck-full" style="margin-top:16px;">
          <div class="prof-card-header" style="margin-bottom:14px;">
            <span><i class="fas fa-list-check"></i> بث رسائل المجتمع الكامل مع صلاحيات المدير</span>
            <span class="admin-chip-pro admin-chip-active">${publicMsgs.length} رسالة</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px; max-height:480px; overflow-y:auto; padding:6px;" class="custom-scrollbar">
            ${publicMsgs
              .map(
                (m) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:12px 16px; gap:12px; flex-wrap:wrap;">
                <div style="flex:1; min-width:240px;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <strong style="color:#818cf8;">${Community.escapeHtml(m.senderName || m.sender)}</strong>
                    <span style="font-size:0.75rem; color:#64748b;">(@${Community.escapeHtml(m.sender)})</span>
                    <span style="font-size:0.72rem; color:#94a3b8;">${new Date(m.timestamp).toLocaleTimeString("ar-EG")}</span>
                  </div>
                  <div style="color:#f1f5f9; font-size:0.88rem;">${Community.escapeHtml(m.text || (m.type === "audio" ? "🎤 تسجيل صوتي" : "مرفق وسائط"))}</div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button type="button" class="admin-mini-btn" style="background:rgba(99,102,241,0.2); color:#818cf8;" onclick="CommunityAdmin.editPublicMessage('${m.id}')">
                    <i class="fas fa-edit"></i> تعديل
                  </button>
                  <button type="button" class="admin-mini-btn mini-del" onclick="CommunityAdmin.deletePublicMessage('${m.id}')">
                    <i class="fas fa-trash"></i> حذف
                  </button>
                  <button type="button" class="admin-mini-btn" style="background:rgba(239,68,68,0.2); color:#ef4444;" onclick="CommunityAdmin.banUser('${Community.escapeHtml(m.sender)}')">
                    <i class="fas fa-ban"></i> طرد وحظر
                  </button>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    },

    renderReportsModeration(reports) {
      return `
        <div class="admin-deck-full" style="border-color: rgba(245, 158, 11, 0.4);">
          <div class="prof-card-header" style="color:#f59e0b; margin-bottom:14px;">
            <span><i class="fas fa-flag"></i> سجل بلاغات وشكاوى المستخدمين في الدردشات الخاصة (${reports.length})</span>
            ${reports.length > 0 ? `<button class="admin-mini-btn mini-del" onclick="CommunityAdmin.clearAllReports()"><i class="fas fa-trash"></i> مسح جميع البلاغات</button>` : ""}
          </div>

          <div class="admin-reports-stream custom-scrollbar">
            ${reports
              .map(
                (r) => `
              <div class="admin-report-card">
                <div class="admin-report-info">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="color:#38bdf8;">المُبلِّغ: ${Community.escapeHtml(r.reporterName || r.reporter)} (@${Community.escapeHtml(r.reporter)})</strong>
                    <span style="color:#64748b;">➔</span>
                    <strong style="color:#ef4444;">المُبلَّغ عنه: @${Community.escapeHtml(r.reportedUser)}</strong>
                  </div>
                  <div style="font-size:0.86rem; color:#fbbf24; margin-top:2px;">
                    <i class="fas fa-exclamation-circle"></i> <strong>السبب:</strong> ${Community.escapeHtml(r.reason)}
                  </div>
                  ${r.details ? `<div style="font-size:0.82rem; color:#cbd5e1; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:8px; margin-top:4px;">"${Community.escapeHtml(r.details)}"</div>` : ""}
                  <span style="font-size:0.72rem; color:#94a3b8; margin-top:4px;"><i class="fas fa-clock"></i> ${new Date(r.timestamp).toLocaleString("ar-EG")}</span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button type="button" class="admin-mini-btn" style="background:rgba(99,102,241,0.25); color:#818cf8;" onclick="CommunityAdmin.inspectChat('${Community.escapeHtml(r.reporter)}', '${Community.escapeHtml(r.reportedUser)}')">
                    <i class="fas fa-eye"></i> معاينة الشات بينهما
                  </button>
                  <button type="button" class="admin-mini-btn mini-del" onclick="CommunityAdmin.banUser('${Community.escapeHtml(r.reportedUser)}')">
                    <i class="fas fa-ban"></i> حظر وطرد المبلّغ عنه
                  </button>
                  <button type="button" class="admin-mini-btn" style="background:rgba(255,255,255,0.08); color:#94a3b8;" onclick="CommunityAdmin.dismissReport('${r.id}')">
                    <i class="fas fa-check"></i> إغلاق البلاغ
                  </button>
                </div>
              </div>
            `,
              )
              .join("")}

            ${
              reports.length === 0
                ? `
              <div style="text-align:center; padding:35px; color:#10b981;">
                <i class="fas fa-circle-check" style="font-size:28px; display:block; margin-bottom:8px;"></i>
                لا توجد بلاغات معلقة حالياً، جميع الدردشات تسير بصورة آمنة ومحترمة!
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    },

    renderPrivateChatsModeration(privateChats) {
      const keys = Object.keys(privateChats);
      const selectedKey = this.selectedChatKey || keys[0];
      const selectedMessages = selectedKey ? privateChats[selectedKey] || [] : [];
      const frozenList = JSON.parse(localStorage.getItem("luxen_frozen_chats") || "[]");
      const isCurrentFrozen = selectedKey && frozenList.includes(selectedKey);

      let p1 = "",
        p2 = "";
      if (selectedKey) {
        const parts = selectedKey.replace("chat_", "").split("_");
        p1 = parts[0] || "";
        p2 = parts[1] || "";
      }

      return `
        <div class="admin-pchats-grid">
          <!-- Sidebar: List of pairs -->
          <div class="admin-pchats-sidebar custom-scrollbar">
            <h4 style="font-size:0.9rem; color:#94a3b8; margin:0 0 10px 0; padding:6px 8px;">سجل الشاتات الثنائية (${keys.length})</h4>
            ${keys
              .map((k) => {
                const parts = k.replace("chat_", "").split("_");
                const count = (privateChats[k] || []).length;
                const isFr = frozenList.includes(k);
                return `
                <div class="admin-pchat-user-item ${k === selectedKey ? "active" : ""}" onclick="CommunityAdmin.selectChatKey('${k}')">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <strong style="color:#f1f5f9; font-size:0.86rem;"><i class="fas fa-comments"></i> ${Community.escapeHtml(parts[0])} ↔ ${Community.escapeHtml(parts[1])}</strong>
                    ${isFr ? '<span style="color:#ef4444; font-size:0.75rem;"><i class="fas fa-snowflake"></i> مجمد</span>' : ""}
                  </div>
                  <div style="font-size:0.75rem; color:#94a3b8;">${count} رسالة متبادلة</div>
                </div>
              `;
              })
              .join("")}

            ${
              keys.length === 0
                ? `
              <div style="text-align:center; padding:30px; color:#64748b; font-size:0.85rem;">
                لا توجد شاتات خاصة بين الأعضاء بعد.
              </div>
            `
                : ""
            }
          </div>

          <!-- Inspector View Panel -->
          <div class="admin-pchat-inspector-panel">
            <div class="admin-pchat-inspector-header">
              <div>
                <h4 style="margin:0; font-size:1rem; font-weight:800; color:#fff;">
                  تفاصيل الشات: ${Community.escapeHtml(p1)} ↔ ${Community.escapeHtml(p2)}
                </h4>
                <p style="margin:0; font-size:0.78rem; color:#94a3b8;">يمكن للمدير قراءة السجل الكامل، حذف الرسائل، أو تجميد الشات</p>
              </div>
              ${
                selectedKey
                  ? `
                <div style="display:flex; gap:8px;">
                  <button type="button" class="admin-mini-btn ${isCurrentFrozen ? "mini-on" : "mini-off"}" onclick="CommunityAdmin.toggleFreezeKey('${selectedKey}')">
                    <i class="fas ${isCurrentFrozen ? "fa-fire" : "fa-snowflake"}"></i>
                    ${isCurrentFrozen ? "إلغاء التجميد والسماح بالشات" : "منعهم من التحدث وتجميد الشات"}
                  </button>
                </div>
              `
                  : ""
              }
            </div>

            <!-- Messages Stream -->
            <div class="admin-pchat-inspector-body custom-scrollbar">
              ${selectedMessages
                .map(
                  (m) => `
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                  <div>
                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
                      <strong style="color:#818cf8; font-size:0.85rem;">@${Community.escapeHtml(m.sender)}</strong>
                      ${m.roleTitle ? `<span style="background:rgba(99,102,241,0.2); color:#c4b5fd; border:1px solid rgba(99,102,241,0.4); padding:1px 6px; border-radius:6px; font-size:0.72rem; font-weight:700;"><i class="fas fa-shield-halved"></i> ${Community.escapeHtml(m.roleTitle)}</span>` : ""}
                      <span style="font-size:0.72rem; color:#64748b;">${new Date(m.timestamp).toLocaleString("ar-EG")}</span>
                    </div>
                    <div style="color:#f1f5f9; font-size:0.88rem;">${Community.escapeHtml(m.text || (m.type === "audio" ? "🎤 تسجيل صوتي" : "مرفق"))}</div>
                  </div>
                  <button type="button" class="admin-mini-btn mini-del" onclick="CommunityAdmin.deletePrivateMsg('${selectedKey}', '${m.id}')">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              `,
                )
                .join("")}

              ${
                selectedMessages.length === 0
                  ? `
                <div style="text-align:center; padding:40px; color:#64748b;">لا توجد رسائل في هذا الشات.</div>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    },

    selectChatKey(key) {
      this.selectedChatKey = key;
      this.render();
    },

    inspectChat(userA, userB) {
      const key = Community.getChatKey(userA, userB);
      this.selectedChatKey = key;
      this.activeTab = "private";
      this.render();
    },

    toggleFreezeKey(key) {
      let frozen = JSON.parse(localStorage.getItem("luxen_frozen_chats") || "[]");
      if (frozen.includes(key)) {
        frozen = frozen.filter((k) => k !== key);
        alert("تم إلغاء التجميد! يمكن للمستخدمين التحدث الآن.");
      } else {
        frozen.push(key);
        alert("تم تجميد الشات بنجاح ومنع المستخدمين من إرسال أي رسائل.");
      }
      localStorage.setItem("luxen_frozen_chats", JSON.stringify(frozen));
      this.render();
    },

    deletePublicMessage(msgId) {
      if (!confirm("هل تريد حذف هذه الرسالة من المجتمع فوراً؟")) return;
      let msgs = Community.getPublicMessages();
      msgs = msgs.filter((m) => m.id !== msgId);
      Community.savePublicMessages(msgs);
      this.render();
    },

    editPublicMessage(msgId) {
      let msgs = Community.getPublicMessages();
      const m = msgs.find((x) => x.id === msgId);
      if (!m) return;
      const newText = prompt("تعديل نص الرسالة:", m.text || "");
      if (newText !== null && newText.trim()) {
        m.text = newText.trim();
        Community.savePublicMessages(msgs);
        this.render();
      }
    },

    deletePrivateMsg(chatKey, msgId) {
      if (!confirm("هل تريد حذف هذه الرسالة الخاصة؟")) return;
      const chats = Community.getPrivateChats();
      if (chats[chatKey]) {
        chats[chatKey] = chats[chatKey].filter((m) => m.id !== msgId);
        Community.savePrivateChats(chats);
      }
      this.render();
    },

    banUser(username) {
      if (!confirm(`هل أنت متأكد من طرد وحظر العضو (@${username}) نهائياً من المجتمع؟`)) return;
      Community.toggleBanUser(username);
      alert(`تم حظر العضو (@${username}) وطرد حسابه نهائياً من مجتمع المنصة.`);
      this.render();
    },

    dismissReport(repId) {
      let reports = JSON.parse(localStorage.getItem("luxen_user_reports") || "[]");
      reports = reports.filter((r) => r.id !== repId);
      localStorage.setItem("luxen_user_reports", JSON.stringify(reports));
      alert("تم إغلاق البلاغ بنجاح.");
      this.render();
    },

    clearAllReports() {
      if (!confirm("هل تريد مسح جميع البلاغات؟")) return;
      localStorage.removeItem("luxen_user_reports");
      this.render();
    },

    clearViolations() {
      if (!confirm("هل تريد مسح سجل المخالفات؟")) return;
      localStorage.removeItem("luxen_flagged_violations");
      this.render();
    },
  };

  // Expose to window
  window.Community = Community;
  window.CommunityAdmin = CommunityAdmin;
})();
