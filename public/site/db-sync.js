/* Elevate Real Database Sync Layer
   Keeps all shared site data exclusively on the server database.
   The browser does NOT store site data or users in localStorage.
   All shared data lives in memory and syncs directly with the server SQL database. */
(function () {
  var KEYS = [
    "luxen_general_cards",
    "luxen_partners",
    "luxen_comments",
    "luxen_likes",
    "luxen_all_users",
    "luxen_notifications",
    "luxen_category_status",
    "luxen_views",
    "luxen_submissions",
    "luxen_votes",
    "luxen_settings",
    "luxen_live_joins",
    "luxen_video_likes",
    "luxen_video_views",
    "luxen_faq",
    "luxen_qna",
    "luxen_reset_requests",
    "luxen_app_installs",
    "luxen_courses",
    "luxen_course_comments",
    "luxen_course_likes",
    "luxen_course_bookmarks",
    "luxen_course_subscriptions",
    "luxen_community_messages",
    "luxen_private_chats",
    "luxen_shorts_videos",
    "luxen_contests_state",
    "luxen_contests_applicants",
  ];
  var API = "/api/public/store";
  var sharedStore = {};
  var pending = {};
  var inflight = {};
  var dirty = {};
  var failures = 0;
  var isReady = false;
  var readyCallbacks = [];

  var proto = window.Storage.prototype;
  var nativeGet = proto.getItem;
  var nativeSet = proto.setItem;
  var nativeRemove = proto.removeItem;

  function isSharedKey(key) {
    return KEYS.indexOf(key) !== -1;
  }

  function getAdminToken() {
    try {
      var tok =
        localStorage.getItem("ns_admin_token") ||
        localStorage.getItem("ns_backup_token") ||
        localStorage.getItem("ns_token") ||
        "";
      if (!tok || !tok.startsWith("adm_")) {
        var u = JSON.parse(localStorage.getItem("ns_user") || "null");
        if (u && u.isAdmin) {
          tok = u.adminToken || u.auth_token || "adm_admin_master";
        }
      }
      return tok;
    } catch (e) {
      return "";
    }
  }

  // Clean out historical shared data from localStorage so the browser stays completely clean
  try {
    KEYS.forEach(function (key) {
      nativeRemove.call(window.localStorage, key);
      nativeRemove.call(window.localStorage, "__elevate_cache__" + key);
    });
  } catch (e) {}

  function applyServerStore(store) {
    if (!store || typeof store !== "object") return false;
    var hasChanges = false;
    KEYS.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(store, k) && store[k] !== null && store[k] !== undefined) {
        var raw = JSON.stringify(store[k]);
        if (dirty[k] && Array.isArray(store[k])) {
          var localArr = [];
          try {
            localArr = JSON.parse(sharedStore[k] || "[]");
          } catch (e) {}
          if (Array.isArray(localArr)) {
            var merged = localArr.slice();
            store[k].forEach(function (sItem) {
              if (!sItem) return;
              var sId = sItem.id || sItem.username || sItem.email;
              var exists = merged.some(function (lItem) {
                return lItem && (lItem.id === sId || lItem.username === sId || lItem.email === sId);
              });
              if (!exists) merged.push(sItem);
            });
            var rawMerged = JSON.stringify(merged);
            if (sharedStore[k] !== rawMerged) {
              sharedStore[k] = rawMerged;
              hasChanges = true;
            }
            return;
          }
        }
        if (dirty[k]) return;
        if (sharedStore[k] !== raw) {
          sharedStore[k] = raw;
          hasChanges = true;
        }
      } else if (!dirty[k] && Object.prototype.hasOwnProperty.call(sharedStore, k)) {
        delete sharedStore[k];
        hasChanges = true;
      }
    });
    return hasChanges;
  }

  function triggerReady() {
    isReady = true;
    if (window.ElevateDB) window.ElevateDB.isReady = true;
    while (readyCallbacks.length) {
      var cb = readyCallbacks.shift();
      try {
        cb();
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent("elevate_db_ready"));
    window.dispatchEvent(new CustomEvent("elevate_sync_complete"));
    rerender();
  }

  function pullInitialStore() {
    var headers = {};
    var tok = getAdminToken();
    if (tok) headers["x-admin-token"] = tok;

    fetch(API + "?t=" + Date.now(), { cache: "no-store", headers: headers })
      .then(function (res) {
        if (res.ok) return res.json();
        throw new Error("HTTP " + res.status);
      })
      .then(function (payload) {
        applyServerStore((payload && payload.data) || {});
        triggerReady();
      })
      .catch(function (e) {
        console.warn("[Elevate Database] Initial pull notice:", e);
        triggerReady();
      });
  }
  pullInitialStore();

  // Persist writes directly to the server database
  function flush(key) {
    if (inflight[key] || !Object.prototype.hasOwnProperty.call(pending, key)) return;
    var raw = pending[key];
    delete pending[key];
    inflight[key] = true;

    var value;
    try {
      value = raw === null ? null : JSON.parse(raw);
    } catch (e) {
      value = raw;
    }

    var body = JSON.stringify({ key: key, value: value });
    var headers = { "content-type": "application/json" };
    var tok = getAdminToken();
    if (tok) headers["x-admin-token"] = tok;

    var opts = {
      method: "POST",
      headers: headers,
      body: body,
      cache: "no-store",
    };

    fetch(API, opts)
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            throw new Error("HTTP " + r.status + " " + t);
          });
        }
        failures = 0;
        inflight[key] = false;
        if (!Object.prototype.hasOwnProperty.call(pending, key)) dirty[key] = false;
        flush(key);
      })
      .catch(function (err) {
        failures++;
        console.error("[Elevate Database] Write failed, retrying in 1s:", err);
        inflight[key] = false;
        if (!Object.prototype.hasOwnProperty.call(pending, key)) pending[key] = raw;
        setTimeout(function () {
          flush(key);
        }, 1000);
      });
  }

  function push(key, raw) {
    dirty[key] = true;
    pending[key] = raw;
    flush(key);
  }

  // Intercept Storage calls for shared keys: maintain entirely in RAM and sync with server
  proto.getItem = function (key) {
    if (this === window.localStorage && isSharedKey(key)) {
      return Object.prototype.hasOwnProperty.call(sharedStore, key) ? sharedStore[key] : null;
    }
    return nativeGet.call(this, key);
  };

  proto.setItem = function (key, value) {
    if (this === window.localStorage && isSharedKey(key)) {
      var raw = String(value);
      sharedStore[key] = raw;
      nativeRemove.call(this, key); // Never pollute physical localStorage
      push(key, raw);
      return;
    }
    nativeSet.call(this, key, value);
  };

  proto.removeItem = function (key) {
    if (this === window.localStorage && isSharedKey(key)) {
      var empty =
        key === "luxen_likes" ||
        key === "luxen_category_status" ||
        key === "luxen_views" ||
        key === "luxen_votes" ||
        key === "luxen_settings" ||
        key === "luxen_live_joins" ||
        key === "luxen_video_likes" ||
        key === "luxen_video_views"
          ? "{}"
          : "[]";
      sharedStore[key] = empty;
      nativeRemove.call(this, key);
      push(key, empty);
      return;
    }
    nativeRemove.call(this, key);
  };

  function rerender() {
    try {
      if (window.App) {
        if (typeof App.applyCategoryStatuses === "function") App.applyCategoryStatuses();
        if (typeof App.renderPartners === "function") App.renderPartners();
        if (typeof App.renderOpportunities === "function") App.renderOpportunities();
        if (typeof App.updateHomeStats === "function") App.updateHomeStats();
      }
      if (window.ElevateFilters && typeof ElevateFilters.apply === "function") ElevateFilters.apply();
      if (window.ElevateFAQ && typeof ElevateFAQ.refresh === "function") ElevateFAQ.refresh();
      if (window.StudentHub && typeof StudentHub.refresh === "function") StudentHub.refresh();
      if (window.ElevateExtras && typeof ElevateExtras.refresh === "function") {
        ElevateExtras.refresh();
      }
      if (window.Admin && typeof Admin.init === "function") {
        Admin.init();
      }
      if (window.CoursesApp && typeof CoursesApp.render === "function") {
        CoursesApp.render();
      }
    } catch (e) {}
  }

  function refresh(silent) {
    var headers = {};
    var tok = getAdminToken();
    if (tok) headers["x-admin-token"] = tok;

    return fetch(API + "?t=" + Date.now(), { cache: "no-store", headers: headers })
      .then(function (r) {
        return r.json();
      })
      .then(function (p) {
        var store = (p && p.data) || {};
        var changed = applyServerStore(store);
        if (changed || !silent) rerender();
        return store;
      })
      .catch(function () {
        return null;
      });
  }

  // Fast background real-time sync with database every 3 seconds
  var hasPendingWork = function () {
    for (var k in dirty) if (dirty[k]) return true;
    return false;
  };

  setInterval(function () {
    if (document.hidden || hasPendingWork()) return;
    refresh(true);
  }, 3000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !hasPendingWork()) refresh(false);
  });

  window.ElevateDB = {
    keys: KEYS,
    isReady: isReady,
    refresh: refresh,
    onReady: function (fn) {
      if (isReady) {
        try {
          fn();
        } catch (e) {}
      } else {
        readyCallbacks.push(fn);
      }
    },
    ready: new Promise(function (resolve) {
      if (isReady) resolve();
      else readyCallbacks.push(resolve);
    }),
  };
})();
