/* Mapping the Spotify Soundscape — page behaviour (vanilla JS, no libraries) */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- top bar, progress, active chapter ---------- */
  const topbar = $("#topbar"), bar = $("#progress-bar");
  const navLinks = $$(".topbar nav a");
  const chapters = navLinks.map(a => $(a.getAttribute("href")));
  function onScroll() {
    const h = document.documentElement;
    const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    bar.style.width = (p * 100).toFixed(2) + "%";
    topbar.classList.toggle("visible", h.scrollTop > window.innerHeight * 0.6);
    let current = -1;
    chapters.forEach((sec, i) => { if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
    navLinks.forEach((a, i) => a.classList.toggle("active", i === current));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- animated counters ---------- */
  function countUp(el) {
    const target = +el.dataset.target, dur = reduceMotion ? 0 : 1600, t0 = performance.now();
    const fmt = n => n.toLocaleString("en-US");
    if (!dur) { el.textContent = fmt(target); return; }
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(target * e));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  $$(".count").forEach(countUp);

  /* ---------- reveal on scroll ---------- */
  const revealables = $$(".fig, .prose, .callouts, .explorer, .takeaways li, .pullquote, .chapter-head");
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealables.forEach(el => el.classList.add("reveal"));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(el => io.observe(el));
  }

  /* ---------- lightbox ---------- */
  const lb = $("#lightbox"), lbImg = $("#lightbox-img"), lbCap = $("#lightbox-cap");
  let lastFocus = null;
  function openLB(img) {
    lastFocus = document.activeElement;
    lbImg.src = img.src; lbImg.alt = img.alt;
    const cap = img.closest("figure").querySelector("figcaption");
    lbCap.innerHTML = cap ? cap.innerHTML : "";
    lb.hidden = false; document.body.style.overflow = "hidden";
    $("#lightbox-close").focus();
  }
  function closeLB() { lb.hidden = true; document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  $$(".fig img").forEach(img => {
    img.tabIndex = 0;
    img.addEventListener("click", () => openLB(img));
    img.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLB(img); } });
  });
  lb.addEventListener("click", e => { if (e.target !== lbCap) closeLB(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !lb.hidden) closeLB(); });

  /* ---------- interactive genre radar ---------- */
  const D = window.SOUNDSCAPE;
  if (!D) return;
  const ORDER = ["Rock", "R&B", "Pop", "Rap", "Latin", "EDM"];
  const COLOR = { "Rock": "#3d9be0", "R&B": "#e0682e", "Pop": "#0fa78a", "Rap": "#b88700", "Latin": "#e0609e", "EDM": "#8c6cf0" };
  const LABEL = { danceability: "dance", energy: "energy", valence: "valence", acousticness: "acoustic",
    speechiness: "speech", instrumentalness: "instrumental", liveness: "live", loudness: "loud",
    tempo: "tempo", duration_min: "length" };
  const UNIT = { loudness: " dB", tempo: " BPM", duration_min: " min" };
  const F = D.features, N = F.length;
  const svg = $("#radar"), NS = "http://www.w3.org/2000/svg";
  const cx = 280, cy = 280, R = 200, rMin = 0.15, rMax = 0.85;   // percentile range shown on the radius
  const active = new Set(["Rock", "EDM"]);
  let focusIdx = null;

  const angle = i => -Math.PI / 2 + (2 * Math.PI * i) / N;
  const rad = v => R * Math.max(0, (v - rMin) / (rMax - rMin));
  const pt = (i, v) => [cx + rad(v) * Math.cos(angle(i)), cy + rad(v) * Math.sin(angle(i))];
  const el = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n); return n;
  };

  // static frame
  [0.3, 0.5, 0.7].forEach(v => {
    el("circle", { cx, cy, r: rad(v), class: v === 0.5 ? "ring-avg" : "ring" });
    el("text", { x: cx + 4, y: cy - rad(v) - 4, class: "ring-label" }).textContent = Math.round(v * 100) + "th";
  });
  el("circle", { cx, cy, r: R, class: "ring" });
  const spokes = [], labels = [];
  F.forEach((f, i) => {
    const [x, y] = pt(i, rMax);
    const hit = el("line", { x1: cx, y1: cy, x2: x, y2: y, class: "spoke-hit", tabindex: 0, role: "button",
      "aria-label": "Show " + LABEL[f] });
    spokes.push(el("line", { x1: cx, y1: cy, x2: x, y2: y, class: "spoke" }));
    const lx = cx + (R + 26) * Math.cos(angle(i)), ly = cy + (R + 26) * Math.sin(angle(i));
    const t = el("text", { x: lx, y: ly + 4, class: "axis-label",
      "text-anchor": Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end" });
    t.textContent = LABEL[f]; labels.push(t);
    const show = () => setFocus(i);
    hit.addEventListener("mouseenter", show); hit.addEventListener("focus", show); hit.addEventListener("click", show);
  });
  const shapesG = el("g", {});

  function pathFor(vals) {
    return vals.map((v, i) => (i ? "L" : "M") + pt(i, v).map(n => n.toFixed(1)).join(",")).join("") + "Z";
  }
  function drawShapes() {
    shapesG.innerHTML = "";
    ORDER.filter(g => active.has(g)).forEach(g => {
      const vals = D.genres[g].pct;
      el("path", { d: pathFor(vals), class: "shape", fill: COLOR[g], stroke: COLOR[g] }, shapesG);
      vals.forEach((v, i) => {
        const [x, y] = pt(i, v);
        const c = el("circle", { cx: x, cy: y, r: focusIdx === i ? 6.5 : 4, fill: COLOR[g], class: "dot" }, shapesG);
        c.addEventListener("mouseenter", ev => tip(ev, `<b style="color:${COLOR[g]}">${g}</b> · ${LABEL[F[i]]}: ${Math.round(v * 100)}th pct`));
        c.addEventListener("mousemove", ev => tip(ev));
        c.addEventListener("mouseleave", hideTip);
      });
    });
  }

  // readout panel
  const readout = $("#readout");
  function setFocus(i) {
    focusIdx = i;
    spokes.forEach((s, k) => s.classList.toggle("hot", k === i));
    labels.forEach((t, k) => t.classList.toggle("hot", k === i));
    drawShapes(); renderReadout();
  }
  function renderReadout() {
    if (focusIdx === null) {
      readout.innerHTML = `<p class="readout-hint">Hover over or tap a spoke to compare the selected genres on that feature.</p>` + summary();
      return;
    }
    const f = F[focusIdx];
    const rows = ORDER.filter(g => active.has(g))
      .sort((a, b) => D.genres[b].pct[focusIdx] - D.genres[a].pct[focusIdx])
      .map(g => {
        const p = D.genres[g].pct[focusIdx], raw = D.genres[g].raw[focusIdx];
        const rawTxt = (Math.abs(raw) >= 10 ? raw.toFixed(0) : raw.toFixed(2)) + (UNIT[f] || "");
        return `<div class="bar-row" title="mean ${rawTxt}"><span style="color:${COLOR[g]};font-weight:700">${g}</span>
          <span class="track"><span class="fill" style="width:${(p * 100).toFixed(1)}%;background:${COLOR[g]}"></span></span>
          <span class="val">${Math.round(p * 100)}</span></div>`;
      }).join("");
    readout.innerHTML = `<div class="readout"><h4>${LABEL[f]}</h4>
      <p class="sub">Average percentile (50 = dataset average). Hover over a row to see the raw mean.</p>${rows || "<p class='readout-hint'>Select at least one genre.</p>"}</div>`;
  }
  function summary() {
    const sel = ORDER.filter(g => active.has(g));
    if (!sel.length) return "";
    return `<div class="readout">${sel.map(g => {
      const d = D.genres[g].pct.map((v, i) => [Math.abs(v - 0.5), v, i]).sort((a, b) => b[0] - a[0])[0];
      return `<p style="margin:.3rem 0"><b style="color:${COLOR[g]}">${g}</b>: most distinctive is <b>${LABEL[F[d[2]]]}</b>
        (${Math.round(d[1] * 100)}th pct, ${d[1] > 0.5 ? "above" : "below"} average).</p>`;
    }).join("")}</div>`;
  }

  // genre chips
  const chips = $("#chips");
  ORDER.forEach(g => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = g;
    b.style.setProperty("--c", COLOR[g]);
    b.setAttribute("aria-pressed", active.has(g));
    b.addEventListener("click", () => {
      active.has(g) ? active.delete(g) : active.add(g);
      b.setAttribute("aria-pressed", active.has(g));
      drawShapes(); renderReadout();
    });
    chips.appendChild(b);
  });
  const allBtn = document.createElement("button");
  allBtn.type = "button"; allBtn.className = "chip"; allBtn.textContent = "All"; allBtn.style.setProperty("--c", "#a99fc9");
  allBtn.addEventListener("click", () => {
    const all = active.size < ORDER.length;
    ORDER.forEach(g => all ? active.add(g) : active.delete(g));
    $$(".chip", chips).forEach(c => c !== allBtn && c.setAttribute("aria-pressed", active.has(c.textContent)));
    drawShapes(); renderReadout();
  });
  chips.appendChild(allBtn);

  // tooltip
  const tipEl = $("#tooltip");
  function tip(ev, html) {
    if (html) tipEl.innerHTML = html;
    tipEl.hidden = false;
    tipEl.style.left = Math.min(ev.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8) + "px";
    tipEl.style.top = (ev.clientY + 14) + "px";
  }
  function hideTip() { tipEl.hidden = true; }

  drawShapes(); renderReadout();
})();
