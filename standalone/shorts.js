/**
 * Elevate Shorts — Core Application Logic
 * Short-form Vertical Video Experience (Reels / TikTok / YouTube Shorts style)
 * Fully compliant with Elevate platform rules, privacy guarantees, and non-destructive data handling.
 */

(function () {
  "use strict";

  const ElevateShorts = {
    activeTab: "explore", // 'explore' | 'foryou' | 'learn' | 'opportunities' | 'following' | 'mystudio'
    activeFilterCat: "all", // 'all' | 'learn' | 'opportunities' | 'shorts' | 'saved'
    searchQuery: "",
    currentIndex: 0,
    isMuted: true,
    isPlaying: true,
    touchStartY: 0,
    lastTapTime: 0,
    isWheelThrottled: false,
    activeCreatorProfileUser: null,

    // ==========================================
    // Storage Helpers (No Dummy / Seed Accounts)
    // ==========================================
    getAllVideos() {
      const stored = localStorage.getItem("luxen_shorts_videos");
      if (!stored) return [];
      try {
        const parsed = JSON.parse(stored);
        // Clean out any dummy/seed videos that were pre-populated
        const clean = Array.isArray(parsed)
          ? parsed.filter((v) => v && v.id && !v.id.startsWith("short_seed_"))
          : [];
        if (clean.length !== parsed.length) {
          localStorage.setItem("luxen_shorts_videos", JSON.stringify(clean));
        }
        return clean;
      } catch (e) {
        return [];
      }
    },

    saveAllVideos(videos) {
      localStorage.setItem("luxen_shorts_videos", JSON.stringify(videos));
    },

    getComments(videoId) {
      const stored = localStorage.getItem("luxen_shorts_comments_" + videoId);
      return stored ? JSON.parse(stored) : [];
    },

    saveComments(videoId, comments) {
      localStorage.setItem("luxen_shorts_comments_" + videoId, JSON.stringify(comments));
    },

    getCurrentUser() {
      if (typeof App !== "undefined" && typeof App.getUser === "function") {
        const u = App.getUser();
        if (u && u.username) return u;
      }
      return {
        username: "guest_" + Math.random().toString(36).substr(2, 4),
        fullName: "زائر",
        isGuest: true,
        isAdmin: false,
      };
    },

    isUserLoggedIn() {
      if (typeof App !== "undefined" && typeof App.isLoggedIn === "function") {
        return App.isLoggedIn();
      }
      const user = this.getCurrentUser();
      return Boolean(user && user.username && !user.isGuest && user.username !== "ضيف المنصة");
    },

    getFollows() {
      const user = this.getCurrentUser();
      if (!user || user.isGuest) return [];
      const stored = localStorage.getItem("luxen_community_follows_" + user.username);
      return stored ? JSON.parse(stored) : [];
    },

    saveFollows(follows) {
      const user = this.getCurrentUser();
      if (!user || user.isGuest) return;
      localStorage.setItem("luxen_community_follows_" + user.username, JSON.stringify(follows));
    },

    getSavedShorts() {
      const user = this.getCurrentUser();
      if (!user || user.isGuest) return [];
      const stored = localStorage.getItem("luxen_shorts_saved_" + user.username);
      return stored ? JSON.parse(stored) : [];
    },

    saveSavedShorts(saved) {
      const user = this.getCurrentUser();
      if (!user || user.isGuest) return;
      localStorage.setItem("luxen_shorts_saved_" + user.username, JSON.stringify(saved));
    },

    // Total followers count for a creator
    getCreatorFollowersCount(creatorUsername) {
      let count = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("luxen_community_follows_")) {
          try {
            const list = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(list) && list.includes(creatorUsername)) {
              count++;
            }
          } catch (e) {}
        }
      }
      return count;
    },

    // ==========================================
    // Role & Content Protection Helpers
    // ==========================================
    isUserAdmin() {
      if (typeof App !== "undefined" && typeof App.getUser === "function") {
        const u = App.getUser();
        if (u && u.isAdmin === true) return true;
      }
      const u = this.getCurrentUser();
      return Boolean(u && u.isAdmin === true);
    },

    showToast(msg, icon = "info") {
      let toast = document.getElementById("shorts-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "shorts-toast";
        toast.className = "shorts-toast";
        document.body.appendChild(toast);
      }
      const iconHtml =
        icon === "lock"
          ? '<i class="fas fa-lock"></i>'
          : icon === "check"
            ? '<i class="fas fa-check-circle"></i>'
            : icon === "heart"
              ? '<i class="fas fa-heart"></i>'
              : '<i class="fas fa-circle-info"></i>';
      toast.innerHTML = `<span class="shorts-toast-icon">${iconHtml}</span><span>${this.escapeHtml(msg)}</span>`;
      toast.classList.add("show");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.classList.remove("show");
      }, 2600);
    },

    seekVideo(e) {
      if (e) e.stopPropagation();
      const bar = document.getElementById("shorts-progress-bar-wrap");
      const video = document.getElementById("shorts-active-video");
      if (!bar || !video || !video.duration) return;
      const rect = bar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      video.currentTime = pct * video.duration;
      const progressFill = document.getElementById("shorts-progress-fill");
      if (progressFill) progressFill.style.width = pct * 100 + "%";
    },

    toggleDescExpand(e) {
      if (e) e.stopPropagation();
      const desc = document.getElementById("shorts-video-desc");
      if (desc) desc.classList.toggle("expanded");
    },

    onSearchInput(val) {
      this.searchQuery = (val || "").trim();
      const clearBtn = document.getElementById("shorts-search-clear-btn");
      if (clearBtn) {
        clearBtn.style.display = this.searchQuery ? "flex" : "none";
      }
      const filtered = this.getExploreVideos();
      const grid = document.getElementById("shorts-explore-grid-content");
      const counter = document.getElementById("shorts-explore-count-badge");
      if (counter) counter.textContent = `${filtered.length} فيديو`;
      if (grid) grid.innerHTML = this.renderGridCardsHtml(filtered);
    },

    clearSearch() {
      this.searchQuery = "";
      const input = document.getElementById("shorts-search-input");
      if (input) {
        input.value = "";
        input.focus();
      }
      this.onSearchInput("");
    },

    setFilterCat(cat) {
      this.activeFilterCat = cat;
      const filtered = this.getExploreVideos();
      const grid = document.getElementById("shorts-explore-grid-content");
      const counter = document.getElementById("shorts-explore-count-badge");
      if (counter) counter.textContent = `${filtered.length} فيديو`;
      if (grid) grid.innerHTML = this.renderGridCardsHtml(filtered);

      document.querySelectorAll(".shorts-cat-pill").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-cat") === cat);
      });
    },

    switchToFeedMode(startVideoId) {
      const allApproved = this.getAllVideos().filter((v) => v.status === "approved");
      if (startVideoId) {
        const idx = allApproved.findIndex((v) => v.id === startVideoId);
        this.currentIndex = idx > -1 ? idx : 0;
      } else {
        this.currentIndex = 0;
      }
      this.activeTab = "foryou";
      this.render();
    },

    getExploreVideos() {
      const allApproved = this.getAllVideos().filter((v) => v.status === "approved");
      let list = allApproved;

      if (this.activeFilterCat === "learn") {
        list = list.filter((v) => v.category === "learn");
      } else if (this.activeFilterCat === "opportunities") {
        list = list.filter((v) => v.category === "opportunities");
      } else if (this.activeFilterCat === "shorts") {
        list = list.filter((v) => !v.category || v.category === "shorts");
      } else if (this.activeFilterCat === "saved") {
        const saved = this.getSavedShorts();
        list = list.filter((v) => saved.includes(v.id));
      }

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        list = list.filter(
          (v) =>
            (v.title && v.title.toLowerCase().includes(q)) ||
            (v.desc && v.desc.toLowerCase().includes(q)) ||
            (v.creator && v.creator.toLowerCase().includes(q)) ||
            (v.creatorName && v.creatorName.toLowerCase().includes(q)) ||
            (v.oppTitle && v.oppTitle.toLowerCase().includes(q)),
        );
      }

      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

      return list;
    },

    renderGridCardsHtml(videos) {
      if (!videos || videos.length === 0) {
        return `
          <div class="shorts-explore-empty-state">
            <div class="shorts-explore-empty-icon"><i class="fas fa-search"></i></div>
            <h3 style="color:#fff; font-size:1.25rem; margin:0 0 8px 0;">لا توجد أي فيديوهات مطابقة</h3>
            <p style="color:#94a3b8; font-size:0.88rem; max-width:440px; margin:0 auto 20px auto; line-height:1.6;">
              ${this.searchQuery ? `لم نجد أي نتائج تطابق "${this.escapeHtml(this.searchQuery)}". جرب البحث بكلمات أخرى أو امسح البحث.` : "لا توجد فيديوهات منشورة في هذا القسم حالياً."}
            </p>
            ${
              this.searchQuery
                ? `
              <button class="shorts-pill-btn active" style="margin:0 auto; padding:10px 24px;" onclick="ElevateShorts.clearSearch()">
                <i class="fas fa-rotate-left"></i> عرض كل الفيديوهات
              </button>
            `
                : this.isUserAdmin()
                  ? `
              <button class="shorts-btn-create-post" style="margin:0 auto;" onclick="ElevateShorts.openCreateModal()">
                <i class="fas fa-plus"></i> انشر فيديو الآن
              </button>
            `
                  : ""
            }
          </div>
        `;
      }

      return videos
        .map((v) => {
          const catLabel =
            v.category === "learn"
              ? "🎓 اتعلم"
              : v.category === "opportunities"
                ? "🚀 فرصة"
                : "✨ شورتس";
          return `
          <div class="shorts-explore-card" onclick="ElevateShorts.switchToFeedMode('${v.id}')">
            <video src="${v.videoUrl}" class="shorts-explore-video-thumb" preload="metadata" controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture ondragstart="return false;" draggable="false" oncontextmenu="return false;"></video>
            <div class="shorts-explore-overlay" oncontextmenu="event.preventDefault(); ElevateShorts.showToast('🔒 تنزيل الفيديوهات غير متاح', 'lock'); return false;"></div>
            
            <div class="shorts-explore-card-top">
              <span class="shorts-explore-cat-badge">${catLabel}</span>
              ${v.isPinned ? '<span class="shorts-explore-pinned-badge"><i class="fas fa-thumbtack"></i> مثبت</span>' : ""}
            </div>

            <div class="shorts-explore-play-icon"><i class="fas fa-play"></i></div>
            
            <div class="shorts-explore-content">
              <h4 class="shorts-explore-title">${this.escapeHtml(v.title)}</h4>
              <div class="shorts-explore-meta">
                <span onclick="event.stopPropagation(); ElevateShorts.openCreatorProfile('${this.escapeHtml(v.creator)}')" class="shorts-explore-creator">
                  @${this.escapeHtml(v.creatorName || v.creator)}
                  <i class="fas fa-circle-check" style="color:#38bdf8; font-size:0.75rem;"></i>
                </span>
                <span class="shorts-explore-views"><i class="fas fa-eye"></i> ${v.views || 0}</span>
              </div>
            </div>
          </div>
        `;
        })
        .join("");
    },

    // ==========================================
    // Initialization
    // ==========================================
    init() {
      // Purge any dummy seed data if present
      this.getAllVideos();

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        ["explore", "foryou", "learn", "opportunities", "following", "mystudio"].includes(tabParam)
      ) {
        this.activeTab = tabParam;
      }

      const videoIdParam = params.get("id");
      if (videoIdParam) {
        const all = this.getAllVideos().filter((v) => v.status === "approved");
        const targetIdx = all.findIndex((v) => v.id === videoIdParam);
        if (targetIdx > -1) {
          this.activeTab = "foryou";
          this.currentIndex = targetIdx;
        }
      }

      this.render();
      this.attachGlobalEvents();
      this.initMobilePill();
    },

    // ==========================================
    // Filtering Videos by Tab
    // ==========================================
    getFilteredVideos() {
      const all = this.getAllVideos();
      const follows = this.getFollows();

      // Only approved videos are shown to the public
      const approved = all.filter((v) => v.status === "approved");

      // Sort pinned to top, then by timestamp descending
      approved.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

      if (this.activeTab === "learn") {
        return approved.filter((v) => v.category === "learn");
      }
      if (this.activeTab === "opportunities") {
        return approved.filter((v) => v.category === "opportunities");
      }
      if (this.activeTab === "following") {
        return approved.filter((v) => follows.includes(v.creator));
      }
      return approved; // 'explore' or 'foryou'
    },

    // ==========================================
    // Main View Rendering
    // ==========================================
    render() {
      const container = document.getElementById("shorts-view");
      if (!container) return;

      if (this.activeTab === "mystudio") {
        container.innerHTML = this.renderStudioLayout();
        return;
      }

      if (this.activeTab === "explore") {
        container.innerHTML = this.renderExploreLayout();
        return;
      }

      // Swiper Feed View (foryou | learn | opportunities | following)
      const videos = this.getFilteredVideos();
      if (this.currentIndex >= videos.length) {
        this.currentIndex = Math.max(0, videos.length - 1);
      }
      const currentVideo = videos[this.currentIndex];

      container.innerHTML = `
        <div class="shorts-feed-layout">
          <!-- Feed Top Floating Nav Bar -->
          <header class="shorts-feed-top-bar">
            <button class="shorts-feed-back-btn" onclick="ElevateShorts.switchTab('explore')" title="الرجوع لشبكة الفيديوهات">
              <i class="fas fa-table-cells-large"></i> <span>كل الفيديوهات</span>
            </button>

            <!-- Mode Switcher Category Pills -->
            <div class="shorts-top-pills">
              <button class="shorts-pill-btn ${this.activeTab === "foryou" ? "active" : ""}" onclick="ElevateShorts.switchTab('foryou')">لك</button>
              <button class="shorts-pill-btn ${this.activeTab === "learn" ? "active" : ""}" onclick="ElevateShorts.switchTab('learn')">اتعلم</button>
              <button class="shorts-pill-btn ${this.activeTab === "opportunities" ? "active" : ""}" onclick="ElevateShorts.switchTab('opportunities')">الفرص</button>
              <button class="shorts-pill-btn ${this.activeTab === "following" ? "active" : ""}" onclick="ElevateShorts.switchTab('following')">متابَع</button>
            </div>

            <button class="shorts-feed-search-btn" onclick="ElevateShorts.switchTab('explore')" title="البحث في الفيديوهات">
              <i class="fas fa-search"></i>
            </button>
          </header>

          <!-- Main Feed & Video Player Area -->
          <div class="shorts-feed-wrapper" id="shorts-feed-container">
            <!-- Video Player or Empty State -->
            ${currentVideo ? this.renderVideoCard(currentVideo) : this.renderEmptyFeed()}

            <!-- Desktop Arrow Controls -->
            ${
              currentVideo
                ? `
              <div class="shorts-desktop-nav-arrows">
                <button class="shorts-nav-arrow-btn" onclick="ElevateShorts.prevVideo()" title="الفيديو السابق (سهم لأعلى)"><i class="fas fa-chevron-up"></i></button>
                <button class="shorts-nav-arrow-btn" onclick="ElevateShorts.nextVideo()" title="الفيديو التالي (سهم لأسفل)"><i class="fas fa-chevron-down"></i></button>
                <div class="shorts-desktop-nav-hint"><span>⬆ ⬇ تقليب</span></div>
              </div>
            `
                : ""
            }
          </div>

          <!-- Slide-Up Comments Drawer -->
          <div class="shorts-comments-drawer" id="shorts-comments-drawer">
            <div class="shorts-comments-header">
              <h3 id="shorts-comments-title">التعليقات</h3>
              <button class="shorts-comments-close" onclick="ElevateShorts.closeComments()"><i class="fas fa-times"></i></button>
            </div>
            <div class="shorts-comments-body custom-scrollbar" id="shorts-comments-body"></div>
            <div class="shorts-comments-footer">
              <input type="text" class="shorts-comment-input" id="shorts-new-comment-input" placeholder="أضف تعليقاً محترماً..." onkeydown="if(event.key==='Enter') ElevateShorts.addComment()">
              <button class="shorts-comment-send" onclick="ElevateShorts.addComment()"><i class="fas fa-paper-plane"></i></button>
            </div>
          </div>
        </div>

        <!-- Mobile Bottom Tab Bar -->
        <nav class="shorts-mobile-bar">
          <button class="shorts-m-btn" onclick="ElevateShorts.switchTab('explore')">
            <i class="fas fa-table-cells-large"></i> <span>المعرض</span>
          </button>
          <button class="shorts-m-btn active" onclick="ElevateShorts.switchTab('foryou')">
            <i class="fas fa-fire"></i> <span>تقليب</span>
          </button>
          <button class="shorts-m-btn ${this.activeTab === "learn" ? "active" : ""}" onclick="ElevateShorts.switchTab('learn')">
            <i class="fas fa-graduation-cap"></i> <span>اتعلم</span>
          </button>
          <button class="shorts-m-btn ${this.activeTab === "opportunities" ? "active" : ""}" onclick="ElevateShorts.switchTab('opportunities')">
            <i class="fas fa-rocket"></i> <span>الفرص</span>
          </button>
          <button class="shorts-m-btn ${this.activeTab === "following" ? "active" : ""}" onclick="ElevateShorts.switchTab('following')">
            <i class="fas fa-user-check"></i> <span>متابَع</span>
          </button>
        </nav>

        <!-- Modals -->
        ${this.renderCreateModal()}
        ${this.renderCreatorProfileModal()}
      `;

      if (currentVideo) {
        this.initCurrentVideoPlayback();
        this.incrementViews(currentVideo.id);
      }
    },

    // ==========================================
    // Render Explore Grid Gallery Layout (كل الفيديوهات)
    // ==========================================
    renderExploreLayout() {
      const exploreVideos = this.getExploreVideos();

      return `
        <div class="shorts-gallery-layout">
          <!-- Top Global Header with Search & Mode Switcher -->
          <header class="shorts-explore-navbar">
            <div class="shorts-navbar-brand" onclick="ElevateShorts.switchTab('explore')" style="cursor:pointer;">
              <div class="shorts-navbar-logo"><i class="fas fa-play"></i></div>
              <div class="shorts-navbar-title-wrap">
                <h2>Elevate Shorts</h2>
                <span>فيديوهات قصيرة هادفة</span>
              </div>
            </div>

            <!-- Search Bar in Header -->
            <div class="shorts-navbar-search">
              <i class="fas fa-search shorts-search-icon"></i>
              <input type="text" id="shorts-search-input" class="shorts-search-input"
                     placeholder="ابحث في الفيديوهات أو عن صانع محتوى..."
                     value="${this.escapeHtml(this.searchQuery)}"
                     oninput="ElevateShorts.onSearchInput(this.value)">
              <button id="shorts-search-clear-btn" class="shorts-search-clear-btn"
                      style="display:${this.searchQuery ? "flex" : "none"};"
                      onclick="ElevateShorts.clearSearch()" title="مسح البحث">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Mode Switcher & Admin Actions -->
            <div class="shorts-navbar-actions">
              <button class="shorts-mode-flip-btn" onclick="ElevateShorts.switchToFeedMode()" title="التشغيل في وضع تقليب الشورتس">
                <i class="fas fa-fire"></i>
                <span>وضع التقليب 📱</span>
              </button>
              ${
                this.isUserAdmin()
                  ? `
                <button class="shorts-btn-create-post" onclick="ElevateShorts.openCreateModal()" style="margin:0; padding:9px 18px;">
                  <i class="fas fa-plus"></i> <span>نشر فيديو</span>
                </button>
              `
                  : ""
              }
            </div>
          </header>

          <!-- Category Filter Bar & Count -->
          <div class="shorts-subnav-bar">
            <div class="shorts-cat-pills-wrap custom-scrollbar">
              <button class="shorts-cat-pill ${this.activeFilterCat === "all" ? "active" : ""}" data-cat="all" onclick="ElevateShorts.setFilterCat('all')">
                <i class="fas fa-border-all"></i> الكل
              </button>
              <button class="shorts-cat-pill ${this.activeFilterCat === "learn" ? "active" : ""}" data-cat="learn" onclick="ElevateShorts.setFilterCat('learn')">
                <i class="fas fa-graduation-cap"></i> اتعلم
              </button>
              <button class="shorts-cat-pill ${this.activeFilterCat === "opportunities" ? "active" : ""}" data-cat="opportunities" onclick="ElevateShorts.setFilterCat('opportunities')">
                <i class="fas fa-rocket"></i> الفرص
              </button>
              <button class="shorts-cat-pill ${this.activeFilterCat === "shorts" ? "active" : ""}" data-cat="shorts" onclick="ElevateShorts.setFilterCat('shorts')">
                <i class="fas fa-bolt"></i> شورتس
              </button>
              <button class="shorts-cat-pill ${this.activeFilterCat === "saved" ? "active" : ""}" data-cat="saved" onclick="ElevateShorts.setFilterCat('saved')">
                <i class="fas fa-bookmark"></i> المفضلة
              </button>
            </div>

            <div class="shorts-count-badge" id="shorts-explore-count-badge">
              ${exploreVideos.length} فيديو
            </div>
          </div>

          <!-- Explore Grid Body -->
          <div class="shorts-explore-body custom-scrollbar">
            <div class="shorts-explore-grid" id="shorts-explore-grid-content">
              ${this.renderGridCardsHtml(exploreVideos)}
            </div>
          </div>
        </div>

        <!-- Mobile Bottom Tab Bar -->
        <nav class="shorts-mobile-bar">
          <button class="shorts-m-btn active" onclick="ElevateShorts.switchTab('explore')">
            <i class="fas fa-table-cells-large"></i> <span>المعرض</span>
          </button>
          <button class="shorts-m-btn" onclick="ElevateShorts.switchToFeedMode()">
            <i class="fas fa-fire"></i> <span>تقليب</span>
          </button>
          <button class="shorts-m-btn" onclick="ElevateShorts.setFilterCat('learn')">
            <i class="fas fa-graduation-cap"></i> <span>اتعلم</span>
          </button>
          <button class="shorts-m-btn" onclick="ElevateShorts.setFilterCat('opportunities')">
            <i class="fas fa-rocket"></i> <span>الفرص</span>
          </button>
          <button class="shorts-m-btn" onclick="ElevateShorts.setFilterCat('saved')">
            <i class="fas fa-bookmark"></i> <span>المفضلة</span>
          </button>
        </nav>

        <!-- Modals -->
        ${this.renderCreateModal()}
        ${this.renderCreatorProfileModal()}
      `;
    },

    openVideoInFeed(videoId) {
      const allApproved = this.getAllVideos().filter((v) => v.status === "approved");
      const idx = allApproved.findIndex((v) => v.id === videoId);
      this.currentIndex = idx > -1 ? idx : 0;
      this.activeTab = "foryou";
      this.render();
    },

    // ==========================================
    // Render Single Short Card (9:16)
    // ==========================================
    renderVideoCard(video) {
      const user = this.getCurrentUser();
      const isLiked = (video.likes || []).includes(user.username);
      const savedList = this.getSavedShorts();
      const isSaved = savedList.includes(video.id);
      const follows = this.getFollows();
      const isFollowing = follows.includes(video.creator);
      const comments = this.getComments(video.id);

      const categoryLabel =
        video.category === "learn"
          ? "🎓 اتعلم"
          : video.category === "opportunities"
            ? "🚀 فرصة"
            : "✨ شورتس";

      return `
        <div class="shorts-player-container" id="player-container-${video.id}"
             ontouchstart="ElevateShorts.handleTouchStart(event)"
             ontouchend="ElevateShorts.handleTouchEnd(event)">
          
          <!-- Video Element (Protected against download) -->
          <video class="shorts-video-element" id="shorts-active-video"
                 src="${video.videoUrl}"
                 loop
                 playsinline
                 webkit-playsinline
                 disablepictureinpicture
                 controlslist="nodownload noplaybackrate nofullscreen"
                 ondragstart="return false;"
                 draggable="false"
                 oncontextmenu="return false;"
                 ${this.isMuted ? "muted" : ""}>
          </video>

          <!-- Interactive Ambient Overlay -->
          <div class="shorts-video-overlay"
               onclick="ElevateShorts.togglePlayPause(event)"
               ondblclick="ElevateShorts.handleDoubleTap('${video.id}', event)"
               oncontextmenu="event.preventDefault(); ElevateShorts.showToast('🔒 تنزيل الفيديوهات غير متاح لحماية حقوق المحتوى', 'lock'); return false;">
          </div>

          <!-- Top Category Badge -->
          <div class="shorts-top-cat-badge">
            <span>${categoryLabel}</span>
            ${video.isPinned ? '<span style="color:#fbbf24; margin-right:4px;"><i class="fas fa-thumbtack"></i> مثبت</span>' : ""}
          </div>

          <!-- Sound Mute/Unmute Button -->
          <button class="shorts-top-sound-btn" onclick="ElevateShorts.toggleSound(event)" title="كتم/تشغيل الصوت">
            <i class="fas ${this.isMuted ? "fa-volume-xmark" : "fa-volume-high"}"></i>
          </button>

          <!-- Central Play Flash Icon -->
          <div class="shorts-play-flash" id="shorts-play-flash"><i class="fas fa-play"></i></div>

          <!-- Right-Side Action Deck (Reels Style) -->
          <div class="shorts-actions-column">
            <!-- Creator Avatar (Opens Creator Profile) -->
            <div class="shorts-action-item" onclick="ElevateShorts.openCreatorProfile('${video.creator}')" title="عرض ملف صانع المحتوى">
              <div class="shorts-action-icon-circle" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border:2px solid #fff;">
                ${this.escapeHtml((video.creatorName || video.creator).charAt(0).toUpperCase())}
              </div>
            </div>

            <!-- Like -->
            <button class="shorts-action-item ${isLiked ? "liked" : ""}" onclick="ElevateShorts.toggleLike('${video.id}')">
              <div class="shorts-action-icon-circle"><i class="fas fa-heart"></i></div>
              <span class="shorts-action-count">${(video.likes || []).length}</span>
            </button>

            <!-- Comments -->
            <button class="shorts-action-item" onclick="ElevateShorts.openComments('${video.id}')">
              <div class="shorts-action-icon-circle"><i class="fas fa-comment-dots"></i></div>
              <span class="shorts-action-count">${comments.length}</span>
            </button>

            <!-- Bookmark / Save -->
            <button class="shorts-action-item ${isSaved ? "saved" : ""}" onclick="ElevateShorts.toggleSave('${video.id}')">
              <div class="shorts-action-icon-circle"><i class="fas fa-bookmark"></i></div>
              <span class="shorts-action-count">${(video.saves || 0) + (isSaved ? 1 : 0)}</span>
            </button>

            <!-- Share -->
            <button class="shorts-action-item" onclick="ElevateShorts.shareVideo('${video.id}')">
              <div class="shorts-action-icon-circle"><i class="fas fa-share"></i></div>
              <span class="shorts-action-count">${video.shares || 0}</span>
            </button>

            <!-- Report Inappropriate Video -->
            <button class="shorts-action-item" onclick="ElevateShorts.openReportModal('${video.id}')" title="إبلاغ عن محتوى غير لائق">
              <div class="shorts-action-icon-circle" style="font-size:14px; opacity:0.8;"><i class="fas fa-flag"></i></div>
            </button>
          </div>

          <!-- Bottom Content Info -->
          <div class="shorts-content-info">
            <div class="shorts-creator-chip">
              <div class="shorts-creator-avatar" onclick="ElevateShorts.openCreatorProfile('${video.creator}')" style="cursor:pointer;">
                ${this.escapeHtml((video.creatorName || video.creator).charAt(0).toUpperCase())}
              </div>
              <div onclick="ElevateShorts.openCreatorProfile('${video.creator}')" style="cursor:pointer;" class="shorts-creator-meta">
                <span class="shorts-creator-name">
                  @${this.escapeHtml(video.creatorName || video.creator)}
                  <i class="fas fa-circle-check" style="color:#38bdf8; font-size:0.82rem; margin-right:4px;"></i>
                </span>
                ${video.creatorRole ? `<span style="font-size:0.75rem; color:#c4b5fd;"><i class="fas fa-shield-halved"></i> ${this.escapeHtml(video.creatorRole)}</span>` : ""}
              </div>
              <button class="shorts-follow-btn ${isFollowing ? "following" : ""}" onclick="ElevateShorts.toggleFollow('${video.creator}')">
                ${isFollowing ? "متابَع" : "+ متابعة"}
              </button>
            </div>

            <h3 class="shorts-video-title">${this.escapeHtml(video.title)}</h3>
            <p class="shorts-video-desc" id="shorts-video-desc" onclick="ElevateShorts.toggleDescExpand(event)" title="اضغط لعرض كامل النص">${this.escapeHtml(video.desc || "")}</p>

            ${
              video.oppLink
                ? `
              <div style="margin-top:6px;">
                <a href="${video.oppLink}" class="shorts-opp-link-cta">
                  <i class="fas fa-arrow-up-right-from-square"></i>
                  <span>${video.oppTitle || "عرض الفرصة في Elevate"}</span>
                </a>
              </div>
            `
                : ""
            }
          </div>

          <!-- Bottom Progress Bar with Seek -->
          <div class="shorts-progress-bar" id="shorts-progress-bar-wrap" onclick="ElevateShorts.seekVideo(event)" title="انقر لتقديم أو تأخير الفيديو">
            <div class="shorts-progress-fill" id="shorts-progress-fill"></div>
          </div>
        </div>
      `;
    },

    renderEmptyFeed() {
      return `
        <div style="text-align:center; padding:60px 20px; color:#94a3b8; max-width:440px; background:#111827; border-radius:24px; border:1px solid rgba(255,255,255,0.06); margin:20px;">
          <div style="font-size:50px; color:#f43f5e; margin-bottom:16px;"><i class="fas fa-film"></i></div>
          <h3 style="color:#fff; font-size:1.25rem; margin:0 0 8px 0;">لا توجد أي فيديوهات منشورة بعد</h3>
          <p style="font-size:0.88rem; line-height:1.6; margin:0 0 20px 0;">
            تصفح أحدث الفرص والمسابقات المتاحة في المنصة، أو انتظر الفيديوهات الجديدة قريباً!
          </p>
          ${
            this.isUserAdmin()
              ? `
            <button class="shorts-btn-create-post" style="margin:0 auto;" onclick="ElevateShorts.openCreateModal()">
              <i class="fas fa-plus"></i> انشر أول فيديو الآن
            </button>
          `
              : `
            <button class="shorts-pill-btn active" style="margin:0 auto; padding:10px 24px;" onclick="ElevateShorts.switchTab('explore')">
              <i class="fas fa-compass"></i> استكشف المنصة
            </button>
          `
          }
        </div>
      `;
    },

    // ==========================================
    // Video Playback Controls
    // ==========================================
    initCurrentVideoPlayback() {
      const video = document.getElementById("shorts-active-video");
      const progressFill = document.getElementById("shorts-progress-fill");
      if (!video) return;

      video.muted = this.isMuted;
      video.play().catch(() => {
        video.muted = true;
        this.isMuted = true;
        video.play().catch(() => {});
      });

      video.ontimeupdate = () => {
        if (progressFill && video.duration) {
          const pct = (video.currentTime / video.duration) * 100;
          progressFill.style.width = pct + "%";
        }
      };
    },

    togglePlayPause(e) {
      if (e) e.stopPropagation();
      const video = document.getElementById("shorts-active-video");
      const flash = document.getElementById("shorts-play-flash");
      if (!video) return;

      if (video.paused) {
        video.play();
        this.isPlaying = true;
        if (flash) {
          flash.innerHTML = '<i class="fas fa-play"></i>';
          flash.classList.add("flash");
          setTimeout(() => flash.classList.remove("flash"), 500);
        }
      } else {
        video.pause();
        this.isPlaying = false;
        if (flash) {
          flash.innerHTML = '<i class="fas fa-pause"></i>';
          flash.classList.add("flash");
          setTimeout(() => flash.classList.remove("flash"), 500);
        }
      }
    },

    toggleSound(e) {
      if (e) e.stopPropagation();
      const video = document.getElementById("shorts-active-video");
      this.isMuted = !this.isMuted;
      if (video) video.muted = this.isMuted;

      const btn = document.querySelector(".shorts-top-sound-btn i");
      if (btn) {
        btn.className = `fas ${this.isMuted ? "fa-volume-xmark" : "fa-volume-high"}`;
      }
      this.showToast(this.isMuted ? "تم كتم الصوت 🔇" : "تم تشغيل الصوت 🔊", "info");
    },

    handleDoubleTap(videoId, e) {
      if (e) e.stopPropagation();
      this.toggleLike(videoId, true);

      // Trigger pop heart at click location
      const container = document.getElementById(`player-container-${videoId}`);
      if (container) {
        const heart = document.createElement("div");
        heart.className = "shorts-floating-heart";
        heart.innerHTML = '<i class="fas fa-heart"></i>';
        container.appendChild(heart);
        setTimeout(() => heart.remove(), 800);

        // Mini floating particle hearts
        for (let i = 0; i < 4; i++) {
          const mini = document.createElement("div");
          mini.className = "shorts-mini-particle-heart";
          const rot = Math.random() * 40 - 20 + "deg";
          const offsetX = Math.random() * 80 - 40 + "px";
          mini.style.setProperty("--offset-x", offsetX);
          mini.style.setProperty("--rot", rot);
          mini.style.animationDelay = i * 0.08 + "s";
          mini.innerHTML = '<i class="fas fa-heart"></i>';
          container.appendChild(mini);
          setTimeout(() => mini.remove(), 1000);
        }
      }
    },

    prevVideo() {
      const videos = this.getFilteredVideos();
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.render();
      }
    },

    nextVideo() {
      const videos = this.getFilteredVideos();
      if (this.currentIndex < videos.length - 1) {
        this.currentIndex++;
        this.render();
      }
    },

    switchTab(tab) {
      this.activeTab = tab;
      this.currentIndex = 0;
      this.render();
    },

    incrementViews(videoId) {
      if (!videoId) return;
      const all = this.getAllVideos();
      const v = all.find((x) => x.id === videoId);
      if (v) {
        v.views = (v.views || 0) + 1;
        this.saveAllVideos(all);
      }
    },

    // ==========================================
    // Like, Save, Follow, Share & Report Actions
    // ==========================================
    toggleLike(videoId, forceLikeOnly = false) {
      if (!this.isUserLoggedIn()) {
        alert("يرجى تسجيل الدخول أولاً للإعجاب بالفيديو.");
        window.location.href = "?view=login";
        return;
      }

      const user = this.getCurrentUser();
      const all = this.getAllVideos();
      const v = all.find((x) => x.id === videoId);
      if (!v) return;

      if (!v.likes) v.likes = [];
      const idx = v.likes.indexOf(user.username);

      if (idx > -1) {
        if (!forceLikeOnly) {
          v.likes.splice(idx, 1);
        }
      } else {
        v.likes.push(user.username);
      }

      this.saveAllVideos(all);
      this.render();
    },

    toggleSave(videoId) {
      if (!this.isUserLoggedIn()) {
        alert("يرجى تسجيل الدخول أولاً لحفظ الفيديو في مفضلتك.");
        window.location.href = "?view=login";
        return;
      }

      let saved = this.getSavedShorts();
      const all = this.getAllVideos();
      const v = all.find((x) => x.id === videoId);

      const idx = saved.indexOf(videoId);
      if (idx > -1) {
        saved.splice(idx, 1);
        if (v && v.saves > 0) v.saves--;
      } else {
        saved.push(videoId);
        if (v) v.saves = (v.saves || 0) + 1;
      }

      this.saveSavedShorts(saved);
      if (v) this.saveAllVideos(all);
      this.render();
    },

    toggleFollow(creatorUsername) {
      if (!this.isUserLoggedIn()) {
        alert("يرجى تسجيل الدخول أولاً لمتابعة صانع المحتوى.");
        window.location.href = "?view=login";
        return;
      }

      let follows = this.getFollows();
      const idx = follows.indexOf(creatorUsername);
      if (idx > -1) {
        follows.splice(idx, 1);
      } else {
        follows.push(creatorUsername);
      }
      this.saveFollows(follows);

      // Re-render creator profile modal if open
      if (this.activeCreatorProfileUser === creatorUsername) {
        this.openCreatorProfile(creatorUsername);
      } else {
        this.render();
      }
    },

    shareVideo(videoId) {
      const all = this.getAllVideos();
      const v = all.find((x) => x.id === videoId);
      if (v) {
        v.shares = (v.shares || 0) + 1;
        this.saveAllVideos(all);
      }

      const shareUrl =
        window.location.origin + window.location.pathname + `?view=shorts&id=${videoId}`;

      if (navigator.share) {
        navigator
          .share({
            title: v ? v.title : "Elevate Shorts",
            text: "شاهد هذا الفيديو على Elevate Shorts!",
            url: shareUrl,
          })
          .catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl).then(() => {
          this.showToast("تم نسخ رابط الفيديو بنجاح 📋✨", "check");
        });
      }
      this.render();
    },

    // ==========================================
    // Public Creator Profile Modal (Strictly requested data only)
    // Name, Bio, Followers count, Likes count, Views count, Their videos
    // ==========================================
    openCreatorProfile(username) {
      if (!username) return;
      this.activeCreatorProfileUser = username;

      const modal = document.getElementById("shorts-creator-profile-modal");
      const card = document.getElementById("shorts-creator-profile-card-content");
      if (!modal || !card) return;

      const allUsers = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      const userObj = allUsers.find((u) => u.username === username);

      const allApproved = this.getAllVideos().filter((v) => v.status === "approved");
      const creatorVideos = allApproved.filter((v) => v.creator === username);

      const totalViews = creatorVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = creatorVideos.reduce((sum, v) => sum + (v.likes || []).length, 0);
      const followersCount = this.getCreatorFollowersCount(username);

      const follows = this.getFollows();
      const isFollowing = follows.includes(username);

      const displayName = userObj ? userObj.fullName || userObj.username : username;
      const roleTitle = userObj && userObj.customRoleTitle ? userObj.customRoleTitle : "";
      const bioText = userObj && userObj.bio ? userObj.bio : "صانع محتوى في منصة Elevate Shorts";

      card.innerHTML = `
        <div class="shorts-creator-profile-header">
          <h3><i class="fas fa-circle-user" style="color:#f43f5e;"></i> ملف صانع المحتوى</h3>
          <button style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;" onclick="ElevateShorts.closeCreatorProfile()"><i class="fas fa-times"></i></button>
        </div>

        <div class="shorts-creator-profile-body custom-scrollbar">
          <!-- Avatar -->
          <div class="shorts-creator-profile-avatar">
            ${this.escapeHtml(displayName.charAt(0).toUpperCase())}
          </div>

          <!-- Name & Handle -->
          <h2 class="shorts-creator-profile-name">${this.escapeHtml(displayName)}</h2>
          <div class="shorts-creator-profile-handle">
            @${this.escapeHtml(username)}
            ${roleTitle ? `<span style="background:rgba(99,102,241,0.2); color:#c4b5fd; border:1px solid rgba(99,102,241,0.4); padding:2px 8px; border-radius:6px; font-size:0.75rem; margin-right:6px;"><i class="fas fa-shield-halved"></i> ${this.escapeHtml(roleTitle)}</span>` : ""}
          </div>

          <!-- Bio / Description (الوصف) -->
          <p class="shorts-creator-profile-bio">${this.escapeHtml(bioText)}</p>

          <!-- 3-Part Metric Stats Row (كام متابع، الإعجابات، المشاهدات فقط!) -->
          <div class="shorts-creator-profile-stats-row">
            <div class="shorts-creator-stat-box">
              <div class="shorts-creator-stat-val">${followersCount}</div>
              <div class="shorts-creator-stat-lbl">المتابعون</div>
            </div>
            <div class="shorts-creator-stat-box" style="border-right:1px solid var(--shorts-border); border-left:1px solid var(--shorts-border);">
              <div class="shorts-creator-stat-val" style="color:#f43f5e;">${totalLikes.toLocaleString()}</div>
              <div class="shorts-creator-stat-lbl">الإعجابات</div>
            </div>
            <div class="shorts-creator-stat-box">
              <div class="shorts-creator-stat-val" style="color:#10b981;">${totalViews.toLocaleString()}</div>
              <div class="shorts-creator-stat-lbl">المشاهدات</div>
            </div>
          </div>

          <!-- Follow Button -->
          <button class="shorts-creator-profile-follow-btn ${isFollowing ? "following" : ""}" onclick="ElevateShorts.toggleFollow('${this.escapeHtml(username)}')">
            <i class="fas ${isFollowing ? "fa-check" : "fa-user-plus"}"></i> ${isFollowing ? "متابَع" : "متابعة"}
          </button>

          <!-- Creator's Published Videos Grid Only -->
          <h4 class="shorts-creator-videos-heading">
            <i class="fas fa-film" style="color:#f43f5e;"></i> فيديوهات ${this.escapeHtml(displayName)} (${creatorVideos.length})
          </h4>

          <div class="shorts-creator-profile-grid">
            ${creatorVideos
              .map(
                (v) => `
              <div class="shorts-explore-card" style="aspect-ratio: 9/16;" onclick="ElevateShorts.closeCreatorProfile(); ElevateShorts.openVideoInFeed('${v.id}')">
                <video src="${v.videoUrl}" class="shorts-explore-video-thumb" preload="metadata" controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture ondragstart="return false;" draggable="false" oncontextmenu="return false;"></video>
                <div class="shorts-explore-overlay" oncontextmenu="event.preventDefault(); ElevateShorts.showToast('🔒 تنزيل الفيديوهات غير متاح', 'lock'); return false;"></div>
                <div class="shorts-explore-play-icon"><i class="fas fa-play"></i></div>
                <div class="shorts-explore-content">
                  <h5 class="shorts-explore-title" style="font-size:0.75rem;">${this.escapeHtml(v.title)}</h5>
                  <div class="shorts-explore-meta" style="font-size:0.68rem;">
                    <span><i class="fas fa-eye"></i> ${v.views || 0}</span>
                    <span><i class="fas fa-heart"></i> ${(v.likes || []).length}</span>
                  </div>
                </div>
              </div>
            `,
              )
              .join("")}

            ${
              creatorVideos.length === 0
                ? `
              <div style="grid-column: 1 / -1; padding:30px 15px; color:#64748b; font-size:0.85rem;">
                لم يقم هذا الحساب بنشر أي فيديوهات بعد.
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;

      modal.classList.add("open");
    },

    closeCreatorProfile() {
      const modal = document.getElementById("shorts-creator-profile-modal");
      if (modal) modal.classList.remove("open");
      this.activeCreatorProfileUser = null;
    },

    renderCreatorProfileModal() {
      return `
        <div class="shorts-creator-profile-modal" id="shorts-creator-profile-modal">
          <div class="shorts-creator-profile-card" id="shorts-creator-profile-card-content">
            <!-- Dynamically populated by openCreatorProfile() -->
          </div>
        </div>
      `;
    },

    // ==========================================
    // Comments System
    // ==========================================
    openComments(videoId) {
      this.activeCommentVideoId = videoId;
      const drawer = document.getElementById("shorts-comments-drawer");
      const body = document.getElementById("shorts-comments-body");
      const title = document.getElementById("shorts-comments-title");
      if (!drawer || !body) return;

      const comments = this.getComments(videoId);
      if (title) title.textContent = `التعليقات (${comments.length})`;

      body.innerHTML =
        comments.length > 0
          ? comments
              .map(
                (c) => `
        <div class="shorts-comment-item">
          <div class="shorts-comment-avatar">${this.escapeHtml((c.author || "?").charAt(0).toUpperCase())}</div>
          <div class="shorts-comment-content">
            <div class="shorts-comment-author">@${this.escapeHtml(c.author)} <span style="font-size:0.68rem; color:#64748b; font-weight:normal;">• ${c.time || "الآن"}</span></div>
            <p class="shorts-comment-text">${this.escapeHtml(c.text)}</p>
          </div>
        </div>
      `,
              )
              .join("")
          : `
        <div style="text-align:center; padding:30px; color:#64748b; font-size:0.85rem;">
          لا توجد تعليقات بعد، كن أول من يترك تعليقاً محترماً!
        </div>
      `;

      drawer.classList.add("open");
    },

    closeComments() {
      const drawer = document.getElementById("shorts-comments-drawer");
      if (drawer) drawer.classList.remove("open");
    },

    addComment() {
      if (!this.isUserLoggedIn()) {
        alert("يرجى تسجيل الدخول أولاً للتعليق على الفيديو.");
        window.location.href = "?view=login";
        return;
      }

      const input = document.getElementById("shorts-new-comment-input");
      const text = input ? input.value.trim() : "";
      if (!text || !this.activeCommentVideoId) return;

      const user = this.getCurrentUser();
      const comments = this.getComments(this.activeCommentVideoId);

      comments.push({
        id: "c_" + Date.now(),
        author: user.fullName || user.username,
        text: text,
        time: "الآن",
      });

      this.saveComments(this.activeCommentVideoId, comments);
      if (input) input.value = "";
      this.openComments(this.activeCommentVideoId);
      this.render();
    },

    // ==========================================
    // Reporting Inappropriate Videos
    // ==========================================
    openReportModal(videoId) {
      if (!this.isUserLoggedIn()) {
        alert("يرجى تسجيل الدخول أولاً للإبلاغ عن المحتوى.");
        window.location.href = "?view=login";
        return;
      }

      const reason = prompt(
        "يرجى كتابة سبب الإبلاغ عن هذا الفيديو (محتوى مخالف، معلومات مضللة، سب وقذف، إلخ):",
      );
      if (!reason || !reason.trim()) return;

      const user = this.getCurrentUser();
      const reports = JSON.parse(localStorage.getItem("luxen_shorts_reports") || "[]");
      const all = this.getAllVideos();
      const v = all.find((x) => x.id === videoId);

      reports.push({
        id: "rep_" + Date.now(),
        videoId: videoId,
        videoTitle: v ? v.title : "فيديو محذوف",
        creator: v ? v.creator : "مجهول",
        reporter: user.username,
        reason: reason.trim(),
        timestamp: Date.now(),
      });

      localStorage.setItem("luxen_shorts_reports", JSON.stringify(reports));
      alert("تم استلام بلاغك وسيقوم فريق الإدارة بمراجعة الفيديو واتخاذ الإجراء اللازم فوراً.");
    },

    // ==========================================
    // Content Creator Studio & Video Upload (Must be logged in)
    // ==========================================
    openCreateModal() {
      if (!this.isUserAdmin()) {
        this.showToast("⛔ نشر الفيديوهات مخصص فقط لإدارة المنصة وصناع المحتوى المعتمدين", "lock");
        return;
      }
      const modal = document.getElementById("shorts-create-modal");
      if (modal) modal.classList.add("open");
    },

    closeCreateModal() {
      const modal = document.getElementById("shorts-create-modal");
      if (modal) modal.classList.remove("open");
    },

    renderCreateModal() {
      if (!this.isUserAdmin()) return "";
      const allCards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");

      return `
        <div class="shorts-create-modal" id="shorts-create-modal">
          <div class="shorts-create-card">
            <div class="shorts-create-header">
              <h3><i class="fas fa-video" style="color:#f43f5e;"></i> نشر فيديو في Elevate Shorts</h3>
              <button style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;" onclick="ElevateShorts.closeCreateModal()"><i class="fas fa-times"></i></button>
            </div>

            <div class="shorts-create-body custom-scrollbar">
              <!-- Upload Zone -->
              <div class="shorts-upload-zone" onclick="document.getElementById('shorts-file-input').click()">
                <div class="shorts-upload-icon"><i class="fas fa-cloud-arrow-up"></i></div>
                <h4 style="margin:0 0 4px 0; color:#fff;">اختر فيديو عمودي بصيغة MP4 أو WebM</h4>
                <p style="margin:0; font-size:0.8rem; color:#94a3b8;">مدة الفيديو القصوى 60 ثانية (نسبة 9:16)</p>
                <input type="file" id="shorts-file-input" accept="video/mp4,video/webm" style="display:none;" onchange="ElevateShorts.handleVideoSelect(event)">
              </div>

              <!-- Video Preview Element -->
              <video id="shorts-preview-player" class="shorts-create-preview" controls controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture oncontextmenu="return false;"></video>

              <!-- Video Details -->
              <div>
                <label class="shorts-create-label">عنوان الفيديو *</label>
                <input type="text" id="shorts-create-title" class="shorts-create-input" placeholder="مثال: أسرار القبول في منح الاتحاد الأوروبي...">
              </div>

              <div>
                <label class="shorts-create-label">الوصف والهاشتاجات</label>
                <textarea id="shorts-create-desc" rows="3" class="shorts-create-textarea" placeholder="اكتب تفاصيل مختصرة وهاشتاجات #منح #تطوع..."></textarea>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div>
                  <label class="shorts-create-label">التصنيف *</label>
                  <select id="shorts-create-category" class="shorts-create-select">
                    <option value="foryou">عام — لك (For You)</option>
                    <option value="learn">اتعلم — مهارات وكورسات</option>
                    <option value="opportunities">الفرص — منح ومسابقات</option>
                  </select>
                </div>
                <div>
                  <label class="shorts-create-label">ربط بفرصة داخل Elevate</label>
                  <select id="shorts-create-opp" class="shorts-create-select">
                    <option value="">بدون ربط (فيديو مستقل)</option>
                    ${allCards
                      .map(
                        (c) => `
                      <option value="${c.id}">${this.escapeHtml(c.name)}</option>
                    `,
                      )
                      .join("")}
                  </select>
                </div>
              </div>

              <div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); border-radius:12px; padding:12px; font-size:0.82rem; color:#fca5a5;">
                <i class="fas fa-shield-halved" style="margin-left:6px;"></i>
                <strong>ملاحظة هامة:</strong> تخضع جميع الفيديوهات لمراجعة وتدقيق الإدارة قبل النشر لحماية جودة المجتمع. ستظهر لك رسالة تفيد بأن الفيديو قيد المعالجة فور الإرسال.
              </div>
            </div>

            <div class="shorts-create-actions">
              <button type="button" class="shorts-btn-submit" onclick="ElevateShorts.submitVideo(false)">
                <i class="fas fa-paper-plane"></i> إرسال للمراجعة والنشر
              </button>
              <button type="button" class="shorts-btn-draft" onclick="ElevateShorts.submitVideo(true)">
                <i class="fas fa-floppy-disk"></i> حفظ كمسودة
              </button>
            </div>
          </div>
        </div>
      `;
    },

    handleVideoSelect(e) {
      const file = e.target.files[0];
      if (!file) return;

      const preview = document.getElementById("shorts-preview-player");
      const reader = new FileReader();

      reader.onload = (event) => {
        this.tempVideoDataUrl = event.target.result;
        if (preview) {
          preview.src = this.tempVideoDataUrl;
          preview.style.display = "block";
        }
      };
      reader.readAsDataURL(file);
    },

    submitVideo(isDraft = false) {
      if (!this.isUserLoggedIn()) {
        alert("⛔ يجب تسجيل الدخول أو إنشاء حساب في المنصة أولاً لتتمكن من نشر فيديو.");
        window.location.href = "?view=login";
        return;
      }

      const titleInput = document.getElementById("shorts-create-title");
      const descInput = document.getElementById("shorts-create-desc");
      const catSelect = document.getElementById("shorts-create-category");
      const oppSelect = document.getElementById("shorts-create-opp");

      const title = titleInput ? titleInput.value.trim() : "";
      const desc = descInput ? descInput.value.trim() : "";
      const category = catSelect ? catSelect.value : "foryou";
      const oppId = oppSelect ? oppSelect.value : "";

      if (!title) {
        alert("يرجى إدخال عنوان للفيديو أولاً.");
        return;
      }

      if (!this.tempVideoDataUrl) {
        alert("يرجى اختيار ملف فيديو لرفعه أولاً.");
        return;
      }

      const videoUrl = this.tempVideoDataUrl;
      const user = this.getCurrentUser();
      const allCards = JSON.parse(localStorage.getItem("luxen_general_cards") || "[]");
      const targetOpp = oppId ? allCards.find((c) => c.id == oppId) : null;

      const newVideo = {
        id: "short_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        title: title,
        desc: desc,
        category: category,
        videoUrl: videoUrl,
        creator: user.username,
        creatorName: user.fullName || user.username,
        creatorRole: user.customRoleTitle || (user.isAdmin ? "إدارة المنصة" : "صانع محتوى"),
        oppLink: targetOpp ? `?id=${targetOpp.id}` : null,
        oppTitle: targetOpp ? targetOpp.name : null,
        status: isDraft ? "draft" : user.isAdmin ? "approved" : "pending", // Admin publishes directly, users require review
        views: 0,
        likes: [],
        shares: 0,
        saves: 0,
        isPinned: false,
        timestamp: Date.now(),
      };

      const all = this.getAllVideos();
      all.unshift(newVideo);
      this.saveAllVideos(all);

      this.tempVideoDataUrl = null;
      this.closeCreateModal();

      if (isDraft) {
        alert("تم حفظ الفيديو كمسودة في حسابك بنجاح!");
        this.switchTab("mystudio");
      } else {
        if (user.isAdmin) {
          alert("تم نشر الفيديو بنجاح على Elevate Shorts!");
          this.switchTab("explore");
        } else {
          // Rule compliance: "الفديوهات والحاجات مينفعش تتنشر غير بموافقه من الادمن تمام يظهرلو ويقولو يتم معالجه طلبك تمام"
          alert(
            "✅ تم استلام الفيديو بنجاح!\n\nيتم معالجة ومراجعة طلبك حالياً من قِبل إدارة المنصة قبل النشر، وسيتم إتاحته للجمهور فور الموافقة عليه.",
          );
          this.switchTab("mystudio");
        }
      }
    },

    // ==========================================
    // Creator Studio Tab View
    // ==========================================
    renderStudioLayout() {
      if (!this.isUserAdmin()) {
        return `
          <div style="text-align:center; padding:80px 20px; color:#94a3b8; max-width:460px; margin:0 auto;">
            <div style="font-size:55px; color:#f43f5e; margin-bottom:16px;"><i class="fas fa-shield-halved"></i></div>
            <h2 style="color:#fff; font-size:1.4rem; margin:0 0 10px 0;">نشر الفيديوهات مخصص للإدارة</h2>
            <p style="font-size:0.9rem; line-height:1.6; margin:0 0 24px 0;">
              خاصية رفع ونشر الفيديوهات في Elevate Shorts مقتصرة على إدارة المنصة وصناع المحتوى المعتمدين لضمان جودة وأمان المحتوى.
            </p>
            <button onclick="ElevateShorts.switchTab('explore')" class="shorts-pill-btn active" style="padding:10px 24px; font-size:0.95rem;">
              <i class="fas fa-play"></i> استكشاف كل الفيديوهات
            </button>
          </div>
        `;
      }

      const user = this.getCurrentUser();
      const all = this.getAllVideos();
      const myVideos = all.filter((v) => v.creator === user.username || user.isAdmin);

      const totalViews = myVideos.reduce((acc, v) => acc + (v.views || 0), 0);
      const totalLikes = myVideos.reduce((acc, v) => acc + (v.likes || []).length, 0);

      return `
        <div class="shorts-studio-container custom-scrollbar">
          <div class="shorts-studio-header">
            <div>
              <h2 style="font-size:1.4rem; font-weight:800; color:#fff; margin:0 0 6px 0;">
                <i class="fas fa-clapperboard" style="color:#f43f5e; margin-left:8px;"></i> استوديو صانع المحتوى
              </h2>
              <p style="margin:0; font-size:0.85rem; color:#94a3b8;">متابعة حالة فيديوهاتك، عدد المشاهدات، وإحصائيات التفاعل</p>
            </div>
            <div style="display:flex; gap:10px;">
              <button class="shorts-pill-btn active" onclick="ElevateShorts.switchTab('explore')"><i class="fas fa-table-cells-large"></i> كل الفيديوهات</button>
              <button class="shorts-btn-create-post" style="padding:10px 18px;" onclick="ElevateShorts.openCreateModal()"><i class="fas fa-plus"></i> فيديو جديد</button>
            </div>
          </div>

          <!-- Studio KPIs -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:24px;">
            <div style="background:#111827; border:1px solid var(--shorts-border); border-radius:16px; padding:18px;">
              <div style="font-size:0.8rem; color:#94a3b8;">إجمالي الفيديوهات</div>
              <div style="font-size:1.6rem; font-weight:900; color:#fff; margin-top:4px;">${myVideos.length}</div>
            </div>
            <div style="background:#111827; border:1px solid var(--shorts-border); border-radius:16px; padding:18px;">
              <div style="font-size:0.8rem; color:#94a3b8;">إجمالي المشاهدات</div>
              <div style="font-size:1.6rem; font-weight:900; color:#10b981; margin-top:4px;">${totalViews.toLocaleString()}</div>
            </div>
            <div style="background:#111827; border:1px solid var(--shorts-border); border-radius:16px; padding:18px;">
              <div style="font-size:0.8rem; color:#94a3b8;">إجمالي الإعجابات</div>
              <div style="font-size:1.6rem; font-weight:900; color:#f43f5e; margin-top:4px;">${totalLikes.toLocaleString()}</div>
            </div>
          </div>

          <!-- Videos List -->
          <h3 style="font-size:1.1rem; font-weight:800; color:#fff; margin:0 0 16px 0;">سجل الفيديوهات الخاصة بك</h3>
          <div class="shorts-studio-grid">
            ${myVideos
              .map((v) => {
                const statusBadge =
                  v.status === "approved"
                    ? '<span class="shorts-status-badge approved"><i class="fas fa-check"></i> منشور</span>'
                    : v.status === "pending"
                      ? '<span class="shorts-status-badge pending"><i class="fas fa-hourglass-half"></i> يتم معالجة طلبك</span>'
                      : '<span class="shorts-status-badge draft">مسودة</span>';

                return `
                <div class="shorts-studio-card">
                  <div class="shorts-studio-thumb-wrap">
                    <video src="${v.videoUrl}" class="shorts-studio-thumb" preload="metadata" controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture ondragstart="return false;" draggable="false" oncontextmenu="return false;"></video>
                    ${statusBadge}
                  </div>
                  <div class="shorts-studio-body">
                    <h4 class="shorts-studio-title">${this.escapeHtml(v.title)}</h4>
                    <div class="shorts-studio-stats">
                      <span><i class="fas fa-eye"></i> ${v.views || 0}</span>
                      <span><i class="fas fa-heart"></i> ${(v.likes || []).length}</span>
                      <span><i class="fas fa-share"></i> ${v.shares || 0}</span>
                    </div>
                    <div class="shorts-studio-actions">
                      <button class="shorts-pill-btn" style="background:rgba(239,68,68,0.15); color:#ef4444; border-radius:8px; padding:4px 10px; font-size:0.75rem;" onclick="ElevateShorts.deleteVideo('${v.id}')">
                        <i class="fas fa-trash"></i> حذف
                      </button>
                    </div>
                  </div>
                </div>
              `;
              })
              .join("")}

            ${
              myVideos.length === 0
                ? `
              <div style="grid-column: 1 / -1; text-align:center; padding:40px; color:#64748b;">
                لم تقم برفع أي فيديوهات بعد. اضغط على "فيديو جديد" للبدء!
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    },

    deleteVideo(videoId) {
      if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الفيديو؟")) return;
      let all = this.getAllVideos();
      all = all.filter((v) => v.id !== videoId);
      this.saveAllVideos(all);
      this.render();
    },

    // ==========================================
    // Mobile Floating Shortcut Pill
    // ==========================================
    initMobilePill() {
      if (sessionStorage.getItem("luxen_shorts_pill_dismissed") === "true") return;
      if (document.getElementById("mobile-shorts-pill")) return;

      const pill = document.createElement("a");
      pill.id = "mobile-shorts-pill";
      pill.className = "mobile-shorts-pill";
      pill.href = "?view=shorts";
      pill.innerHTML = `
        <i class="fas fa-play"></i>
        <span>Elevate Shorts</span>
        <button type="button" class="mobile-shorts-pill-close" onclick="ElevateShorts.dismissMobilePill(event)" title="إخفاء">
          <i class="fas fa-times"></i>
        </button>
      `;
      document.body.appendChild(pill);
    },

    dismissMobilePill(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      sessionStorage.setItem("luxen_shorts_pill_dismissed", "true");
      const pill = document.getElementById("mobile-shorts-pill");
      if (pill) pill.remove();
    },

    // ==========================================
    // Swiping & Event Listeners
    // ==========================================
    handleTouchStart(e) {
      this.touchStartY = e.touches[0].clientY;
    },

    handleTouchEnd(e) {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = this.touchStartY - touchEndY;
      if (Math.abs(diff) > 45) {
        if (diff > 0)
          this.nextVideo(); // Swipe up
        else this.prevVideo(); // Swipe down
      }
    },

    attachGlobalEvents() {
      // Wheel debounce
      window.addEventListener(
        "wheel",
        (e) => {
          const view = document.getElementById("shorts-view");
          if (!view || view.style.display === "none") return;
          if (this.activeTab === "explore" || this.activeTab === "mystudio") return;
          if (this.isWheelThrottled) return;

          this.isWheelThrottled = true;
          if (e.deltaY > 20) this.nextVideo();
          else if (e.deltaY < -20) this.prevVideo();

          setTimeout(() => {
            this.isWheelThrottled = false;
          }, 600);
        },
        { passive: true },
      );

      // Keyboard Up / Down arrows
      window.addEventListener("keydown", (e) => {
        const view = document.getElementById("shorts-view");
        if (!view || view.style.display === "none") return;
        if (this.activeTab === "explore" || this.activeTab === "mystudio") return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          this.nextVideo();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.prevVideo();
        } else if (e.key === " " || e.key === "k") {
          e.preventDefault();
          this.togglePlayPause();
        } else if (e.key === "m") {
          e.preventDefault();
          this.toggleSound();
        }
      });

      // Video download and right-click protection across shorts
      window.addEventListener(
        "contextmenu",
        (e) => {
          const view = document.getElementById("shorts-view");
          if (view && view.style.display !== "none" && view.contains(e.target)) {
            e.preventDefault();
            this.showToast("🔒 تنزيل أو حفظ الفيديوهات غير متاح لحماية حقوق المحتوى", "lock");
            return false;
          }
        },
        { capture: true },
      );

      // Prevent Ctrl+S / Cmd+S save page / video shortcut
      window.addEventListener(
        "keydown",
        (e) => {
          const view = document.getElementById("shorts-view");
          if (view && view.style.display !== "none") {
            if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
              e.preventDefault();
              this.showToast("🔒 حفظ وتنزيل الفيديو غير متاح", "lock");
              return false;
            }
          }
        },
        { capture: true },
      );
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
  // Elevate Shorts Admin Moderation Section
  // (Integrated into Manager Dashboard)
  // ==========================================
  const ElevateShortsAdmin = {
    activeTab: "pending", // 'pending' | 'approved' | 'reports'

    render() {
      const container = document.getElementById("adm-sec-shorts");
      if (!container) return;

      const all = ElevateShorts.getAllVideos();
      const pendingVideos = all.filter((v) => v.status === "pending");
      const approvedVideos = all.filter((v) => v.status === "approved");
      const reports = JSON.parse(localStorage.getItem("luxen_shorts_reports") || "[]");

      // Update badge in sidebar if present
      const badge = document.getElementById("admin-nav-shorts-badge");
      if (badge) badge.textContent = pendingVideos.length;

      container.innerHTML = `
        <div class="admin-shorts-wrapper">
          <!-- Overview KPIs -->
          <div class="admin-shorts-kpis">
            <div class="admin-shorts-kpi-card">
              <div class="admin-shorts-kpi-icon" style="background:rgba(244,63,94,0.15); color:#f43f5e;"><i class="fas fa-play"></i></div>
              <div>
                <div style="font-size:0.75rem; color:#94a3b8;">إجمالي الشورتس</div>
                <div style="font-size:1.3rem; font-weight:900; color:#fff;">${all.length}</div>
              </div>
            </div>

            <div class="admin-shorts-kpi-card" style="border-color:rgba(245,158,11,0.4);">
              <div class="admin-shorts-kpi-icon" style="background:rgba(245,158,11,0.15); color:#f59e0b;"><i class="fas fa-hourglass-half"></i></div>
              <div>
                <div style="font-size:0.75rem; color:#f59e0b; font-weight:700;">طلبات معلقة للموافقة</div>
                <div style="font-size:1.3rem; font-weight:900; color:#f59e0b;">${pendingVideos.length}</div>
              </div>
            </div>

            <div class="admin-shorts-kpi-card">
              <div class="admin-shorts-kpi-icon" style="background:rgba(16,185,129,0.15); color:#10b981;"><i class="fas fa-circle-check"></i></div>
              <div>
                <div style="font-size:0.75rem; color:#94a3b8;">فيديوهات منشورة</div>
                <div style="font-size:1.3rem; font-weight:900; color:#10b981;">${approvedVideos.length}</div>
              </div>
            </div>

            <div class="admin-shorts-kpi-card" style="border-color:rgba(239,68,68,0.4);">
              <div class="admin-shorts-kpi-icon" style="background:rgba(239,68,68,0.15); color:#ef4444;"><i class="fas fa-flag"></i></div>
              <div>
                <div style="font-size:0.75rem; color:#ef4444; font-weight:700;">البلاغات الواردة</div>
                <div style="font-size:1.3rem; font-weight:900; color:#ef4444;">${reports.length}</div>
              </div>
            </div>
          </div>

          <!-- Section Navigation Tabs -->
          <div class="admin-shorts-tabs-nav">
            <button class="admin-shorts-tab-btn ${this.activeTab === "pending" ? "active" : ""}" onclick="ElevateShortsAdmin.switchTab('pending')">
              <i class="fas fa-clock"></i> <span>طلبات النشر المعلقة (${pendingVideos.length})</span>
            </button>
            <button class="admin-shorts-tab-btn ${this.activeTab === "approved" ? "active" : ""}" onclick="ElevateShortsAdmin.switchTab('approved')">
              <i class="fas fa-list-check"></i> <span>الفيديوهات المنشورة (${approvedVideos.length})</span>
            </button>
            <button class="admin-shorts-tab-btn ${this.activeTab === "reports" ? "active" : ""}" onclick="ElevateShortsAdmin.switchTab('reports')">
              <i class="fas fa-flag"></i> <span>سجل البلاغات (${reports.length})</span>
            </button>
          </div>

          <!-- Tab Content -->
          ${
            this.activeTab === "pending"
              ? this.renderPendingQueue(pendingVideos)
              : this.activeTab === "reports"
                ? this.renderReports(reports)
                : this.renderApprovedList(approvedVideos)
          }
        </div>
      `;
    },

    switchTab(tab) {
      this.activeTab = tab;
      this.render();
    },

    renderPendingQueue(pendingVideos) {
      if (pendingVideos.length === 0) {
        return `
          <div style="text-align:center; padding:50px 20px; background:#111827; border-radius:18px; border:1px solid rgba(255,255,255,0.06);">
            <i class="fas fa-circle-check" style="font-size:36px; color:#10b981; margin-bottom:12px; display:block;"></i>
            <h4 style="color:#fff; margin:0 0 6px 0;">لا توجد فيديوهات معلقة للمراجعة</h4>
            <p style="color:#94a3b8; font-size:0.85rem; margin:0;">تمت مراجعة والبت في جميع الفيديوهات المرفوعة بنجاح.</p>
          </div>
        `;
      }

      return `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${pendingVideos
            .map(
              (v) => `
            <div style="background:#111827; border:1px solid rgba(245,158,11,0.3); border-radius:18px; padding:18px; display:flex; flex-wrap:wrap; gap:18px; align-items:center;">
              <div style="width:130px; height:180px; background:#000; border-radius:12px; overflow:hidden; flex-shrink:0;">
                <video src="${v.videoUrl}" controls controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture oncontextmenu="return false;" style="width:100%; height:100%; object-fit:cover;"></video>
              </div>

              <div style="flex:1; min-width:260px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                  <span style="background:#f59e0b; color:#000; padding:2px 8px; border-radius:6px; font-weight:800; font-size:0.75rem;">قيد المعالجة</span>
                  <span style="color:#818cf8; font-size:0.82rem; font-weight:700;">صاحب الفيديو: @${ElevateShorts.escapeHtml(v.creator)}</span>
                  ${v.creatorRole ? `<span style="color:#c4b5fd; font-size:0.75rem;">[${ElevateShorts.escapeHtml(v.creatorRole)}]</span>` : ""}
                </div>
                <h4 style="color:#fff; font-size:1.05rem; margin:0 0 6px 0;">${ElevateShorts.escapeHtml(v.title)}</h4>
                <p style="color:#94a3b8; font-size:0.85rem; line-height:1.5; margin:0 0 10px 0;">${ElevateShorts.escapeHtml(v.desc || "")}</p>
                <div style="font-size:0.78rem; color:#64748b;">
                  <span>التصنيف: <strong>${v.category}</strong></span>
                  ${v.oppTitle ? ` | <span>الفرصة المرتبطة: <strong>${ElevateShorts.escapeHtml(v.oppTitle)}</strong></span>` : ""}
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:8px;">
                <button type="button" class="admin-mini-btn" style="background:#10b981; color:#fff; padding:10px 16px; border-radius:10px; font-weight:800; font-size:0.88rem;" onclick="ElevateShortsAdmin.approveVideo('${v.id}')">
                  <i class="fas fa-check"></i> موافقة ونشر الآن
                </button>
                <button type="button" class="admin-mini-btn mini-del" style="padding:10px 16px; border-radius:10px; font-weight:800; font-size:0.88rem;" onclick="ElevateShortsAdmin.rejectVideo('${v.id}')">
                  <i class="fas fa-times"></i> رفض المحتوى
                </button>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    },

    renderApprovedList(approvedVideos) {
      return `
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${approvedVideos
            .map(
              (v) => `
            <div style="background:#111827; border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <span style="width:36px; height:36px; border-radius:10px; background:rgba(244,63,94,0.15); color:#f43f5e; display:flex; align-items:center; justify-content:center;">
                  <i class="fas fa-play"></i>
                </span>
                <div>
                  <h4 style="color:#fff; font-size:0.95rem; margin:0 0 4px 0;">
                    ${ElevateShorts.escapeHtml(v.title)}
                    ${v.isPinned ? '<span style="color:#fbbf24; font-size:0.75rem; margin-right:8px;"><i class="fas fa-thumbtack"></i> مثبت</span>' : ""}
                  </h4>
                  <div style="font-size:0.75rem; color:#94a3b8;">
                    <span>@${ElevateShorts.escapeHtml(v.creator)}</span> •
                    <span>${v.views || 0} مشاهدة</span> •
                    <span>${(v.likes || []).length} إعجاب</span> •
                    <span>${v.category}</span>
                  </div>
                </div>
              </div>

              <div style="display:flex; gap:8px;">
                <button type="button" class="admin-mini-btn" style="background:${v.isPinned ? "#f59e0b" : "rgba(255,255,255,0.08)"}; color:${v.isPinned ? "#000" : "#fff"};" onclick="ElevateShortsAdmin.togglePin('${v.id}')">
                  <i class="fas fa-thumbtack"></i> ${v.isPinned ? "إلغاء التثبيت" : "تثبيت في المقدمة"}
                </button>
                <button type="button" class="admin-mini-btn mini-del" onclick="ElevateShortsAdmin.deleteVideo('${v.id}')">
                  <i class="fas fa-trash"></i> حذف
                </button>
              </div>
            </div>
          `,
            )
            .join("")}

          ${
            approvedVideos.length === 0
              ? `
            <div style="text-align:center; padding:30px; color:#64748b;">لا توجد فيديوهات منشورة حالياً.</div>
          `
              : ""
          }
        </div>
      `;
    },

    renderReports(reports) {
      if (reports.length === 0) {
        return `
          <div style="text-align:center; padding:45px 20px; background:#111827; border-radius:18px; color:#10b981;">
            <i class="fas fa-circle-check" style="font-size:32px; margin-bottom:10px; display:block;"></i>
            لا توجد أي بلاغات معلقة ضد فيديوهات الشورتس حالياً.
          </div>
        `;
      }

      return `
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${reports
            .map(
              (r) => `
            <div style="background:#111827; border:1px solid rgba(239,68,68,0.3); border-radius:14px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="color:#ef4444; font-weight:800; font-size:0.85rem; margin-bottom:4px;">
                  <i class="fas fa-triangle-exclamation"></i> بلاغ من @${ElevateShorts.escapeHtml(r.reporter)}
                </div>
                <h4 style="color:#fff; margin:0 0 4px 0;">الفيديو: ${ElevateShorts.escapeHtml(r.videoTitle)} (صانع المحتوى: @${ElevateShorts.escapeHtml(r.creator)})</h4>
                <div style="color:#fca5a5; font-size:0.82rem; background:rgba(239,68,68,0.1); padding:6px 10px; border-radius:8px;">
                  سبب البلاغ: ${ElevateShorts.escapeHtml(r.reason)}
                </div>
              </div>

              <div style="display:flex; gap:8px;">
                <button type="button" class="admin-mini-btn mini-del" onclick="ElevateShortsAdmin.deleteReportedVideo('${r.videoId}', '${r.id}')">
                  <i class="fas fa-trash"></i> حذف الفيديو
                </button>
                <button type="button" class="admin-mini-btn" style="background:rgba(255,255,255,0.08); color:#94a3b8;" onclick="ElevateShortsAdmin.dismissReport('${r.id}')">
                  <i class="fas fa-check"></i> حفظ وإغلاق البلاغ
                </button>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    },

    approveVideo(id) {
      let all = ElevateShorts.getAllVideos();
      const v = all.find((x) => x.id === id);
      if (v) {
        v.status = "approved";
        ElevateShorts.saveAllVideos(all);
        alert("تمت الموافقة ونشر الفيديو بنجاح على Elevate Shorts!");
        this.render();
      }
    },

    rejectVideo(id) {
      if (!confirm("هل تريد رفض هذا المحتوى؟")) return;
      let all = ElevateShorts.getAllVideos();
      const v = all.find((x) => x.id === id);
      if (v) {
        v.status = "rejected";
        ElevateShorts.saveAllVideos(all);
        alert("تم رفض الفيديو.");
        this.render();
      }
    },

    togglePin(id) {
      let all = ElevateShorts.getAllVideos();
      const v = all.find((x) => x.id === id);
      if (v) {
        v.isPinned = !v.isPinned;
        ElevateShorts.saveAllVideos(all);
        this.render();
      }
    },

    deleteVideo(id) {
      if (!confirm("هل أنت متأكد من حذف هذا الفيديو نهائياً؟")) return;
      let all = ElevateShorts.getAllVideos();
      all = all.filter((x) => x.id !== id);
      ElevateShorts.saveAllVideos(all);
      this.render();
    },

    deleteReportedVideo(videoId, reportId) {
      this.deleteVideo(videoId);
      this.dismissReport(reportId);
    },

    dismissReport(reportId) {
      let reports = JSON.parse(localStorage.getItem("luxen_shorts_reports") || "[]");
      reports = reports.filter((r) => r.id !== reportId);
      localStorage.setItem("luxen_shorts_reports", JSON.stringify(reports));
      this.render();
    },
  };

  // Expose to window
  window.ElevateShorts = ElevateShorts;
  window.ElevateShortsAdmin = ElevateShortsAdmin;

  // Auto initialize floating pill on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    ElevateShorts.initMobilePill();
  });
})();
