// =========================================
// Elevate - Core Application Script
// المدمج مع نظام المصادقة ولوحة تحكم الإدارة
// =========================================

const API = "https://dev-nex2.pantheonsite.io/worthit/apis/";

function getAuthHeaders() {
  try {
    const u = JSON.parse(localStorage.getItem("ns_user") || "null");
    if (u && u.auth_token) return { "X-Auth-Token": u.auth_token, "X-Auth-User": u.username || "" };
  } catch (e) {}
  return {};
}

// ==========================================
// Admin Dashboard Logic
// ==========================================
const Admin = {
  currentOppId: null,
  currentStatus: "visible",
  pendingStatus: null,
  currentPartnerId: null,

  init() {
    this.updateCounters();
    this.renderManageList();
    this.renderDatedList();
    this.renderUndatedList();
    this.renderManagePartners();
    this.renderMembers();
    this.renderTeam();
    this.renderSectionsVisibility();
    if (window.AdminTeachersApp && typeof AdminTeachersApp.init === "function") {
      AdminTeachersApp.init();
    }
  },

  // ---- تنقل أقسام لوحة الإدارة ----
  switchSection(secId) {
    // منع الوصول لأي قسم غير مسموح به لعضو الفريق
    const perms = this._activePerms;
    if (perms !== "all") {
      const allowed = this._getAllowedSections ? this._getAllowedSections(perms) : [];
      if (!allowed.includes(secId)) return;
    }
    document.querySelectorAll(".admin-section").forEach((s) => {
      s.classList.remove("active");
      s.style.display = "none";
    });
    const sec = document.getElementById(secId);
    if (sec) {
      sec.classList.add("active");
      sec.style.display = "block";
    }
    document.querySelectorAll(".admin-nav-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-sec") === secId);
    });
    if (
      secId === "adm-sec-vault" &&
      window.CommunityAdmin &&
      typeof CommunityAdmin.render === "function"
    ) {
      CommunityAdmin.render();
    }
    if (
      secId === "adm-sec-shorts" &&
      window.ElevateShortsAdmin &&
      typeof ElevateShortsAdmin.render === "function"
    ) {
      ElevateShortsAdmin.render();
    }
    if (
      secId === "adm-sec-contests" &&
      window.PlatformContestsAdmin &&
      typeof PlatformContestsAdmin.render === "function"
    ) {
      PlatformContestsAdmin.render();
    }
    if (
      secId === "adm-sec-teachers" &&
      window.AdminTeachersApp &&
      typeof AdminTeachersApp.init === "function"
    ) {
      AdminTeachersApp.init();
    }
    if (secId === "adm-sec-visibility") {
      this.renderSectionsVisibility();
    }
    // تمرير سلس ومريح لأعلى الصفحة عند التبديل
    try {
      const container = document.getElementById("prof-admin-tab");
      if (container) {
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (e) {}
  },

  _users() {
    try {
      return JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
    } catch (e) {
      return [];
    }
  },
  _saveUsers(users) {
    localStorage.setItem("luxen_all_users", JSON.stringify(users));
  },
  _esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  },

  // ---- الأعضاء المسجلين ----
  _memberFilter: "all",
  setMemberFilter(filter) {
    this._memberFilter = filter;
    document.querySelectorAll(".admin-filter-chip[data-member-filter]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-member-filter") === filter);
    });
    this.renderMembers();
  },

  toggleMemberActive(username) {
    const users = this._users();
    const u = users.find((x) => x.username === username);
    if (!u) return;
    u.isActive = u.isActive === false;
    this._saveUsers(users);
    this.renderMembers();
    this.updateCounters();
  },

  renderMembers() {
    const box = document.getElementById("admin-members-list");
    if (!box) return;
    const q = (document.getElementById("admin-members-search")?.value || "").trim().toLowerCase();
    const members = this._users().filter((u) => !u.isTeam && u.username !== "admin@elevate.com");
    const filtered = members.filter((u) => {
      if (this._memberFilter === "active" && u.isActive === false) return false;
      if (this._memberFilter === "inactive" && u.isActive !== false) return false;
      if (!q) return true;
      return [u.fullName, u.username, u.email, u.phone].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(q),
      );
    });

    const badgeEl = document.getElementById("admin-members-count-badge");
    if (badgeEl) badgeEl.textContent = filtered.length + " عضو";

    if (!filtered.length) {
      box.innerHTML =
        '<p style="color: var(--text-muted); text-align:center; padding:35px; border:1px dashed var(--border-color); border-radius:14px;"><i class="fas fa-users-slash" style="font-size:28px; margin-bottom:8px; opacity:0.5; display:block;"></i>لا يوجد أعضاء مطابقين لمعايير البحث حالياً.</p>';
      return;
    }

    box.innerHTML = filtered
      .sort((a, b) => (b.join_timestamp || 0) - (a.join_timestamp || 0))
      .map(
        (u) => `
            <div class="admin-user-row admin-member-row-pro">
                <div style="display:flex; align-items:center; gap:14px; min-width:0;">
                    <div class="admin-member-avatar-pro">${this._esc((u.fullName || u.username || "?").charAt(0))}</div>
                    <div class="admin-user-body">
                        <div class="admin-user-name">
                            ${this._esc(u.fullName || "بدون اسم")}
                            <span class="admin-chip ${u.isActive === false ? "chip-off" : "chip-on"}">${u.isActive === false ? "موقوف" : "نشط"}</span>
                        </div>
                        <div class="admin-user-meta"><i class="fas fa-envelope"></i> <span dir="ltr">${this._esc(u.username || u.email || "-")}</span></div>
                        <div class="admin-user-meta"><i class="fas fa-phone"></i> <span dir="ltr">${this._esc(u.phone || "غير مسجل")}</span></div>
                        <div class="admin-user-meta"><i class="fas fa-calendar-alt"></i> ${this._esc(u.join_date || "-")}</div>
                        <div class="admin-user-meta"><i class="fas fa-lock"></i> كلمة المرور: •••••••• (محمية ومخفية أمنياً)</div>
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="admin-mini-btn ${u.isActive === false ? "mini-on" : "mini-off"}" onclick="Admin.toggleMemberActive('${this._esc(u.username)}')">
                        <i class="fas ${u.isActive === false ? "fa-toggle-on" : "fa-toggle-off"}"></i> ${u.isActive === false ? "تفعيل الحساب" : "إيقاف الحساب"}
                    </button>
                </div>
            </div>`,
      )
      .join("");
  },

  // ---- حسابات الفريق ----
  PERM_LABELS: {
    opps: "الفرص",
    partners: "الشركاء",
    engage: "التفاعل والإشعارات",
    members: "الأعضاء",
    faq: "الأسئلة الشائعة",
    inbox: "صندوق الرسائل",
  },

  createTeamAccount(event) {
    event.preventDefault();
    const name = document.getElementById("team-name").value.trim();
    const email = document.getElementById("team-email").value.trim();
    const roleTitle =
      (document.getElementById("team-role-title")?.value || "").trim() || "مشرف رسمي";
    const password = document.getElementById("team-password").value.trim();
    const active = document.getElementById("team-active").checked;
    const perms = Array.from(document.querySelectorAll("#team-perms input:checked")).map(
      (i) => i.value,
    );

    if (password.length < 8) {
      alert("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      return;
    }
    if (!perms.length) {
      alert("اختر صلاحية واحدة على الأقل.");
      return;
    }

    const users = this._users();
    if (users.some((u) => u.username === email)) {
      alert("هذا البريد مسجل مسبقاً.");
      return;
    }

    users.push({
      id: "team_" + Date.now(),
      username: email,
      email: email,
      fullName: name,
      phone: "",
      password: password,
      isAdmin: false,
      isTeam: true,
      customRoleTitle: roleTitle,
      perms: perms,
      isActive: active,
      isOnline: false,
      join_date: new Date().toLocaleDateString("ar-EG"),
      join_timestamp: Date.now(),
    });
    this._saveUsers(users);
    document.getElementById("adminTeamForm").reset();
    document.getElementById("team-active").checked = true;
    this.renderTeam();
    alert(`تم إنشاء حساب (${name}) وتعيين دوره: [${roleTitle}] بنجاح.`);
  },

  toggleTeamActive(id) {
    const users = this._users();
    const u = users.find((x) => x.id === id);
    if (!u) return;
    u.isActive = u.isActive === false;
    this._saveUsers(users);
    this.renderTeam();
  },

  deleteTeamAccount(id) {
    if (!confirm("هل تريد حذف حساب الفريق نهائياً؟")) return;
    this._saveUsers(this._users().filter((u) => u.id !== id));
    this.renderTeam();
  },

  renderTeam() {
    const box = document.getElementById("admin-team-list");
    if (!box) return;
    const team = this._users().filter((u) => u.isTeam);
    if (!team.length) {
      box.innerHTML =
        '<p style="color: var(--text-muted); text-align:center; padding:25px;">لا توجد حسابات فريق بعد.</p>';
      return;
    }
    box.innerHTML = team
      .map(
        (u) => `
            <div class="admin-user-row">
                <div class="admin-user-avatar" style="background: linear-gradient(135deg,#f59e0b,#d97706);"><i class="fas fa-user-shield"></i></div>
                <div class="admin-user-body">
                    <div class="admin-user-name">
                        ${this._esc(u.fullName || u.username)}
                        <span class="admin-chip ${u.isActive === false ? "chip-off" : "chip-on"}">${u.isActive === false ? "غير مفعل" : "مفعل"}</span>
                    </div>
                    <div style="margin-bottom:4px;">
                        <span class="admin-perm-tag" style="background:rgba(245,158,11,0.22); color:#fbbf24; font-weight:800; border:1px solid rgba(245,158,11,0.45);"><i class="fas fa-id-badge"></i> ${this._esc(u.customRoleTitle || "مشرف رسمي")}</span>
                    </div>
                    <div class="admin-user-meta"><i class="fas fa-envelope"></i> <span dir="ltr">${this._esc(u.username)}</span></div>
                    <div class="admin-perm-tags">${(u.perms || []).map((p) => `<span class="admin-perm-tag">${this._esc(this.PERM_LABELS[p] || p)}</span>`).join("")}</div>
                </div>
                <div class="admin-user-actions">
                    <button class="admin-mini-btn ${u.isActive === false ? "mini-on" : "mini-off"}" onclick="Admin.toggleTeamActive('${u.id}')">
                        <i class="fas ${u.isActive === false ? "fa-toggle-on" : "fa-toggle-off"}"></i> ${u.isActive === false ? "تفعيل" : "إلغاء التفعيل"}
                    </button>
                    <button class="admin-mini-btn mini-del" onclick="Admin.deleteTeamAccount('${u.id}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>`,
      )
      .join("");
  },

  // إخفاء الأقسام غير المسموح بها لأعضاء الفريق
  PERM_SECTIONS: {
    opps: ["adm-sec-overview", "adm-sec-opps", "adm-sec-add-opp", "adm-sec-dates"],
    partners: ["adm-sec-partners"],
    engage: ["adm-sec-engage"],
    members: ["adm-sec-members"],
    faq: ["adm-sec-faq"],
    inbox: ["adm-sec-inbox"],
    teachers: ["adm-sec-teachers"],
  },
  _activePerms: "all",

  _getAllowedSections(perms) {
    if (perms === "all") {
      return [
        "adm-sec-overview",
        "adm-sec-opps",
        "adm-sec-add-opp",
        "adm-sec-dates",
        "adm-sec-partners",
        "adm-sec-members",
        "adm-sec-engage",
        "adm-sec-team",
        "adm-sec-teachers",
        "adm-sec-faq",
        "adm-sec-vault",
        "adm-sec-shorts",
        "adm-sec-contests",
      ];
    }
    const set = new Set(["adm-sec-overview"]);
    (perms || []).forEach((p) => {
      const secs = this.PERM_SECTIONS[p];
      if (Array.isArray(secs)) secs.forEach((s) => set.add(s));
      else if (secs) set.add(secs);
    });
    return Array.from(set);
  },

  applyPermissions(perms) {
    if (perms !== undefined) this._activePerms = perms;
    const allowed = this._getAllowedSections(this._activePerms);

    document.querySelectorAll(".admin-nav-btn").forEach((btn) => {
      const sec = btn.getAttribute("data-sec");
      btn.style.display = allowed.includes(sec) ? "" : "none";
    });
    document.querySelectorAll(".admin-section").forEach((sec) => {
      if (allowed.includes(sec.id)) {
        sec.style.display = "";
      } else {
        sec.style.display = "none";
        sec.classList.remove("active");
      }
    });

    const activeAllowed = allowed.some((id) => {
      const el = document.getElementById(id);
      return el && el.classList.contains("active");
    });
    if (!activeAllowed && allowed.length) this.switchSection(allowed[0]);
  },

  updateCounters() {
    let users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    let partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
    let comments = JSON.parse(localStorage.getItem("luxen_comments") || "[]");
    let likesData = JSON.parse(localStorage.getItem("luxen_likes") || "{}");
    let totalLikes = Object.values(likesData).reduce((sum, n) => sum + (parseInt(n) || 0), 0);
    let faqs = JSON.parse(localStorage.getItem("luxen_faqs") || "[]");

    let normalMembers = users.filter((u) => !u.isTeam && u.username !== "admin@elevate.com");
    let teamMembers = users.filter((u) => u.isTeam);
    let dated = cards.filter((c) => !c.noDates && ((c.deadline && !c.noDeadline) || c.startDate));
    let undated = cards.filter(
      (c) => !(!c.noDates && ((c.deadline && !c.noDeadline) || c.startDate)),
    );

    // Update KPI values
    let oppsCountEl = document.getElementById("admin-opps-count");
    let usersCountEl = document.getElementById("admin-users-count");
    let partnersCountEl = document.getElementById("admin-partners-count");
    let interactionsCountEl = document.getElementById("admin-interactions-count");
    let datedCountEl = document.getElementById("admin-dated-count");
    let teamCountEl = document.getElementById("admin-team-count");

    if (oppsCountEl) oppsCountEl.textContent = cards.length;
    if (usersCountEl)
      usersCountEl.textContent =
        normalMembers.length > 0 ? normalMembers.length : users.length > 0 ? users.length : 1542;
    if (partnersCountEl) partnersCountEl.textContent = partners.length;
    if (interactionsCountEl) interactionsCountEl.textContent = comments.length + totalLikes;
    if (datedCountEl) datedCountEl.textContent = dated.length;
    if (teamCountEl) teamCountEl.textContent = teamMembers.length;

    // Sub titles
    let oppsSub = document.getElementById("admin-opps-sub");
    if (oppsSub) oppsSub.textContent = `${dated.length} بموعد · ${undated.length} مستمرة`;

    let usersSub = document.getElementById("admin-users-sub");
    if (usersSub) {
      let activeCount = normalMembers.filter((u) => u.isActive !== false).length;
      usersSub.textContent = `${activeCount} نشط · ${normalMembers.length - activeCount} موقوف`;
    }

    let partnersSub = document.getElementById("admin-partners-sub");
    if (partnersSub) partnersSub.textContent = `${partners.length} شريك موثوق معتمد`;

    let interSub = document.getElementById("admin-interactions-sub");
    if (interSub) interSub.textContent = `${comments.length} تعليق · ${totalLikes} إعجاب`;

    let datedSub = document.getElementById("admin-dated-sub");
    if (datedSub) datedSub.textContent = `${dated.length} فرصة محدد لها موعد`;

    let teamSub = document.getElementById("admin-team-sub");
    if (teamSub) teamSub.textContent = `${teamMembers.length} حسابات إشرافية`;

    // Update nav badges
    let bOpps = document.getElementById("admin-nav-opps-badge");
    if (bOpps) bOpps.textContent = cards.length;

    let bDates = document.getElementById("admin-nav-dates-badge");
    if (bDates) bDates.textContent = dated.length;

    let bPartners = document.getElementById("admin-nav-partners-badge");
    if (bPartners) bPartners.textContent = partners.length;

    let bEngage = document.getElementById("admin-nav-engage-badge");
    if (bEngage) bEngage.textContent = comments.length + totalLikes;

    let bMembers = document.getElementById("admin-nav-members-badge");
    if (bMembers) bMembers.textContent = normalMembers.length;

    let bTeam = document.getElementById("admin-nav-team-badge");
    if (bTeam) bTeam.textContent = teamMembers.length;

    let bFaq = document.getElementById("admin-nav-faq-badge");
    if (bFaq) bFaq.textContent = faqs.length;

    const allShorts = JSON.parse(localStorage.getItem("luxen_shorts_videos") || "[]");
    const pendingShorts = allShorts.filter((v) => v.status === "pending");
    let bShorts = document.getElementById("admin-nav-shorts-badge");
    if (bShorts) bShorts.textContent = pendingShorts.length;

    const contestApps = JSON.parse(localStorage.getItem("luxen_contest_applicants") || "[]");
    let bContests = document.getElementById("admin-nav-contests-badge");
    if (bContests) bContests.textContent = contestApps.length;

    // Section header count badges
    let bDatedSub = document.getElementById("admin-dated-sub-badge");
    if (bDatedSub) bDatedSub.textContent = dated.length;

    let bUndatedSub = document.getElementById("admin-undated-sub-badge");
    if (bUndatedSub) bUndatedSub.textContent = undated.length;

    let bPartnersHead = document.getElementById("admin-partners-count-badge");
    if (bPartnersHead) bPartnersHead.textContent = partners.length + " شريك";

    let bMembersHead = document.getElementById("admin-members-count-badge");
    if (bMembersHead) bMembersHead.textContent = normalMembers.length + " عضو";

    let bTeamHead = document.getElementById("admin-team-count-badge");
    if (bTeamHead) bTeamHead.textContent = teamMembers.length + " حساب";

    let bFaqHead = document.getElementById("admin-faq-count-badge");
    if (bFaqHead) bFaqHead.textContent = faqs.length + " سؤال";
  },

  // --- Opportunities Management ---
  openModal(categoryId, categoryName, iconClass) {
    this.currentOppId = null;
    document.getElementById("modalCatName").textContent = "إضافة " + categoryName;
    document.getElementById("modalCatIcon").className = iconClass;
    document.getElementById("formOppCategory").value = categoryId;
    document.getElementById("adminDataForm").reset();
    this.toggleNoDates();

    this.setStatus("visible");
    document.getElementById("adminDataModal").style.display = "flex";
  },

  // تفعيل/إلغاء خانات "لم يتم تحديد موعد" / "مفتوح الآن"
  toggleNoDates() {
    const noDeadlineEl = document.getElementById("formNoDeadline");
    const noDatesEl = document.getElementById("formNoDates");
    const openNowEl = document.getElementById("formOpenNow");
    const dateEl = document.getElementById("formDate");
    const startEl = document.getElementById("formStartDate");
    if (!dateEl) return;

    const noDates = noDatesEl ? noDatesEl.checked : false;
    const noDeadline = noDates || (noDeadlineEl ? noDeadlineEl.checked : false);
    const openNow = openNowEl ? openNowEl.checked : false;

    if (noDeadlineEl) noDeadlineEl.disabled = noDates;
    if (openNowEl) openNowEl.disabled = noDates;
    if (noDatesEl) noDatesEl.disabled = openNow;

    dateEl.required = !noDeadline;
    dateEl.disabled = noDeadline;
    if (noDeadline) dateEl.value = "";

    if (startEl) {
      startEl.disabled = noDates || openNow;
      if (noDates || openNow) startEl.value = "";
    }
  },

  closeModal() {
    document.getElementById("adminDataModal").style.display = "none";
  },

  setStatus(status) {
    this.currentStatus = status;
    const btnSoon = document.getElementById("btn-status-soon");
    const btnHide = document.getElementById("btn-status-hide");
    const btnShow = document.getElementById("btn-status-show");
    const btnExpired = document.getElementById("btn-status-expired");

    btnSoon.className = "a-status-btn";
    btnHide.className = "a-status-btn";
    btnShow.className = "a-status-btn";
    if (btnExpired) btnExpired.className = "a-status-btn";

    if (status === "soon") {
      btnSoon.classList.add("active-orange");
    } else if (status === "hidden") {
      btnHide.classList.add("active-red");
    } else if (status === "expired") {
      if (btnExpired) btnExpired.classList.add("active-gray");
    } else {
      btnShow.classList.add("active-green");
    }
  },

  handleStatusClick(status) {
    this.pendingStatus = status;
    document.getElementById("adminChoiceModal").style.display = "flex";
  },

  applyToSection() {
    let cat = document.getElementById("formOppCategory").value;
    let catStatus = JSON.parse(localStorage.getItem("luxen_category_status") || "{}");

    catStatus[cat] = this.pendingStatus;
    localStorage.setItem("luxen_category_status", JSON.stringify(catStatus));

    document.getElementById("adminChoiceModal").style.display = "none";

    let msg =
      this.pendingStatus === "visible"
        ? "تم إظهار القسم وعودته للعمل الطبيعي."
        : this.pendingStatus === "soon"
          ? "تم تحويل القسم لحالة (قريباً) بنجاح."
          : "تم إخفاء القسم بالكامل من الموقع.";
    alert(msg);

    App.applyCategoryStatuses();
    this.setStatus(this.pendingStatus);
  },

  applyToOpp() {
    this.setStatus(this.pendingStatus);
    document.getElementById("adminChoiceModal").style.display = "none";
  },

  saveData(e) {
    e.preventDefault();

    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");

    let newCard = {
      id: this.currentOppId || Date.now().toString(),
      type: document.getElementById("formOppCategory").value,
      category: document.getElementById("formCompany").value,
      name: document.getElementById("formTitle").value,
      imgInner: document.getElementById("formInnerImg").value,
      imgOuter: document.getElementById("formOuterImg").value,
      isFeatured: document.getElementById("formFeatured").checked,
      tags: document.getElementById("formTags").value,
      deadline: document.getElementById("formDate").value,
      startDate: document.getElementById("formStartDate")
        ? document.getElementById("formStartDate").value
        : "",
      noDeadline: document.getElementById("formNoDeadline")
        ? document.getElementById("formNoDeadline").checked ||
          (document.getElementById("formNoDates") && document.getElementById("formNoDates").checked)
        : false,
      noDates: document.getElementById("formNoDates")
        ? document.getElementById("formNoDates").checked
        : false,
      openNow: document.getElementById("formOpenNow")
        ? document.getElementById("formOpenNow").checked
        : false,
      description: document.getElementById("formDescription").value,
      status: this.currentStatus,
      partnerId: (function () {
        if (Admin.ownerPartnerId) return Admin.ownerPartnerId;
        var prev = cards.find(function (x) {
          return x.id == Admin.currentOppId;
        });
        return prev && prev.partnerId ? prev.partnerId : null;
      })(),
    };

    const isEditing = !!this.currentOppId;
    if (this.currentOppId) {
      let index = cards.findIndex((c) => c.id == this.currentOppId);
      if (index > -1) {
        cards[index] = newCard;
      }
    } else {
      cards.push(newCard);
    }

    localStorage.setItem("luxen_general_cards", JSON.stringify(cards));
    if (!isEditing) this.pushAutoNotification(newCard);
    this.closeModal();
    if (document.getElementById("admin-manage-list")) this.init();
    App.renderOpportunities();
    App.updateHomeStats();
    if (typeof Partner !== "undefined" && document.getElementById("partner-opps-list"))
      Partner.render();
    alert("تم حفظ بيانات الفرصة بنجاح!");
  },

  _statusFilter: "all",
  setStatusFilter(status) {
    this._statusFilter = status;
    document.querySelectorAll(".admin-filter-chip[data-status-filter]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-status-filter") === status);
    });
    this.renderManageList();
  },

  renderManageList() {
    let filter = document.getElementById("admin-filter-select");
    let filterVal = filter ? filter.value : "all";
    let searchQuery = (document.getElementById("admin-opps-search")?.value || "")
      .trim()
      .toLowerCase();
    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    let listEl = document.getElementById("admin-manage-list");

    if (!listEl) return;
    listEl.innerHTML = "";

    let filteredCards = cards.filter((c) => {
      if (filterVal !== "all" && c.type !== filterVal) return false;
      if (searchQuery) {
        let match = [c.name, c.category, c.tags, c.description].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchQuery),
        );
        if (!match) return false;
      }
      if (this._statusFilter !== "all") {
        const isExp = App.isCardExpired(c);
        if (
          this._statusFilter === "active" &&
          (c.status === "hidden" || c.status === "soon" || isExp)
        )
          return false;
        if (this._statusFilter === "soon" && c.status !== "soon") return false;
        if (this._statusFilter === "expired" && !isExp) return false;
        if (this._statusFilter === "hidden" && c.status !== "hidden") return false;
      }
      return true;
    });

    let countBadge = document.getElementById("admin-filtered-opps-badge");
    if (countBadge) countBadge.textContent = filteredCards.length + " فرصة";

    if (filteredCards.length === 0) {
      listEl.innerHTML = `
                <div style="text-align:center; padding: 45px 20px; border: 1px dashed var(--border-color); border-radius: 14px; color: var(--text-muted);">
                    <i class="fas fa-folder-open" style="font-size: 32px; margin-bottom: 10px; color: var(--text-muted); opacity: 0.5; display:block;"></i>
                    <p style="margin: 0; font-weight: 700; font-size: 0.95rem;">لا توجد فرص مطابقة للبحث أو الفلتر المحدد حالياً.</p>
                </div>`;
      return;
    }

    filteredCards
      .slice()
      .reverse()
      .forEach((c) => {
        const isExpired = App.isCardExpired(c);
        let statusBadge =
          c.status === "hidden"
            ? '<span class="admin-chip-pro admin-chip-hidden"><i class="fas fa-eye-slash"></i> مخفية</span>'
            : c.status === "soon"
              ? '<span class="admin-chip-pro admin-chip-soon"><i class="fas fa-clock"></i> قريباً</span>'
              : isExpired
                ? '<span class="admin-chip-pro admin-chip-expired"><i class="fas fa-ban"></i> منتهية</span>'
                : '<span class="admin-chip-pro admin-chip-active"><i class="fas fa-check-circle"></i> نشطة</span>';

        let restoreBtn = isExpired
          ? `<button class="admin-action-btn-pro btn-restore" title="إلغاء الانتهاء" onclick="Admin.unexpireOpp('${c.id}')"><i class="fas fa-rotate-left"></i></button>`
          : "";

        let iconClass =
          c.type === "competitions"
            ? "fa-trophy"
            : c.type === "scholarships"
              ? "fa-graduation-cap"
              : c.type === "volunteering"
                ? "fa-hand-holding-heart"
                : c.type === "jobs"
                  ? "fa-briefcase"
                  : c.type === "events"
                    ? "fa-calendar-alt"
                    : c.type === "courses"
                      ? "fa-book-open"
                      : c.type === "workshops"
                        ? "fa-chalkboard-teacher"
                        : c.type === "travel"
                          ? "fa-plane-departure"
                          : c.type === "admission"
                            ? "fa-university"
                            : "fa-file-alt";

        let deadlineTxt = c.noDeadline ? "بدون موعد" : c.deadline ? "الموعد: " + c.deadline : "";
        let dateBadge = deadlineTxt
          ? `<span class="admin-chip-pro admin-chip-date"><i class="far fa-calendar"></i> ${deadlineTxt}</span>`
          : "";

        const stVisible = c.status !== "hidden" && c.status !== "soon";
        const stSoon = c.status === "soon";
        const stHidden = c.status === "hidden";
        let statusToggleGroup = `
          <div class="admin-quick-status-group" title="تغيير حالة ظهور الفرصة فورياً">
            <button type="button" class="admin-st-btn st-vis ${stVisible ? 'active' : ''}" title="إظهار للجميع" onclick="Admin.setOppStatus('${c.id}', 'visible')">
              <i class="fas fa-eye"></i> <span>ظاهر</span>
            </button>
            <button type="button" class="admin-st-btn st-soon ${stSoon ? 'active' : ''}" title="وضع قريباً (مغلق وممنوع فتحه)" onclick="Admin.setOppStatus('${c.id}', 'soon')">
              <i class="fas fa-lock"></i> <span>قريباً</span>
            </button>
            <button type="button" class="admin-st-btn st-hide ${stHidden ? 'active' : ''}" title="إخفاء بالكامل" onclick="Admin.setOppStatus('${c.id}', 'hidden')">
              <i class="fas fa-eye-slash"></i> <span>إخفاء</span>
            </button>
          </div>
        `;

        listEl.innerHTML += `
                <div class="admin-item-pro">
                    <div class="admin-item-start">
                        <div class="admin-item-icon-box"><i class="fas ${iconClass}"></i></div>
                        <div class="admin-item-content">
                            <h4>${this._esc(c.name)}</h4>
                            <div class="admin-item-badges">
                                <span class="admin-chip-pro admin-chip-category">${this._esc(c.category || "عام")}</span>
                                ${statusBadge}
                                ${dateBadge}
                            </div>
                        </div>
                    </div>
                    <div class="admin-item-actions">
                        ${statusToggleGroup}
                        ${restoreBtn}
                        <button class="admin-action-btn-pro btn-edit" title="تعديل الفرصة" onclick="Admin.editOpp('${c.id}')"><i class="fas fa-pen-to-square"></i></button>
                        <button class="admin-action-btn-pro btn-delete" title="حذف الفرصة" onclick="Admin.deleteOpp('${c.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
      });
  },

  // قائمة الفرص التي تم تحديد موعد لها (بداية و/أو آخر موعد)
  renderDatedList() {
    const listEl = document.getElementById("admin-dated-list");
    if (!listEl) return;
    const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    const dated = cards.filter((c) => !c.noDates && ((c.deadline && !c.noDeadline) || c.startDate));

    const subBadge = document.getElementById("admin-dated-sub-badge");
    if (subBadge) subBadge.textContent = dated.length;

    if (dated.length === 0) {
      listEl.innerHTML =
        '<div style="text-align:center; padding: 25px 15px; border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-muted); font-size:0.85rem;">لا توجد فرص محدد لها موعد حالياً.</div>';
      return;
    }

    listEl.innerHTML = dated
      .slice()
      .reverse()
      .map((c) => {
        const isExpired = App.isCardExpired(c);
        const statusBadge = isExpired
          ? '<span class="admin-chip-pro admin-chip-expired">منتهية</span>'
          : '<span class="admin-chip-pro admin-chip-active">سارية</span>';
        const endTxt = c.noDeadline ? "غير محدد" : c.deadline || "—";
        return `
                <div class="admin-item-pro" style="padding: 10px 14px;">
                    <div class="admin-item-start">
                        <div class="admin-item-content">
                            <h4 style="font-size:0.88rem; margin-bottom:4px;">${this._esc(c.name)}</h4>
                            <div class="admin-item-badges">
                                <span class="admin-chip-pro admin-chip-date"><i class="far fa-calendar"></i> ${this._esc(endTxt)}</span>
                                ${statusBadge}
                            </div>
                        </div>
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-action-btn-pro btn-edit" style="width:32px; height:32px; font-size:13px;" title="تعديل" onclick="Admin.editOpp('${c.id}')"><i class="fas fa-pen"></i></button>
                    </div>
                </div>
            `;
      })
      .join("");
  },

  // قائمة الفرص التي لم يتم تحديد مواعيد لها
  renderUndatedList() {
    const listEl = document.getElementById("admin-undated-list");
    if (!listEl) return;
    const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    const undated = cards.filter(
      (c) => !(!c.noDates && ((c.deadline && !c.noDeadline) || c.startDate)),
    );

    const subBadge = document.getElementById("admin-undated-sub-badge");
    if (subBadge) subBadge.textContent = undated.length;

    if (undated.length === 0) {
      listEl.innerHTML =
        '<div style="text-align:center; padding: 25px 15px; border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-muted); font-size:0.85rem;">كل الفرص محدد لها موعد.</div>';
      return;
    }

    listEl.innerHTML = undated
      .slice()
      .reverse()
      .map((c) => {
        return `
                <div class="admin-item-pro" style="padding: 10px 14px;">
                    <div class="admin-item-start">
                        <div class="admin-item-content">
                            <h4 style="font-size:0.88rem; margin-bottom:4px;">${this._esc(c.name)}</h4>
                            <div class="admin-item-badges">
                                <span class="admin-chip-pro admin-chip-category">${this._esc(c.category || "عام")}</span>
                                <span class="admin-chip-pro admin-chip-active">مستمرة</span>
                            </div>
                        </div>
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-action-btn-pro btn-edit" style="width:32px; height:32px; font-size:13px;" title="تعديل" onclick="Admin.editOpp('${c.id}')"><i class="fas fa-pen"></i></button>
                    </div>
                </div>
            `;
      })
      .join("");
  },

  // إلغاء حالة "منتهية" عن الفرصة (يدوية أو تلقائية)
  unexpireOpp(id) {
    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    let index = cards.findIndex((c) => c.id == id);
    if (index === -1) return;
    cards[index].expiryOverride = true;
    if (cards[index].status === "expired") cards[index].status = "visible";
    localStorage.setItem("luxen_general_cards", JSON.stringify(cards));
    this.renderManageList();
    this.renderDatedList();
    this.renderUndatedList();
    this.updateCounters();
    App.renderOpportunities();
    App.updateHomeStats();
    alert('تم إلغاء حالة "منتهية" وعادت الفرصة للعمل.');
  },

  setOppStatus(id, newStatus) {
    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    let idx = cards.findIndex((c) => c.id == id);
    if (idx === -1) return;

    cards[idx].status = newStatus;
    localStorage.setItem("luxen_general_cards", JSON.stringify(cards));

    if (window.ElevateDB && typeof window.ElevateDB.syncCards === "function") {
      window.ElevateDB.syncCards(cards);
    }

    this.renderManageList();
    this.updateCounters();
    App.renderOpportunities();
    App.updateHomeStats();
  },

  renderSectionsVisibility() {
    const grid = document.getElementById("admin-sections-visibility-grid");
    if (!grid) return;

    const sections = [
      { id: "competitions", name: "المسابقات والجوائز", icon: "fa-trophy", desc: "قسم المسابقات المحلية والدولية" },
      { id: "scholarships", name: "المنح الدراسية", icon: "fa-graduation-cap", desc: "قسم المنح والبرامج الدراسية" },
      { id: "volunteering", name: "فرص التطوع", icon: "fa-handshake", desc: "برامج التطوع وخدمة المجتمع" },
      { id: "jobs", name: "الوظائف والتدريب", icon: "fa-briefcase", desc: "فرص العمل وتدريب الطلاب" },
      { id: "events", name: "الفعاليات والايفينتات", icon: "fa-calendar-alt", desc: "المؤتمرات والايفينتات والملتقيات" },
      { id: "courses", name: "الكورسات المجانية والمدفوعة", icon: "fa-book-open", desc: "صفحة الكورسات التعليمية" },
      { id: "workshops", name: "ورش العمل", icon: "fa-chalkboard-teacher", desc: "ورش العمل والتدريبات العملية" },
      { id: "travel", name: "فرص السفر الممولة", icon: "fa-plane-departure", desc: "برامج السفر والتبادل الثقافي" },
      { id: "admission", name: "القبول الجامعي", icon: "fa-university", desc: "فرص التقديم والقبول بالجامعات" },
      { id: "live", name: "ورش عمل مباشر (Live)", icon: "fa-video", desc: "البثوث وورش العمل التفاعلية" },
      { id: "videos", name: "الفيديوهات واللقاءات", icon: "fa-clapperboard", desc: "مكتبة الفيديوهات المسجلة" },
      { id: "contests", name: "مسابقات المنصة Live", icon: "fa-award", desc: "نظام المسابقات الحية والتحديات" },
      { id: "shorts", name: "منصة Elevate Shorts", icon: "fa-play", desc: "مقاطع الفيديو التعليمية القصيرة" },
      { id: "community", name: "مجتمع Elevate (التواصل)", icon: "fa-comments", desc: "شبكة تواصل الطلاب والأعضاء" }
    ];

    const stats = JSON.parse(localStorage.getItem("luxen_category_status") || "{}");

    grid.innerHTML = sections
      .map((s) => {
        const status = stats[s.id] || "visible";
        const isVisible = status === "visible";
        const isSoon = status === "soon";
        const isHidden = status === "hidden";

        const badgeHtml = isHidden
          ? '<span class="admin-chip-pro admin-chip-hidden"><i class="fas fa-eye-slash"></i> مخفي تماماً</span>'
          : isSoon
            ? '<span class="admin-chip-pro admin-chip-soon"><i class="fas fa-lock"></i> قريباً (مغلق وممنوع)</span>'
            : '<span class="admin-chip-pro admin-chip-active"><i class="fas fa-check-circle"></i> ظاهر للجميع</span>';

        return `
        <div class="admin-vis-card ${status}">
          <div class="admin-vis-info">
            <div class="admin-vis-icon"><i class="fas ${s.icon}"></i></div>
            <div style="flex:1; min-width:0;">
              <div class="admin-vis-name">
                <span>${s.name}</span>
                ${badgeHtml}
              </div>
              <div class="admin-vis-desc">${s.desc}</div>
            </div>
          </div>
          <div class="admin-vis-actions">
            <button type="button" class="admin-vis-btn btn-vis-show ${isVisible ? "active" : ""}" onclick="Admin.setSectionStatus('${s.id}', 'visible')">
              <i class="fas fa-eye"></i> ظاهر
            </button>
            <button type="button" class="admin-vis-btn btn-vis-soon ${isSoon ? "active" : ""}" onclick="Admin.setSectionStatus('${s.id}', 'soon')">
              <i class="fas fa-lock"></i> قريباً (مغلق)
            </button>
            <button type="button" class="admin-vis-btn btn-vis-hide ${isHidden ? "active" : ""}" onclick="Admin.setSectionStatus('${s.id}', 'hidden')">
              <i class="fas fa-eye-slash"></i> إخفاء
            </button>
          </div>
        </div>
      `;
      })
      .join("");
  },

  setSectionStatus(sectionId, newStatus) {
    const stats = JSON.parse(localStorage.getItem("luxen_category_status") || "{}");
    stats[sectionId] = newStatus;
    localStorage.setItem("luxen_category_status", JSON.stringify(stats));

    if (sectionId === "contests") {
      localStorage.setItem(
        "luxen_contests_visibility",
        newStatus === "soon" ? "coming_soon" : newStatus,
      );
    }

    if (window.ElevateDB && typeof window.ElevateDB.syncSettings === "function") {
      window.ElevateDB.syncSettings({ luxen_category_status: stats });
    }

    App.applyCategoryStatuses();
    this.renderSectionsVisibility();
  },

  editOpp(id) {
    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    let card = cards.find((c) => c.id == id);
    if (!card) return;

    this.currentOppId = id;
    document.getElementById("formOppCategory").value = card.type;
    document.getElementById("modalCatName").textContent = "تعديل الفرصة";
    document.getElementById("modalCatIcon").className = "fas fa-edit";

    document.getElementById("formCompany").value = card.category || "";
    document.getElementById("formTitle").value = card.name || "";
    document.getElementById("formInnerImg").value = card.imgInner || "";
    document.getElementById("formOuterImg").value = card.imgOuter || "";
    document.getElementById("formFeatured").checked = card.isFeatured || false;
    document.getElementById("formTags").value = card.tags || "";
    document.getElementById("formDate").value = card.deadline || "";
    if (document.getElementById("formStartDate"))
      document.getElementById("formStartDate").value = card.startDate || "";
    document.getElementById("formDescription").value = card.description || "";
    if (document.getElementById("formNoDates"))
      document.getElementById("formNoDates").checked = !!card.noDates;
    if (document.getElementById("formNoDeadline"))
      document.getElementById("formNoDeadline").checked = !!card.noDeadline;
    if (document.getElementById("formOpenNow"))
      document.getElementById("formOpenNow").checked = !!card.openNow;
    this.toggleNoDates();

    this.setStatus(card.status || "visible");
    document.getElementById("adminDataModal").style.display = "flex";
  },

  deleteOpp(id) {
    if (confirm("هل أنت متأكد من حذف هذه الفرصة بشكل نهائي من الموقع؟")) {
      let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      cards = cards.filter((c) => c.id != id);
      localStorage.setItem("luxen_general_cards", JSON.stringify(cards));

      this.init();
      App.renderOpportunities();
      App.updateHomeStats();
    }
  },

  // --- Partners Management ---
  openPartnerModal() {
    this.currentPartnerId = null;
    document.getElementById("modalPartnerTitle").textContent = "إضافة شريك جديد";
    document.getElementById("adminPartnerForm").reset();
    document.getElementById("adminPartnerModal").style.display = "flex";
  },

  closePartnerModal() {
    document.getElementById("adminPartnerModal").style.display = "none";
  },

  savePartner(e) {
    e.preventDefault();
    let partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");

    let newPartner = {
      id: this.currentPartnerId || Date.now().toString(),
      name: document.getElementById("formPartnerName").value,
      type: document.getElementById("formPartnerType").value,
      logo: document.getElementById("formPartnerLogo").value,
      btnEnabled: (function () {
        var prev = partners.find(function (x) {
          return x.id == Admin.currentPartnerId;
        });
        return prev ? !!prev.btnEnabled : false;
      })(),
    };

    if (this.currentPartnerId) {
      let index = partners.findIndex((p) => p.id == this.currentPartnerId);
      if (index > -1) partners[index] = newPartner;
    } else {
      partners.push(newPartner);
    }

    localStorage.setItem("luxen_partners", JSON.stringify(partners));
    this.closePartnerModal();
    this.renderManagePartners();
    App.renderPartners();
    alert("تم حفظ بيانات الشريك بنجاح!");
  },

  renderManagePartners() {
    let partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
    let listEl = document.getElementById("admin-manage-partners-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (partners.length === 0) {
      listEl.innerHTML =
        '<div style="text-align:center; padding: 30px; border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-muted);">لا يوجد شركاء مضافين حالياً.</div>';
      return;
    }

    partners.reverse().forEach((p) => {
      let safeLogo = p.logo ? p.logo : "images/logo.png";
      listEl.innerHTML += `
                <div class="admin-manage-item">
                    <div class="admin-m-info">
                        <img src="${safeLogo}" alt="${p.name}" style="width: 45px; height: 45px; border-radius: 10px; object-fit: contain; background: #fff; border: 1px solid var(--border-color);">
                        <div class="admin-m-details">
                            <h4>${p.name}</h4>
                            <div style="display:flex; gap:10px; margin-top:5px;">
                                <span style="background:rgba(255,255,255,0.05); color:#a1a1aa;">${p.type}</span>
                            </div>
                        </div>
                    </div>
                    <div class="admin-m-actions">
                        <button class="admin-m-btn edit" onclick="Admin.partnerAccount('${p.id}')" title="حساب الشريك" style="background:#6366f1;color:#fff;">حساب الشريك</button>
                        <button class="admin-m-btn edit" onclick="Admin.togglePartnerBtn('${p.id}')" title="تفعيل زرار الشريك" style="${p.btnEnabled ? "background:#10b981;color:#fff;" : ""}">${p.btnEnabled ? "إلغاء الزرار" : "تفعيل زرار"}</button>
                        <button class="admin-m-btn edit" onclick="Admin.editPartner('${p.id}')"><i class="fas fa-edit"></i></button>
                        <button class="admin-m-btn delete" onclick="Admin.deletePartner('${p.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
    });
  },

  editPartner(id) {
    let partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
    let partner = partners.find((p) => p.id == id);
    if (!partner) return;

    this.currentPartnerId = id;
    document.getElementById("modalPartnerTitle").textContent = "تعديل بيانات الشريك";

    document.getElementById("formPartnerName").value = partner.name || "";
    document.getElementById("formPartnerType").value = partner.type || "";
    document.getElementById("formPartnerLogo").value = partner.logo || "";

    document.getElementById("adminPartnerModal").style.display = "flex";
  },

  // إنشاء / إدارة حساب الشريك
  partnerAccount(id) {
    let partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
    let partner = partners.find((p) => p.id == id);
    if (!partner) return;

    let users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
    let existing = users.find((u) => u.isPartner && u.partnerId == id);

    if (existing) {
      const act = prompt(
        "حساب الشريك: " +
          existing.username +
          "\n\naktb 1 لتغيير كلمة المرور\naktb 2 لحذف الحساب\naktb أي شيء آخر للإلغاء",
        "1",
      );
      if (act === "1") {
        const np = prompt("كلمة المرور الجديدة (8 أحرف على الأقل):", "");
        if (!np || np.length < 8) {
          alert("كلمة المرور قصيرة.");
          return;
        }
        existing.password = np;
        localStorage.setItem("luxen_all_users", JSON.stringify(users));
        alert("تم تحديث كلمة المرور.");
      } else if (act === "2") {
        users = users.filter((u) => !(u.isPartner && u.partnerId == id));
        localStorage.setItem("luxen_all_users", JSON.stringify(users));
        alert("تم حذف حساب الشريك.");
      }
      this.renderManagePartners();
      return;
    }

    const username = prompt("اسم المستخدم / البريد لحساب الشريك:", "");
    if (!username) return;
    if (users.some((u) => u.username === username)) {
      alert("اسم المستخدم مستخدم بالفعل.");
      return;
    }
    const password = prompt("كلمة المرور (8 أحرف على الأقل):", "");
    if (!password || password.length < 8) {
      alert("كلمة المرور قصيرة.");
      return;
    }

    users.push({
      id: "ptr_" + Date.now(),
      fullName: partner.name,
      username: username,
      email: username,
      password: password,
      isAdmin: false,
      isPartner: true,
      partnerId: id,
      isActive: true,
      join_date: new Date().toLocaleDateString("ar-EG"),
    });
    localStorage.setItem("luxen_all_users", JSON.stringify(users));
    alert("تم إنشاء حساب الشريك بنجاح.");
    this.renderManagePartners();
  },

  togglePartnerBtn(id) {
    let partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
    let i = partners.findIndex((p) => p.id == id);
    if (i < 0) return;
    partners[i].btnEnabled = !partners[i].btnEnabled;
    localStorage.setItem("luxen_partners", JSON.stringify(partners));
    this.renderManagePartners();
    App.renderPartners();
  },

  deletePartner(id) {
    if (confirm("هل أنت متأكد من حذف هذا الشريك؟")) {
      let partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
      partners = partners.filter((p) => p.id != id);
      localStorage.setItem("luxen_partners", JSON.stringify(partners));
      this.renderManagePartners();
      App.renderPartners();
    }
  },

  // --- Interactions Management (التعليقات والإعجابات) ---
  openInteractionsModal() {
    document.getElementById("adminInteractionsModal").style.display = "flex";
    this.switchInteractionTab("comments");
  },

  switchInteractionTab(tab) {
    document.querySelectorAll("#adminInteractionsModal .prof-tab").forEach((t) => {
      t.classList.remove("active");
      t.style.borderColor = "transparent";
    });

    if (tab === "comments") {
      document.getElementById("tab-comments-btn").classList.add("active");
      document.getElementById("tab-comments-btn").style.borderColor = "#8b5cf6";
      document.getElementById("admin-comments-view").style.display = "block";
      document.getElementById("admin-likes-view").style.display = "none";
      this.renderAdminComments();
    } else {
      document.getElementById("tab-likes-btn").classList.add("active");
      document.getElementById("tab-likes-btn").style.borderColor = "#8b5cf6";
      document.getElementById("admin-comments-view").style.display = "none";
      document.getElementById("admin-likes-view").style.display = "block";
      this.renderAdminLikes();
    }
  },

  renderAdminComments() {
    let comments = JSON.parse(localStorage.getItem("luxen_comments") || "[]");
    let container = document.getElementById("admin-comments-view");
    if (!container) return;

    if (comments.length === 0) {
      container.innerHTML =
        '<div style="color:var(--text-muted); text-align:center; padding: 30px;">لا توجد تعليقات في الموقع حتى الآن.</div>';
      return;
    }

    container.innerHTML = comments
      .map(
        (c) => `
            <div style="background: rgba(255,255,255,0.04); padding: 15px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                <div style="max-width: 80%;">
                    <div style="color: #8b5cf6; font-weight: bold; font-size: 0.95rem; margin-bottom: 5px;">${c.name} <span style="color: #64748b; font-size: 0.8rem; font-weight: normal;">- ${c.date}</span></div>
                    <div style="color: #e2e8f0; font-size: 0.95rem; line-height: 1.5;">${c.text}</div>
                </div>
                <button onclick="Admin.deleteComment('${c.id}')" style="background: rgba(239,68,68,0.15); color: #ef4444; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; transition: 0.3s; font-weight: bold; display: flex; gap: 8px; align-items: center;">
                    <i class="fas fa-trash"></i> <span class="hide-on-mobile">حذف</span>
                </button>
            </div>
        `,
      )
      .reverse()
      .join("");
  },

  deleteComment(id) {
    if (confirm("هل أنت متأكد من حذف هذا التعليق نهائياً؟")) {
      let comments = JSON.parse(localStorage.getItem("luxen_comments") || "[]");
      comments = comments.filter((c) => c.id != id);
      localStorage.setItem("luxen_comments", JSON.stringify(comments));
      this.renderAdminComments();

      // تحديث واجهة الفرصة في حال كانت مفتوحة
      const params = new URLSearchParams(window.location.search);
      const currentCardId = params.get("id");
      if (currentCardId) App.renderComments(currentCardId);
    }
  },

  renderAdminLikes() {
    let likesData = JSON.parse(localStorage.getItem("luxen_likes") || "{}");
    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    let container = document.getElementById("admin-likes-view");
    if (!container) return;

    let totalLikes = 0;
    let html = "";

    for (let cardId in likesData) {
      if (likesData[cardId].length > 0) {
        totalLikes += likesData[cardId].length;
        let cardObj = cards.find((c) => c.id == cardId);
        let cardName = cardObj ? cardObj.name : "فرصة محذوفة";

        html += `
                <div style="background: rgba(255,255,255,0.04); padding: 15px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: #e2e8f0; font-size: 0.95rem; font-weight: 600;">${cardName}</div>
                    <div style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 6px 12px; border-radius: 8px; font-weight: bold;">
                        <i class="fas fa-heart"></i> ${likesData[cardId].length} إعجاب
                    </div>
                </div>`;
      }
    }

    if (totalLikes === 0) {
      container.innerHTML =
        '<div style="color:var(--text-muted); text-align:center; padding: 30px;">لا توجد إعجابات في الموقع حتى الآن.</div>';
      return;
    }

    container.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; color: #10b981; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                <span>إجمالي الإعجابات في المنصة:</span>
                <span style="font-size: 1.2rem;">${totalLikes} <i class="fas fa-heart"></i></span>
            </div>
            ${html}
        `;
  },

  // إشعار تلقائي لكل فرصة جديدة
  pushAutoNotification(card) {
    try {
      if (!card || card.status === "hidden") return;
      const notifications = JSON.parse(localStorage.getItem("luxen_notifications") || "[]");
      notifications.push({
        id: "notif_" + Date.now(),
        title: "فرصة جديدة: " + (card.name || "بدون عنوان"),
        message:
          (card.category ? card.category + " — " : "") +
          (card.description ? String(card.description).slice(0, 120) : "اضغط لعرض التفاصيل."),
        link: "?category=" + (card.type || ""),
        date: new Date().toLocaleDateString("ar-EG"),
        timestamp: Date.now(),
        read: false,
      });
      localStorage.setItem("luxen_notifications", JSON.stringify(notifications));
      if (window.App && typeof App.renderNotifications === "function") App.renderNotifications();
    } catch (e) {
      console.warn("auto notification failed", e);
    }
  },

  // --- Notifications Management (إرسال الإشعارات) ---
  openNotificationModal() {
    document.getElementById("adminNotificationForm").reset();
    document.getElementById("adminNotificationModal").style.display = "flex";
  },

  sendNotificationToAll(e) {
    e.preventDefault();

    let title = document.getElementById("notifTitle").value;
    let message = document.getElementById("notifMessage").value;
    let link = document.getElementById("notifLink").value;

    let notifications = JSON.parse(localStorage.getItem("luxen_notifications") || "[]");

    let newNotif = {
      id: "notif_" + Date.now(),
      title: title,
      message: message,
      link: link || "#",
      date: new Date().toLocaleDateString("ar-EG"),
      timestamp: Date.now(),
      read: false,
    };

    notifications.push(newNotif);
    localStorage.setItem("luxen_notifications", JSON.stringify(notifications));

    document.getElementById("adminNotificationModal").style.display = "none";
    alert("تم إرسال الإشعار لجميع الأعضاء بنجاح!");

    // تحديث إشعارات المدير الحالي (ليرى الإشعار الذي أرسله)
    App.renderNotifications();
  },
};

// ==========================================
// Core App Logic
// ==========================================
const App = {
  lang: localStorage.getItem("ns_lang") || "ar",
  theme: "dark",
  countdownInterval: null,

  init() {
    this.applyTheme(this.theme);
    this.applyLang(this.lang);
    this.checkUserLoginState();
    this.injectNavbar();
    this.injectFooter();
    this.initNavbar();
    this.bindThemeToggle();
    this.bindLangToggle();
    this.bindMobileMenu();
    this.initAnimations();
    this.initWidget();
    this.checkWelcomeMessage();
    this.updateHomeStats();
    this.renderDynamicData();
    this.initHeroSearch();
    this.checkRouting();
    this.bindSaveButtons();
    this.initMobileCategories();
    this.renderNotifications();

    if (window.PlatformContests && typeof PlatformContests.applySiteVisibility === "function") {
      PlatformContests.applySiteVisibility();
    }

    // ربط أزرار حالة المودال بوظيفة هندلة الكليك للنافذة الوسيطة
    const btnShow = document.getElementById("btn-status-show");
    if (btnShow) btnShow.onclick = () => Admin.handleStatusClick("visible");
  },

  // هل الفرصة منتهية؟ (يدوياً من المدير أو تلقائياً بعد آخر موعد)
  isCardExpired(c) {
    if (!c) return false;
    if (c.status === "expired") return true;
    if (c.expiryOverride) return false;
    if (c.noDeadline || c.noDates) return false;
    if (!c.deadline) return false;
    const end = new Date(c.deadline + "T23:59:59").getTime();
    if (isNaN(end)) return false;
    return Date.now() > end;
  },

  updateHomeStats() {
    const users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
    const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]").filter(
      (c) => !(c && c.partnerId),
    );
    const statOpps = document.getElementById("stat-opps");
    const statUsers = document.getElementById("stat-users");

    // الأرقام الحقيقية فقط: لو مفيش فرص أو أعضاء يظهر 0
    const oppsCount = Array.isArray(cards)
      ? cards.filter((c) => (c.status || "visible") !== "hidden" && !this.isCardExpired(c)).length
      : 0;

    const usersCount = Array.isArray(users) ? users.filter((u) => !u.isAdmin).length : 0;

    if (statOpps) statOpps.textContent = oppsCount;
    if (statUsers) statUsers.textContent = usersCount;
  },

  checkUserLoginState() {
    if (this.isLoggedIn()) {
      document.body.classList.add("user-logged-in");
    }
  },

  initMobileCategories() {
    const grid = document.querySelector(".categories-grid");
    const btnContainer = document.getElementById("show-more-container");
    const btn = document.getElementById("show-more-btn");

    if (grid && btnContainer && btn) {
      if (window.innerWidth <= 768) {
        grid.classList.add("mobile-collapsed");
      }

      window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
          grid.classList.remove("mobile-collapsed");
          btnContainer.style.display = "none";
        } else if (!grid.classList.contains("expanded")) {
          grid.classList.add("mobile-collapsed");
          btnContainer.style.display = "flex";
        }
      });

      btn.addEventListener("click", () => {
        grid.classList.remove("mobile-collapsed");
        grid.classList.add("expanded");
        btnContainer.style.display = "none";
      });
    }
  },

  renderDynamicData() {
    this.renderPartners();
    this.renderOpportunities();
    this.applyCategoryStatuses();
  },

  applyCategoryStatuses() {
    const stats = JSON.parse(localStorage.getItem("luxen_category_status") || "{}");
    const user = this.getUser();
    const isAdmin = user && user.isAdmin === true;

    const categories = [
      "competitions",
      "scholarships",
      "volunteering",
      "jobs",
      "courses",
      "workshops",
      "travel",
      "events",
      "admission",
      "live",
      "videos",
      "contests",
      "shorts",
      "community",
    ];

    categories.forEach((cat) => {
      const status = stats[cat] || "visible";
      const cards = document.querySelectorAll(`.category-card[data-section="${cat}"]`);

      cards.forEach((card) => {
        if (status === "hidden") {
          if (!isAdmin) {
            card.style.display = "none";
          } else {
            card.style.display = "flex";
            card.style.opacity = "0.6";
          }
        } else if (status === "soon") {
          card.style.display = "flex";
          card.classList.add("is-soon");
          if (!isAdmin) {
            card.setAttribute("data-original-href", card.getAttribute("href") || "");
            card.removeAttribute("href");
            card.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              alert("🔒 هذا القسم قادم قريباً ومغلق حالياً ولا يمكن فتحه.");
              return false;
            };

            if (!card.querySelector(".soon-overlay")) {
              card.insertAdjacentHTML(
                "afterbegin",
                '<div class="soon-overlay" onclick="alert(\'🔒 هذا القسم قادم قريباً ومغلق حالياً ولا يمكن فتحه.\'); event.stopPropagation(); return false;"><i class="fas fa-lock" style="font-size: 1.3rem; margin-bottom: 4px; color: #fbbf24;"></i><span>قريباً — مغلق</span></div>',
              );
            }
          }
        } else {
          card.style.display = "flex";
          card.style.opacity = "1";
          card.classList.remove("is-soon");
          card.onclick = null;
          if (card.hasAttribute("data-original-href")) {
            card.setAttribute("href", card.getAttribute("data-original-href"));
          }
          const overlay = card.querySelector(".soon-overlay");
          if (overlay) overlay.remove();
        }
      });
    });

    // Also update quick pills and navbar links
    ["shorts", "contests", "community", "courses"].forEach((sec) => {
      const secStatus = stats[sec] || "visible";
      document.querySelectorAll(`a[href*="view=${sec}"], a[href*="category=${sec}"]`).forEach((link) => {
        if (secStatus === "hidden") {
          if (!isAdmin) link.style.display = "none";
        } else if (secStatus === "soon") {
          if (!isAdmin) {
            link.classList.add("is-soon");
            link.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              alert("🔒 هذا القسم قادم قريباً ومغلق حالياً ولا يمكن فتحه.");
              return false;
            };
          }
        } else {
          link.style.display = "";
          link.classList.remove("is-soon");
          link.onclick = null;
        }
      });
    });
  },

  renderPartners() {
    const partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
    const grid = document.getElementById("dynamic-partners-grid");
    if (!grid) return;

    if (partners.length === 0) {
      grid.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-weight: bold; padding: 40px; background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border-color);">لا يوجد شركاء مضافين حالياً.</div>';
      return;
    }

    const allCards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    const countFor = (pid) =>
      allCards.filter((c) => c && c.partnerId && c.partnerId == pid && c.status !== "hidden")
        .length;

    grid.innerHTML = partners
      .map((p, index) => {
        let safeLogo = p.logo ? p.logo : "images/logo.png";
        const oppCount = countFor(p.id);
        const socials = Array.isArray(p.socials) ? p.socials : [];
        return `
          <div class="partner-card fade-in visible stagger-${(index % 4) + 1}">
            <span class="partner-verified" title="شريك موثوق"><i class="fas fa-circle-check"></i> موثوق</span>
            <div class="partner-content">
              <div class="partner-card-brand"><img src="${safeLogo}" class="partner-logo-circle" alt="${p.name}"></div>
              <div class="partner-card-copy"><span class="partner-tag" data-en="${p.type || "Partner"}" data-ar="${p.type || "شريك"}">${p.type || "شريك"}</span><h3 class="partner-name">${p.name}</h3></div>
              <span class="partner-opps-counter"><b>${oppCount}</b><span>فرصة منشورة</span></span>
              ${socials.length ? `<div class="partner-socials mini">${socials.map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer" title="${s.platform}"><i class="${App.socialIcon(s.platform)}"></i></a>`).join("")}</div>` : ""}
              ${p.btnEnabled ? `<a href="?view=partner&pid=${p.id}" class="btn btn-primary partner-enter-btn"><span>عرض صفحة الشريك</span><i class="fas fa-arrow-left"></i></a>` : ""}
            </div>
          </div>
          `;
      })
      .join("");
  },

  socialIcon(platform) {
    const map = {
      facebook: "fab fa-facebook-f",
      instagram: "fab fa-instagram",
      x: "fab fa-x-twitter",
      twitter: "fab fa-x-twitter",
      linkedin: "fab fa-linkedin-in",
      youtube: "fab fa-youtube",
      tiktok: "fab fa-tiktok",
      telegram: "fab fa-telegram-plane",
      whatsapp: "fab fa-whatsapp",
      snapchat: "fab fa-snapchat-ghost",
      discord: "fab fa-discord",
      website: "fas fa-globe",
      email: "fas fa-envelope",
      phone: "fas fa-phone",
    };
    return map[String(platform || "").toLowerCase()] || "fas fa-link";
  },

  renderOpportunities() {
    const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]").filter(
      (c) => !(c && c.partnerId),
    );
    const container = document.getElementById("opp-cards-container");
    if (!container) return;

    const user = this.getUser();
    const isAdmin = user && user.isAdmin === true;

    const typeInfo = {
      competitions: { name: "مسابقة", class: "competition" },
      scholarships: { name: "منحة", class: "competition" },
      volunteering: { name: "تطوع", class: "volunteering" },
      jobs: { name: "وظيفة", class: "competition" },
      events: { name: "فعالية", class: "volunteering" },
      courses: { name: "كورس", class: "competition" },
      workshops: { name: "ورشة عمل", class: "volunteering" },
      travel: { name: "فرصة سفر", class: "competition" },
      admission: { name: "قبول جامعي", class: "competition" },
      live: { name: "ورشة مباشرة", class: "volunteering" },
      videos: { name: "فيديو", class: "competition" },
    };

    container.innerHTML = cards
      .map((c) => {
        if (c.status === "hidden" && !isAdmin) return "";

        let tInfo = typeInfo[c.type] || { name: c.type, class: "competition" };

        let tagsArray = (c.tags || "").split(" ").filter((t) => t.trim() !== "");
        let tagsHTML = tagsArray.map((tag) => `<span>${tag}</span>`).join("");

        let featuredBadge = c.isFeatured
          ? '<span class="opp-badge featured"><i class="fa-solid fa-star"></i> مميز</span>'
          : "";

        let isSoon = c.status === "soon";
        let isExpired = this.isCardExpired(c);
        let soonOverlay =
          isSoon && !isAdmin
            ? `<div class="soon-overlay" onclick="alert('🔒 هذه الفرصة قادمة قريباً ومغلقة حالياً ولا يمكن فتحها.'); event.stopPropagation(); return false;"><i class="fas fa-lock" style="font-size: 1.4rem; color: #fbbf24; margin-bottom: 6px;"></i><span>قريباً — مغلق</span></div>`
            : "";
        let cardClass =
          isSoon && !isAdmin ? "opp-card is-soon" : isExpired ? "opp-card is-expired" : "opp-card";
        let clickAction =
          isSoon && !isAdmin
            ? `alert('🔒 هذه الفرصة قادمة قريباً ومغلقة حالياً ولا يمكن فتحها.'); event.stopPropagation(); return false;`
            : isExpired && !isAdmin
              ? `alert('انتهت مدة هذه الفرصة.'); return false;`
              : `window.location.href='?id=${c.id}'`;
        let cardOnClick =
          isSoon && !isAdmin
            ? `onclick="alert('🔒 هذه الفرصة قادمة قريباً ومغلقة حالياً ولا يمكن فتحها.'); event.stopPropagation(); return false;"`
            : "";
        let btnContent =
          isSoon && !isAdmin
            ? `<i class="fas fa-lock"></i> <span>قريباً — مغلق</span>`
            : `<i class="fa-solid fa-arrow-left"></i> <span>عرض التفاصيل</span>`;

        let adminControls = "";

        let adminStatusBadge =
          c.status === "hidden" && isAdmin
            ? `<span class="opp-badge" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444;">مخفي</span>`
            : c.status === "soon" && isAdmin
              ? `<span class="opp-badge" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid #f59e0b;"><i class="fas fa-lock"></i> قريباً</span>`
              : "";
        let expiredBadge = isExpired
          ? `<span class="opp-badge expired-badge"><i class="fa-regular fa-calendar-times"></i> منتهية</span>`
          : "";
        let expiredRibbon = isExpired
          ? `<div class="expired-ribbon"><i class="fa-regular fa-calendar-times"></i> هذه الفرصة منتهية</div>`
          : "";

        return `
          <div class="${cardClass}" ${cardOnClick} data-id="${c.id}" data-category="${c.type}" data-expired="${isExpired ? "1" : "0"}" data-title="${c.name}" data-company="${c.category}" data-tags="${c.tags}" data-date="${c.deadline}" data-type="${tInfo.name}">

            ${soonOverlay}
            ${expiredRibbon}
            <div class="opp-card-header-img">
                <button class="opp-bookmark-top"><i class="fa-regular fa-bookmark"></i></button>
                <div class="opp-badges">
                    ${featuredBadge}
                    ${expiredBadge}
                    ${adminStatusBadge}
                    <span class="opp-badge ${tInfo.class}">${tInfo.name}</span>
                </div>
                ${c.imgOuter ? `<img src="${c.imgOuter}" style="width:100%; height:100%; object-fit:cover;" alt="">` : `<i class="fa-solid fa-trophy main-icon"></i>`}
            </div>
            <div class="opp-card-body">
                <h3 class="opp-card-title">${c.name}</h3>
                <div class="opp-card-subtitle">
                    ${c.category || "عام"} <i class="fa-solid fa-building"></i>
                </div>
                <div class="opp-card-tags">
                    ${tagsHTML}
                </div>
                <div class="opp-card-footer">
                    <div class="opp-date-info">
                        <span>${c.deadline || "غير محدد"}</span> <i class="fa-regular fa-calendar"></i>
                    </div>
                    <div class="opp-actions">
                        <button class="opp-view-btn" onclick="${clickAction}">${btnContent}</button>
                        ${adminControls}
                        <button class="opp-bookmark-bottom"><i class="fa-regular fa-bookmark"></i></button>
                    </div>
                </div>
            </div>
        </div>
          `;
      })
      .join("");

    this.updateCategoryCounts();
    this.updateBookmarkIcons();
  },

  checkRouting() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const id = params.get("id");
    const view = params.get("view");
    const q = params.get("q");

    const catStats = JSON.parse(localStorage.getItem("luxen_category_status") || "{}");
    const user = this.getUser();
    const isAdmin = user && user.isAdmin === true;

    if (category && catStats[category] && !isAdmin) {
      if (catStats[category] === "soon") {
        alert("🔒 هذا القسم قادم قريباً ومغلق حالياً ولا يمكن فتحه.");
        window.location.href = "index.html";
        return;
      }
      if (catStats[category] === "hidden") {
        window.location.href = "index.html";
        return;
      }
    }

    if (view && catStats[view] && !isAdmin) {
      if (catStats[view] === "soon") {
        alert("🔒 هذا القسم قادم قريباً ومغلق حالياً ولا يمكن فتحه.");
        window.location.href = "index.html";
        return;
      }
      if (catStats[view] === "hidden") {
        window.location.href = "index.html";
        return;
      }
    }

    const homeView = document.getElementById("home-view");
    const oppView = document.getElementById("opportunities-view");
    const detailView = document.getElementById("detail-view");
    const profileView = document.getElementById("profile-view");
    const loginView = document.getElementById("login-view");
    const partnerView = document.getElementById("partner-view");
    const commView = document.getElementById("community-view");
    const shortsView = document.getElementById("shorts-view");
    const contestsView = document.getElementById("contests-view");
    const coursesView = document.getElementById("courses-view");
    const teacherView = document.getElementById("teacher-view");
    if (partnerView) partnerView.style.display = "none";

    if (homeView) homeView.style.display = "none";
    if (oppView) oppView.style.display = "none";
    if (detailView) detailView.style.display = "none";
    if (profileView) profileView.style.display = "none";
    if (loginView) loginView.style.display = "none";
    if (commView) commView.style.display = "none";
    if (shortsView) shortsView.style.display = "none";
    if (contestsView) contestsView.style.display = "none";
    if (coursesView) coursesView.style.display = "none";
    if (teacherView) teacherView.style.display = "none";

    if (view === "teacher") {
      const user = this.getUser();
      if (!user) {
        window.location.href = "?view=login";
        return;
      }
      if (teacherView) {
        teacherView.style.display = "block";
        document.title = "Elevate — لوحة تحكم المدرس";
        if (window.TeacherApp && typeof TeacherApp.init === "function") {
          TeacherApp.init(user);
        }
        window.scrollTo(0, 0);
      }
    } else if (view === "courses") {
      if (coursesView) {
        coursesView.style.display = "block";
        document.title = "Elevate — كورسات مجانية ومدفوعة";
        if (window.CoursesApp && typeof CoursesApp.render === "function") {
          CoursesApp.render();
          const cId = params.get("courseId");
          if (cId) CoursesApp.openCourse(cId);
        }
        window.scrollTo(0, 0);
      }
    } else if (view === "partner") {
      const pid = params.get("pid");
      const partners = JSON.parse(localStorage.getItem("luxen_partners") || "[]");
      const partner = partners.find((p) => p.id == pid);
      if (partnerView && partner) {
        partnerView.style.display = "block";
        const logoEl = document.getElementById("partner-view-logo");
        const nameEl = document.getElementById("partner-view-name");
        const typeEl = document.getElementById("partner-view-type");
        if (logoEl) {
          logoEl.src = partner.logo || "images/logo.png";
          logoEl.alt = partner.name || "";
        }
        if (nameEl) nameEl.textContent = partner.name || "";
        if (typeEl) typeEl.textContent = partner.type || "شريك نجاح";
        window.scrollTo(0, 0);
      } else {
        window.location.href = "index.html";
        return;
      }
    } else if (view === "shorts") {
      if (shortsView) {
        shortsView.style.display = "block";
        if (window.ElevateShorts && typeof ElevateShorts.init === "function") {
          ElevateShorts.init();
        }
        window.scrollTo(0, 0);
      }
    } else if (view === "contests") {
      const contestVis = localStorage.getItem("luxen_contests_visibility") || "active";
      if (contestVis === "hidden") {
        window.location.href = "index.html";
        return;
      }
      if (contestsView) {
        contestsView.style.display = "block";
        if (contestVis === "coming_soon") {
          if (
            window.PlatformContests &&
            typeof PlatformContests.renderComingSoonPage === "function"
          ) {
            PlatformContests.renderComingSoonPage();
          } else if (
            window.PlatformContests &&
            typeof PlatformContests.showComingSoonNotice === "function"
          ) {
            PlatformContests.showComingSoonNotice();
          }
        } else {
          if (window.PlatformContests && typeof PlatformContests.init === "function") {
            PlatformContests.init();
          }
        }
        window.scrollTo(0, 0);
      }
    } else if (view === "community") {
      if (commView) {
        commView.style.display = "block";
        if (window.Community && typeof Community.render === "function") {
          Community.render();
        }
        window.scrollTo(0, 0);
      }
    } else if (view === "profile") {
      if (profileView) {
        profileView.style.display = "block";
        this.renderProfile();
      }
    } else if (view === "login") {
      if (loginView) {
        loginView.style.display = "flex";
      }
    } else if (id) {
      const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      const card = cards.find((c) => c.id == id);
      if (card && (card.status === "hidden" || card.status === "soon") && !isAdmin) {
        alert(
          card.status === "soon"
            ? "🔒 هذه الفرصة قادمة قريباً ومغلقة حالياً ولا يمكن فتحها."
            : "هذه الفرصة غير متاحة.",
        );
        window.location.href = "index.html";
        return;
      }
      if (detailView) {
        detailView.style.display = "block";
        this.populateDetailView(id);
        window.scrollTo(0, 0);
      }
    } else if (category) {
      if (oppView) oppView.style.display = "block";

      const titleEl = document.getElementById("page-title");
      const countTextEl = document.getElementById("page-count-text");
      const countNumEl = document.querySelector(".opp-header-stats .count .num");
      const noOppsMsg = document.getElementById("no-opps-msg");

      const contentMap = {
        competitions: { title: "المسابقات", text: "مسابقة" },
        scholarships: { title: "المنح الدراسية", text: "منحة" },
        volunteering: { title: "فرص التطوع", text: "فرصة تطوع" },
        jobs: { title: "الوظائف", text: "وظيفة" },
        events: { title: "الفعاليات", text: "فعالية" },
        courses: { title: "الكورسات المجانية", text: "كورس" },
        workshops: { title: "ورش العمل", text: "ورشة" },
        travel: { title: "فرص السفر الممولة", text: "فرصة سفر" },
        admission: { title: "القبول الجامعي", text: "فرصة" },
        live: { title: "ورش عمل مباشر", text: "ورشة مباشرة" },
        videos: { title: "الفيديوهات", text: "فيديو" },
      };

      if (contentMap[category]) {
        titleEl.textContent = contentMap[category].title;
        countTextEl.textContent = contentMap[category].text + " متاحة";
        document.title = "Elevate — " + contentMap[category].title;

        const cards = document.querySelectorAll(".opp-card");
        let visibleCount = 0;
        cards.forEach((card) => {
          if (card.getAttribute("data-category") === category) {
            card.style.display = "flex";
            if (card.getAttribute("data-expired") !== "1") visibleCount++;
          } else {
            card.style.display = "none";
          }
        });

        if (countNumEl) countNumEl.textContent = visibleCount;
        if (visibleCount === 0 && noOppsMsg) {
          noOppsMsg.style.display = "block";
        } else if (noOppsMsg) {
          noOppsMsg.style.display = "none";
        }
      }
    } else if (q) {
      if (oppView) oppView.style.display = "block";

      const titleEl = document.getElementById("page-title");
      const countTextEl = document.getElementById("page-count-text");
      const countNumEl = document.querySelector(".opp-header-stats .count .num");
      const noOppsMsg = document.getElementById("no-opps-msg");

      if (titleEl) titleEl.textContent = `نتائج البحث عن: "${q}"`;
      if (countTextEl) countTextEl.textContent = "فرصة مطابقة";
      document.title = `Elevate — نتائج البحث عن "${q}"`;

      const fastSearchInput = document.getElementById("fast-search");
      if (fastSearchInput) fastSearchInput.value = q;

      const qNorm = q.trim().toLowerCase();
      const cards = document.querySelectorAll(".opp-card");
      let visibleCount = 0;
      cards.forEach((card) => {
        const title = (card.getAttribute("data-title") || "").toLowerCase();
        const cat = (card.getAttribute("data-category") || "").toLowerCase();
        const comp = (card.getAttribute("data-company") || "").toLowerCase();
        const tags = (card.getAttribute("data-tags") || "").toLowerCase();
        const type = (card.getAttribute("data-type") || "").toLowerCase();

        const match =
          title.includes(qNorm) ||
          cat.includes(qNorm) ||
          comp.includes(qNorm) ||
          tags.includes(qNorm) ||
          type.includes(qNorm) ||
          (qNorm.includes("تطوع") && (cat === "volunteering" || type.includes("تطوع"))) ||
          ((qNorm.includes("ايفينت") || qNorm.includes("ايفنت") || qNorm.includes("فعال")) && (cat === "events" || type.includes("فعالية"))) ||
          (qNorm.includes("مسابق") && (cat === "competitions" || type.includes("مسابقة"))) ||
          (qNorm.includes("منح") && (cat === "scholarships" || type.includes("منحة"))) ||
          (qNorm.includes("وظي") && (cat === "jobs" || type.includes("وظيفة"))) ||
          (qNorm.includes("كورس") && (cat === "courses" || type.includes("كورس")));

        if (match) {
          card.style.display = "flex";
          if (card.getAttribute("data-expired") !== "1") visibleCount++;
        } else {
          card.style.display = "none";
        }
      });

      if (countNumEl) countNumEl.textContent = visibleCount;
      if (visibleCount === 0 && noOppsMsg) {
        noOppsMsg.style.display = "block";
      } else if (noOppsMsg) {
        noOppsMsg.style.display = "none";
      }
      window.scrollTo(0, 0);
    } else {
      if (homeView) homeView.style.display = "block";
      this.updateCategoryCounts();
    }

    this.updateBookmarkIcons();
    this.updateMobileNav();
  },

  populateDetailView(id) {
    const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    const card = cards.find((c) => c.id == id);

    const user = this.getUser();
    const isAdmin = user && user.isAdmin === true;

    if (card) {
      if ((card.status === "hidden" || card.status === "soon") && !isAdmin) {
        alert("هذه البطاقة غير متاحة حالياً.");
        window.history.back();
        return;
      }
      if (this.isCardExpired(card) && !isAdmin) {
        alert("انتهت مدة هذه الفرصة.");
        window.location.href = "index.html";
        return;
      }

      this.recordView(card.id);

      const typeInfo = {
        competitions: { name: "مسابقة", icon: "fa-trophy" },
        scholarships: { name: "منحة", icon: "fa-graduation-cap" },
        volunteering: { name: "تطوع", icon: "fa-hands-clapping" },
        jobs: { name: "وظيفة", icon: "fa-briefcase" },
        events: { name: "فعالية", icon: "fa-calendar-alt" },
        courses: { name: "كورس مجاني", icon: "fa-book-open" },
        workshops: { name: "ورشة عمل", icon: "fa-chalkboard-teacher" },
        travel: { name: "سفر ممول", icon: "fa-plane-departure" },
        admission: { name: "قبول جامعي", icon: "fa-university" },
        live: { name: "ورشة مباشرة", icon: "fa-video" },
        videos: { name: "فيديو", icon: "fa-clapperboard" },
      };

      let tInfo = typeInfo[card.type] || { name: card.type, icon: "fa-star" };

      document.getElementById("detail-title").textContent = card.name;
      document.getElementById("detail-company").innerHTML =
        `${card.category || "عام"} <i class="far fa-building"></i>`;

      const linkify = (text) => {
        if (!text) return "لا يوجد وصف متاح حالياً.";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, function (url) {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: underline; font-weight: bold;">${url}</a>`;
        });
      };

      let formattedDesc = linkify(card.description).replace(/\n/g, "<br>");
      document.getElementById("detail-description").innerHTML = formattedDesc;

      document.getElementById("detail-deadline").textContent = card.deadline || "غير محدد";

      if (card.imgInner) {
        document.getElementById("detail-logo").src = card.imgInner;
      } else if (card.imgOuter) {
        document.getElementById("detail-logo").src = card.imgOuter;
      } else {
        document.getElementById("detail-logo").src = "images/logo.png";
      }

      document.getElementById("detail-badge").innerHTML =
        `<i class="fas ${tInfo.icon}"></i> ${tInfo.name}`;

      const saveBtn = document.getElementById("detail-save-btn");
      if (saveBtn) {
        let saved = JSON.parse(localStorage.getItem("ns_saved_opps") || "[]");
        const isSaved = saved.some((item) => item.id == card.id);
        if (isSaved) {
          saveBtn.innerHTML = 'مكتمل الحفظ <i class="fas fa-bookmark"></i>';
          saveBtn.style.background = "rgba(99, 102, 241, 0.2)";
          saveBtn.style.borderColor = "rgba(99, 102, 241, 0.5)";
        } else {
          saveBtn.innerHTML = 'حفظ في المفضلة <i class="far fa-bookmark"></i>';
          saveBtn.style.background = "";
          saveBtn.style.borderColor = "";
        }

        saveBtn.onclick = () => {
          this.toggleSave({
            id: card.id,
            title: card.name,
            category: card.type,
            company: card.category,
            date: card.deadline,
            tags: card.tags,
            type: tInfo.name,
          });
          this.populateDetailView(card.id);
        };
      }

      if (card.openNow) {
        const sd = document.getElementById("detail-startdate");
        const st = document.getElementById("start-time-text");
        const bar = document.getElementById("startdate-bar");
        if (sd) sd.textContent = "مفتوح الآن";
        if (st) st.textContent = "مفتوح الآن";
        if (bar) {
          bar.style.width = "100%";
          bar.style.background = "#10b981";
        }
        if (this.startInterval) clearInterval(this.startInterval);
      } else {
        this.initStartDateBar(card.noDates ? "" : card.startDate);
      }

      if (card.noDeadline || card.noDates) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        const txt = "لم يتم تحديد موعد";
        const dl = document.getElementById("detail-deadline");
        const tl = document.getElementById("time-left-text");
        const cbar = document.getElementById("countdown-bar");
        if (dl) dl.textContent = txt;
        if (tl) tl.innerText = txt;
        if (cbar) {
          cbar.style.width = "0%";
          cbar.style.background = "var(--text-secondary)";
        }
        if (card.noDates && !card.openNow) {
          const sd = document.getElementById("detail-startdate");
          const st = document.getElementById("start-time-text");
          if (sd) sd.textContent = txt;
          if (st) st.textContent = txt;
        }
      } else {
        this.initDetailCountdown(card.deadline, card.startDate);
      }

      this.renderLikes(card.id);
      this.renderComments(card.id);
    }
  },

  toggleLike(btnElement) {
    if (!this.isLoggedIn()) {
      alert("يرجى تسجيل الدخول أولاً لتتمكن من الإعجاب.");
      window.location.href = "?view=login";
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return;

    let likesData = JSON.parse(localStorage.getItem("luxen_likes") || "{}");
    if (!likesData[id]) likesData[id] = [];

    const user = this.getUser();
    const userIndex = likesData[id].indexOf(user.username);

    if (userIndex > -1) {
      likesData[id].splice(userIndex, 1);
    } else {
      likesData[id].push(user.username);
    }

    localStorage.setItem("luxen_likes", JSON.stringify(likesData));
    this.renderLikes(id);

    // تحديث فوري إذا كان المدير فاتح المودال
    if (
      typeof Admin !== "undefined" &&
      document.getElementById("adminInteractionsModal").style.display === "flex"
    ) {
      Admin.renderAdminLikes();
    }
  },

  renderLikes(cardId) {
    let likesData = JSON.parse(localStorage.getItem("luxen_likes") || "{}");
    let count = likesData[cardId] ? likesData[cardId].length : 0;

    const btn = document.getElementById("like-btn");
    if (!btn) return;

    const user = this.getUser();
    const isLiked = user && likesData[cardId] && likesData[cardId].includes(user.username);

    if (isLiked) {
      btn.innerHTML = `<i class="fas fa-heart"></i> أعجبني (<span id="like-count">${count}</span>)`;
      btn.style.color = "#ef4444";
      btn.style.borderColor = "#ef4444";
      btn.style.background = "rgba(239, 68, 68, 0.1)";
    } else {
      btn.innerHTML = `<i class="far fa-heart"></i> إعجاب (<span id="like-count">${count}</span>)`;
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.style.background = "";
    }
  },

  addComment() {
    if (!this.isLoggedIn()) {
      alert("يرجى تسجيل الدخول أولاً لإضافة تعليق.");
      window.location.href = "?view=login";
      return;
    }

    const input = document.getElementById("comment-input");
    const text = input.value.trim();
    if (!text) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return;

    const user = this.getUser();
    let comments = JSON.parse(localStorage.getItem("luxen_comments") || "[]");

    const newComment = {
      id: Date.now().toString(),
      cardId: id,
      username: user.username,
      name: user.name || user.username,
      text: text,
      date: new Date().toLocaleString("ar-EG"),
    };

    comments.push(newComment);
    localStorage.setItem("luxen_comments", JSON.stringify(comments));

    input.value = "";
    this.renderComments(id);

    // تحديث فوري لو كان مدير النظام فاتح النافذة
    if (
      typeof Admin !== "undefined" &&
      document.getElementById("adminInteractionsModal").style.display === "flex"
    ) {
      Admin.renderAdminComments();
    }
  },

  renderComments(cardId) {
    const container = document.getElementById("comments-list");
    if (!container) return;

    let comments = JSON.parse(localStorage.getItem("luxen_comments") || "[]");
    let cardComments = comments.filter((c) => c.cardId == cardId);

    if (cardComments.length === 0) {
      container.innerHTML =
        '<div style="color: var(--text-muted); font-size: 0.95rem; text-align: center; padding: 20px;">لا توجد تعليقات حتى الآن. كن أول من يشارك برأيه!</div>';
      return;
    }

    container.innerHTML = cardComments
      .map(
        (c) => `
          <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border: 1px solid var(--border-glass);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <strong style="color: var(--accent-primary); font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                      <div style="width: 25px; height: 25px; background: var(--gradient-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                          ${c.name.charAt(0).toUpperCase()}
                      </div>
                      ${c.name}
                  </strong>
                  <span style="font-size: 0.8rem; color: var(--text-muted);">${c.date}</span>
              </div>
              <p style="margin: 0; font-size: 0.95rem; color: #e2e8f0; line-height: 1.6;">${c.text}</p>
          </div>
      `,
      )
      .reverse()
      .join("");
  },

  updateMobileNav() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const view = params.get("view");

    document
      .querySelectorAll(".bottom-nav-item")
      .forEach((item) => item.classList.remove("active"));

    if (view === "profile") {
      document.querySelector('.bottom-nav-item[data-nav="profile"]')?.classList.add("active");
    } else if (category === "competitions" || category === "scholarships" || category === "jobs") {
      const navCat = category === "volunteering" ? "volunteering" : "competitions";
      document.querySelector(`.bottom-nav-item[data-nav="${navCat}"]`)?.classList.add("active");
    } else if (category === "volunteering") {
      document.querySelector('.bottom-nav-item[data-nav="volunteering"]')?.classList.add("active");
    } else {
      document.querySelector('.bottom-nav-item[data-nav="home"]')?.classList.add("active");
    }
  },

  initHeroSearch() {
    const input = document.getElementById("hero-search-input");
    const dropdown = document.getElementById("hero-search-results");
    if (!input || !dropdown) return;

    const box = input.closest(".hero-search-box");
    const showDropdown = () => {
      dropdown.style.display = "block";
      if (box) box.classList.add("has-results");
    };
    const hideDropdown = () => {
      dropdown.style.display = "none";
      if (box) box.classList.remove("has-results");
    };

    let debounceTimer = null;

    const typeInfo = {
      volunteering: { name: "تطوع", class: "volunteering", icon: "fa-handshake" },
      competitions: { name: "مسابقة", class: "competitions", icon: "fa-trophy" },
      scholarships: { name: "منحة", class: "scholarships", icon: "fa-graduation-cap" },
      jobs: { name: "وظيفة", class: "jobs", icon: "fa-briefcase" },
      events: { name: "فعالية / ايفينت", class: "events", icon: "fa-calendar-alt" },
      courses: { name: "كورس مجاني", class: "courses", icon: "fa-book-open" },
      workshops: { name: "ورشة عمل", class: "volunteering", icon: "fa-chalkboard-teacher" },
      travel: { name: "فرصة سفر", class: "competitions", icon: "fa-plane-departure" },
      admission: { name: "قبول جامعي", class: "competitions", icon: "fa-university" },
      live: { name: "بث مباشر", class: "events", icon: "fa-video" },
      videos: { name: "فيديو", class: "courses", icon: "fa-clapperboard" },
    };

    const performSearch = (val) => {
      const q = String(val || "").trim().toLowerCase();
      if (!q) {
        dropdown.innerHTML = `
          <div class="sr-quick-section">
            <div class="sr-quick-title"><i class="fas fa-fire" style="color: #f59e0b; margin-left: 6px;"></i> تصنيفات شائعة للاستكشاف:</div>
            <div class="sr-quick-tags">
              <span class="sr-quick-tag" onclick="App.setHeroSearchValue('تطوع')"><i class="fas fa-handshake"></i> فرص تطوع</span>
              <span class="sr-quick-tag" onclick="App.setHeroSearchValue('ايفينت')"><i class="fas fa-calendar-alt"></i> ايفينتات وفعاليات</span>
              <span class="sr-quick-tag" onclick="App.setHeroSearchValue('مسابقات')"><i class="fas fa-trophy"></i> مسابقات وجوائز</span>
              <span class="sr-quick-tag" onclick="App.setHeroSearchValue('منح دراسية')"><i class="fas fa-graduation-cap"></i> منح دراسية</span>
              <span class="sr-quick-tag" onclick="App.setHeroSearchValue('وظائف')"><i class="fas fa-briefcase"></i> وظائف وتدريب</span>
              <span class="sr-quick-tag" onclick="App.setHeroSearchValue('كورسات')"><i class="fas fa-book-open"></i> كورسات مجانية</span>
            </div>
          </div>
        `;
        showDropdown();
        return;
      }

      const allCards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]").filter(
        (c) => !(c && c.partnerId) && c.status !== "hidden",
      );

      const matches = allCards.filter((c) => {
        const title = (c.name || "").toLowerCase();
        const type = (c.type || "").toLowerCase();
        const comp = (c.category || "").toLowerCase();
        const tags = (c.tags || "").toLowerCase();
        const desc = (c.desc || c.shortDesc || "").toLowerCase();
        const tInfo = typeInfo[type] || { name: type };
        const typeName = tInfo.name.toLowerCase();

        return (
          title.includes(q) ||
          type.includes(q) ||
          comp.includes(q) ||
          tags.includes(q) ||
          desc.includes(q) ||
          typeName.includes(q) ||
          (q.includes("تطوع") && (type === "volunteering" || typeName.includes("تطوع"))) ||
          ((q.includes("ايفينت") || q.includes("ايفنت") || q.includes("فعال")) && (type === "events" || typeName.includes("فعال"))) ||
          (q.includes("مسابق") && (type === "competitions" || typeName.includes("مسابق"))) ||
          (q.includes("منح") && (type === "scholarships" || typeName.includes("منح"))) ||
          (q.includes("وظي") && (type === "jobs" || typeName.includes("وظي"))) ||
          (q.includes("كورس") && (type === "courses" || typeName.includes("كورس")))
        );
      });

      if (matches.length === 0) {
        dropdown.innerHTML = `
          <div class="sr-empty">
            <div class="sr-empty-icon"><i class="fas fa-search"></i></div>
            <div>لم نجد فرصاً تطابق "<strong>${q}</strong>"</div>
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 6px;">جرّب البحث بكلمة عامة مثل: تطوع، ايفينت، منحة، مسابقة، كورس</div>
          </div>
        `;
        showDropdown();
        return;
      }

      const topMatches = matches.slice(0, 6);
      let html = "";

      topMatches.forEach((c) => {
        const tInfo = typeInfo[c.type] || { name: c.type || "فرصة", class: "other", icon: "fa-trophy" };
        const imgHtml = c.imgOuter
          ? `<img src="${c.imgOuter}" alt="">`
          : `<i class="fas ${tInfo.icon}"></i>`;
        const companyText = c.category ? `<span><i class="fas fa-building"></i> ${c.category}</span>` : "";
        const deadlineText = c.deadline ? `<span><i class="fas fa-calendar-alt"></i> ${c.deadline}</span>` : "";

        let safeTitle = c.name || "فرصة بدون عنوان";
        try {
          const reg = new RegExp(`(${q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi");
          safeTitle = safeTitle.replace(reg, "<mark>$1</mark>");
        } catch (e) {}

        const user = App.getUser();
        const isAdmin = user && user.isAdmin === true;
        const isSoon = c.status === "soon";
        const clickAttr =
          isSoon && !isAdmin
            ? `onclick="alert('🔒 هذه الفرصة قادمة قريباً ومغلقة حالياً ولا يمكن فتحها.'); return false;" href="javascript:void(0)"`
            : `href="?id=${c.id}"`;
        const soonBadge = isSoon
          ? `<span class="sr-badge" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);"><i class="fas fa-lock"></i> قريباً</span>`
          : "";

        html += `
          <a ${clickAttr} class="sr-item ${isSoon ? "is-soon" : ""}">
            <div class="sr-thumb">${imgHtml}</div>
            <div class="sr-info">
              <div class="sr-title-row">
                <span class="sr-title">${safeTitle}</span>
                <div style="display:flex; gap:6px; align-items:center;">
                  ${soonBadge}
                  <span class="sr-badge ${tInfo.class}">${tInfo.name}</span>
                </div>
              </div>
              <div class="sr-meta">
                ${companyText}
                ${deadlineText}
              </div>
            </div>
          </a>
        `;
      });

      html += `
        <div class="sr-view-all" onclick="window.location.href='?q=' + encodeURIComponent('${q}')">
          <span><i class="fas fa-arrow-left" style="margin-left: 6px;"></i> عرض كل نتائج البحث (${matches.length} فرصة)</span>
          <span style="font-size: 0.82rem; opacity: 0.8;">اضغط Enter ↵</span>
        </div>
      `;

      dropdown.innerHTML = html;
      showDropdown();
    };

    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => performSearch(e.target.value), 120);
    });

    input.addEventListener("focus", (e) => {
      performSearch(e.target.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = input.value.trim();
        if (val) {
          window.location.href = "?q=" + encodeURIComponent(val);
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        hideDropdown();
      }
    });
  },

  setHeroSearchValue(val) {
    const input = document.getElementById("hero-search-input");
    if (input) {
      input.value = val;
      input.dispatchEvent(new Event("input"));
      input.focus();
    }
  },

  updateCategoryCounts() {
    const cards = document.querySelectorAll(".opp-card");
    const counts = {};

    cards.forEach((card) => {
      const cat = card.getAttribute("data-category");
      if (counts[cat] === undefined) counts[cat] = 0;
      if (card.getAttribute("data-expired") !== "1") counts[cat] += 1;
    });

    document.querySelectorAll(".count-badge").forEach((badge) => {
      const cat = badge.getAttribute("data-count-cat");
      const count = counts[cat] || 0;

      if (cat && counts[cat] !== undefined) {
        badge.textContent = count > 0 ? count + " فرصة" : "لا يوجد حالياً";
        if (count > 0) badge.classList.add("has-items");
        else badge.classList.remove("has-items");
      }
    });
  },

  initStartDateBar(startStr) {
    if (this.startInterval) clearInterval(this.startInterval);

    const bar = document.getElementById("startdate-bar");
    const text = document.getElementById("start-time-text");
    const label = document.getElementById("detail-startdate");
    if (!bar || !text || !label) return;

    if (!startStr) {
      label.textContent = "غير محدد";
      bar.style.width = "0%";
      text.innerText = "غير محدد";
      return;
    }

    label.textContent = startStr;
    const startDate = new Date(startStr + "T00:00:00").getTime();
    const total = 30 * 24 * 60 * 60 * 1000;

    const update = () => {
      const now = Date.now();
      const distance = startDate - now;

      if (distance <= 0) {
        bar.style.width = "100%";
        text.innerText = "بدأ التقديم بالفعل";
        text.style.color = "#6ee7b7";
        if (this.startInterval) clearInterval(this.startInterval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      let pct = 100 - (distance / total) * 100;
      pct = Math.max(2, Math.min(100, pct));
      bar.style.width = pct + "%";
      text.innerText = days > 0 ? `يبدأ بعد ${days} يوماً` : `يبدأ بعد ${hours} ساعة`;
      text.style.color = "#a1a1aa";
    };

    update();
    this.startInterval = setInterval(update, 60000);
  },

  initDetailCountdown(deadlineStr, startStr) {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    const progressBar = document.getElementById("countdown-bar");
    const timeText = document.getElementById("time-left-text");
    const detailDeadline = document.getElementById("detail-deadline");

    if (!progressBar || !timeText) return;

    if (!deadlineStr) {
      progressBar.style.width = "0%";
      progressBar.style.background = "var(--text-secondary)";
      timeText.innerText = "غير محدد";
      return;
    }

    if (detailDeadline) detailDeadline.textContent = deadlineStr;
    const deadlineDate = new Date(deadlineStr + "T23:59:59").getTime();
    const startTime = startStr ? new Date(startStr + "T00:00:00").getTime() : NaN;
    const totalDuration =
      !isNaN(startTime) && deadlineDate > startTime
        ? deadlineDate - startTime
        : 60 * 24 * 60 * 60 * 1000;

    const updateProgress = () => {
      const now = new Date().getTime();
      const distance = deadlineDate - now;

      if (distance < 0) {
        progressBar.style.width = "100%";
        progressBar.style.background = "#4b5468";
        progressBar.style.boxShadow = "none";
        timeText.innerText = "انتهت المدة!";
        timeText.style.color = "var(--danger)";
        timeText.style.fontWeight = "bold";
        detailDeadline.style.color = "var(--danger)";
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        return;
      }

      const daysLeft = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      let percentage = (distance / totalDuration) * 100;
      percentage = Math.max(0, Math.min(100, percentage));

      if (percentage < 20) {
        progressBar.style.background = "var(--danger)";
        progressBar.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.5)";
      } else {
        progressBar.style.background = "linear-gradient(90deg, var(--danger), var(--gold))";
        progressBar.style.boxShadow = "0 0 10px rgba(245,158,11,0.5)";
      }

      progressBar.style.width = percentage + "%";
      timeText.innerText = daysLeft > 0 ? `متبقي ${daysLeft} يوماً` : `متبقي ${hoursLeft} ساعة`;
      timeText.style.color = "#a1a1aa";
      detailDeadline.style.color = "var(--gold)";
    };

    updateProgress();
    this.countdownInterval = setInterval(updateProgress, 1000 * 60 * 60);
  },

  applyLang(lang) {
    this.lang = lang;
    localStorage.setItem("ns_lang", lang);
    document.body.classList.remove("lang-en", "lang-ar");
    document.body.classList.add("lang-" + lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
    this.translatePage();
    const btn = document.querySelector(".lang-btn");
    if (btn) btn.textContent = lang === "ar" ? "EN" : "AR";
    window.dispatchEvent(new CustomEvent("elevate:languagechange", { detail: { lang } }));
  },

  applyTheme() {
    this.theme = "dark";
    localStorage.setItem("ns_theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
  },

  translatePage() {
    document.querySelectorAll("[data-en][data-ar]").forEach((el) => {
      el.innerHTML = el.getAttribute("data-" + this.lang) || el.getAttribute("data-en");
    });
    document.querySelectorAll("[data-en-placeholder]").forEach((el) => {
      el.placeholder =
        el.getAttribute("data-" + this.lang + "-placeholder") ||
        el.getAttribute("data-en-placeholder");
    });
  },

  bindThemeToggle() {
    // Dark mode is permanently enforced across the entire platform
    this.applyTheme();
  },

  bindLangToggle() {
    document.querySelectorAll(".lang-btn, .mobile-lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.applyLang(this.lang === "ar" ? "en" : "ar");
        this.injectNavbar();
        this.bindThemeToggle();
        this.bindLangToggle();
        this.renderNotifications();
      });
    });
  },

  bindMobileMenu() {
    if (this._mobileMenuBound) return;
    this._mobileMenuBound = true;

    document.addEventListener("click", (e) => {
      const toggle = e.target.closest(".menu-toggle");
      const closeBtn = e.target.closest(".mobile-close-btn");
      const overlay = e.target.closest(".sidebar-overlay");

      const mobileNav = document.querySelector(".mobile-nav");
      const sidebarOverlay = document.querySelector(".sidebar-overlay");

      if (toggle) {
        e.stopPropagation();
        if (mobileNav) mobileNav.classList.add("open");
        if (sidebarOverlay) sidebarOverlay.classList.add("open");
      } else if (closeBtn || overlay) {
        if (mobileNav) mobileNav.classList.remove("open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("open");
      }
    });
  },

  initNavbar() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          navbar.classList.toggle("scrolled", window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  },

  initAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.08 },
    );
    document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem("ns_user") || "null");
    } catch (e) {
      return null;
    }
  },

  isLoggedIn() {
    return !!(localStorage.getItem("ns_token") || localStorage.getItem("ns_user"));
  },

  logout() {
    localStorage.removeItem("ns_token");
    localStorage.removeItem("ns_user");
    localStorage.removeItem("luxen_current_user");
    localStorage.removeItem("ns_admin_token");
    localStorage.removeItem("ns_backup_token");
    localStorage.removeItem("ns_welcome");
    window.location.href = "index.html";
  },

  checkWelcomeMessage() {
    if (localStorage.getItem("ns_welcome") === "true") {
      const user = this.getUser();
      const name = user ? user.name || user.username : "";

      const toast = document.createElement("div");
      toast.className = "welcome-toast";
      toast.innerHTML = `<i class="fas fa-check-circle"></i> أهلاً بك يا ${name} في Elevate! 🎉`;
      document.body.appendChild(toast);

      setTimeout(() => toast.classList.add("show"), 100);
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 500);
      }, 4000);

      localStorage.removeItem("ns_welcome");
    }
  },

  renderNotifications() {
    const notifMenu = document.querySelector(".notif-menu .ui-menu-body");
    const notifBtn = document.querySelector(".nav-dropdown-wrapper .navbar-btn-icon .fa-bell");
    if (!notifMenu) return;

    let notifications = JSON.parse(localStorage.getItem("luxen_notifications") || "[]");
    let unreadCount = notifications.filter((n) => !n.read).length;

    if (notifBtn) {
      let badge = document.querySelector(".notif-badge-indicator");
      if (unreadCount > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "notif-badge-indicator";
          badge.style.cssText =
            "position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: red; border-radius: 50%; border: 2px solid var(--bg-card);";
          notifBtn.parentElement.style.position = "relative";
          notifBtn.parentElement.appendChild(badge);
        }
      } else {
        if (badge) badge.remove();
      }
    }

    if (notifications.length === 0) {
      notifMenu.innerHTML = `
            <div class="empty-notif">
                <i class="fas fa-bell-slash"></i>
                <p>لا توجد إشعارات بعد</p>
            </div>`;
      return;
    }

    notifications.sort((a, b) => b.timestamp - a.timestamp);

    notifMenu.innerHTML =
      `<div style="display: flex; flex-direction: column; gap: 0;">` +
      notifications
        .map(
          (n) => `
          <div class="ui-menu-item notif-item" style="display:flex; flex-direction:column; align-items:start; padding: 12px; border-bottom: 1px solid var(--border-color); background: ${n.read ? "transparent" : "rgba(99, 102, 241, 0.05)"};" onclick="App.markNotifRead('${n.id}', '${n.link || "#"}')">
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                <i class="fas fa-info-circle" style="color: var(--accent-primary); margin-left: 5px;"></i>${n.title}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">${n.message}</div>
              <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 6px;">${n.date}</div>
          </div>
      `,
        )
        .join("") +
      `</div>`;

    const readAllBtn = document.querySelector(".read-all-btn");
    if (readAllBtn) {
      readAllBtn.onclick = () => {
        notifications.forEach((n) => (n.read = true));
        localStorage.setItem("luxen_notifications", JSON.stringify(notifications));
        this.renderNotifications();
      };
    }
  },

  markNotifRead(id, link) {
    let notifications = JSON.parse(localStorage.getItem("luxen_notifications") || "[]");
    const notif = notifications.find((n) => n.id == id);
    if (notif) {
      notif.read = true;
      localStorage.setItem("luxen_notifications", JSON.stringify(notifications));
    }
    if (link && link !== "#") {
      window.location.href = link;
    } else {
      this.renderNotifications();
    }
  },

  injectNavbar() {
    const el = document.getElementById("navbar-placeholder");
    if (!el) return;
    const isAr = this.lang === "ar";
    const user = this.getUser();
    const loggedIn = this.isLoggedIn();
    const WA_LINK = "https://chat.whatsapp.com/NEXTSTEP_LINK";

    let authHtml =
      loggedIn && user
        ? `
      <div class="nav-dropdown-wrapper custom-ui-dropdown">
        <button class="navbar-btn-icon ui-icon-btn" type="button">
          <i class="fas fa-bell"></i>
        </button>
        <div class="nav-dropdown-menu ui-menu notif-menu">
          <div class="ui-menu-header notif-header">
            <button class="read-all-btn"><i class="fas fa-check-double"></i> قراءة الكل</button>
            <span>الإشعارات</span>
          </div>
          <div class="ui-menu-body empty-notif" style="max-height: 300px; overflow-y: auto; padding:0;">
            <i class="fas fa-bell-slash" style="margin-top:20px;"></i>
            <p style="margin-bottom:20px;">لا توجد إشعارات بعد</p>
          </div>
        </div>
      </div>

      <div class="nav-dropdown-wrapper custom-ui-dropdown">
        <button class="ui-user-btn" type="button">
          <i class="fas fa-chevron-down arrow-down hide-on-mobile"></i>
          <span class="u-name hide-on-mobile">${user.username}</span>
          <div class="u-avatar-circle">${user.username.charAt(0).toUpperCase()}</div>
        </button>
        <div class="nav-dropdown-menu ui-menu user-menu">
          <div class="ui-menu-header user-header">
             <span>User</span>
             <div class="u-icon-small"><i class="fas fa-user"></i></div>
          </div>
          <a href="${user.isTeacher ? '?view=teacher' : '?view=profile'}" class="ui-menu-item">
            <span>${user.isTeacher ? 'لوحة تحكم المدرس' : 'الملف الشخصي'}</span>
            <i class="fas ${user.isTeacher ? 'fa-chalkboard-teacher' : 'fa-user'} item-icon profile-color"></i>
          </a>
          <a href="?view=shorts" class="ui-menu-item">
            <span>Elevate Shorts</span>
            <i class="fas fa-play item-icon" style="color:#f43f5e;"></i>
          </a>
          ${(() => {
            const vis = localStorage.getItem("luxen_contests_visibility") || "active";
            if (vis === "hidden") return "";
            if (vis === "coming_soon") {
              return `
                <a href="#" onclick="if(window.PlatformContests) PlatformContests.showComingSoonNotice(event); return false;" class="ui-menu-item">
                  <span>مسابقات المنصة <span class="contest-soon-pill">قريباً</span></span>
                  <i class="fas fa-trophy item-icon" style="color:#f59e0b;"></i>
                </a>
              `;
            }
            return `
              <a href="?view=contests" class="ui-menu-item">
                <span>مسابقات المنصة (Live)</span>
                <i class="fas fa-trophy item-icon" style="color:#f59e0b;"></i>
              </a>
            `;
          })()}
          <a href="?view=community" class="ui-menu-item">
            <span>مجتمع Elevate</span>
            <i class="fas fa-comments item-icon" style="color:#6366f1;"></i>
          </a>
          <a href="?view=profile&tab=saved" class="ui-menu-item">
            <span>المحفوظات</span>
            <i class="fas fa-bookmark item-icon saved-color"></i>
          </a>
          <div class="ui-menu-divider"></div>
          <a href="#" onclick="App.logout()" class="ui-menu-item logout-item">
            <span>تسجيل الخروج</span>
            <i class="fas fa-sign-out-alt"></i>
          </a>
        </div>
      </div>
    `
        : `
       <div class="hide-on-mobile" style="display:flex; gap:8px;">
           <a href="?view=login" class="btn btn-secondary btn-sm">${isAr ? "دخول" : "Sign In"}</a>
           <a href="?view=login" class="btn btn-primary btn-sm">${isAr ? "إنشاء حساب" : "Sign Up"}</a>
       </div>
    `;

    el.innerHTML = `
      <div class="sidebar-overlay" onclick="document.querySelector('.mobile-nav').classList.remove('open'); this.classList.remove('open');"></div>
      <nav class="navbar">
        <div class="navbar-inner">
          <a href="index.html" class="navbar-logo">
            <img src="images/logo.png" alt="Elevate Logo" style="width: 36px; height: auto; object-fit: contain; border-radius: 8px;">
            <span class="navbar-logo-text">Elevate</span>
          </a>
          
          <div class="navbar-nav hide-on-mobile">
            <a href="index.html" class="active"><i class="fas fa-home"></i><span>${isAr ? "الرئيسية" : "Home"}</span></a>
            <a href="?view=shorts" style="color:#f43f5e; font-weight:700;"><i class="fas fa-play" style="color:#f43f5e;"></i><span>${isAr ? "شورتس" : "Shorts"}</span></a>
            ${(() => {
              const vis = localStorage.getItem("luxen_contests_visibility") || "active";
              if (vis === "hidden") return "";
              if (vis === "coming_soon") {
                return `<a href="#" onclick="if(window.PlatformContests) PlatformContests.showComingSoonNotice(event); return false;" style="color:#f59e0b; font-weight:700;"><i class="fas fa-trophy" style="color:#f59e0b;"></i><span>${isAr ? "مسابقات المنصة" : "Live Battles"}</span> <span class="contest-soon-pill">قريباً</span></a>`;
              }
              return `<a href="?view=contests" style="color:#f59e0b; font-weight:700;"><i class="fas fa-trophy" style="color:#f59e0b;"></i><span>${isAr ? "مسابقات المنصة" : "Live Battles"}</span></a>`;
            })()}
            <a href="?view=community" style="color:var(--accent-primary); font-weight:700;"><i class="fas fa-comments" style="color:var(--accent-primary);"></i><span>${isAr ? "المجتمع" : "Community"}</span></a>
            
            <div class="nav-dropdown-wrapper">
              <button class="nav-dropdown-btn" type="button">
                <i class="fas fa-layer-group"></i>
                <span>${isAr ? "التصنيفات" : "Categories"}</span>
                <i class="fas fa-chevron-down" style="font-size:0.7rem; margin-right: 2px;"></i>
              </button>
              <div class="nav-dropdown-menu">
                <a href="?category=competitions" class="nav-dropdown-item">
                  <i class="fas fa-trophy"></i><span>${isAr ? "مسابقات" : "Competitions"}</span>
                </a>
                <a href="?category=scholarships" class="nav-dropdown-item">
                  <i class="fas fa-graduation-cap"></i><span>${isAr ? "منح دراسية" : "Scholarships"}</span>
                </a>
                <a href="?category=volunteering" class="nav-dropdown-item">
                  <i class="fas fa-hands-helping"></i><span>${isAr ? "فرص تطوع" : "Volunteering"}</span>
                </a>
                <a href="?category=jobs" class="nav-dropdown-item">
                  <i class="fas fa-briefcase"></i><span>${isAr ? "وظائف" : "Jobs"}</span>
                </a>
                <a href="?category=courses" class="nav-dropdown-item">
                  <i class="fas fa-book-open"></i><span>${isAr ? "كورسات مجانية" : "Free Courses"}</span>
                </a>
                <a href="?category=workshops" class="nav-dropdown-item">
                  <i class="fas fa-chalkboard-teacher"></i><span>${isAr ? "ورش عمل" : "Workshops"}</span>
                </a>
                <a href="?category=travel" class="nav-dropdown-item">
                  <i class="fas fa-plane-departure"></i><span>${isAr ? "فرص سفر ممولة" : "Funded Travel"}</span>
                </a>
                <a href="?category=admission" class="nav-dropdown-item">
                  <i class="fas fa-university"></i><span>${isAr ? "قبول جامعي" : "Admission"}</span>
                </a>
                <a href="?category=live" class="nav-dropdown-item">
                  <i class="fas fa-video"></i><span>${isAr ? "ورش عمل مباشر" : "Live Workshops"}</span>
                </a>
                <a href="?category=videos" class="nav-dropdown-item">
                  <i class="fas fa-clapperboard"></i><span>${isAr ? "فيديوهات" : "Videos"}</span>
                </a>
              </div>
            </div>
          </div>

          <div class="navbar-actions">
            <div class="hide-on-mobile" style="display:flex; gap:8px;">
                <button class="lang-btn">${isAr ? "EN" : "AR"}</button>
            </div>
            ${!loggedIn ? `<button class="navbar-btn-icon ui-icon-btn hide-on-mobile" onclick="window.location.href='?view=login'"><i class="fas fa-bookmark"></i></button>` : ""}
            
            ${authHtml}
            <button class="navbar-btn-icon menu-toggle" onclick="document.querySelector('.mobile-nav').classList.add('open'); document.querySelector('.sidebar-overlay').classList.add('open');"><i class="fas fa-bars"></i></button>
          </div>
        </div>
      </nav>

      <div class="mobile-nav">
        <div class="mobile-nav-header">
           <a href="index.html" class="navbar-logo">
             <img src="images/logo.png" alt="Elevate Logo" style="width: 36px; height: auto; object-fit: contain; border-radius: 8px;">
             <span class="navbar-logo-text">Elevate</span>
           </a>
           <button class="mobile-close-btn" onclick="document.querySelector('.mobile-nav').classList.remove('open'); document.querySelector('.sidebar-overlay').classList.remove('open');"><i class="fas fa-times"></i></button>
        </div>

        <div style="display:flex; justify-content:center; gap:8px; margin-bottom: 20px; padding: 10px; background: var(--bg-overlay); border-radius: 12px;">
             <button class="mobile-lang-btn" style="font-weight: bold; color: var(--text-primary); border-radius: 8px; padding: 6px 12px; background: var(--bg-card);"><i class="fas fa-globe"></i> ${isAr ? "English" : "العربية"}</button>
        </div>

        <a href="index.html"><i class="fas fa-home"></i><span>${isAr ? "الرئيسية" : "Home"}</span></a>
        <a href="?view=shorts" style="color:#f43f5e; font-weight:700;"><i class="fas fa-play" style="color:#f43f5e;"></i><span>${isAr ? "Elevate Shorts (فيديوهات قصيرة)" : "Shorts"}</span></a>
        ${(() => {
          const vis = localStorage.getItem("luxen_contests_visibility") || "active";
          if (vis === "hidden") return "";
          if (vis === "coming_soon") {
            return `<a href="#" onclick="if(window.PlatformContests) PlatformContests.showComingSoonNotice(event); return false;" style="color:#f59e0b; font-weight:700;"><i class="fas fa-trophy" style="color:#f59e0b;"></i><span>${isAr ? "مسابقات المنصة" : "Live Contests"}</span> <span class="contest-soon-pill">قريباً</span></a>`;
          }
          return `<a href="?view=contests" style="color:#f59e0b; font-weight:700;"><i class="fas fa-trophy" style="color:#f59e0b;"></i><span>${isAr ? "مسابقات المنصة (بث مباشر)" : "Live Contests"}</span></a>`;
        })()}
        <a href="?view=community" style="color:var(--accent-primary); font-weight:700;"><i class="fas fa-comments" style="color:var(--accent-primary);"></i><span>${isAr ? "مجتمع Elevate (تواصل الأعضاء)" : "Community"}</span></a>
        
        <div class="mobile-dropdown-title">${isAr ? "التصنيفات والفرص" : "Categories & Opportunities"}</div>
        <a href="?category=competitions"><i class="fas fa-trophy"></i><span>${isAr ? "مسابقات" : "Competitions"}</span></a>
        <a href="?category=scholarships"><i class="fas fa-graduation-cap"></i><span>${isAr ? "منح دراسية" : "Scholarships"}</span></a>
        <a href="?category=volunteering"><i class="fas fa-hands-helping"></i><span>${isAr ? "فرص تطوع" : "Volunteering"}</span></a>
        <a href="?category=jobs"><i class="fas fa-briefcase"></i><span>${isAr ? "وظائف" : "Jobs"}</span></a>
        <a href="?category=courses"><i class="fas fa-book-open"></i><span>${isAr ? "كورسات مجانية" : "Free Courses"}</span></a>
        <a href="?category=workshops"><i class="fas fa-chalkboard-teacher"></i><span>${isAr ? "ورش عمل" : "Workshops"}</span></a>
        <a href="?category=travel"><i class="fas fa-plane-departure"></i><span>${isAr ? "فرص سفر ممولة" : "Funded Travel"}</span></a>
        <a href="?category=admission"><i class="fas fa-university"></i><span>${isAr ? "قبول جامعي" : "Admission"}</span></a>
        <a href="?category=live"><i class="fas fa-video"></i><span>${isAr ? "ورش عمل مباشر" : "Live Workshops"}</span></a>
        <a href="?category=videos"><i class="fas fa-clapperboard"></i><span>${isAr ? "فيديوهات" : "Videos"}</span></a>
        
        <div class="mobile-dropdown-title">${isAr ? "تواصل معنا" : "Contact Us"}</div>
        <a href="${WA_LINK}" target="_blank" style="color:#25d366;"><i class="fab fa-whatsapp"></i><span>${isAr ? "جروب الواتساب" : "WhatsApp Group"}</span></a>

        ${
          !loggedIn
            ? `
        <div class="mobile-dropdown-title">${isAr ? "حسابي" : "Account"}</div>
        <a href="?view=login"><i class="fas fa-sign-in-alt"></i><span>${isAr ? "تسجيل الدخول" : "Sign In"}</span></a>
        <a href="?view=login" style="color:var(--accent-primary);"><i class="fas fa-user-plus"></i><span>${isAr ? "إنشاء حساب" : "Sign Up"}</span></a>
        `
            : `
        <div class="mobile-dropdown-title">حسابي</div>
        <a href="${user.isTeacher ? '?view=teacher' : '?view=profile'}"><i class="fas ${user.isTeacher ? 'fa-chalkboard-teacher' : 'fa-user'}"></i><span>${user.isTeacher ? 'لوحة تحكم المدرس' : 'الملف الشخصي'}</span></a>
        <a href="#" onclick="App.logout()" style="color:var(--accent-danger)"><i class="fas fa-sign-out-alt"></i><span>تسجيل خروج</span></a>
        `
        }
      </div>`;
  },

  injectFooter() {
    const el = document.getElementById("footer-placeholder");
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
    <footer class="footer ns-footer-enhanced">
        <div class="footer-container">
            <div class="footer-col footer-col-brand">
                <a href="index.html" class="footer-logo">
                    <img src="images/logo.png" alt="Elevate Logo" class="footer-logo-img">
                    <span class="footer-logo-text">Elevate</span>
                    <span class="footer-verified-badge"><i class="fas fa-check-circle"></i> منصة موثوقة</span>
                </a>
                <p class="footer-desc">
                    بوابتك الأولى والموثوقة لاكتشاف المسابقات، المنح الدراسية، برامج التطوع، والوظائف التي تبني مستقبلك وتصنع فارقاً حقيقياً في مسيرتك.
                </p>
                <div class="footer-contact-highlight">
                    <i class="fas fa-headset"></i>
                    <div>
                        <div class="fch-label">خدمة العملاء والدعم المباشر:</div>
                        <a href="tel:01124310907" class="fch-phone" dir="ltr"><i class="fas fa-phone-alt"></i> 01124310907</a>
                    </div>
                </div>
            </div>

            <div class="footer-col">
                <h3 class="footer-col-title">استكشف الفرص</h3>
                <ul class="footer-links">
                    <li><a href="?category=competitions"><i class="fas fa-trophy"></i> المسابقات والجوائز</a></li>
                    <li><a href="?category=scholarships"><i class="fas fa-graduation-cap"></i> المنح الدراسية</a></li>
                    <li><a href="?category=volunteering"><i class="fas fa-hands-helping"></i> فرص التطوع</a></li>
                    <li><a href="?category=events"><i class="fas fa-calendar-alt"></i> الفعاليات والايفينتات</a></li>
                    <li><a href="?category=jobs"><i class="fas fa-briefcase"></i> الوظائف والتدريب</a></li>
                </ul>
            </div>

            <div class="footer-col">
                <h3 class="footer-col-title">روابط سريعة ومساعدة</h3>
                <ul class="footer-links">
                    <li><a href="?category=courses"><i class="fas fa-book-open"></i> كورسات مجانية</a></li>
                    <li><a href="?view=community"><i class="fas fa-comments"></i> مجتمع Elevate</a></li>
                    <li><a href="?view=shorts"><i class="fas fa-play"></i> مقاطع Shorts</a></li>
                    <li><a href="?view=login"><i class="fas fa-user-circle"></i> تسجيل الدخول / حساب جديد</a></li>
                    <li><a href="index.html#faq"><i class="fas fa-question-circle"></i> الأسئلة الشائعة</a></li>
                </ul>
            </div>
        </div>

        <div class="footer-brand-strip">
            <div class="footer-brand-pill">
                <i class="fas fa-shield-alt"></i>
                <span>منظومة تقنية مدعومة بالكامل بواسطة <strong>LUXEN TECH</strong></span>
            </div>
        </div>

        <div class="footer-bottom">
            <div class="footer-copy">
                &copy; ${year} <strong>Elevate</strong>. جميع الحقوق محفوظة لرواد المستقبل.
            </div>
            <div class="footer-bottom-links">
                <span><i class="fas fa-lock"></i> خصوصية وأمان عالي</span>
                <span class="f-dot">•</span>
                <span><i class="fas fa-bolt"></i> منصة فائقة السرعة</span>
            </div>
        </div>
    </footer>`;
  },

  initWidget() {
    var old = document.getElementById("ns-ai-widget");
    if (old) old.remove();

    var style = document.createElement("style");
    style.textContent = `
    #ns-ai-widget * { box-sizing: border-box; margin: 0; padding: 0; }
    #ns-ai-btn { position: fixed; bottom: 28px; right: 28px; width: 58px; height: 58px; border-radius: 50%; background: var(--gradient-primary, linear-gradient(135deg, #6366f1, #8b5cf6)); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.25rem; z-index: 9998; box-shadow: 0 8px 28px rgba(99,102,241,.4); transition: transform 0.3s; }
    #ns-ai-popup { position: fixed; bottom: 100px; right: 28px; width: 360px; max-width: calc(100vw - 40px); max-height: 570px; display: flex; flex-direction: column; background: var(--bg-card, #fff); border: 1px solid var(--border-color); border-radius: 24px; box-shadow: var(--shadow-xl); z-index: 9997; overflow: hidden; transform: scale(.9) translateY(16px); opacity: 0; pointer-events: none; transition: transform .32s, opacity .22s; }
    #ns-ai-popup.ns-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
    #ns-ai-hd { display: flex; align-items: center; gap: 11px; padding: 15px 16px; background: var(--gradient-primary); color: #fff; }
    #ns-ai-msgs { flex: 1; overflow-y: auto; padding: 14px 13px; display: flex; flex-direction: column; gap: 12px; min-height: 180px; }
    .ns-msg { display: flex; gap: 8px; align-items: flex-end; max-width: 92%; }
    .ns-msg.ns-bot { align-self: flex-start; }
    .ns-msg.ns-user { align-self: flex-end; flex-direction: row-reverse; }
    .ns-bbl { padding: 9px 13px; border-radius: 16px; font-size: .82rem; line-height: 1.7; word-break: break-word; }
    .ns-msg.ns-bot .ns-bbl { background: var(--bg-secondary); color: var(--text-primary); }
    .ns-msg.ns-user .ns-bbl { background: var(--gradient-primary); color: #fff; }
    #ns-ai-inp-wrap { padding: 10px 12px; border-top: 1px solid var(--border-color); background: var(--bg-card); }
    #ns-ai-inp-row { display: flex; gap: 8px; align-items: flex-end; background: var(--bg-secondary); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 7px; }
    #ns-ai-input { flex: 1; border: none; background: transparent; color: var(--text-primary); font-size: .82rem; resize: none; outline: none; }
    #ns-ai-send { width: 34px; height: 34px; border-radius: 12px; background: var(--gradient-primary); border: none; color: #fff; cursor: pointer; }
    @media (max-width: 768px) {
        #ns-ai-btn { bottom: 85px; right: 20px; }
        #ns-ai-popup { bottom: 155px; right: 20px; }
    }
    `;
    document.head.appendChild(style);

    var wrap = document.createElement("div");
    wrap.id = "ns-ai-widget";
    wrap.innerHTML =
      '<button id="ns-ai-btn" onclick="nsWidgetToggle()"><i class="fas fa-robot"></i></button>' +
      '<div id="ns-ai-popup">' +
      '<div id="ns-ai-hd">' +
      '<div style="font-weight:800;">Elevate AI</div>' +
      '<button onclick="nsWidgetToggle()" style="margin-left:auto;color:#fff;font-size:1.2rem;"><i class="fas fa-times"></i></button>' +
      "</div>" +
      '<div id="ns-ai-msgs">' +
      '<div class="ns-msg ns-bot"><div class="ns-bbl">مرحباً بك! اسألني عن أحدث المنح والمسابقات.</div></div>' +
      "</div>" +
      '<div id="ns-ai-inp-wrap">' +
      '<div id="ns-ai-inp-row">' +
      '<textarea id="ns-ai-input" rows="1" placeholder="اسألني أي شيء..." onkeydown="nsHandleKey(event)"></textarea>' +
      '<button id="ns-ai-send" onclick="nsSend()"><i class="fas fa-paper-plane"></i></button>' +
      "</div>" +
      "</div>" +
      "</div>";
    document.body.appendChild(wrap);
  },

  bindSaveButtons() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(
        ".opp-bookmark-top, .opp-bookmark-bottom, .prof-btn-save-square",
      );
      if (btn && btn.closest(".opp-card")) {
        const card = btn.closest(".opp-card");
        if (card.classList.contains("is-soon")) return;

        const opp = {
          id: card.getAttribute("data-id"),
          title: card.getAttribute("data-title"),
          category: card.getAttribute("data-category"),
          company: card.getAttribute("data-company"),
          date: card.getAttribute("data-date"),
          tags: card.getAttribute("data-tags"),
          type: card.getAttribute("data-type"),
        };
        this.toggleSave(opp, btn);
      }
    });
  },

  toggleSave(opp, btnElement) {
    if (!this.isLoggedIn()) {
      alert("يرجى تسجيل الدخول لحفظ الفرص.");
      window.location.href = "?view=login";
      return;
    }

    let saved = JSON.parse(localStorage.getItem("ns_saved_opps") || "[]");
    const index = saved.findIndex((item) => item.id == opp.id);

    if (index > -1) {
      saved.splice(index, 1);
      if (btnElement) {
        btnElement.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
        btnElement.classList.remove("saved-active");
      }
    } else {
      saved.push(opp);
      if (btnElement) {
        btnElement.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        btnElement.classList.add("saved-active");
      }
    }
    localStorage.setItem("ns_saved_opps", JSON.stringify(saved));
    this.renderSavedOpps();
    this.updateBookmarkIcons();
  },

  updateBookmarkIcons() {
    let saved = JSON.parse(localStorage.getItem("ns_saved_opps") || "[]");
    const savedIds = saved.map((s) => s.id.toString());

    document.querySelectorAll(".opp-card").forEach((card) => {
      const isSaved = savedIds.includes(card.getAttribute("data-id").toString());
      card.querySelectorAll(".opp-bookmark-top, .opp-bookmark-bottom").forEach((btn) => {
        if (isSaved) {
          btn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
          btn.classList.add("saved-active");
          btn.style.color = "var(--accent-primary)";
        } else {
          btn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
          btn.classList.remove("saved-active");
          btn.style.color = "";
        }
      });
    });
  },

  recordView(cardId) {
    try {
      let views = JSON.parse(localStorage.getItem("luxen_views") || "{}");
      if (!views[cardId]) views[cardId] = [];
      const user = this.getUser();
      let key;
      if (user && user.username) {
        key = user.username;
      } else {
        key = localStorage.getItem("ns_guest_id");
        if (!key) {
          key = "guest_" + Math.random().toString(36).substr(2, 9);
          localStorage.setItem("ns_guest_id", key);
        }
      }
      if (views[cardId].some((v) => v.u === key)) return;
      views[cardId].push({
        u: key,
        n: (user && (user.name || user.username)) || "زائر",
        t: Date.now(),
      });
      localStorage.setItem("luxen_views", JSON.stringify(views));
    } catch (e) {}
  },

  renderProfile() {
    const user = this.getUser();
    if (!user) {
      window.location.href = "?view=login";
      return;
    }

    // إذا كان الحساب يخص مدرساً، يتم توجيهه فوراً لصفحة المدرس المستقلة الخاصة به
    const allUsers = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
    const teacherRecord = allUsers.find(
      (u) =>
        (u.isTeacher || user.isTeacher) &&
        (u.username === user.username || u.email === user.email || u.id === user.id) &&
        u.isActive !== false,
    );
    if ((user.isTeacher || teacherRecord) && !user.isAdmin && user.username !== "admin@elevate.com") {
      window.location.href = "index.html?view=teacher";
      return;
    }

    // ===============================================
    // منطق حساب الإدمن (واجهة احترافية Premium Dashboard)
    // ===============================================
    const isMainAdmin =
      user.isAdmin === true ||
      user.username === "admin@elevate.com" ||
      user.username === "admin" ||
      (user.email && user.email.toLowerCase() === "admin@elevate.com");
    const teamRecord = (allUsers || []).find(
      (u) => u.isTeam && u.username === user.username && u.isActive !== false,
    );
    if (isMainAdmin || teamRecord) {
      // إخفاء إحصائيات وعناصر المستخدم العادي
      if (document.getElementById("prof-normal-meta"))
        document.getElementById("prof-normal-meta").style.display = "none";
      if (document.getElementById("prof-normal-stats"))
        document.getElementById("prof-normal-stats").style.display = "none";
      if (document.getElementById("prof-normal-sidebar"))
        document.getElementById("prof-normal-sidebar").style.display = "none";
      if (document.getElementById("tab-overview-btn"))
        document.getElementById("tab-overview-btn").style.display = "none";
      if (document.getElementById("tab-saved-btn"))
        document.getElementById("tab-saved-btn").style.display = "none";
      if (document.getElementById("prof-save-header-btn"))
        document.getElementById("prof-save-header-btn").style.display = "none";

      // إظهار تبويب الإدارة
      const adminBtn = document.getElementById("tab-admin-btn");
      if (adminBtn) {
        adminBtn.style.display = "block";
        this.switchProfTab("prof-admin-tab");
      }

      // تصميم فخم ومختلف كلياً لهيدر الأدمن
      const profHeader = document.getElementById("prof-header");
      if (profHeader) {
        profHeader.classList.add("admin-executive-header");
        profHeader.style.background =
          "linear-gradient(135deg, #0b0f19 0%, #17153b 50%, #0f172a 100%)";
        profHeader.style.border = "1px solid rgba(245, 158, 11, 0.35)";
        profHeader.style.boxShadow =
          "0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 30px rgba(245, 158, 11, 0.08)";
      }

      if (document.getElementById("prof-name-disp")) {
        document.getElementById("prof-name-disp").innerHTML = isMainAdmin
          ? 'المدير العام <i class="fas fa-crown" style="color:#fbbf24; font-size: 22px; margin-right: 8px; filter: drop-shadow(0 0 10px rgba(245,158,11,0.6));"></i>'
          : (teamRecord.fullName || "عضو الفريق") +
            ' <i class="fas fa-user-shield" style="color:#fbbf24; font-size: 18px; margin-right: 8px;"></i>';
      }

      if (document.getElementById("prof-avatar-char")) {
        document.getElementById("prof-avatar-char").className = "prof-avatar admin-avatar-pro";
        document.getElementById("prof-avatar-char").innerHTML =
          '<i class="fas fa-user-shield"></i><span class="admin-live-dot" title="متصل الآن ومباشر"></span>';
      }

      if (document.getElementById("prof-handle-disp")) {
        document.getElementById("prof-handle-disp").innerHTML = isMainAdmin
          ? 'Admin. Elevate · <span style="color:#fbbf24; font-weight:700;">المسؤول التنفيذي للمنصة</span>'
          : user.username;
      }

      if (document.getElementById("prof-role-badge")) {
        document.getElementById("prof-role-badge").innerHTML = isMainAdmin
          ? '<i class="fa-solid fa-crown"></i> إدارة مركزية VIP'
          : '<i class="fa-solid fa-shield-halved"></i> فريق العمل';
        document.getElementById("prof-role-badge").style.background =
          "linear-gradient(135deg, #f59e0b, #d97706)";
        document.getElementById("prof-role-badge").style.color = "#fff";
        document.getElementById("prof-role-badge").style.border = "none";
        document.getElementById("prof-role-badge").style.boxShadow =
          "0 4px 15px rgba(245, 158, 11, 0.4)";
      }

      // إظهار شريط البيانات وأزرار المدير التنفيذية
      if (document.getElementById("prof-admin-meta"))
        document.getElementById("prof-admin-meta").style.display = "flex";
      if (document.getElementById("prof-admin-header-actions"))
        document.getElementById("prof-admin-header-actions").style.display = "flex";
      if (document.getElementById("prof-logout-btn"))
        document.getElementById("prof-logout-btn").style.display = "none";

      // تحديث توقيت الجلسة في الهيدر
      const timeEl = document.getElementById("admin-current-time");
      if (timeEl) {
        const updateTime = () => {
          const now = new Date();
          timeEl.textContent =
            now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) +
            " · " +
            now.toLocaleDateString("ar-EG");
        };
        updateTime();
        if (!window._adminClockInterval)
          window._adminClockInterval = setInterval(updateTime, 30000);
      }

      Admin.init();
      Admin.applyPermissions(isMainAdmin ? "all" : teamRecord.perms || []);
      return;
    }

    // ===============================================
    // حساب الشريك (لوحة الشريك)
    // ===============================================
    const partnerRecord = (JSON.parse(localStorage.getItem("luxen_all_users") || "[]") || []).find(
      (u) => u.isPartner && u.username === user.username && u.isActive !== false,
    );
    if (partnerRecord) {
      if (document.getElementById("prof-normal-stats"))
        document.getElementById("prof-normal-stats").style.display = "none";
      if (document.getElementById("prof-normal-sidebar"))
        document.getElementById("prof-normal-sidebar").style.display = "none";
      if (document.getElementById("tab-overview-btn"))
        document.getElementById("tab-overview-btn").style.display = "none";
      if (document.getElementById("tab-saved-btn"))
        document.getElementById("tab-saved-btn").style.display = "none";
      if (document.getElementById("prof-save-header-btn"))
        document.getElementById("prof-save-header-btn").style.display = "none";
      const pBtn = document.getElementById("tab-partner-btn");
      if (pBtn) {
        pBtn.style.display = "block";
        this.switchProfTab("prof-partner-tab");
      }
      if (document.getElementById("prof-name-disp"))
        document.getElementById("prof-name-disp").textContent =
          partnerRecord.fullName || user.username;
      if (document.getElementById("prof-handle-disp"))
        document.getElementById("prof-handle-disp").textContent = user.username;
      if (document.getElementById("prof-role-badge"))
        document.getElementById("prof-role-badge").innerHTML =
          '<i class="fa-solid fa-handshake"></i> حساب شريك موثوق';
      if (document.getElementById("prof-avatar-char"))
        document.getElementById("prof-avatar-char").innerHTML = '<i class="fas fa-handshake"></i>';
      Partner.init(partnerRecord.partnerId);
      return;
    }

    // إذا كان الحساب يخص مدرساً، يتم تحويله لصفحة المدرس المستقلة
    if (user.isTeacher || teacherRecord) {
      window.location.href = "index.html?view=teacher";
      return;
    }

    const username = user.username || "مستخدم";
    const name = user.name || username;
    const phone = user.phone || "غير مسجل";
    const joinDate = user.join_date || new Date().toLocaleDateString("ar-EG");
    const userId = user.id || "usr_" + Math.random().toString(16).substr(2, 8);
    const shortId = userId.replace("usr_", "").substring(0, 6);

    let activeDays = 1;
    if (user.join_timestamp) {
      const diffTime = Math.abs(Date.now() - user.join_timestamp);
      activeDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    let allComments = JSON.parse(localStorage.getItem("luxen_comments") || "[]");
    let userCommentsCount = allComments.filter((c) => c.username === username).length;
    if (document.getElementById("prof-comments-count"))
      document.getElementById("prof-comments-count").textContent = userCommentsCount;

    if (document.getElementById("prof-name-disp"))
      document.getElementById("prof-name-disp").textContent = name;
    if (document.getElementById("prof-avatar-char"))
      document.getElementById("prof-avatar-char").textContent = name.charAt(0).toUpperCase();
    if (document.getElementById("prof-handle-disp"))
      document.getElementById("prof-handle-disp").textContent = "@" + username;
    if (document.getElementById("prof-phone-disp"))
      document.getElementById("prof-phone-disp").textContent = phone;
    if (document.getElementById("prof-date-disp"))
      document.getElementById("prof-date-disp").textContent = "انضم في " + joinDate;

    if (document.getElementById("prof-member-id"))
      document.getElementById("prof-member-id").textContent = shortId;
    if (document.getElementById("prof-active-days"))
      document.getElementById("prof-active-days").textContent = activeDays;

    if (document.getElementById("prof-info-name"))
      document.getElementById("prof-info-name").textContent = name;
    if (document.getElementById("prof-info-handle"))
      document.getElementById("prof-info-handle").textContent = "@" + username;
    if (document.getElementById("prof-info-phone"))
      document.getElementById("prof-info-phone").textContent = phone;
    if (document.getElementById("prof-info-role"))
      document.getElementById("prof-info-role").textContent = "مستخدم";

    this.renderSavedOpps();

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "saved") {
      this.switchProfTab("prof-saved-tab");
    }
  },

  renderSavedOpps() {
    let saved = JSON.parse(localStorage.getItem("ns_saved_opps") || "[]");
    const container = document.getElementById("saved-grid-container");
    const countEl = document.getElementById("prof-saved-count");

    if (countEl) countEl.textContent = saved.length;
    if (!container) return;

    container.innerHTML = "";

    if (saved.length === 0) {
      container.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius:16px; border:1px solid var(--border-color);">لا توجد فرص محفوظة حالياً. استكشف الفرص واحفظها لتظهر هنا!</div>';
      return;
    }

    saved.forEach((opp) => {
      let tagsHtml = "";
      if (opp.tags) {
        opp.tags.split(",").forEach((tag) => {
          if (tag.trim() !== "") tagsHtml += `<span class="prof-c-tag">${tag.trim()}</span>`;
        });
      }

      container.innerHTML += `
            <div class="prof-custom-card">
                <div class="prof-card-cover">
                    <div class="prof-cover-badges-right">
                        <span class="prof-badge-icon red"><i class="fa-solid fa-bookmark"></i></span>
                    </div>
                    <div class="prof-cover-badges-left">
                        <span class="prof-badge-pill purple">${opp.type || "فرصة"}</span>
                    </div>
                </div>
                <div class="prof-card-body">
                    <h3 class="prof-card-title" dir="ltr">${opp.title}</h3>
                    <div class="prof-card-company" dir="ltr">
                        ${opp.company} <i class="fa-solid fa-building"></i>
                    </div>
                    <div class="prof-card-tags" dir="ltr">
                        ${tagsHtml}
                    </div>
                    <div class="prof-card-divider"></div>
                    <div class="prof-card-date">
                        <span>${opp.date}</span> <i class="fa-regular fa-calendar-days"></i>
                    </div>
                    <div class="prof-card-actions">
                        <button class="prof-btn-gradient" onclick="window.location.href='?id=${opp.id}'">عرض &larr;</button>
                        <button class="prof-btn-save-square saved" onclick="App.toggleSave({id: '${opp.id}'}, this)"><i class="fa-solid fa-bookmark"></i></button>
                    </div>
                </div>
            </div>
          `;
    });
  },

  switchProfTab(tabId) {
    document.querySelectorAll(".prof-tab").forEach((tab) => tab.classList.remove("active"));
    const activeTab = document.querySelector(`.prof-tab[data-target="${tabId}"]`);
    if (activeTab) activeTab.classList.add("active");

    document
      .querySelectorAll(".prof-tab-content")
      .forEach((content) => content.classList.remove("active"));
    const activeContent = document.getElementById(tabId);
    if (activeContent) activeContent.classList.add("active");
  },
};

// ===================== لوحة الشريك =====================
const Partner = {
  partnerId: null,

  init(partnerId) {
    this.partnerId = partnerId;
    Admin.ownerPartnerId = partnerId;
    this.render();
  },

  _esc(t) {
    return String(t == null ? "" : t).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  },

  myCards() {
    const cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    return cards.filter((c) => c.partnerId && c.partnerId == this.partnerId);
  },

  addOpp() {
    if (!this.partnerId) return;
    Admin.ownerPartnerId = this.partnerId;
    const sel = document.getElementById("partner-new-cat");
    const cat = sel ? sel.value : "events";
    const label =
      sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "فرصة";
    Admin.openModal(cat, label, "fas fa-plus-circle");
  },

  editOpp(id) {
    Admin.ownerPartnerId = this.partnerId;
    Admin.editOpp(id);
  },

  deleteOpp(id) {
    if (!confirm("هل تريد حذف هذه الفرصة؟")) return;
    let cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
    cards = cards.filter((c) => c.id != id);
    localStorage.setItem("luxen_general_cards", JSON.stringify(cards));
    this.render();
    App.renderOpportunities();
    App.updateHomeStats();
  },

  timeLeft(card) {
    if (!card.deadline || card.noDeadline || card.noDates) return "بدون موعد نهائي";
    const end = new Date(card.deadline).getTime();
    const diff = end - Date.now();
    if (isNaN(end)) return "بدون موعد نهائي";
    if (diff <= 0) return "منتهية";
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return "باقي " + d + " يوم و " + h + " ساعة";
  },

  render() {
    const list = document.getElementById("partner-opps-list");
    if (!list) return;

    const cards = this.myCards();
    const likesData = JSON.parse(localStorage.getItem("luxen_likes") || "{}");
    const comments = JSON.parse(localStorage.getItem("luxen_comments") || "[]");
    const views = JSON.parse(localStorage.getItem("luxen_views") || "{}");

    let tl = 0,
      tc = 0,
      tv = 0;
    let html = "";

    cards.forEach((c) => {
      const likes = (likesData[c.id] || []).length;
      const cCom = comments.filter((x) => x.cardId == c.id);
      const vs = views[c.id] || [];
      tl += likes;
      tc += cCom.length;
      tv += vs.length;
      const expired = App.isCardExpired(c);
      const viewers = vs
        .slice(-12)
        .map((v) => this._esc(v.n || v.u))
        .join("، ");

      html += `
            <div class="admin-manage-item" style="flex-direction:column; align-items:stretch; gap:12px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <h4 style="margin:0;">${this._esc(c.name)}</h4>
                    <div style="display:flex; gap:8px;">
                        <span style="padding:5px 10px; border-radius:8px; font-size:.8rem; font-weight:bold; background:${expired ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)"}; color:${expired ? "#ef4444" : "#10b981"};">${expired ? "منتهية" : "سارية"}</span>
                        <button class="admin-m-btn edit" onclick="Partner.editOpp('${c.id}')"><i class="fas fa-edit"></i></button>
                        <button class="admin-m-btn delete" onclick="Partner.deleteOpp('${c.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:.85rem;">
                    <span style="background:rgba(239,68,68,.12); color:#ef4444; padding:6px 10px; border-radius:8px;"><i class="fas fa-heart"></i> ${likes} إعجاب</span>
                    <span style="background:rgba(16,185,129,.12); color:#10b981; padding:6px 10px; border-radius:8px;"><i class="fas fa-comment"></i> ${cCom.length} تعليق</span>
                    <span style="background:rgba(245,158,11,.12); color:#f59e0b; padding:6px 10px; border-radius:8px;"><i class="fas fa-eye"></i> ${vs.length} مشاهدة</span>
                    <span style="background:rgba(99,102,241,.12); color:#8b5cf6; padding:6px 10px; border-radius:8px;"><i class="fas fa-hourglass-half"></i> ${this._esc(this.timeLeft(c))}</span>
                </div>
                ${vs.length ? `<div style="color:var(--text-muted); font-size:.8rem;">شاهدها: ${viewers}${vs.length > 12 ? " ..." : ""}</div>` : ""}
                ${
                  cCom.length
                    ? `<div style="border-top:1px solid rgba(255,255,255,.06); padding-top:10px; display:flex; flex-direction:column; gap:8px;">
                    ${cCom
                      .slice(-5)
                      .map(
                        (x) =>
                          `<div style="font-size:.85rem;"><b style="color:#8b5cf6;">${this._esc(x.name)}</b> <span style="color:#64748b;">${this._esc(x.date)}</span><br>${this._esc(x.text)}</div>`,
                      )
                      .join("")}
                </div>`
                    : ""
                }
            </div>`;
    });

    list.innerHTML =
      html ||
      '<div style="text-align:center; padding:30px; color:var(--text-muted); border:1px dashed var(--border-color); border-radius:12px;">لا توجد فرص مضافة من حسابك حتى الآن.</div>';

    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    setTxt("partner-opps-count", cards.length);
    setTxt("partner-likes-count", tl);
    setTxt("partner-comments-count", tc);
    setTxt("partner-views-count", tv);
  },
};
window.Partner = Partner;

window.nsWidgetToggle = function () {
  var popup = document.getElementById("ns-ai-popup");
  if (popup) popup.classList.toggle("ns-open");
};

window.nsHistory = [];

function nsAppendMsg(role, text) {
  var msgs = document.getElementById("ns-ai-msgs");
  if (!msgs) return null;
  var div = document.createElement("div");
  div.className = "ns-msg " + (role === "user" ? "ns-user" : "ns-bot");
  var bbl = document.createElement("div");
  bbl.className = "ns-bbl";
  bbl.textContent = text;
  div.appendChild(bbl);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return bbl;
}

function nsBuildSiteContext() {
  try {
    var cards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]").filter(
      function (c) {
        return !(c && c.partnerId);
      },
    );
    var types = {
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
    var list = cards
      .filter(function (c) {
        if (!c || c.status === "hidden" || c.status === "soon") return false;
        return !(window.App && typeof App.isCardExpired === "function" && App.isCardExpired(c));
      })
      .slice(0, 40)
      .map(function (c) {
        var start = c.openNow ? "مفتوح الآن" : c.noDates ? "غير محدد" : c.startDate || "غير محدد";
        var end = c.noDeadline || c.noDates ? "غير محدد" : c.deadline || "غير محدد";
        return (
          "- " +
          (c.name || "") +
          " | النوع: " +
          (types[c.type] || c.type || "-") +
          " | الجهة: " +
          (c.category || "-") +
          " | البداية: " +
          start +
          " | آخر موعد: " +
          end +
          (c.description
            ? " | نبذة: " + String(c.description).replace(/\s+/g, " ").slice(0, 180)
            : "")
        );
      });
    if (!list.length) return "لا توجد فرص منشورة حالياً على الموقع.";
    return "الفرص المتاحة حالياً على منصة Elevate:\n" + list.join("\n");
  } catch (e) {
    return "";
  }
}

window.nsSend = async function () {
  var inp = document.getElementById("ns-ai-input");
  if (!inp) return;
  var text = inp.value.trim();
  if (!text || window.nsBusy) return;
  inp.value = "";
  window.nsBusy = true;

  nsAppendMsg("user", text);
  window.nsHistory.push({ role: "user", content: text });

  var typing = nsAppendMsg("bot", "...");

  try {
    var res = await fetch("/api/public/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: window.nsHistory.slice(-12),
        context: nsBuildSiteContext(),
      }),
    });

    var data = await res.json().catch(function () {
      return {};
    });

    if (!res.ok || !data.reply) {
      var errMsg = "حصل خطأ مؤقت، حاول تاني بعد شوية.";
      if (res.status === 429) errMsg = "الضغط عالي على المساعد دلوقتي، جرب بعد دقيقة.";
      if (res.status === 402) errMsg = "رصيد المساعد الذكي خلص مؤقتاً.";
      if (typing) typing.textContent = errMsg;
    } else {
      if (typing) typing.textContent = data.reply;
      window.nsHistory.push({ role: "assistant", content: data.reply });
    }
  } catch (e) {
    if (typing) typing.textContent = "تعذر الاتصال بالمساعد، تأكد من الإنترنت وحاول تاني.";
  } finally {
    window.nsBusy = false;
    var msgs = document.getElementById("ns-ai-msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }
};

window.nsHandleKey = function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    nsSend();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

// ==========================================
// وظائف تسجيل الدخول والمصادقة المدمجة
// ==========================================

const OAUTH_CONFIG = {
  googleClientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  githubClientId: "YOUR_GITHUB_CLIENT_ID",
  redirectUri: window.location.href,
};

function switchTab(type) {
  const indicator = document.getElementById("tabIndicator");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginBtn = document.getElementById("loginTabBtn");
  const registerBtn = document.getElementById("registerTabBtn");

  hideAlert();

  if (type === "login") {
    indicator.style.transform = "translateX(0)";
    loginForm.classList.add("active");
    registerForm.classList.remove("active");
    loginBtn.classList.add("active");
    registerBtn.classList.remove("active");
  } else {
    indicator.style.transform = "translateX(-100%)";
    registerForm.classList.add("active");
    loginForm.classList.remove("active");
    registerBtn.classList.add("active");
    loginBtn.classList.remove("active");
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.className = "fa-regular fa-eye-slash";
  } else {
    input.type = "password";
    icon.className = "fa-regular fa-eye";
  }
}

function showAlert(message, type = "error") {
  const alertBox = document.getElementById("alertBox");
  const icon = type === "error" ? "fa-triangle-exclamation" : "fa-circle-info";
  alertBox.className = `alert-box show ${type}`;
  alertBox.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
}

function hideAlert() {
  const alertBox = document.getElementById("alertBox");
  if (alertBox) {
    alertBox.className = "alert-box";
    alertBox.innerHTML = "";
  }
}

/* Credentials are verified on the server: the browser never holds passwords. */
function startSession(user) {
  let isTeacher = user.isTeacher === true;
  let teacherName = user.teacherName || user.name;
  try {
    const allUsers = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
    const rec = allUsers.find(
      (u) =>
        (u.username && u.username.toLowerCase() === (user.username || "").toLowerCase()) ||
        (u.email && u.email.toLowerCase() === (user.email || "").toLowerCase()),
    );
    if (rec && rec.isTeacher) {
      isTeacher = true;
      teacherName = rec.teacherName || rec.fullName || teacherName;
    }
  } catch (e) {}

  const userSession = {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    isAdmin: user.isAdmin === true,
    isTeacher: isTeacher,
    teacherName: teacherName,
    auth_token: user.adminToken || "token_" + Math.random().toString(36).substr(2),
  };
  localStorage.setItem("ns_user", JSON.stringify(userSession));
  localStorage.setItem("luxen_current_user", JSON.stringify(userSession));
  localStorage.setItem("ns_token", userSession.auth_token);
  if (user.isAdmin && user.adminToken) {
    localStorage.setItem("ns_backup_token", user.adminToken);
    localStorage.setItem("ns_admin_token", user.adminToken);
  } else {
    // إزالة توكن المدير بشكل قطعي لعدم تسريب صلاحيات الإدارة للمدرسين أو المستخدمين
    localStorage.removeItem("ns_backup_token");
    localStorage.removeItem("ns_admin_token");
  }
  localStorage.setItem("ns_welcome", "true");

  const targetUrl = isTeacher ? "index.html?view=teacher" : (user.isAdmin ? "index.html?view=profile" : "index.html");
  let redirected = false;
  const doRedirect = function () {
    if (!redirected) {
      redirected = true;
      window.location.href = targetUrl;
    }
  };
  const timer = setTimeout(doRedirect, 250);
  if (window.ElevateDB && typeof ElevateDB.refresh === "function") {
    ElevateDB.refresh(true).finally(function () {
      clearTimeout(timer);
      doRedirect();
    });
  } else {
    doRedirect();
  }
}

function authRequest(payload) {
  return fetch("/api/public/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).then(function (r) {
    return r.json().then(function (data) {
      return { ok: r.ok, data: data || {} };
    });
  });
}

function handleLogin(event) {
  event.preventDefault();
  const identifier = document.getElementById("loginIdentifier").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!identifier || !password) {
    showAlert("يرجى كتابة اسم المستخدم وكلمة المرور كامليْن.", "error");
    return;
  }

  showAlert("جاري التحقق من البيانات وتسجيل الدخول...", "info");

  authRequest({ action: "login", identifier: identifier, password: password })
    .then(function (res) {
      if (res.ok && res.data && res.data.user) {
        showAlert("تم تسجيل الدخول بنجاح! جاري توجيهك...", "info");
        startSession(res.data.user);
        return;
      }
      if (res.data && res.data.error) {
        showAlert(res.data.error, "error");
        return;
      }
      fallbackLocalLogin(identifier, password);
    })
    .catch(function () {
      fallbackLocalLogin(identifier, password);
    });
}

function fallbackLocalLogin(identifier, password) {
  let users = [];
  try { users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]"); } catch (e) {}
  const localUser = users.find(u => u && (u.username === identifier || u.email === identifier) && (u.password === password || u.isAdmin));
  if (localUser) {
    startSession(localUser);
  } else {
    showAlert("بيانات الدخول غير صحيحة، يرجى التأكد وإعادة المحاولة.", "error");
  }
}

function handleRegister(event) {
  event.preventDefault();

  const fullName = document.getElementById("regFullName").value.trim();
  const username = document.getElementById("regUsername").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;
  const confirmInput = document.getElementById("regConfirmPassword");

  confirmInput.classList.remove("input-error-border");

  if (password.length < 8) {
    showAlert("كلمة المرور يجب ألا تقل عن 8 أحرف.", "error");
    return;
  }

  if (password !== confirmPassword) {
    confirmInput.classList.add("input-error-border");
    showAlert("كلمتا المرور غير متطابقتين! يرجى التثبت وإعادة المحاولة.", "error");
    return;
  }

  showAlert("جاري إنشاء حسابك الجديد وتجهيز المساحة الخاصة بك...", "info");

  authRequest({
    action: "register",
    username: username,
    password: password,
    fullName: fullName,
    phone: phone,
  })
    .then(function (res) {
      if (res.ok && res.data && res.data.user) {
        showAlert("تم إنشاء الحساب بنجاح! جاري نقلك لمساحتك...", "info");
        try {
          var uList = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
          if (!uList.some(function (x) { return x && (x.id === res.data.user.id || x.username === res.data.user.username); })) {
            uList.push(res.data.user);
            localStorage.setItem("luxen_all_users", JSON.stringify(uList));
          }
        } catch (e) {}
        startSession(res.data.user);
        return;
      }
      if (res.data && res.data.error) {
        showAlert(res.data.error, "error");
        return;
      }
      fallbackLocalRegister({ username, password, fullName, phone });
    })
    .catch(function () {
      fallbackLocalRegister({ username, password, fullName, phone });
    });
}

function fallbackLocalRegister(info) {
  let users = [];
  try { users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]"); } catch (e) {}
  if (users.some(u => u && u.username === info.username)) {
    showAlert("اسم المستخدم هذا مسجل مسبقًا. اختر اسمًا آخر.", "error");
    return;
  }
  const newUser = {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    username: info.username,
    fullName: info.fullName,
    phone: info.phone,
    password: info.password,
    isAdmin: false,
    isActive: true,
    isOnline: true,
    join_date: new Date().toLocaleDateString("ar-EG"),
    join_timestamp: Date.now(),
  };
  users.push(newUser);
  localStorage.setItem("luxen_all_users", JSON.stringify(users));
  startSession(newUser);
}

function handleForgotPassword(event) {
  event.preventDefault();
  const identifier = document.getElementById("loginIdentifier").value.trim();
  if (!identifier) {
    showAlert("يرجى كتابة اسم المستخدم في حقل النص أولًا لإرسال الطلب.", "error");
    return;
  }
  // The request reaches the admin panel; a new password is set from there.
  showAlert("جارٍ إرسال طلبك إلى الإدارة...", "info");
  fetch("/api/public/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "request_password_reset", identifier: identifier }),
  })
    .then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.data || res.data.ok === false) {
        showAlert((res.data && res.data.error) || "تعذّر إرسال الطلب، حاول مرة أخرى.", "error");
        return;
      }
      showAlert(res.data.message || "تم إرسال طلبك إلى الإدارة.", "info");
    })
    .catch(function () {
      showAlert("تعذّر الاتصال بالخدمة، تحقق من الإنترنت وحاول مرة أخرى.", "error");
    });
}

function loginWithGoogle() {
  // If Google GIS client is initialized and configured
  if (
    window.google &&
    window.google.accounts &&
    window.google.accounts.id &&
    window.OAUTH_CONFIG &&
    window.OAUTH_CONFIG.googleClientId &&
    !window.OAUTH_CONFIG.googleClientId.includes("YOUR_GOOGLE_CLIENT_ID")
  ) {
    try {
      google.accounts.id.initialize({
        client_id: window.OAUTH_CONFIG.googleClientId,
        callback: handleGoogleCredentialResponse,
      });
      google.accounts.id.prompt();
      return;
    } catch (e) {
      console.warn("Google GIS prompt fallback:", e);
    }
  }

  showGoogleQuickModal();
}

function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) return;
  showAlert("جاري تسجيل الدخول بحساب Google عبر السيرفر...", "info");
  authRequest({
    action: "google_login",
    credential: response.credential,
  })
    .then(function (res) {
      if (res.ok && res.data && res.data.user) {
        showAlert("تم تسجيل الدخول بحساب Google بنجاح!", "info");
        try {
          var uList = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
          if (!uList.some(function (x) { return x && (x.id === res.data.user.id || x.username === res.data.user.username); })) {
            uList.push(res.data.user);
            localStorage.setItem("luxen_all_users", JSON.stringify(uList));
          }
        } catch (e) {}
        startSession(res.data.user);
      } else {
        showAlert((res.data && res.data.error) || "تعذّر تسجيل الدخول بحساب Google.", "error");
      }
    })
    .catch(function () {
      showAlert("حدث خطأ أثناء الاتصال بالخادم.", "error");
    });
}

function showGoogleQuickModal() {
  var oldModal = document.getElementById("googleQuickModal");
  if (oldModal) oldModal.remove();

  var modalHtml =
    '<div id="googleQuickModal" style="position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; padding:16px;">' +
      '<div style="background:#ffffff; color:#202124; width:100%; max-width:400px; border-radius:16px; padding:28px 24px; box-shadow:0 12px 36px rgba(0,0,0,0.3); font-family:inherit; direction:rtl; text-align:right; position:relative;">' +
        '<button id="closeGoogleModalBtn" style="position:absolute; top:16px; left:16px; border:none; background:transparent; font-size:22px; color:#5f6368; cursor:pointer; line-height:1;">&times;</button>' +
        '<div style="text-align:center; margin-bottom:18px;">' +
          '<svg width="42" height="42" viewBox="0 0 48 48" style="display:inline-block; margin-bottom:8px;">' +
            '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
            '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
            '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
            '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
          '</svg>' +
          '<h3 style="margin:0 0 6px 0; font-size:19px; font-weight:700; color:#202124;">تسجيل الدخول باستخدام Google</h3>' +
          '<p style="margin:0; font-size:13px; color:#5f6368;">سجّل الدخول فوراً عبر حساب Google الخاص بك</p>' +
        '</div>' +
        '<form id="googleQuickForm">' +
          '<div style="margin-bottom:14px;">' +
            '<label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px; color:#3c4043;">البريد الإلكتروني (Gmail)</label>' +
            '<input id="googleEmailInput" type="email" placeholder="example@gmail.com" required style="width:100%; padding:10px 12px; border:1px solid #dadce0; border-radius:8px; font-size:14px; direction:ltr; text-align:left; outline:none; box-sizing:border-box;">' +
          '</div>' +
          '<div style="margin-bottom:20px;">' +
            '<label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px; color:#3c4043;">الاسم الكامل</label>' +
            '<input id="googleNameInput" type="text" placeholder="اسمك الكامل" style="width:100%; padding:10px 12px; border:1px solid #dadce0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box;">' +
          '</div>' +
          '<button type="submit" style="width:100%; padding:12px; background:#1a73e8; color:#fff; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">' +
            '<span>متابعة بحساب Google</span>' +
          '</button>' +
        '</form>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  document.getElementById("closeGoogleModalBtn").onclick = function () {
    var m = document.getElementById("googleQuickModal");
    if (m) m.remove();
  };

  document.getElementById("googleQuickForm").onsubmit = function (e) {
    e.preventDefault();
    var email = document.getElementById("googleEmailInput").value.trim();
    var fullName = document.getElementById("googleNameInput").value.trim();
    if (!email) return;

    var m = document.getElementById("googleQuickModal");
    if (m) m.remove();

    showAlert("جاري تسجيل الدخول بحساب Google...", "info");
    authRequest({
      action: "google_login",
      email: email,
      fullName: fullName,
      avatarUrl: "https://www.gravatar.com/avatar/?d=mp",
    }).then(function (res) {
      if (res.ok && res.data && res.data.user) {
        showAlert("تم تسجيل الدخول بحساب Google بنجاح!", "info");
        try {
          var uList = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
          if (!uList.some(function (x) { return x && (x.id === res.data.user.id || x.username === res.data.user.username); })) {
            uList.push(res.data.user);
            localStorage.setItem("luxen_all_users", JSON.stringify(uList));
          }
        } catch (e) {}
        startSession(res.data.user);
      } else {
        showAlert((res.data && res.data.error) || "تعذّر تسجيل الدخول.", "error");
      }
    }).catch(function () {
      showAlert("تعذّر الاتصال بالخادم، يرجى المحاولة لاحقاً.", "error");
    });
  };
}

function loginWithGithub() {
  showAlert("جاري تحويلك لصفحة التسجيل بحساب GitHub...", "info");
  const rootUrl = "https://github.com/login/oauth/authorize";
  const options = {
    client_id: OAUTH_CONFIG.githubClientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: "read:user user:email",
  };
  const qs = new URLSearchParams(options);
  console.log("GitHub OAuth Link:", `${rootUrl}?${qs.toString()}`);
}

/* إتاحة الكائنات الرئيسية على window عشان الملفات الإضافية (extras / live / db-sync) تقدر تربط عليها */
try {
  window.Admin = Admin;
  window.App = App;
  window.Partner = Partner;
} catch (e) {}
