(function () {
  "use strict";
  var IMG = "assets/img/";
  var VID = "assets/videos/";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- pending links (arXiv / Code) ---------- */
  document.querySelectorAll("a.btn[data-pending]").forEach(function (a) {
    if (a.getAttribute("href")) { a.target = "_blank"; a.rel = "noopener"; return; }
    a.removeAttribute("href");
    a.classList.add("is-pending");
    a.setAttribute("aria-disabled", "true");
    var s = document.createElement("span");
    s.className = "soon";
    s.textContent = a.getAttribute("data-pending");
    a.appendChild(s);
  });

  /* ---------- scroll scrubber + active nav ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav nav a"));
  var fill = document.querySelector(".scrub-fill");
  var ticks = document.querySelector(".scrub-ticks");
  var targets = navLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); });

  function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  function layoutTicks() {
    ticks.innerHTML = "";
    targets.forEach(function (sec) {
      if (!sec) return;
      var i = document.createElement("i");
      var p = Math.min(1, Math.max(0, (sec.offsetTop - 72) / maxScroll()));
      i.style.left = (p * 100).toFixed(2) + "%";
      ticks.appendChild(i);
    });
  }
  function onScroll() {
    var y = window.scrollY;
    fill.style.width = (Math.min(1, y / maxScroll()) * 100).toFixed(2) + "%";
    var active = -1;
    targets.forEach(function (sec, i) { if (sec && sec.getBoundingClientRect().top <= 110) active = i; });
    if (y >= maxScroll() - 4) active = targets.length - 1;
    navLinks.forEach(function (a, i) { a.classList.toggle("on", i === active); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { layoutTicks(); onScroll(); });
  window.addEventListener("load", function () { layoutTicks(); onScroll(); });
  layoutTicks(); onScroll();

  /* ---------- temporal anchoring explorer ---------- */
  var EXAMPLES = [
    {
      tab: "Track 1 · Bookshop",
      refs: [{ src: "ref_t1.webp", alt: "Reference portrait of a woman with long blond hair" }],
      refClass: "",
      prompt: "A woman amidst the towering, dust-mote filled shelves of a quiet <em>antique bookshop</em>, vigorously <em>spray-painting neon graffiti onto a weathered wooden crate</em>, … a compound <em>camera move slowly dollies forward and tilts right</em>.",
      video: "ex_bookshop",
      segs: [{ t0: 0, t1: 5, label: "single segment", cap: "No temporal captions: the refined prompt <em>P̂</em> covers the whole clip." }],
      meta: "T = 1 · one first-frame anchor A₁ initializes image-to-video generation"
    },
    {
      tab: "Track 2 · Couple",
      refs: [{ src: "ref_cp_m.webp", alt: "Reference image of an elderly man with a laptop" }, { src: "ref_cp_w.webp", alt: "Reference image of an elderly woman with a laptop" }],
      refClass: "two",
      prompt: "A static shot shows an elderly couple sitting close together <em>on a light gray sofa in a bright, cozy living room</em> …",
      video: "ex_couple",
      segs: [
        { t0: 0, t1: 1.9, label: "c1", cap: "The couple <em>looks closely at the laptop screen</em>." },
        { t0: 1.9, t1: 3.2, label: "c2", cap: "The man <em>lifts one hand</em> in a sudden excited gesture." },
        { t0: 3.2, t1: 5, label: "c3", cap: "The woman <em>laughs and leans back slightly</em> while staying beside him." }
      ],
      meta: "T = 3 · anchors A₁ → A₂ → A₃ built in a cascade, one per action segment"
    },
    {
      tab: "Track 2 · Cats",
      refs: [{ src: "ref_ct.webp", alt: "Reference images of a black-and-white cat and a gray cat" }],
      refClass: "wide",
      prompt: "A black-and-white cat sits on the floor near <em>a wooden glass-front cabinet</em> while a gray cat rests <em>at right</em> …",
      video: "ex_cats",
      segs: [
        { t0: 0, t1: 1.5, label: "c1", cap: "The black-and-white cat <em>sits facing the camera</em>." },
        { t0: 1.5, t1: 3.9, label: "c2", cap: "The black-and-white cat <em>licks its front paw</em>." },
        { t0: 3.9, t1: 5, label: "c3", cap: "The black-and-white cat <em>lifts its head and looks around</em>." }
      ],
      meta: "T = 3 · anchors A₁ → A₂ → A₃ built in a cascade, one per action segment"
    }
  ];
  var DUR = 5;
  var PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 16 16"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';
  var ex = document.getElementById("explorer");
  if (ex) {
    var tabsEl = ex.querySelector(".ex-tabs");
    var refsEl = ex.querySelector(".ex-ref-imgs");
    var promptEl = ex.querySelector(".ex-prompt");
    var video = ex.querySelector(".ex-video");
    var playBtn = ex.querySelector(".ex-play");
    var trackEl = ex.querySelector(".ex-track");
    var segsEl = ex.querySelector(".ex-segs");
    var headEl = ex.querySelector(".ex-head-line");
    var timeEl = ex.querySelector(".ex-time");
    var ticksEl = ex.querySelector(".ex-ticks");
    var capsEl = ex.querySelector(".ex-caps");
    var metaEl = ex.querySelector(".ex-meta");
    // userPaused: the visitor paused it, so scrolling back into view must not restart it.
    var cur = null, t = 0, visible = true, userPaused = reduceMotion, dragging = false, wasPlaying = false;

    EXAMPLES.forEach(function (e, i) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.textContent = e.tab;
      b.addEventListener("click", function () { select(i); });
      tabsEl.appendChild(b);
    });

    function select(i) {
      cur = EXAMPLES[i];
      tabsEl.querySelectorAll("button").forEach(function (b, j) { b.setAttribute("aria-selected", String(i === j)); });
      refsEl.className = "ex-ref-imgs " + cur.refClass;
      refsEl.innerHTML = cur.refs.map(function (r) { return '<img src="' + IMG + r.src + '" alt="' + r.alt + '">'; }).join("");
      promptEl.innerHTML = cur.prompt;
      video.poster = VID + cur.video + ".webp";
      video.src = VID + cur.video + ".mp4";
      video.setAttribute("aria-label", "Video generated by Chronos: " + cur.tab);
      segsEl.innerHTML = cur.segs.map(function (s) {
        return '<div class="s" style="flex:' + (s.t1 - s.t0) + ' 1 0"><span class="a"></span><b>' + s.label + "</b></div>";
      }).join("");
      var bounds = [0].concat(cur.segs.map(function (s) { return s.t1; }));
      ticksEl.innerHTML = bounds.map(function (b) { return '<span style="left:' + (b / DUR * 100) + '%">' + b + (b === DUR ? " s" : "") + "</span>"; }).join("");
      capsEl.innerHTML = cur.segs.map(function (s) {
        var key = cur.segs.length > 1 ? s.label : "P̂";
        return '<li><span class="k">' + key + '</span><span class="t">' + s.t0.toFixed(1) + "–" + s.t1.toFixed(1) + ' s</span><span class="c">' + s.cap + "</span></li>";
      }).join("");
      capsEl.querySelectorAll("li").forEach(function (li, k) {
        li.addEventListener("click", function () { seek(cur.segs[k].t0); });
      });
      metaEl.textContent = cur.meta;
      t = 0;
      render();
      sync();
    }

    function sync() {
      if (visible && !userPaused && !dragging && !document.hidden) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
      else video.pause();
    }
    function render() {
      var p = t / DUR;
      headEl.style.left = (p * 100) + "%";
      timeEl.textContent = t.toFixed(1) + " s";
      timeEl.style.transform = "translateX(" + (-p * 100) + "%)";
      trackEl.setAttribute("aria-valuenow", t.toFixed(1));
      var si = 0;
      cur.segs.forEach(function (s, i) { if (t >= s.t0) si = i; });
      segsEl.querySelectorAll(".s").forEach(function (s, i) { s.classList.toggle("on", i === si); });
      capsEl.querySelectorAll("li").forEach(function (li, i) { li.classList.toggle("on", i === si); });
    }
    // The timeline is drawn on the nominal 5 s axis; clips run 4.9–5.0 s, so map proportionally.
    function fromVideo() {
      if (video.duration) { t = Math.min(DUR, video.currentTime / video.duration * DUR); render(); }
    }
    function seek(v) {
      t = Math.max(0, Math.min(DUR, v));
      if (video.duration) video.currentTime = Math.min(video.duration - 0.05, t / DUR * video.duration);
      render();
    }
    function setBtn() {
      var paused = video.paused;
      playBtn.innerHTML = paused ? PLAY : PAUSE;
      playBtn.setAttribute("aria-label", paused ? "Play video" : "Pause video");
    }
    function toggle() { userPaused = !video.paused; sync(); }
    playBtn.addEventListener("click", toggle);
    video.addEventListener("click", toggle);
    video.addEventListener("play", setBtn);
    video.addEventListener("pause", setBtn);
    video.addEventListener("seeked", fromVideo);
    video.addEventListener("timeupdate", function () { if (!dragging) fromVideo(); });
    video.addEventListener("loadedmetadata", fromVideo);
    setBtn();

    function fromPointer(e) {
      var r = segsEl.getBoundingClientRect();
      seek((e.clientX - r.left) / r.width * DUR);
    }
    trackEl.addEventListener("pointerdown", function (e) {
      dragging = true; wasPlaying = !video.paused; video.pause();
      fromPointer(e);
      try { trackEl.setPointerCapture(e.pointerId); } catch (err) {}
    });
    trackEl.addEventListener("pointermove", function (e) { if (dragging) fromPointer(e); });
    function endDrag() { if (!dragging) return; dragging = false; if (wasPlaying) sync(); }
    trackEl.addEventListener("pointerup", endDrag);
    trackEl.addEventListener("pointercancel", endDrag);
    trackEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { seek(t + 0.25); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { seek(t - 0.25); e.preventDefault(); }
      else if (e.key === "Home") { seek(0); e.preventDefault(); }
      else if (e.key === "End") { seek(DUR); e.preventDefault(); }
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }, { threshold: 0.3 }).observe(video);
    }
    document.addEventListener("visibilitychange", sync);
    function loop() {
      if (!video.paused && !dragging) fromVideo();
      requestAnimationFrame(loop);
    }
    select(1);
    requestAnimationFrame(loop);
  }

  /* ---------- result data ---------- */
  var COLS = ["Subject Score", "GMEScore", "GMEScore_Seg", "Aesthetic Score", "Motion Amplitude", "Motion Smoothness", "Natural Score", "Total Score"];
  var SHORT = ["Subject", "GMEScore", "GME-Seg", "Aesthetic", "Motion Amp.", "Smoothness", "Natural", "Total"];
  var GROUPS = [["Identity Consistency", [0]], ["Text Alignment", [1, 2]], ["Video Quality", [3, 4, 5, 6]]];
  var DATA = {
    cmp: {
      t1: [
        ["Stand-In-14B", 0.2396, 0.6286, null, 0.4878, 0.4589, 0.9112, 0.5550, 0.5042],
        ["RefAlign-14B", 0.7996, 0.6342, null, 0.4758, 0.2946, 0.9637, 0.4837, 0.6214],
        ["Phantom-14B", 0.7165, 0.6242, null, 0.5041, 0.2102, 0.8882, 0.5712, 0.6211],
        ["IPT2V-14B", 0.5387, 0.5572, null, 0.4940, 0.3864, 0.9004, 0.5387, 0.5614],
        ["Chronos (ours)", 0.6840, 0.6411, null, 0.5984, 0.4306, 0.9709, 0.6725, 0.6769, true]
      ],
      t2: [
        ["Stand-In-14B", 0.1844, 0.7268, 0.5663, 0.4836, 0.3027, 0.9191, 0.6350, 0.5100],
        ["RefAlign-14B", 0.3877, 0.6996, 0.5392, 0.4930, 0.1620, 0.9838, 0.5812, 0.5430],
        ["Phantom-14B", 0.4136, 0.7170, 0.5432, 0.5268, 0.2110, 0.9613, 0.6387, 0.5725],
        ["Chronos (ours)", 0.4400, 0.6907, 0.5407, 0.6009, 0.1479, 0.9950, 0.70625, 0.6102, true]
      ]
    },
    abl: {
      t1: [
        ["Baseline (VACE)", 0.7511, 0.6188, null, 0.5001, 0.1827, 0.9548, 0.5775, 0.6353],
        ["+ SPA", 0.7557, 0.6176, null, 0.5030, 0.1763, 0.9529, 0.5875, 0.6394],
        ["+ SPA & VFA (Seedance)", 0.6736, 0.6357, null, 0.5824, 0.4996, 0.9645, 0.6475, 0.6646],
        ["+ SPA & VFA (Wan)", 0.6816, 0.6650, null, 0.6000, 0.3652, 0.9508, 0.5800, 0.6487],
        ["Chronos (full)", 0.6981, 0.6475, null, 0.6063, 0.4798, 0.9762, 0.6675, 0.6833, true]
      ],
      t2: [
        ["Baseline (VACE)", 0.4576, 0.6872, 0.5504, 0.5278, 0.1893, 0.9632, 0.6300, 0.5803],
        ["+ SPA & VFA (Wan I2V-14B)", 0.5338, 0.6741, 0.5502, 0.6131, 0.1963, 0.9825, 0.6450, 0.6177],
        ["+ SPA & VFA (Wan FLF2V-14B)", 0.5911, 0.6771, 0.5473, 0.6439, 0.1505, 0.9956, 0.6625, 0.6417],
        ["Chronos (full)", 0.6085, 0.6761, 0.5496, 0.6406, 0.1743, 0.9944, 0.6850, 0.6530, true]
      ]
    }
  };

  function fmt(v) { return v == null ? "–" : (String(v).length > 6 ? v.toFixed(5) : v.toFixed(4)); }

  function renderTable(key, track) {
    var wrap = document.querySelector('[data-table="' + key + '"]');
    if (!wrap) return;
    var rows = DATA[key][track];
    var cols = COLS.map(function (_, i) { return i; }).filter(function (i) { return rows.some(function (r) { return r[i + 1] != null; }); });
    var best = {};
    cols.forEach(function (i) { best[i] = Math.max.apply(null, rows.map(function (r) { return r[i + 1] == null ? -1 : r[i + 1]; })); });
    var h = '<table class="tbl"><thead><tr class="grp"><th></th>';
    GROUPS.forEach(function (g) {
      var n = g[1].filter(function (i) { return cols.indexOf(i) >= 0; }).length;
      if (n) h += '<th colspan="' + n + '">' + g[0] + "</th>";
    });
    h += "<th></th></tr><tr><th>Method</th>";
    cols.forEach(function (i) { h += '<th class="num" title="' + COLS[i] + '">' + SHORT[i] + " ↑</th>"; });
    h += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h += "<tr" + (r[9] ? ' class="ours"' : "") + "><td>" + r[0] + "</td>";
      cols.forEach(function (i) {
        var v = r[i + 1];
        h += '<td class="num' + (v == null ? " dash" : v === best[i] ? " best" : "") + '">' + fmt(v) + "</td>";
      });
      h += "</tr>";
    });
    wrap.innerHTML = h + "</tbody></table>";
  }

  var tip = document.createElement("div");
  tip.className = "tip"; tip.setAttribute("role", "status");
  function renderBars(key, track) {
    var el = document.querySelector('[data-chart="' + key + '"]');
    if (!el) return;
    var rows = DATA[key][track].slice().sort(function (a, b) { return b[8] - a[8]; });
    var ours = rows.filter(function (r) { return r[9]; })[0];
    var MAX = 0.7;
    var h = '<p class="bars-title">Total Score ↑ · ' + (track === "t1" ? "Track 1" : "Track 2") + "</p>";
    rows.forEach(function (r) {
      var d = ours[8] - r[8];
      var info = r[9] ? "Highest Total Score on this track" : d.toFixed(4) + " below Chronos";
      h += '<div class="bar' + (r[9] ? " ours" : "") + '" tabindex="0" data-tip="<b>' + r[0] + "</b><br>Total Score " + fmt(r[8]) + "<br>" + info + '" aria-label="' + r[0] + ", Total Score " + fmt(r[8]) + '">' +
        '<span class="lbl">' + r[0] + '</span><span class="trk"><span class="fill" style="width:0"></span></span><span class="val">' + fmt(r[8]) + "</span></div>";
    });
    h += '<div class="bars-axis" aria-hidden="true"><span></span><span class="ax">' +
      [0, 0.2, 0.4, 0.6].map(function (v) { return '<span style="left:' + (v / MAX * 100) + '%">' + v.toFixed(1) + "</span>"; }).join("") + "</span><span></span></div>";
    el.innerHTML = h;
    el.appendChild(tip);
    requestAnimationFrame(function () {
      el.querySelectorAll(".bar").forEach(function (b, i) { b.querySelector(".fill").style.width = (rows[i][8] / MAX * 100) + "%"; });
    });
    el.querySelectorAll(".bar").forEach(function (b) {
      function show() {
        tip.innerHTML = b.getAttribute("data-tip");
        var er = el.getBoundingClientRect(), fr = b.querySelector(".fill").getBoundingClientRect();
        tip.classList.add("show");
        var x = fr.right - er.left + 10;
        if (x + tip.offsetWidth > er.width - 8) x = fr.right - er.left - tip.offsetWidth - 10;
        tip.style.left = Math.max(8, x) + "px";
        tip.style.top = (b.offsetTop + b.offsetHeight / 2 - tip.offsetHeight / 2) + "px";
      }
      function hide() { tip.classList.remove("show"); }
      b.addEventListener("mouseenter", show); b.addEventListener("focus", show);
      b.addEventListener("mouseleave", hide); b.addEventListener("blur", hide);
    });
  }

  /* ---------- tabs ---------- */
  var onTab = {
    cmp: function (tr) { renderBars("cmp", tr); renderTable("cmp", tr); },
    abl: function (tr) { renderTable("abl", tr); }
  };
  document.querySelectorAll(".seg").forEach(function (seg) {
    var scope = seg.closest("[data-tabs]") || seg.closest(".sec");
    var key = scope.getAttribute("data-tabs");
    var buttons = seg.querySelectorAll("button");
    function activate(tr) {
      buttons.forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === tr)); });
      scope.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tr; });
      if (onTab[key]) onTab[key](tr);
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { activate(b.getAttribute("data-tab")); }); });
    activate("t1");
  });

  /* ---------- lightbox ---------- */
  var lb = document.querySelector(".lightbox");
  var lbImg = lb.querySelector("img");
  var lbClose = lb.querySelector(".lb-close");
  var opener = null;
  document.querySelectorAll(".zoom").forEach(function (z) {
    z.addEventListener("click", function () {
      var img = z.querySelector("img");
      lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
      opener = z; lb.hidden = false; document.body.style.overflow = "hidden"; lbClose.focus();
    });
  });
  function closeLb() { lb.hidden = true; document.body.style.overflow = ""; if (opener) opener.focus(); }
  lb.addEventListener("click", function (e) { if (e.target !== lbImg) closeLb(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lb.hidden) closeLb(); });

  /* ---------- BibTeX ---------- */
  var bib = document.getElementById("bibtex");
  if (bib && bib.textContent.trim()) {
    var box = bib.closest(".bib");
    box.classList.add("has-bib");
    var copy = box.querySelector(".copy");
    copy.hidden = false;
    copy.addEventListener("click", function () {
      navigator.clipboard.writeText(bib.textContent.trim()).then(function () {
        copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy"; }, 1600);
      });
    });
  }
})();
