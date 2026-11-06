(function () {
  try {
    localStorage.setItem("ns_theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
  } catch (e) {}
  var bar = document.createElement("div");
  bar.id = "wow-progress";
  document.body.appendChild(bar);
  addEventListener(
    "scroll",
    function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
    },
    { passive: true },
  );
  // reveal on scroll
  var io = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll("#home-view > section").forEach(function (s, i) {
    if (i > 0) {
      s.classList.add("wow-reveal");
      io.observe(s);
    }
  });
  // rotating motivational quotes
  var Q = [
    ["كل فرصة كبيرة بتبدأ بخطوة صغيرة", "Every big opportunity starts with a small step"],
    ["استثمر في نفسك، هو أفضل استثمار", "Invest in yourself, it's the best investment"],
    ["النجاح مش صدفة، ده تحضير قابل فرصة", "Success is preparation meeting opportunity"],
    ["متستناش الفرصة، روح لها", "Don't wait for opportunity, go get it"],
  ];
  var cta = document.querySelector(".cta-section");
  if (cta) {
    var w = document.createElement("div");
    w.className = "container";
    w.innerHTML =
      '<div id="wow-quote"><i class="fas fa-quote-right" style="color:#0284c7"></i> <span class="q"></span><small>Elevate</small></div>';
    cta.parentNode.insertBefore(w, cta);
    var el = w.querySelector(".q"),
      i = 0;
    function lang() {
      return document.documentElement.lang === "en" ? 1 : 0;
    }
    function show() {
      el.style.opacity = 0;
      setTimeout(function () {
        el.textContent = Q[i % Q.length][lang()];
        el.style.opacity = 1;
        i++;
      }, 400);
    }
    show();
    setInterval(show, 5000);
  }
  // count-up stats
  function countUp(el) {
    var t = el.textContent.replace(/[^\d]/g, "");
    if (!t || el.dataset.wow) return;
    el.dataset.wow = 1;
    var n = +t,
      s = null,
      suf = el.textContent.replace(/[\d,]/g, "");
    requestAnimationFrame(function f(ts) {
      s = s || ts;
      var p = Math.min((ts - s) / 1500, 1);
      el.textContent = Math.floor(n * (1 - Math.pow(1 - p, 3))).toLocaleString("en") + suf;
      if (p < 1) requestAnimationFrame(f);
    });
  }
  var tries = 0,
    iv = setInterval(function () {
      document.querySelectorAll(".hero-stat-number").forEach(countUp);
      if (++tries > 20) clearInterval(iv);
    }, 700);
})();
