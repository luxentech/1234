/* ==========================================================================
   Elevate — Courses & Teacher Management System
   (منظومة الكورسات المجانية والمدفوعة من الجهاز + حسابات ولوحة متابعة المدرس)
   ========================================================================== */

(function (window, document) {
  "use strict";

  // Helper to read JSON safely from localStorage
  function getStored(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // Helper to write JSON to localStorage
  function setStored(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("[Courses] Failed to save " + key, e);
    }
  }

  // Get current logged-in user
  function getCurrentUser() {
    try {
      return JSON.parse(
        localStorage.getItem("ns_user") ||
          localStorage.getItem("luxen_current_user") ||
          "null"
      );
    } catch (e) {
      return null;
    }
  }

  // Format file size nicely
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 بايت";
    var k = 1024;
    var sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  // =========================================================================
  // IndexedDB Media Store for Native Videos & Images from Device
  // =========================================================================
  var CoursesMediaDB = {
    dbName: "ElevateCoursesMediaDB",
    dbVersion: 1,
    db: null,
    urlCache: {},

    open: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (self.db) return resolve(self.db);
        if (!window.indexedDB) {
          console.warn("[CoursesMediaDB] IndexedDB not supported");
          return resolve(null);
        }

        var req = indexedDB.open(self.dbName, self.dbVersion);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains("videos")) {
            db.createObjectStore("videos", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("images")) {
            db.createObjectStore("images", { keyPath: "id" });
          }
        };
        req.onsuccess = function (e) {
          self.db = e.target.result;
          resolve(self.db);
        };
        req.onerror = function (e) {
          console.warn("[CoursesMediaDB] open error", e);
          resolve(null);
        };
      });
    },

    saveVideo: function (courseId, fileOrBlob, fileName) {
      var self = this;
      return this.open().then(function (db) {
        if (!db) return false;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction("videos", "readwrite");
            var store = tx.objectStore("videos");
            store.put({
              id: courseId,
              blob: fileOrBlob,
              name: fileName || fileOrBlob.name || "video.mp4",
              size: fileOrBlob.size || 0,
              type: fileOrBlob.type || "video/mp4",
              updatedAt: Date.now()
            });
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = function () { resolve(false); };
          } catch (e) {
            console.warn("[CoursesMediaDB] saveVideo error", e);
            resolve(false);
          }
        });
      });
    },

    saveImage: function (courseId, fileOrBlob, fileName) {
      var self = this;
      return this.open().then(function (db) {
        if (!db) return false;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction("images", "readwrite");
            var store = tx.objectStore("images");
            store.put({
              id: courseId,
              blob: fileOrBlob,
              name: fileName || fileOrBlob.name || "thumb.jpg",
              type: fileOrBlob.type || "image/jpeg",
              updatedAt: Date.now()
            });
            tx.oncomplete = function () { resolve(true); };
            tx.onerror = function () { resolve(false); };
          } catch (e) {
            console.warn("[CoursesMediaDB] saveImage error", e);
            resolve(false);
          }
        });
      });
    },

    getVideoUrl: function (courseId) {
      var self = this;
      if (self.urlCache["v_" + courseId]) {
        return Promise.resolve(self.urlCache["v_" + courseId]);
      }
      return this.open().then(function (db) {
        if (!db) return null;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction("videos", "readonly");
            var store = tx.objectStore("videos");
            var req = store.get(courseId);
            req.onsuccess = function () {
              if (req.result && req.result.blob) {
                var url = URL.createObjectURL(req.result.blob);
                self.urlCache["v_" + courseId] = url;
                resolve(url);
              } else {
                resolve(null);
              }
            };
            req.onerror = function () { resolve(null); };
          } catch (e) {
            resolve(null);
          }
        });
      });
    },

    getImageUrl: function (courseId) {
      var self = this;
      if (self.urlCache["img_" + courseId]) {
        return Promise.resolve(self.urlCache["img_" + courseId]);
      }
      return this.open().then(function (db) {
        if (!db) return null;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction("images", "readonly");
            var store = tx.objectStore("images");
            var req = store.get(courseId);
            req.onsuccess = function () {
              if (req.result && req.result.blob) {
                var url = URL.createObjectURL(req.result.blob);
                self.urlCache["img_" + courseId] = url;
                resolve(url);
              } else {
                resolve(null);
              }
            };
            req.onerror = function () { resolve(null); };
          } catch (e) {
            resolve(null);
          }
        });
      });
    },

    deleteMedia: function (courseId) {
      var self = this;
      delete self.urlCache["v_" + courseId];
      delete self.urlCache["img_" + courseId];
      return this.open().then(function (db) {
        if (!db) return;
        try {
          var tx = db.transaction(["videos", "images"], "readwrite");
          tx.objectStore("videos").delete(courseId);
          tx.objectStore("images").delete(courseId);
        } catch (e) {}
      });
    }
  };

  // Get courses: strictly real courses uploaded by teachers, NO fake/dummy courses
  var CoursesApp = {
    activeFilter: "all",
    searchQuery: "",
    currentViewingCourseId: null,

    getCourses: function () {
      var courses = getStored("luxen_courses", []);
      if (!Array.isArray(courses)) courses = [];
      var delList = [];
      try {
        delList = JSON.parse(localStorage.getItem("luxen_deleted_courses") || "[]");
      } catch (e) {}

      // Clean up and remove any dummy or seed courses as well as permanently deleted courses
      var cleaned = courses.filter(function (c) {
        return (
          c &&
          c.id &&
          String(c.id).indexOf("crs_seed") === -1 &&
          String(c.id).indexOf("seed") === -1 &&
          delList.indexOf(String(c.id)) === -1
        );
      });
      if (cleaned.length !== courses.length) {
        setStored("luxen_courses", cleaned);
      }
      return cleaned;
    },

    saveCourses: function (list) {
      setStored("luxen_courses", list);
      this.render();
      this.updateCounts();
    },

    getSubscriptions: function () {
      return getStored("luxen_course_subscriptions", []);
    },

    saveSubscriptions: function (subs) {
      setStored("luxen_course_subscriptions", subs);
    },

    getLikes: function () {
      return getStored("luxen_course_likes", {});
    },

    saveLikes: function (likes) {
      setStored("luxen_course_likes", likes);
    },

    getBookmarks: function () {
      return getStored("luxen_course_bookmarks", []);
    },

    saveBookmarks: function (bms) {
      setStored("luxen_course_bookmarks", bms);
    },

    getComments: function () {
      return getStored("luxen_course_comments", []);
    },

    saveComments: function (comms) {
      setStored("luxen_course_comments", comms);
    },

    hasAccess: function (course) {
      if (!course.isPaid) return true;
      var user = getCurrentUser();
      if (!user) return false;
      if (user.isAdmin) return true;
      if (course.teacherId && (course.teacherId === user.id || course.teacherName === user.name)) return true;

      var subs = this.getSubscriptions();
      var id = user.username || user.email || user.id || "";
      return subs.some(function (s) {
        return (
          String(s.courseId) === String(course.id) &&
          (String(s.identifier).toLowerCase() === String(id).toLowerCase() ||
            String(s.username || "").toLowerCase() === String(user.username || "").toLowerCase() ||
            String(s.email || "").toLowerCase() === String(user.email || "").toLowerCase())
        );
      });
    },

    handleSearch: function (query) {
      this.searchQuery = (query || "").trim().toLowerCase();
      var clearBtn = document.getElementById("courses-search-clear");
      if (clearBtn) {
        clearBtn.style.display = this.searchQuery ? "block" : "none";
      }
      this.render();
    },

    clearSearch: function () {
      var input = document.getElementById("courses-search-input");
      if (input) input.value = "";
      this.handleSearch("");
    },

    setFilter: function (filter) {
      this.activeFilter = filter;
      document.querySelectorAll(".courses-filter-btn").forEach(function (btn) {
        if (btn.getAttribute("data-filter") === filter) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      this.render();
    },

    updateCounts: function () {
      var courses = this.getCourses();
      var freeCount = 0;
      var paidCount = 0;
      courses.forEach(function (c) {
        if (c.isPaid) paidCount++;
        else freeCount++;
      });

      var badge = document.getElementById("courses-count-badge");
      if (badge) badge.textContent = courses.length + " كورس";

      var elAll = document.getElementById("count-all-courses");
      if (elAll) elAll.textContent = courses.length;

      var elFree = document.getElementById("count-free-courses");
      if (elFree) elFree.textContent = freeCount;

      var elPaid = document.getElementById("count-paid-courses");
      if (elPaid) elPaid.textContent = paidCount;
    },

    render: function () {
      var container = document.getElementById("courses-grid");
      var emptyState = document.getElementById("courses-empty");
      if (!container) return;

      var courses = this.getCourses();
      var q = this.searchQuery;
      var f = this.activeFilter;

      var filtered = courses.filter(function (c) {
        if (f === "free" && c.isPaid) return false;
        if (f === "paid" && !c.isPaid) return false;

        if (q) {
          var matchTitle = (c.title || "").toLowerCase().indexOf(q) !== -1;
          var matchTeacher = (c.teacherName || "").toLowerCase().indexOf(q) !== -1;
          var matchCategory = (c.category || "").toLowerCase().indexOf(q) !== -1;
          var matchTags = (c.hashtags || "").toLowerCase().indexOf(q) !== -1;
          var matchDesc = (c.description || "").toLowerCase().indexOf(q) !== -1;
          if (!matchTitle && !matchTeacher && !matchCategory && !matchTags && !matchDesc) {
            return false;
          }
        }
        return true;
      });

      this.updateCounts();

      if (filtered.length === 0) {
        container.innerHTML = "";
        if (emptyState) emptyState.style.display = "block";
        return;
      }

      if (emptyState) emptyState.style.display = "none";

      var html = "";
      filtered.forEach(function (c) {
        var isPaid = !!c.isPaid;
        var badgeHtml = isPaid
          ? '<span class="course-badge-type course-badge-paid"><i class="fas fa-crown"></i> مدفوع</span>'
          : '<span class="course-badge-type course-badge-free"><i class="fas fa-check-circle"></i> مجاني</span>';

        var priceDisp = isPaid ? (c.price || "مدفوع") : "مجاني بالكامل";
        var priceClass = isPaid ? "course-price-disp" : "course-price-disp course-price-free";

        var tagsHtml = (c.hashtags || "")
          .split(" ")
          .filter(function (t) { return t.trim().length > 0; })
          .map(function (t) { return '<span class="course-hashtag">' + t + '</span>'; })
          .join("");

        var thumb = c.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80";
        var teacherInitial = (c.teacherName || "م")[0];

        var btnText = isPaid
          ? '<i class="fas fa-lock-open"></i> تفاصيل والاشتراك'
          : '<i class="fas fa-play"></i> مشاهدة الكورس';
        var btnClass = isPaid ? "course-action-btn course-btn-paid" : "course-action-btn course-btn-free";

        html +=
          '<div class="course-card" onclick="CoursesApp.openCourse(\'' + c.id + '\')">' +
            '<div class="course-thumb-box">' +
              '<img id="course-thumb-' + c.id + '" class="course-thumb-img" src="' + thumb + '" alt="' + (c.title || "") + '" loading="lazy" />' +
              badgeHtml +
              (c.category ? '<span class="course-category-badge">' + c.category + '</span>' : '') +
              '<div class="course-play-overlay"><div class="course-play-icon"><i class="fas fa-play"></i></div></div>' +
            '</div>' +
            '<div class="course-content">' +
              '<div class="course-teacher-row">' +
                '<div class="course-teacher-avatar">' + teacherInitial + '</div>' +
                '<span class="course-teacher-name">' + (c.teacherName || "مدرس معتمد") + '</span>' +
              '</div>' +
              '<h3 class="course-title">' + (c.title || "كورس بدون عنوان") + '</h3>' +
              '<p class="course-desc">' + (c.description || "لا يوجد وصف مختصر.") + '</p>' +
              '<div class="course-hashtags">' + tagsHtml + '</div>' +
              '<div class="course-footer-row">' +
                '<span class="' + priceClass + '">' + priceDisp + '</span>' +
                '<button type="button" class="' + btnClass + '">' + btnText + '</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        // Load IndexedDB image if stored locally
        CoursesMediaDB.getImageUrl(c.id).then(function (blobUrl) {
          if (blobUrl) {
            var imgEl = document.getElementById("course-thumb-" + c.id);
            if (imgEl) imgEl.src = blobUrl;
          }
        });
      });

      container.innerHTML = html;
    },

    openCourse: function (courseId) {
      var courses = this.getCourses();
      var course = courses.find(function (x) { return String(x.id) === String(courseId); });
      if (!course) return;

      this.currentViewingCourseId = course.id;

      if (course.isPaid && !this.hasAccess(course)) {
        this.renderLockedModal(course);
        return;
      }

      this.renderPlayerModal(course);
    },

    // Render Locked Screen for Paid Course with WhatsApp subscription button
    renderLockedModal: function (course) {
      var old = document.getElementById("course-locked-modal");
      if (old) old.remove();

      var user = getCurrentUser();
      var userName = user ? (user.name || user.username || "عضو في المنصة") : "طالب مهتم";
      var userEmail = user ? (user.email || user.username || "") : "";

      var rawMsg =
        "السلام عليكم أستاذ " + (course.teacherName || "") + "،\n" +
        "أريد الاشتراك في كورس: " + course.title + " (السعر: " + (course.price || "") + ").\n" +
        "بيانات حسابي في المنصة:\n" +
        "- الاسم: " + userName + "\n" +
        "- البريد / الحساب: " + userEmail + "\n" +
        "يرجى تفعيل الكورس لحسابي بعد الدفع.";

      var phone = (course.teacherPhone || "201012345678").replace(/[^0-9]/g, "");
      var waUrl = "https://wa.me/" + phone + "?text=" + encodeURIComponent(rawMsg);

      var modal = document.createElement("div");
      modal.id = "course-locked-modal";
      modal.className = "course-modal-overlay";
      modal.innerHTML =
        '<div class="course-locked-card" dir="rtl">' +
          '<div class="course-locked-icon"><i class="fas fa-lock"></i></div>' +
          '<h2 class="course-locked-title">' + course.title + '</h2>' +
          '<div style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 8px;">تقديم: <strong style="color:#e2e8f0;">' + (course.teacherName || "") + '</strong></div>' +
          '<div class="course-locked-price-tag">' + (course.price || "كورس مدفوع") + '</div>' +
          '<p class="course-locked-desc">' +
            'هذا الكورس محمي ويتطلب الاشتراك للمشاهدة. اضغط على الزر أدناه للتواصل مباشرة مع المدرس عبر الواتساب للاشتراك وتفعيل حسابك فوراً.' +
          '</p>' +
          '<a class="course-whatsapp-btn" href="' + waUrl + '" target="_blank" rel="noopener">' +
            '<i class="fab fa-whatsapp" style="font-size: 1.4rem;"></i> الاشتراك في الكورس عبر واتساب' +
          '</a>' +
          '<div class="course-locked-note">' +
            'بعد إتمام التحويل سيقوم المدرس بتفعيل الكورس لحسابك لتتمكن من فتحه ومشاهدته.' +
          '</div>' +
          '<button type="button" class="courses-back-btn" style="margin-top: 20px;" onclick="document.getElementById(\'course-locked-modal\').remove()">' +
            '<i class="fas fa-arrow-right"></i> رجوع للكورسات' +
          '</button>' +
        '</div>';

      document.body.appendChild(modal);
    },

    // Render Full Video Player Modal with uploaded video from device
    renderPlayerModal: function (course) {
      var old = document.getElementById("course-player-modal");
      if (old) old.remove();

      var allCourses = this.getCourses();
      var suggested = allCourses.filter(function (x) { return String(x.id) !== String(course.id); }).slice(0, 5);

      var likes = this.getLikes();
      var courseLikes = Array.isArray(likes[course.id]) ? likes[course.id] : [];
      var user = getCurrentUser();
      var userId = user ? (user.username || user.id) : null;
      var isLiked = userId && courseLikes.indexOf(userId) !== -1;

      var bookmarks = this.getBookmarks();
      var isBookmarked = bookmarks.indexOf(course.id) !== -1;

      // Suggested Videos HTML
      var suggestedHtml = suggested.map(function (s) {
        var sThumb = s.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80";
        return (
          '<div class="course-suggested-item" onclick="CoursesApp.openCourse(\'' + s.id + '\')">' +
            '<img class="course-suggested-thumb" src="' + sThumb + '" alt="' + s.title + '" loading="lazy" />' +
            '<div class="course-suggested-info">' +
              '<h4 class="course-suggested-title">' + s.title + '</h4>' +
              '<span class="course-suggested-author"><i class="fas fa-chalkboard-teacher"></i> ' + (s.teacherName || "") + '</span>' +
              '<span style="font-size: 0.7rem; color:' + (s.isPaid ? '#fbbf24' : '#10b981') + '; font-weight:700;">' + (s.isPaid ? s.price : 'مجاني') + '</span>' +
            '</div>' +
          '</div>'
        );
      }).join("");

      var modal = document.createElement("div");
      modal.id = "course-player-modal";
      modal.className = "course-modal-overlay";
      modal.innerHTML =
        '<div class="course-modal-container" dir="rtl">' +
          '<div class="course-modal-header">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
              '<button type="button" class="courses-back-btn" onclick="document.getElementById(\'course-player-modal\').remove()">' +
                '<i class="fas fa-arrow-right"></i> العودة للكورسات' +
              '</button>' +
              '<span style="font-size:0.9rem;color:#94a3b8;"><i class="fas fa-graduation-cap"></i> ' + (course.category || "كورس تعليمي") + '</span>' +
            '</div>' +
            '<button type="button" class="course-modal-close" onclick="document.getElementById(\'course-player-modal\').remove()">&times;</button>' +
          '</div>' +

          '<div class="course-viewer-layout">' +
            '<!-- Main Player Column -->' +
            '<div class="course-main-column">' +
              '<div class="course-video-wrapper">' +
                '<video id="course-active-player" controls autoplay playsinline style="width:100%;height:100%;background:#000;"></video>' +
              '</div>' +
              '<div class="course-meta-box">' +
                '<h2 style="margin:0 0 8px; font-size:1.3rem; color:#fff;">' + course.title + '</h2>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
                  '<div class="course-teacher-row" style="margin:0;">' +
                    '<div class="course-teacher-avatar">' + (course.teacherName || "م")[0] + '</div>' +
                    '<span class="course-teacher-name" style="font-size:0.95rem;color:#f1f5f9;">' + (course.teacherName || "مدرس معتمد") + '</span>' +
                  '</div>' +
                  '<span style="font-size:0.85rem;color:#94a3b8;">' + (course.isPaid ? '<strong style="color:#fbbf24;">مدفوع (' + course.price + ')</strong>' : '<strong style="color:#10b981;">مجاني</strong>') + '</span>' +
                '</div>' +

                '<!-- Interactive Actions Bar (لايك، حفظ، مشاركة) -->' +
                '<div class="course-meta-actions">' +
                  '<button type="button" id="course-like-btn" class="course-action-pill ' + (isLiked ? 'active' : '') + '" onclick="CoursesApp.toggleLike(\'' + course.id + '\')">' +
                    '<i class="' + (isLiked ? 'fas' : 'far') + ' fa-heart"></i> <span id="course-like-count">' + courseLikes.length + '</span> إعجاب' +
                  '</button>' +
                  '<button type="button" id="course-bookmark-btn" class="course-action-pill ' + (isBookmarked ? 'bookmarked' : '') + '" onclick="CoursesApp.toggleBookmark(\'' + course.id + '\')">' +
                    '<i class="' + (isBookmarked ? 'fas' : 'far') + ' fa-bookmark"></i> <span>' + (isBookmarked ? 'محفوظ' : 'حفظ الكورس') + '</span>' +
                  '</button>' +
                  '<button type="button" class="course-action-pill" onclick="CoursesApp.shareCourse(\'' + course.id + '\')">' +
                    '<i class="fas fa-share-nodes"></i> مشاركة' +
                  '</button>' +
                '</div>' +

                '<p style="font-size:0.95rem;color:#cbd5e1;line-height:1.7;margin:0 0 12px;">' + (course.description || "") + '</p>' +
                '<div style="color:#60a5fa;font-size:0.85rem;font-weight:600;">' + (course.hashtags || "") + '</div>' +

                '<!-- Comments Section -->' +
                '<div class="course-comments-section">' +
                  '<div class="course-comments-head">' +
                    '<i class="far fa-comments"></i> التعليقات والأسئلة' +
                  '</div>' +
                  '<div class="course-comment-input-box">' +
                    '<input type="text" id="course-comment-text" class="course-comment-input" placeholder="اكتب تعليقك أو سؤالك حول هذا الكورس..." onkeydown="if(event.key===\'Enter\') CoursesApp.addComment(\'' + course.id + '\')" />' +
                    '<button type="button" class="course-comment-send-btn" onclick="CoursesApp.addComment(\'' + course.id + '\')"><i class="fas fa-paper-plane"></i> إرسال</button>' +
                  '</div>' +
                  '<div id="course-comments-container" class="course-comments-list"></div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<!-- Suggested Videos Sidebar (قائمة الفيديوهات المقترحة) -->' +
            '<div class="course-suggested-sidebar">' +
              '<h3 class="course-suggested-head"><i class="fas fa-list-ul" style="color:#3b82f6;"></i> فيديوهات وكورسات مقترحة</h3>' +
              '<div class="course-suggested-list">' + (suggestedHtml || '<div style="color:#64748b;font-size:0.85rem;">لا توجد فيديوهات مقترحة إضافية حالياً.</div>') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(modal);

      // Load native video into <video> player
      var playerEl = document.getElementById("course-active-player");
      CoursesMediaDB.getVideoUrl(course.id).then(function (blobUrl) {
        if (blobUrl) {
          playerEl.src = blobUrl;
        } else if (course.videoUrl) {
          playerEl.src = course.videoUrl;
        }
      });

      this.renderCommentsList(course.id);
    },

    toggleLike: function (courseId) {
      var user = getCurrentUser();
      if (!user) {
        alert("يرجى تسجيل الدخول أولاً للإعجاب بالكورس.");
        return;
      }
      var userId = user.username || user.id;
      var likes = this.getLikes();
      if (!Array.isArray(likes[courseId])) likes[courseId] = [];

      var idx = likes[courseId].indexOf(userId);
      if (idx !== -1) {
        likes[courseId].splice(idx, 1);
      } else {
        likes[courseId].push(userId);
      }

      this.saveLikes(likes);

      var btn = document.getElementById("course-like-btn");
      var count = document.getElementById("course-like-count");
      if (btn && count) {
        var isNowLiked = likes[courseId].indexOf(userId) !== -1;
        btn.className = "course-action-pill " + (isNowLiked ? "active" : "");
        btn.querySelector("i").className = (isNowLiked ? "fas" : "far") + " fa-heart";
        count.textContent = likes[courseId].length;
      }
    },

    toggleBookmark: function (courseId) {
      var bookmarks = this.getBookmarks();
      var idx = bookmarks.indexOf(courseId);
      if (idx !== -1) {
        bookmarks.splice(idx, 1);
      } else {
        bookmarks.push(courseId);
      }
      this.saveBookmarks(bookmarks);

      var btn = document.getElementById("course-bookmark-btn");
      if (btn) {
        var isBm = bookmarks.indexOf(courseId) !== -1;
        btn.className = "course-action-pill " + (isBm ? "bookmarked" : "");
        btn.querySelector("i").className = (isBm ? "fas" : "far") + " fa-bookmark";
        btn.querySelector("span").textContent = isBm ? "محفوظ" : "حفظ الكورس";
      }
    },

    shareCourse: function (courseId) {
      var url = window.location.origin + window.location.pathname + "?view=courses&courseId=" + courseId;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          alert("تم نسخ رابط الكورس بنجاح!");
        });
      } else {
        prompt("انسخ الرابط التالي:", url);
      }
    },

    addComment: function (courseId) {
      var input = document.getElementById("course-comment-text");
      if (!input) return;
      var text = input.value.trim();
      if (!text) return;

      var user = getCurrentUser();
      var authorName = user ? (user.name || user.username || "عضو") : "زائر";

      var comments = this.getComments();
      comments.unshift({
        id: "cc_" + Date.now(),
        courseId: courseId,
        author: authorName,
        text: text,
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) + " · اليوم",
      });

      this.saveComments(comments);
      input.value = "";
      this.renderCommentsList(courseId);
    },

    renderCommentsList: function (courseId) {
      var container = document.getElementById("course-comments-container");
      if (!container) return;

      var comments = this.getComments().filter(function (c) {
        return String(c.courseId) === String(courseId);
      });

      if (comments.length === 0) {
        container.innerHTML = '<div style="color:#64748b;font-size:0.85rem;padding:8px 0;">كن أول من يكتب تعليقاً على هذا الكورس!</div>';
        return;
      }

      container.innerHTML = comments.map(function (c) {
        return (
          '<div class="course-comment-card">' +
            '<div class="course-comment-header">' +
              '<span class="course-comment-author">' + c.author + '</span>' +
              '<span class="course-comment-time">' + c.time + '</span>' +
            '</div>' +
            '<p class="course-comment-text">' + c.text + '</p>' +
          '</div>'
        );
      }).join("");
    }
  };

  // =========================================================================
  // Teacher App (لوحة تحكم المدرس ورفع الفيديوهات من الجهاز ومتابعة الكورسات)
  // =========================================================================
  var TeacherApp = {
    pendingVideoFile: null,
    pendingImageFile: null,

    init: function (user) {
      if (!user) user = getCurrentUser();
      this.renderDashboard(user);
    },

    renderDashboard: function (user) {
      var teacherName = (user && (user.teacherName || user.name || user.username)) || "أستاذ";
      var nameEl = document.getElementById("teacher-profile-name");
      if (nameEl) nameEl.textContent = teacherName;

      this.updateTeacherStats(user);
      this.renderTeacherCourses(user);
      this.populateCourseSelect(user);
      this.renderSubscribersList();
    },

    updateTeacherStats: function (user) {
      var teacherName = (user && (user.teacherName || user.name || user.username)) || "";
      var allCourses = CoursesApp.getCourses();
      var teacherCourses = allCourses.filter(function (c) {
        return c.teacherId === user?.id || c.teacherName === teacherName;
      });

      var freeCount = 0;
      var paidCount = 0;
      var totalLikes = 0;
      var likesData = CoursesApp.getLikes();

      teacherCourses.forEach(function (c) {
        if (c.isPaid) paidCount++;
        else freeCount++;
        if (Array.isArray(likesData[c.id])) {
          totalLikes += likesData[c.id].length;
        }
      });

      var subs = CoursesApp.getSubscriptions();
      var teacherSubsCount = subs.filter(function (s) {
        return teacherCourses.some(function (c) { return String(c.id) === String(s.courseId); });
      }).length;

      var totalEl = document.getElementById("teacher-stat-total-courses");
      if (totalEl) totalEl.textContent = teacherCourses.length;

      var subsEl = document.getElementById("teacher-stat-subscribers");
      if (subsEl) subsEl.textContent = teacherSubsCount;

      var likesEl = document.getElementById("teacher-stat-likes");
      if (likesEl) likesEl.textContent = totalLikes;

      var typeEl = document.getElementById("teacher-stat-type-breakdown");
      if (typeEl) typeEl.textContent = freeCount + " مجاني / " + paidCount + " مدفوع";
    },

    toggleAddCourseForm: function () {
      var card = document.getElementById("teacher-add-course-form-card");
      if (!card) return;
      card.style.display = card.style.display === "none" ? "block" : "none";
      if (card.style.display === "block") {
        card.scrollIntoView({ behavior: "smooth" });
      }
    },

    handlePriceTypeChange: function () {
      var isPaid = document.getElementById("teacher-course-paid-radio")?.checked;
      var priceBox = document.getElementById("teacher-course-price-box");
      if (priceBox) {
        priceBox.style.display = isPaid ? "block" : "none";
      }
    },

    // Handle video chosen from user's device
    onVideoSelected: function (input) {
      var file = input.files && input.files[0];
      if (!file) return;

      this.pendingVideoFile = file;
      var statusBox = document.getElementById("teacher-video-upload-box");
      var infoText = document.getElementById("teacher-video-info-text");

      if (infoText) {
        infoText.innerHTML =
          '<i class="fas fa-check-circle" style="color:#10b981;"></i> تم اختيار الفيديو: <strong>' +
          file.name +
          '</strong> (' +
          formatBytes(file.size) +
          ')';
      }
      if (statusBox) {
        statusBox.style.borderColor = "#10b981";
      }
    },

    // Handle image chosen from user's device
    onThumbSelected: function (input) {
      var file = input.files && input.files[0];
      if (!file) return;

      this.pendingImageFile = file;
      var previewBox = document.getElementById("teacher-thumb-preview-box");
      var previewImg = document.getElementById("teacher-thumb-preview-img");

      if (previewBox && previewImg) {
        previewImg.src = URL.createObjectURL(file);
        previewBox.style.display = "block";
      }
    },

    submitCourse: function (event) {
      if (event) event.preventDefault();

      var self = this;
      var user = getCurrentUser();
      var teacherName = (user && (user.teacherName || user.name || user.username)) || "مدرس معتمد";
      var teacherPhone = (user && user.phone) || "";

      var title = (document.getElementById("teacher-course-title")?.value || "").trim();
      var category = document.getElementById("teacher-course-category")?.value || "برمجة وتطوير";
      var hashtags = (document.getElementById("teacher-course-hashtags")?.value || "").trim();
      var description = (document.getElementById("teacher-course-desc")?.value || "").trim();
      var isPaid = document.getElementById("teacher-course-paid-radio")?.checked || false;
      var price = (document.getElementById("teacher-course-price")?.value || "").trim();
      var phoneInput = (document.getElementById("teacher-course-phone")?.value || "").trim();

      if (!title) {
        alert("يرجى كتابة اسم الكورس.");
        return;
      }
      if (!self.pendingVideoFile) {
        alert("يرجى رفع ملف الفيديو من جهازك.");
        return;
      }
      if (isPaid && !price) {
        alert("يرجى كتابة سعر الكورس المدفوع.");
        return;
      }

      var courseId = "crs_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

      var newCourse = {
        id: courseId,
        title: title,
        teacherId: user ? user.id : "teacher",
        teacherName: teacherName,
        teacherPhone: phoneInput || teacherPhone || "201012345678",
        videoFileName: self.pendingVideoFile.name,
        videoSizeText: formatBytes(self.pendingVideoFile.size),
        videoUrl: "",
        thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
        category: category,
        hashtags: hashtags,
        description: description,
        isPaid: isPaid,
        price: isPaid ? (price.indexOf("ج.م") === -1 && price.indexOf("جنيه") === -1 ? price + " ج.م" : price) : "0",
        createdAt: Date.now()
      };

      // Save binary video file into IndexedDB
      CoursesMediaDB.saveVideo(courseId, self.pendingVideoFile, self.pendingVideoFile.name).then(function () {
        if (self.pendingImageFile) {
          return CoursesMediaDB.saveImage(courseId, self.pendingImageFile, self.pendingImageFile.name);
        }
        return true;
      }).then(function () {
        var list = CoursesApp.getCourses();
        list.unshift(newCourse);
        CoursesApp.saveCourses(list);

        alert("تم رفع ونشر الكورس بنجاح من جهازك!");

        // Reset form
        self.pendingVideoFile = null;
        self.pendingImageFile = null;
        document.getElementById("teacher-add-course-form")?.reset();
        var infoText = document.getElementById("teacher-video-info-text");
        if (infoText) infoText.innerHTML = "اضغط لاختيار ملف الفيديو من جهازك (MP4, WebM, MOV)";
        var previewBox = document.getElementById("teacher-thumb-preview-box");
        if (previewBox) previewBox.style.display = "none";

        self.toggleAddCourseForm();
        self.renderDashboard(user);
      });
    },

    // Render Published Courses with Full Tracking (المشاهدة والمشتركين والحذف)
    renderTeacherCourses: function (user) {
      var container = document.getElementById("teacher-courses-list");
      if (!container) return;

      var teacherName = (user && (user.teacherName || user.name || user.username)) || "";
      var courses = CoursesApp.getCourses().filter(function (c) {
        return c.teacherId === user?.id || c.teacherName === teacherName;
      });

      if (courses.length === 0) {
        container.innerHTML =
          '<div style="grid-column: 1/-1; color:#64748b; text-align:center; padding:32px; background:rgba(255,255,255,0.02); border-radius:16px;">' +
            '<i class="fas fa-video-slash" style="font-size:2.5rem; margin-bottom:12px; display:block;"></i>' +
            'لم تقم بنشر أي كورسات حتى الآن. اضغط على زر "إضافة كورس جديد" بالأعلى لرفع أول كورس من جهازك.' +
          '</div>';
        return;
      }

      var likesData = CoursesApp.getLikes();
      var commentsData = CoursesApp.getComments();
      var subsData = CoursesApp.getSubscriptions();

      container.innerHTML = courses.map(function (c) {
        var likesCount = Array.isArray(likesData[c.id]) ? likesData[c.id].length : 0;
        var commsCount = commentsData.filter(function (x) { return String(x.courseId) === String(c.id); }).length;
        var subsCount = subsData.filter(function (x) { return String(x.courseId) === String(c.id); }).length;

        var sizeInfo = c.videoSizeText ? '<span style="font-size:0.75rem; color:#94a3b8;"><i class="fas fa-file-video"></i> ' + c.videoSizeText + '</span>' : '';

        return (
          '<div class="course-card" style="cursor:default;">' +
            '<div class="course-thumb-box">' +
              '<img id="teacher-card-thumb-' + c.id + '" class="course-thumb-img" src="' + (c.thumbnail || '') + '" alt="' + c.title + '" />' +
              (c.isPaid
                ? '<span class="course-badge-type course-badge-paid"><i class="fas fa-crown"></i> مدفوع (' + c.price + ')</span>'
                : '<span class="course-badge-type course-badge-free"><i class="fas fa-check-circle"></i> مجاني</span>') +
              (c.category ? '<span class="course-category-badge">' + c.category + '</span>' : '') +
            '</div>' +
            '<div class="course-content">' +
              '<h3 class="course-title">' + c.title + '</h3>' +
              '<p class="course-desc">' + (c.description || "") + '</p>' +

              '<!-- Course Monitoring Statistics Bar -->' +
              '<div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:10px; margin:8px 0; font-size:0.8rem;">' +
                '<span style="color:#fbbf24;"><i class="fas fa-users"></i> ' + (c.isPaid ? subsCount + ' مشترك' : 'متاح للجميع') + '</span>' +
                '<span style="color:#f87171;"><i class="fas fa-heart"></i> ' + likesCount + ' إعجاب</span>' +
                '<span style="color:#60a5fa;"><i class="fas fa-comment"></i> ' + commsCount + ' تعليق</span>' +
              '</div>' +

              '<div style="margin-bottom:8px;">' + sizeInfo + '</div>' +

              '<div class="course-footer-row">' +
                '<button type="button" class="courses-back-btn" style="padding:6px 14px; font-size:0.85rem;" onclick="CoursesApp.openCourse(\'' + c.id + '\')">' +
                  '<i class="fas fa-play"></i> تشغيل' +
                '</button>' +
                (c.isPaid
                  ? '<button type="button" class="course-action-btn course-btn-paid" style="padding:6px 12px; font-size:0.8rem;" onclick="TeacherApp.jumpToActivateCourse(\'' + c.id + '\')"><i class="fas fa-user-plus"></i> تفعيل مشترك</button>'
                  : '') +
                '<button type="button" class="courses-action-btn" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:6px 12px; border-radius:8px; cursor:pointer;" onclick="TeacherApp.deleteCourse(\'' + c.id + '\')">' +
                  '<i class="fas fa-trash"></i>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join("");

      // Load local thumbnail blobs
      courses.forEach(function (c) {
        CoursesMediaDB.getImageUrl(c.id).then(function (blobUrl) {
          if (blobUrl) {
            var imgEl = document.getElementById("teacher-card-thumb-" + c.id);
            if (imgEl) imgEl.src = blobUrl;
          }
        });
      });
    },

    jumpToActivateCourse: function (courseId) {
      var select = document.getElementById("teacher-activate-course-select");
      if (select) {
        select.value = courseId;
        select.scrollIntoView({ behavior: "smooth" });
      }
    },

    deleteCourse: function (courseId) {
      if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الكورس نهائياً؟")) return;
      var delBlacklist = [];
      try {
        delBlacklist = JSON.parse(localStorage.getItem("luxen_deleted_courses") || "[]");
      } catch (e) {}
      if (delBlacklist.indexOf(courseId) === -1) {
        delBlacklist.push(courseId);
        localStorage.setItem("luxen_deleted_courses", JSON.stringify(delBlacklist));
      }

      var list = CoursesApp.getCourses().filter(function (c) { return String(c.id) !== String(courseId); });
      CoursesApp.saveCourses(list);
      CoursesMediaDB.deleteMedia(courseId);

      fetch("/api/public/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "luxen_courses",
          value: list,
          deletedIds: [courseId]
        })
      }).catch(function (e) {
        console.warn("[Teacher] Course delete sync", e);
      });

      var user = getCurrentUser();
      this.renderDashboard(user);
    },

    populateCourseSelect: function (user) {
      var select = document.getElementById("teacher-activate-course-select");
      if (!select) return;
      var teacherName = (user && (user.teacherName || user.name || user.username)) || "";
      var paidCourses = CoursesApp.getCourses().filter(function (c) {
        return c.isPaid && (c.teacherId === user?.id || c.teacherName === teacherName || user?.isAdmin);
      });

      if (paidCourses.length === 0) {
        select.innerHTML = '<option value="">لا توجد كورسات مدفوعة منشورة حالياً</option>';
        return;
      }

      select.innerHTML = paidCourses.map(function (c) {
        return '<option value="' + c.id + '">' + c.title + ' (' + c.price + ')</option>';
      }).join("");
    },

    activateSubscriber: function () {
      var select = document.getElementById("teacher-activate-course-select");
      var courseId = select ? select.value : "";
      var userInput = (document.getElementById("teacher-subscriber-input")?.value || "").trim();

      if (!courseId) {
        alert("يرجى اختيار الكورس المدفوع المراد التفعيل له.");
        return;
      }
      if (!userInput) {
        alert("يرجى كتابة اسم المستخدم أو البريد الإلكتروني للمشترك.");
        return;
      }

      var courses = CoursesApp.getCourses();
      var course = courses.find(function (c) { return String(c.id) === String(courseId); });
      var courseTitle = course ? course.title : "كورس";

      var subs = CoursesApp.getSubscriptions();
      var already = subs.find(function (s) {
        return String(s.courseId) === String(courseId) && String(s.identifier).toLowerCase() === userInput.toLowerCase();
      });

      if (already) {
        alert("هذا الحساب مفعل له الكورس بالفعل!");
        return;
      }

      var user = getCurrentUser();
      subs.unshift({
        id: "sub_" + Date.now(),
        courseId: courseId,
        courseTitle: courseTitle,
        identifier: userInput,
        activatedAt: new Date().toLocaleDateString("ar-EG") + " " + new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        activatedBy: user ? (user.name || user.username) : "المدرس"
      });

      CoursesApp.saveSubscriptions(subs);
      document.getElementById("teacher-subscriber-input").value = "";
      this.renderSubscribersList();
      this.updateTeacherStats(user);
      alert("تم تفعيل الكورس بنجاح للحساب: " + userInput);
    },

    renderSubscribersList: function () {
      var container = document.getElementById("teacher-subscribers-list");
      if (!container) return;

      var subs = CoursesApp.getSubscriptions();
      if (subs.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:16px;">لا يوجد مشتركون مفعلون حالياً.</td></tr>';
        return;
      }

      container.innerHTML = subs.map(function (s) {
        return (
          '<tr>' +
            '<td><strong style="color:#60a5fa;">' + s.identifier + '</strong></td>' +
            '<td>' + s.courseTitle + '</td>' +
            '<td><span style="font-size:0.8rem;color:#94a3b8;">' + s.activatedAt + '</span></td>' +
            '<td>' +
              '<button type="button" style="background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.4);padding:4px 10px;border-radius:6px;cursor:pointer;" onclick="TeacherApp.removeSubscriber(\'' + s.id + '\')">' +
                '<i class="fas fa-user-xmark"></i> إلغاء' +
              '</button>' +
            '</td>' +
          '</tr>'
        );
      }).join("");
    },

    removeSubscriber: function (subId) {
      if (!confirm("هل تريد إلغاء تفعيل هذا المشترك؟")) return;
      var subs = CoursesApp.getSubscriptions().filter(function (s) { return String(s.id) !== String(subId); });
      CoursesApp.saveSubscriptions(subs);
      this.renderSubscribersList();
      var user = getCurrentUser();
      this.updateTeacherStats(user);
    }
  };

  // =========================================================================
  // Admin Teachers Management (قسم إنشاء حسابات المدرسين للمدير)
  // =========================================================================
  var AdminTeachersApp = {
    init: function () {
      this.renderTeachersList();
    },

    createTeacherAccount: function (event) {
      if (event) event.preventDefault();

      var name = (document.getElementById("adm-teacher-name")?.value || "").trim();
      var email = (document.getElementById("adm-teacher-email")?.value || "").trim();
      var password = (document.getElementById("adm-teacher-password")?.value || "").trim();
      var phone = (document.getElementById("adm-teacher-phone")?.value || "").trim();
      var active = document.getElementById("adm-teacher-active")?.checked ?? true;

      if (!name) {
        alert("يرجى كتابة اسم المدرس.");
        return;
      }
      if (!email) {
        alert("يرجى كتابة البريد الإلكتروني للمدرس.");
        return;
      }
      if (!password || password.length < 8) {
        alert("كلمة المرور يجب ألا تقل عن 8 أحرف.");
        return;
      }
      if (!phone) {
        alert("يرجى كتابة رقم الهاتف / واتساب للتواصل مع المدرس.");
        return;
      }

      var users = [];
      try {
        users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      } catch (e) {}

      var exists = users.some(function (u) {
        return (
          (u.username && u.username.toLowerCase() === email.toLowerCase()) ||
          (u.email && u.email.toLowerCase() === email.toLowerCase())
        );
      });

      if (exists) {
        alert("هذا البريد أو اسم المستخدم مسجل مسبقاً لمستخدم آخر.");
        return;
      }

      var teacherUser = {
        id: "teacher_" + Date.now(),
        username: email,
        email: email,
        fullName: name,
        teacherName: name,
        phone: phone,
        password: password,
        isAdmin: false,
        isTeacher: true,
        customRoleTitle: "مدرس معتمد",
        isActive: active,
        isOnline: false,
        join_date: new Date().toLocaleDateString("ar-EG"),
        join_timestamp: Date.now()
      };

      users.push(teacherUser);
      localStorage.setItem("luxen_all_users", JSON.stringify(users));

      document.getElementById("adminTeacherForm")?.reset();
      if (document.getElementById("adm-teacher-active")) {
        document.getElementById("adm-teacher-active").checked = true;
      }

      this.renderTeachersList();
      alert("تم إنشاء حساب المدرس (" + name + ") بنجاح! يمكن للمدرس الآن تسجيل الدخول مباشرة.");
    },

    renderTeachersList: function () {
      var container = document.getElementById("admin-teachers-tbody");
      var badge = document.getElementById("admin-nav-teachers-badge");
      if (!container) return;

      var delBlacklist = [];
      try {
        delBlacklist = JSON.parse(localStorage.getItem("luxen_deleted_teachers") || "[]");
      } catch (e) {}

      var users = [];
      try {
        users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      } catch (e) {}

      if (delBlacklist.length > 0) {
        var cleanUsers = users.filter(function (u) {
          return delBlacklist.indexOf(u.id) === -1 &&
            delBlacklist.indexOf(u.username) === -1 &&
            delBlacklist.indexOf(u.email) === -1;
        });
        if (cleanUsers.length !== users.length) {
          users = cleanUsers;
          localStorage.setItem("luxen_all_users", JSON.stringify(users));
        }
      }

      var teachers = users.filter(function (u) { return !!u.isTeacher; });

      if (badge) badge.textContent = teachers.length;

      if (teachers.length === 0) {
        container.innerHTML =
          '<tr><td colspan="5" style="text-align:center;padding:24px;color:#64748b;">لا توجد حسابات مدرسين مسجلة حتى الآن. استخدم النموذج أعلاه لإنشاء حساب مدرس جديد.</td></tr>';
        return;
      }

      var courses = CoursesApp.getCourses();

      container.innerHTML = teachers.map(function (t) {
        var teacherCoursesCount = courses.filter(function (c) {
          return c.teacherId === t.id || c.teacherName === (t.teacherName || t.fullName);
        }).length;

        var statusPill = t.isActive !== false
          ? '<span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:4px 10px;border-radius:999px;font-size:0.75rem;font-weight:700;"><i class="fas fa-check-circle"></i> مفعل</span>'
          : '<span style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:4px 10px;border-radius:999px;font-size:0.75rem;font-weight:700;"><i class="fas fa-ban"></i> غير مفعل</span>';

        return (
          '<tr>' +
            '<td><strong style="color:#ffffff;">' + (t.teacherName || t.fullName || t.username) + '</strong></td>' +
            '<td><span style="color:#94a3b8;font-size:0.85rem;">' + (t.email || t.username) + '</span></td>' +
            '<td><span style="color:#38bdf8;font-size:0.85rem;" dir="ltr">' + (t.phone || "-") + '</span></td>' +
            '<td>' + statusPill + ' · <span style="font-size:0.8rem;color:#64748b;">' + teacherCoursesCount + ' كورس</span></td>' +
            '<td>' +
              '<div style="display:flex;gap:6px;">' +
                '<button type="button" style="background:rgba(255,255,255,0.08);color:#cbd5e1;border:1px solid rgba(255,255,255,0.15);padding:4px 10px;border-radius:8px;font-size:0.8rem;cursor:pointer;" onclick="AdminTeachersApp.toggleTeacherActive(\'' + t.id + '\')">' +
                  (t.isActive !== false ? '<i class="fas fa-pause"></i> تعطيل' : '<i class="fas fa-play"></i> تفعيل') +
                '</button>' +
                '<button type="button" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:4px 10px;border-radius:8px;font-size:0.8rem;cursor:pointer;" onclick="AdminTeachersApp.deleteTeacher(\'' + t.id + '\')">' +
                  '<i class="fas fa-trash"></i>' +
                '</button>' +
              '</div>' +
            '</td>' +
          '</tr>'
        );
      }).join("");
    },

    toggleTeacherActive: function (teacherId) {
      var users = [];
      try {
        users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      } catch (e) {}

      var t = users.find(function (u) { return u.id === teacherId; });
      if (!t) return;

      t.isActive = t.isActive === false ? true : false;
      localStorage.setItem("luxen_all_users", JSON.stringify(users));
      this.renderTeachersList();
    },

    deleteTeacher: function (teacherId) {
      if (!confirm("هل أنت متأكد من رغبتك في حذف حساب هذا المدرس نهائياً من قاعدة البيانات؟ لن يعود الحساب مجدداً.")) return;
      var users = [];
      try {
        users = JSON.parse(localStorage.getItem("luxen_all_users") || "[]");
      } catch (e) {}

      var teacherToDelete = users.find(function (u) { return u.id === teacherId; });
      var deletedIds = [teacherId];
      if (teacherToDelete) {
        if (teacherToDelete.username) deletedIds.push(teacherToDelete.username);
        if (teacherToDelete.email) deletedIds.push(teacherToDelete.email);
      }

      // 1. تسجيل المعرفات في القائمة السوداء الدائمة لمنع استرجاع الحساب من أي كاش قديم
      var delBlacklist = [];
      try {
        delBlacklist = JSON.parse(localStorage.getItem("luxen_deleted_teachers") || "[]");
      } catch (e) {}
      deletedIds.forEach(function (dId) {
        if (delBlacklist.indexOf(dId) === -1) delBlacklist.push(dId);
      });
      localStorage.setItem("luxen_deleted_teachers", JSON.stringify(delBlacklist));

      // 2. تصفية الحساب محلياً
      users = users.filter(function (u) {
        if (u.id === teacherId) return false;
        if (teacherToDelete && ((u.username && u.username === teacherToDelete.username) || (u.email && u.email === teacherToDelete.email))) return false;
        return true;
      });
      localStorage.setItem("luxen_all_users", JSON.stringify(users));

      // 3. مسح الحساب نهائياً من قاعدة البيانات في السيرفر عبر تمرير deletedIds
      fetch("/api/public/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "luxen_all_users",
          value: users,
          deletedIds: deletedIds
        })
      }).then(function () {
        console.log("[Admin] Teacher permanently deleted from server store:", deletedIds);
      }).catch(function (err) {
        console.warn("[Admin] Delete sync notice:", err);
      });

      this.renderTeachersList();
    }
  };

  // Expose to window
  window.CoursesApp = CoursesApp;
  window.TeacherApp = TeacherApp;
  window.AdminTeachersApp = AdminTeachersApp;
  window.CoursesMediaDB = CoursesMediaDB;

  // Auto initialize on DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    CoursesApp.updateCounts();
    CoursesApp.render();
    if (window.AdminTeachersApp && typeof AdminTeachersApp.init === "function") {
      AdminTeachersApp.init();
    }
    if (window.TeacherApp && typeof TeacherApp.init === "function") {
      TeacherApp.init();
    }
  });

  // Also listen for elevate sync complete event to re-render fresh data
  window.addEventListener("elevate_sync_complete", function () {
    CoursesApp.updateCounts();
    CoursesApp.render();
    if (window.AdminTeachersApp && typeof AdminTeachersApp.renderTeachersList === "function") {
      AdminTeachersApp.renderTeachersList();
    }
    if (window.TeacherApp && typeof TeacherApp.render === "function") {
      TeacherApp.render();
    }
  });

})(window, document);
