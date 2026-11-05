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
      var p = Math.min(0.995, Math.max(0, (sec.offsetTop - 72) / maxScroll()));
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
      tab: "Couple · 3 actions",
      refs: [{ src: "ref_cp_m.webp", alt: "Reference image of an elderly man with a laptop" }, { src: "ref_cp_w.webp", alt: "Reference image of an elderly woman with a laptop" }],
      refClass: "two",
      prompt: "A static shot shows an elderly couple sitting close together <em>on a light gray sofa in a bright, cozy living room</em> …",
      video: "ex_couple",
      segs: [
        { t0: 0, t1: 1.9, label: "c1", cap: "The couple <em>looks closely at the laptop screen</em>." },
        { t0: 1.9, t1: 3.2, label: "c2", cap: "The man <em>lifts one hand</em> in a sudden excited gesture." },
        { t0: 3.2, t1: 5, label: "c3", cap: "The woman <em>laughs and leans back slightly</em> while staying beside him." }
      ],
      meta: "Track 2 · T = 3. Shaded windows are the input caption timings; keyframe anchors A₁ → A₂ → A₃ are generated in a cascade to guide the action phases."
    },
    {
      tab: "Cats · 3 actions",
      refs: [{ src: "ref_ct.webp", alt: "Reference images of a black-and-white cat and a gray cat" }],
      refClass: "wide",
      prompt: "A black-and-white cat sits on the floor near <em>a wooden glass-front cabinet</em> while a gray cat rests <em>at right</em> …",
      video: "ex_cats",
      segs: [
        { t0: 0, t1: 1.5, label: "c1", cap: "The black-and-white cat <em>sits facing the camera</em>." },
        { t0: 1.5, t1: 3.9, label: "c2", cap: "The black-and-white cat <em>licks its front paw</em>." },
        { t0: 3.9, t1: 5, label: "c3", cap: "The black-and-white cat <em>lifts its head and looks around</em>." }
      ],
      meta: "Track 2 · T = 3. Shaded windows are the input caption timings; keyframe anchors A₁ → A₂ → A₃ are generated in a cascade to guide the action phases."
    },
    {
      tab: "Bookshop · single shot",
      refs: [{ src: "ref_t1.webp", alt: "Reference portrait of a woman with long blond hair" }],
      refClass: "",
      prompt: "A woman amidst the towering, dust-mote filled shelves of a quiet <em>antique bookshop</em>, vigorously <em>spray-painting neon graffiti onto a weathered wooden crate</em>, … a compound <em>camera move slowly dollies forward and tilts right</em>.",
      video: "ex_bookshop",
      segs: [{ t0: 0, t1: 5, label: "single prompt · no temporal captions", cap: "No temporal captions: the whole clip follows the prompt." }],
      meta: "Track 1 · T = 1. One first-frame anchor A₁ initializes image-to-video generation."
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
    var cur = null, t = 0, visible = true, userPaused = reduceMotion, dragging = false, wasPlaying = false, lastSi = -1;

    EXAMPLES.forEach(function (e, i) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-pressed", "false"); b.textContent = e.tab;
      b.addEventListener("click", function () { select(i); });
      tabsEl.appendChild(b);
    });

    function select(i) {
      cur = EXAMPLES[i];
      tabsEl.querySelectorAll("button").forEach(function (b, j) { b.setAttribute("aria-pressed", String(i === j)); });
      refsEl.className = "ex-ref-imgs " + cur.refClass;
      refsEl.innerHTML = cur.refs.map(function (r) { return '<img src="' + IMG + r.src + '" alt="' + r.alt + '">'; }).join("");
      promptEl.innerHTML = cur.prompt;
      video.poster = VID + cur.video + ".webp";
      video.src = VID + cur.video + ".mp4";
      video.setAttribute("aria-label", "Video generated by Chronos: " + cur.tab);
      segsEl.innerHTML = cur.segs.map(function (s, i) {
        return '<div class="s" style="flex:' + (s.t1 - s.t0) + ' 1 0">' + (i ? "" : '<span class="a"></span>') + "<b>" + s.label + "</b></div>";
      }).join("");
      ex.classList.toggle("single", cur.segs.length === 1);
      var bounds = [0].concat(cur.segs.map(function (s) { return s.t1; }));
      ticksEl.innerHTML = bounds.map(function (b) { return '<span style="left:' + (b / DUR * 100) + '%">' + b + (b === DUR ? " s" : "") + "</span>"; }).join("");
      capsEl.innerHTML = cur.segs.map(function (s) {
        var key = cur.segs.length > 1 ? s.label : "P";
        return '<li><button type="button" class="ex-cap"><span class="k">' + key + '</span><span class="t">' + s.t0.toFixed(1) + "–" + s.t1.toFixed(1) + ' s</span><span class="c">' + s.cap + "</span></button></li>";
      }).join("");
      capsEl.querySelectorAll(".ex-cap").forEach(function (btn, k) {
        btn.addEventListener("click", function () { seek(cur.segs[k].t0); });
      });
      metaEl.textContent = cur.meta;
      lastSi = -1;
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
      var si = 0;
      cur.segs.forEach(function (s, i) { if (t >= s.t0) si = i; });
      if (si === lastSi) return;
      lastSi = si;
      segsEl.querySelectorAll(".s").forEach(function (s, i) { s.classList.toggle("on", i === si); });
      capsEl.querySelectorAll("li").forEach(function (li, i) { li.classList.toggle("on", i === si); });
      announce();
    }
    // The slider value is only rewritten on segment changes and explicit seeks, not on every frame.
    function announce() {
      var s = cur.segs[Math.max(0, lastSi)];
      trackEl.setAttribute("aria-valuenow", t.toFixed(1));
      trackEl.setAttribute("aria-valuetext", t.toFixed(1) + " of 5 seconds, " + s.label + ": " + s.cap.replace(/<[^>]+>/g, ""));
    }
    // The timeline is drawn on the nominal 5 s axis; clips run 4.9–5.0 s, so map proportionally.
    function fromVideo() {
      if (video.duration) { t = Math.min(DUR, video.currentTime / video.duration * DUR); render(); }
    }
    function seek(v) {
      t = Math.max(0, Math.min(DUR, v));
      if (video.duration) video.currentTime = Math.min(video.duration - 0.05, t / DUR * video.duration);
      render();
      announce();
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
      new IntersectionObserver(function (es) { visible = es[0].intersectionRatio >= 0.3; sync(); }, { threshold: [0, 0.3] }).observe(video);
    }
    document.addEventListener("visibilitychange", sync);
    function loop() {
      if (!video.paused && !dragging) fromVideo();
      requestAnimationFrame(loop);
    }
    select(0);
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

  /* ---------- identity vs motion scatter ---------- */
  var SC_SIDE = {
    t1: { "Stand-In": 1, "RefAlign": -1, "Phantom": 1, "IPT2V": -1, "Chronos": 1 },
    t2: { "Stand-In": 1, "RefAlign": -1, "Phantom": 1, "Chronos": 1 }
  };
  var SC_CAP = {
    t1: "Chronos sits between the face-keeping baselines (RefAlign and Phantom: high identity, less motion) and Stand-In (most motion, lowest identity), and beats IPT2V on both axes.",
    t2: "On Track 2 Chronos has the highest identity score but the least motion: its gains here come from identity, aesthetics, smoothness and naturalness, not from larger movement."
  };
  function renderScatter(key, track) {
    var el = document.querySelector('[data-scatter="' + key + '"]');
    if (!el) return;
    var rows = DATA[key][track];
    var W = 400, H = 272, L = 40, R = 14, T = 24, B = 40, XM = 0.9, YM = 0.6;
    var pw = W - L - R, ph = H - T - B;
    function x(v) { return L + v / XM * pw; }
    function y(v) { return T + ph - v / YM * ph; }
    var g = "";
    [0, 0.2, 0.4, 0.6, 0.8].forEach(function (v) {
      g += '<line class="sc-grid" x1="' + x(v) + '" x2="' + x(v) + '" y1="' + T + '" y2="' + (T + ph) + '"/>' +
        '<text class="sc-axis" x="' + x(v) + '" y="' + (T + ph + 15) + '" text-anchor="middle">' + v.toFixed(1) + "</text>";
    });
    [0, 0.2, 0.4, 0.6].forEach(function (v) {
      g += '<line class="sc-grid" x1="' + L + '" x2="' + (L + pw) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="sc-axis" x="' + (L - 7) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + v.toFixed(1) + "</text>";
    });
    g += '<text class="sc-title" x="' + (L + pw / 2) + '" y="' + (H - 4) + '" text-anchor="middle">Subject Score (identity) →</text>' +
      '<text class="sc-title" x="' + (L - 7) + '" y="' + (T - 6) + '" text-anchor="start">Motion Amp. ↑</text>';
    var pts = "", labels = "", hits = "";
    rows.slice().sort(function (a, b) { return (a[9] ? 1 : 0) - (b[9] ? 1 : 0); }).forEach(function (r) {
      var name = r[0].replace("-14B", "").replace(" (ours)", "");
      var cx = x(r[1]), cy = y(r[5]), ours = !!r[9];
      var side = (SC_SIDE[track] || {})[name] || 1;
      pts += '<circle class="pt' + (ours ? " ours" : "") + '" cx="' + cx + '" cy="' + cy + '" r="' + (ours ? 7 : 5.5) + '"/>';
      labels += '<text class="pl' + (ours ? " ours" : "") + '" x="' + (cx + side * (ours ? 11 : 9)) + '" y="' + (cy + 4) + '" text-anchor="' + (side > 0 ? "start" : "end") + '">' + (ours ? "Chronos (ours)" : name) + "</text>";
      hits += '<circle class="hit" cx="' + cx + '" cy="' + cy + '" r="14" data-tip="<b>' + r[0] + "</b><br>Subject " + fmt(r[1]) + " · Motion Amp. " + fmt(r[5]) + "<br>Total " + fmt(r[8]) + '"/>';
    });
    var summary = rows.map(function (r) { return r[0] + ": Subject " + fmt(r[1]) + ", Motion Amp. " + fmt(r[5]); }).join("; ");
    el.innerHTML = '<p class="bars-title">Identity vs. motion · ' + (track === "t1" ? "Track 1" : "Track 2") + "</p>" +
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Scatter of Subject Score against Motion Amplitude. ' + summary + '">' + g + pts + labels + hits + "</svg>" +
      "<figcaption>" + SC_CAP[track] + '</figcaption><div class="tip" aria-hidden="true"></div>';
    var stip = el.querySelector(".tip");
    el.querySelectorAll(".hit").forEach(function (h) {
      h.addEventListener("mouseenter", function () {
        stip.innerHTML = h.getAttribute("data-tip");
        stip.classList.add("show");
        var er = el.getBoundingClientRect(), hr = h.getBoundingClientRect();
        var left = hr.right - er.left + 4;
        if (left + stip.offsetWidth > er.width - 8) left = hr.left - er.left - stip.offsetWidth - 4;
        stip.style.left = Math.max(8, left) + "px";
        stip.style.top = (hr.top - er.top + hr.height / 2 - stip.offsetHeight / 2) + "px";
      });
      h.addEventListener("mouseleave", function () { stip.classList.remove("show"); });
    });
  }

  /* ---------- tabs ---------- */
  var onTab = {
    cmp: function (tr) { renderBars("cmp", tr); renderScatter("cmp", tr); renderTable("cmp", tr); },
    abl: function (tr) { renderTable("abl", tr); }
  };
  document.querySelectorAll(".seg").forEach(function (seg) {
    var scope = seg.closest("[data-tabs]") || seg.closest(".sec");
    var key = scope.getAttribute("data-tabs");
    var buttons = seg.querySelectorAll("button");
    function activate(tr) {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tab") === tr)); });
      scope.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tr; });
      if (onTab[key]) onTab[key](tr);
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { activate(b.getAttribute("data-tab")); }); });
    activate("t1");
  });

  /* ---------- qualitative comparison: synced videos per case ---------- */
  var METHODS = { chronos: "Chronos (ours)", standin: "Stand-In", refalign: "RefAlign", phantom: "Phantom", ipt2v: "IPT2V" };
  var CASES = [
    {
      id: "t1_198", tag: "Track 1 · Case 198", title: "A sharp head turn: the identity holds through the motion",
      refs: [{ src: "ref_198.webp", alt: "Reference portrait of a young woman with long dark hair" }],
      prompt: "A young South Asian woman is <em>abruptly twisting her neck</em> and darting her piercing gaze <em>sharply to the right</em> with a <em>deep, angry frown</em> creasing her brow as she braces herself for physical impact inside the shadowy, <em>tatami-floored</em> sanctuary of a traditional feudal Japanese dojo, where <em>rusted katanas hang on the dark wood walls</em> and heavy dust motes dance in the slanted light, filmed using a complex, <em>multi-axis camera rig that swings wildly</em> with her erratic motion before smoothly locking focus on her intense, wide-eyed stare to vividly capture the raw adrenaline of the impending fight.",
      note: '<button type="button" class="case-jump" data-seek="1.25">Watch 1.5–2.5 s.</button> Chronos turns from profile to a frontal, frowning stare and still looks like the reference. RefAlign and Phantom keep the face but move less, and Phantom puts a literal camera rig on set. Stand-In and IPT2V move more, but the face drifts from the reference.',
      segs: [{ t0: 0, t1: 5, label: "single prompt", cap: "No temporal captions: the whole clip follows the prompt." }],
      methods: ["chronos", "standin", "refalign", "phantom", "ipt2v"]
    },
    {
      id: "t2_045", tag: "Track 2 · Case 045", title: "Lift, taste, stir: three actions in order",
      refs: [{ src: "ref_045.webp", alt: "Reference portrait of a woman in a dark blazer" }],
      prompt: "A warm, cinematic medium shot shows a cheerful woman <em>cooking at the stove in a cozy sunlit kitchen</em>. She tends a steaming pot with calm, practiced movements, adding seasonings from the counter, tasting the dish, and continuing to stir as golden morning light and soft camera drift enhance the inviting domestic atmosphere.",
      note: '<button type="button" class="case-jump" data-seek="0">Follow the captions.</button> Chronos lifts the spoon (about 1.5 s), tastes (about 2.5–3.5 s) and is stirring the pot again by 4 s. Stand-In stays in a close-up tasting loop and only dips the ladle back at the very end; RefAlign tastes late (about 2.5–4.5 s) and never stirs; Phantom fills half the frame with a stove fire the prompt never asks for.',
      segs: [
        { t0: 0, t1: 1.8, label: "c1", cap: "A woman <em>lifts a spoonful</em> from the pot." },
        { t0: 1.8, t1: 3.1, label: "c2", cap: "She <em>tastes the spoonful</em>." },
        { t0: 3.1, t1: 5, label: "c3", cap: "She <em>resumes stirring</em> the pot with a satisfied smile." }
      ],
      methods: ["chronos", "standin", "refalign", "phantom", null]
    },
    {
      id: "t2_100", tag: "Track 2 · Case 100", title: "Stand, fold arms, hold: the transition actually happens",
      refs: [{ src: "ref_100.webp", alt: "Reference portrait of a woman with long wavy hair" }],
      prompt: "A woman with long blonde hair stands outdoors in a peaceful garden-like setting <em>beside a tall white column</em>, wearing a <em>light patterned long dress</em>. She leans against the column and poses calmly while surrounded by green trees and bushes in natural daylight.",
      note: '<button type="button" class="case-jump" data-seek="0">Watch c1.</button> Chronos starts with her arms down, folds them during c2 (about 1.5–2 s) and then holds the pose. RefAlign and Phantom have her arms folded from the first frame, so the c1 → c2 transition never happens.',
      segs: [
        { t0: 0, t1: 1.3, label: "c1", cap: "The woman <em>stands with her body angled</em> near the white column." },
        { t0: 1.3, t1: 2.95, label: "c2", cap: "She <em>folds her arms</em> across her chest." },
        { t0: 2.95, t1: 5, label: "c3", cap: "She <em>holds the pose</em> calmly beside the column." }
      ],
      methods: ["chronos", "standin", "refalign", "phantom", null]
    }
  ];
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var casesEl = document.getElementById("cases");
  var caseCtl = [];
  if (casesEl) {
    CASES.forEach(function (c) {
      var art = document.createElement("article");
      art.className = "case" + (c.segs.length === 1 ? " single" : "");
      var tiles = c.methods.map(function (m, i) {
        if (!m) return '<div class="cv cv-na"><p><b>IPT2V</b><span>Track 1 only (not supported in Track 2)</span></p></div>';
        var base = VID + "cmp/" + c.id + "_" + m;
        return '<figure class="cv' + (i === 0 ? " cv-ours" : "") + '"><video muted playsinline preload="none" data-src="' + base + '.mp4" poster="' + base + '.webp" aria-label="' + METHODS[m] + ', ' + c.tag + '"></video><figcaption>' + METHODS[m] + "</figcaption></figure>";
      }).join("");
      var bounds = [0].concat(c.segs.map(function (s) { return s.t1; }));
      art.innerHTML =
        '<header class="case-head"><p class="case-tag mono">' + c.tag + '</p><h4 class="case-title">' + c.title + "</h4></header>" +
        '<div class="case-input"><div class="case-refs">' + c.refs.map(function (r) { return '<img src="' + IMG + r.src + '" alt="' + r.alt + '" loading="lazy">'; }).join("") + "</div>" +
        '<div class="case-prompt"><span class="mono">Prompt</span><p class="pt-text">' + c.prompt + '</p><button type="button" class="case-more" aria-expanded="false">Show full prompt</button></div></div>' +
        '<p class="case-note">' + c.note + "</p>" +
        '<div class="case-grid">' + tiles + "</div>" +
        '<p class="case-k mono">' + (c.segs.length === 1 ? "Single prompt · no temporal captions" : "Input captions · same for every method") + "</p>" +
        '<div class="case-bar"><button class="case-play" type="button" aria-label="Play ' + c.tag + '">' + PLAY + "</button>" +
        '<div class="ct" role="slider" tabindex="0" aria-label="Playhead for ' + c.tag + ', seconds" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0">' +
        '<div class="ct-segs">' + c.segs.map(function (s) { return '<div class="s" style="flex:' + (s.t1 - s.t0) + ' 1 0"><b>' + s.label + "</b></div>"; }).join("") + "</div>" +
        '<div class="ct-head"></div>' +
        '<div class="ct-ticks mono">' + bounds.map(function (b) { return '<span style="left:' + (b / DUR * 100) + '%">' + b + (b === DUR ? " s" : "") + "</span>"; }).join("") + "</div></div></div>" +
        '<ol class="case-caps">' + c.segs.map(function (s) { return '<li style="flex:' + (s.t1 - s.t0) + ' 1 0"><button type="button" class="case-cap"><span class="k mono">' + (c.segs.length > 1 ? s.label : "P") + "</span>" + s.cap + "</button></li>"; }).join("") + "</ol>";
      casesEl.appendChild(art);
      caseCtl.push(makeCase(art, c));
    });
  }

  function makeCase(art, c) {
    var vids = Array.prototype.slice.call(art.querySelectorAll("video"));
    var master = vids[0];
    var btn = art.querySelector(".case-play");
    var track = art.querySelector(".ct");
    var segsEl = art.querySelector(".ct-segs");
    var head = art.querySelector(".ct-head");
    var segEls = art.querySelectorAll(".ct-segs .s");
    var capEls = art.querySelectorAll(".case-caps li");
    var st = { loaded: false, visible: false, userPaused: reduceMotion, want: false, dragging: false, started: false, si: -1 };

    var more = art.querySelector(".case-more");
    more.addEventListener("click", function () {
      var box = more.parentNode, open = !box.classList.contains("open");
      box.classList.toggle("open", open);
      more.setAttribute("aria-expanded", String(open));
      more.textContent = open ? "Show less" : "Show full prompt";
    });

    function load() {
      if (st.loaded) return;
      st.loaded = true;
      vids.forEach(function (v) { v.preload = "auto"; v.src = v.getAttribute("data-src"); });
    }
    function render(t) {
      head.style.left = (t / DUR * 100) + "%";
      var si = 0;
      c.segs.forEach(function (s, i) { if (t >= s.t0) si = i; });
      if (si === st.si) return;
      st.si = si;
      segEls.forEach(function (e, i) { e.classList.toggle("on", i === si); });
      capEls.forEach(function (e, i) { e.classList.toggle("on", i === si); });
      announce(t);
    }
    function announce(t) {
      var s = c.segs[Math.max(0, st.si)];
      track.setAttribute("aria-valuenow", t.toFixed(1));
      track.setAttribute("aria-valuetext", t.toFixed(1) + " of 5 seconds, " + s.label + ": " + s.cap.replace(/<[^>]+>/g, ""));
    }
    function now() { return master.duration ? Math.min(DUR, master.currentTime / master.duration * DUR) : 0; }
    function setAll(t) {
      if (!master.duration) return;
      vids.forEach(function (v) {
        if (v.duration) v.currentTime = Math.min(v.duration - 0.05, t / DUR * master.duration);
      });
    }
    function buffered(v) {
      if (v.readyState >= 4) return true;
      var b = v.buffered;
      return v.readyState >= 3 && !!v.duration && b.length > 0 && b.end(b.length - 1) >= v.duration - 0.1;
    }
    // The first start waits for every clip to be fully buffered, so slow links do not stutter; later stalls only need playable data.
    function ready() { return vids.every(function (v) { return st.started ? v.readyState >= 3 : buffered(v); }); }
    function progress() {
      var tot = 0;
      vids.forEach(function (v) { if (v.duration && v.buffered.length) tot += Math.min(1, v.buffered.end(v.buffered.length - 1) / v.duration); });
      return Math.round(tot / vids.length * 100);
    }
    function play(v) { var p = v.play(); if (p && p.catch) p.catch(function (e) { if (e && e.name === "NotAllowedError") blocked(); }); }
    function setBtn() {
      btn.innerHTML = st.want ? PAUSE : PLAY;
      btn.setAttribute("aria-label", (st.want ? "Pause " : "Play ") + c.tag);
    }
    // Clips start together only once every clip can play; if any stalls, all wait for it.
    function update() {
      st.want = st.visible && !st.userPaused && !st.dragging && !document.hidden;
      if (st.want) load();
      var go = st.want && ready();
      art.classList.toggle("is-loading", st.want && !go);
      btn.title = st.want && !go ? "Loading " + progress() + "%" : "";
      if (go && !st.started) { st.started = true; setAll(now()); }
      vids.forEach(function (v) {
        if (go) play(v);
        // iOS only buffers after play() is called, so a muted play starts the download; "playing" pauses it again.
        else if (st.want && !buffered(v) && !st.started && !v._kicked) { v._kicked = true; play(v); }
        else v.pause();
      });
      setBtn();
    }
    function blocked() {
      if (!st.want) return;
      st.userPaused = true;
      update();
    }
    vids.forEach(function (v) {
      v.addEventListener("canplay", function () { if (st.want) update(); });
      v.addEventListener("canplaythrough", function () { if (st.want) update(); });
      v.addEventListener("progress", function () { if (st.want && !st.started) update(); });
      v.addEventListener("waiting", function () { if (st.want) update(); });
      v.addEventListener("playing", function () { if (!st.started) v.pause(); });
    });
    // The master is Chronos. When it ends, every clip restarts together.
    master.addEventListener("ended", function () { setAll(0); update(); });
    master.addEventListener("pause", setBtn);
    master.addEventListener("timeupdate", function () { if (!st.dragging) render(now()); });
    function tick() {
      if (!st.want) return;
      render(now());
      var mt = master.currentTime;
      vids.forEach(function (v, i) {
        if (!i || !v.duration || v.seeking || v.readyState < 3) return;
        var target = Math.min(v.duration - 0.05, mt);
        if (Math.abs(v.currentTime - target) > 0.2) v.currentTime = target;
      });
    }
    function toggle() { st.userPaused = st.want; load(); update(); }
    btn.addEventListener("click", toggle);
    art.querySelectorAll(".cv video").forEach(function (v) { v.addEventListener("click", toggle); });

    function seekTo(t) {
      t = Math.max(0, Math.min(DUR, t));
      load(); setAll(t); render(t); announce(t);
    }
    function fromPointer(e) {
      var r = segsEl.getBoundingClientRect();
      seekTo((e.clientX - r.left) / r.width * DUR);
    }
    var resume = false;
    track.addEventListener("pointerdown", function (e) {
      resume = st.want; st.dragging = true; update();
      fromPointer(e);
      try { track.setPointerCapture(e.pointerId); } catch (err) {}
    });
    track.addEventListener("pointermove", function (e) { if (st.dragging) fromPointer(e); });
    function endDrag() { if (!st.dragging) return; st.dragging = false; if (!resume) st.userPaused = true; update(); }
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("keydown", function (e) {
      var d = { ArrowRight: 0.25, ArrowUp: 0.25, ArrowLeft: -0.25, ArrowDown: -0.25 }[e.key];
      if (d === undefined && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      seekTo(e.key === "Home" ? 0 : e.key === "End" ? DUR : now() + d);
    });
    art.querySelectorAll(".case-cap").forEach(function (b, i) {
      b.addEventListener("click", function () { seekTo(c.segs[i].t0); });
    });
    art.querySelectorAll(".case-jump").forEach(function (b) {
      b.addEventListener("click", function () { seekTo(parseFloat(b.getAttribute("data-seek"))); st.userPaused = false; update(); });
    });

    if ("IntersectionObserver" in window) {
      // Preload ahead of the viewport, except for visitors who asked for less motion or less data.
      if (!reduceMotion && !saveData) {
        new IntersectionObserver(function (es) { if (es[0].isIntersecting) load(); }, { rootMargin: "400px 0px" }).observe(art);
      }
      new IntersectionObserver(function (es) { st.visible = es[0].intersectionRatio >= 0.35; update(); }, { threshold: [0, 0.35] }).observe(art.querySelector(".case-grid"));
    } else { st.visible = true; update(); }
    document.addEventListener("visibilitychange", update);
    render(0); setBtn();
    return { tick: tick };
  }
  (function caseLoop() {
    caseCtl.forEach(function (k) { k.tick(); });
    requestAnimationFrame(caseLoop);
  })();

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
