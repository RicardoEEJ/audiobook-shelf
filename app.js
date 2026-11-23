(() => {
  const SKELETON =
    '<header class="band top"><div class="wrap"><div class="hrow"><div><h1>My audiobook shelf</h1><p>Principles and character over tricks and tactics.</p></div><div class="stats" id="stats"></div></div><nav class="tabs"><button class="tab" data-view="pyramid">Pyramid</button><button class="tab" data-view="shelf">Shelf</button><button class="tab" data-view="next">Up next</button><button class="add" id="add">+ Add book</button></nav></div></header><main class="band"><div class="wrap" id="main"></div></main><footer class="band foot"><div class="wrap"><span id="sv">Loading…</span><button class="btn" id="copy">Copy backup</button><details><summary>Restore from a backup</summary><textarea class="inp" id="imp" placeholder="Paste backup data here"></textarea><button class="btn" id="load">Load backup</button></details></div></footer><div id="dlg"></div><div class="toast" id="toast" hidden></div>';
  const STORE_KEY = "shelf-state";
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(
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
  const TIERS = [
    { t: 1, name: "Life-changing", w: 44 },
    { t: 2, name: "Shaped me", w: 62 },
    { t: 3, name: "Loved", w: 80 },
    { t: 4, name: "Good", w: 100 },
  ];
  const TN = {
    1: "Life-changing",
    2: "Shaped me",
    3: "Loved",
    4: "Good",
    0: "Didn't work for me",
  };
  const ST = {
    read: "Read",
    listening: "Listening now",
    next: "Up next",
    later: "Later",
  };
  const CLOTH = [
    ["#7a1f2b", "#fff"],
    ["#1f3a93", "#fff"],
    ["#d9a21b", "#1d1606"],
    ["#2f5d50", "#fff"],
    ["#5b2a6e", "#fff"],
    ["#b0442b", "#fff"],
    ["#24506e", "#fff"],
    ["#e7dcc6", "#2a2216"],
  ];

  // Load: starting data from data.js, replaced by newer saved data from this browser
  let S = JSON.parse(
    JSON.stringify(window.INITIAL_STATE || { v: 1, savedAt: 0, books: [] }),
  );
  try {
    const L = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (L && L.books && L.savedAt > (S.savedAt || 0)) S = L;
  } catch (e) {}

  let view = "pyramid",
    filter = "all",
    q = "",
    sort = "score",
    openId = null,
    undoSnap = null;
  const hash = (s) => {
    let h = 7;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
  };
  const cloth = (b) => CLOTH[hash(b.id) % CLOTH.length];
  const byId = (id) => S.books.find((b) => b.id === id);
  const fmtS = (n) => (+n % 1 ? (+n).toFixed(1) : String(+n));
  const fmtM = (m) => {
    if (!m) return "";
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1, 1).toLocaleDateString("en", {
      month: "short",
      year: "numeric",
    });
  };
  const thisMonth = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  };
  const byScore = (a) =>
    a
      .slice()
      .sort(
        (x, y) =>
          (y.score || 0) - (x.score || 0) || x.title.localeCompare(y.title),
      );
  const byRank = (a) =>
    a
      .slice()
      .sort(
        (x, y) =>
          (x.rank ?? 1e9) - (y.rank ?? 1e9) ||
          (y.score || 0) - (x.score || 0) ||
          x.title.localeCompare(y.title),
      );
  const queue = () =>
    S.books
      .filter((b) => b.status === "next")
      .sort((a, b) => a.order - b.order);
  const maxOrder = () => Math.max(0, ...S.books.map((b) => b.order || 0));
  const sty = (b) => {
    const [c, f] = cloth(b);
    return `--c:${c};--f:${f}`;
  };
  const mini = (b) =>
    `<div class="mini" style="${sty(b)}" aria-hidden="true">${esc(b.title)}</div>`;

  function spine(b, i) {
    const h = hash(b.id);
    return `<button class="spine" data-open="${b.id}" style="${sty(b)};width:${91 + (h % 10)}%;left:${((h >> 4) % 9) - 4}px;animation-delay:${i * 40}ms"><span class="st">${esc(b.title)}</span><span class="sa">${esc(b.author.split(" ").slice(-1)[0])}</span>${b.score ? `<span class="ss">${fmtS(b.score)}</span>` : ""}</button>`;
  }
  function stats() {
    const n = (s) => S.books.filter((b) => b.status === s).length;
    $("#stats").innerHTML = [
      ["read", "Read"],
      ["listening", "Listening"],
      ["next", "Up next"],
      ["later", "Later"],
    ]
      .map(([k, l]) => `<div><b>${n(k)}</b><span>${l}</span></div>`)
      .join("");
  }

  function vPyramid() {
    const read = S.books.filter((b) => b.status === "read");
    let i = 0;
    const tiers = TIERS.map((T) => {
      const bs = byRank(read.filter((b) => b.tier === T.t));
      return `<div class="tier" style="--w:${T.w}%"><div class="tl">${T.name}<span>${bs.length}</span></div><div class="stk" data-tier="${T.t}">${bs.length ? bs.map((b) => spine(b, i++)).join("") : '<div class="empty">Open a book and move it up here</div>'}</div></div>`;
    }).join("");
    const dnf = byRank(read.filter((b) => b.tier === 0 || b.tier == null));
    const lis = S.books.filter((b) => b.status === "listening"),
      qu = queue(),
      lat = S.books.filter((b) => b.status === "later"),
      rd = S.books.filter((b) => b.status === "read");
    return `<div class="pgrid"><section><h2>My pyramid of influence</h2><p class="mut">The higher a book sits, the more it shaped me. Drag a spine to reorder it or move it to another level (press and hold on a phone). Tap it to score it.</p><div class="pyr">${tiers}<div class="plank"></div><div class="tier dnf" style="--w:100%"><div class="tl">Didn't work for me<span>${dnf.length}</span></div><div class="stk" data-tier="0">${dnf.map((b) => spine(b, i++)).join("") || '<div class="empty">Nothing here</div>'}</div></div></div></section>
<aside class="side"><h2>Listening now</h2>${lis.map((b) => `<article class="lcard">${mini(b)}<div><h3>${esc(b.title)}</h3><p class="mut">${esc(b.author)}</p>${b.version ? `<p class="ver">${esc(b.version.length > 110 ? b.version.slice(0, 110) + "…" : b.version)}</p>` : ""}<div class="row"><button class="btn" data-open="${b.id}">Details</button><button class="btn pri" data-finish="${b.id}">Finished</button></div></div></article>`).join("") || '<div class="empty">Nothing playing. Start one from Up next.</div>'}
<h2 style="margin-top:12px">Next in line</h2><div class="nl">${qu.map((b, i) => `<article class="nrow">${mini(b)}<div><h3>${esc(b.title)}</h3><p class="mut">${esc(b.author)}</p></div><div class="nb">${i === 0 ? `<button class="btn pri rm" data-start="${b.id}">Start</button>` : ""}<button class="btn rm" data-unqueue="${b.id}" aria-label="Remove ${esc(b.title)} from Next in line">Remove</button></div></article>`).join("") || '<div class="empty">No books lined up</div>'}</div>
<label class="addq">Add a book to this list<select class="inp" id="addq"><option value="">Choose a book…</option>${lat.length ? `<optgroup label="Ideas for later">${lat.map((b) => `<option value="${b.id}">${esc(b.title)}</option>`).join("")}</optgroup>` : ""}${rd.length ? `<optgroup label="Listen again">${rd.map((b) => `<option value="${b.id}">${esc(b.title)}</option>`).join("")}</optgroup>` : ""}<option value="new">+ A new book</option></select></label>${qu.length ? '<button class="btn" data-view="next">Open full queue</button>' : ""}</aside></div>`;
  }

  function queueBook(b) {
    if (b.status === "read") b.prev = { status: "read", tier: b.tier };
    b.status = "next";
    b.order = maxOrder() + 1;
  }
  function unqueue(b) {
    if (b.prev) {
      Object.assign(b, b.prev);
      delete b.prev;
    } else b.status = "later";
  }

  function vShelf() {
    const f = [
      ["all", "All"],
      ["read", "Read"],
      ["listening", "Listening"],
      ["next", "Up next"],
      ["later", "Later"],
      ["dnf", "Didn't work"],
    ];
    return `<h2>The whole shelf</h2><div class="ctrl">${f.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}<input class="inp" id="q" type="search" placeholder="Search title, author or idea" value="${esc(q)}" aria-label="Search"><select class="inp" id="sort" aria-label="Sort"><option value="score">Sort: my score</option><option value="title">Sort: title</option><option value="last">Sort: last listened</option><option value="tier">Sort: pyramid tier</option></select></div><div class="grid" id="list"></div>`;
  }

  function renderList() {
    const el = $("#list");
    if (!el) return;
    const t = q.toLowerCase();
    let bs = S.books
      .filter(
        (b) =>
          filter === "all" ||
          (filter === "dnf"
            ? b.status === "read" && b.tier === 0
            : b.status === filter),
      )
      .filter(
        (b) =>
          !t ||
          [b.title, b.author, b.es, b.summary, b.ideas.join(" "), b.notes]
            .join(" ")
            .toLowerCase()
            .includes(t),
      );
    const tv = (b) =>
      b.status !== "read" ? 9 : b.tier === 0 ? 8 : b.tier || 7;
    bs =
      sort === "title"
        ? bs.sort((a, b) => a.title.localeCompare(b.title))
        : sort === "last"
          ? bs.sort((a, b) =>
              (b.lastRead || "").localeCompare(a.lastRead || ""),
            )
          : sort === "tier"
            ? bs.sort(
                (a, b) => tv(a) - tv(b) || (b.score || 0) - (a.score || 0),
              )
            : byScore(bs);
    el.innerHTML =
      bs
        .map(
          (b) =>
            `<button class="card" data-open="${b.id}"><div class="cover" style="${sty(b)}"><span class="ct">${esc(b.title)}</span><span class="ca">${esc(b.author)}</span></div><div class="cm"><span class="pill">${b.status === "read" ? TN[b.tier ?? 4] : ST[b.status]}</span><span>${b.score ? `<span class="star">★ ${fmtS(b.score)}</span> · ` : ""}${b.lastRead ? "Last: " + fmtM(b.lastRead) : b.status === "read" ? "Add last listened" : ""}</span></div></button>`,
        )
        .join("") || '<p class="mut">No books match.</p>';
  }

  function vNext() {
    const qu = queue(),
      lt = S.books.filter((b) => b.status === "later");
    return `<h2>Up next</h2><p class="mut">Your queue, in order, with the version to pick when you get there. Drag a book to reorder (press and hold on a phone).</p><ol class="q">${qu.map((b, i) => `<li data-id="${b.id}"><div><span class="qn">${i + 1}</span><span class="grip" aria-hidden="true"></span></div>${mini(b)}<div><h3>${esc(b.title)}</h3><p class="mut">${esc(b.author)}${b.year ? " · " + esc(b.year) : ""}${b.es ? " · <i>" + esc(b.es) + "</i>" : ""}</p><p class="ver"><b>Version:</b> ${b.version ? esc(b.version) : '<span class="mut">None chosen yet</span>'}</p>${b.why ? `<p>${esc(b.why)}</p>` : ""}<div class="row"><button class="btn" data-up="${b.id}" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button class="btn" data-down="${b.id}" aria-label="Move down" ${i < qu.length - 1 ? "" : "disabled"}>↓</button><button class="btn" data-open="${b.id}">Details</button><button class="btn" data-unqueue="${b.id}">Remove</button><button class="btn pri" data-start="${b.id}">Start listening</button></div></div></li>`).join("") || '<div class="empty">Queue is empty. Add from Later below.</div>'}</ol>
<section class="sec"><h2>Ideas for later</h2><div class="later">${lt.map((b) => `<article>${mini(b)}<div><h3>${esc(b.title)}</h3><p class="mut">${esc(b.author)}</p></div><button class="btn" data-open="${b.id}">Details</button><button class="btn pri" data-queue="${b.id}">Queue</button></article>`).join("") || '<p class="mut">Nothing saved for later.</p>'}</div></section>`;
  }

  function renderMain() {
    stats();
    document
      .querySelectorAll(".tab")
      .forEach((t) =>
        t.setAttribute(
          "aria-current",
          t.dataset.view === view ? "page" : "false",
        ),
      );
    $("#main").innerHTML =
      view === "shelf" ? vShelf() : view === "next" ? vNext() : vPyramid();
    if (view === "shelf") {
      $("#sort").value = sort;
      renderList();
    }
  }
  function setView(v) {
    view = ["pyramid", "shelf", "next"].includes(v) ? v : "pyramid";
    try {
      localStorage.setItem("shelf-view", view);
    } catch (e) {}
    if (location.hash.slice(1) !== view)
      history.replaceState(null, "", "#" + view);
    renderMain();
  }
  function opt(list, val) {
    return list
      .map(
        ([k, l]) =>
          `<option value="${k}" ${String(k) === String(val) ? "selected" : ""}>${l}</option>`,
      )
      .join("");
  }

  function openBook(id) {
    const b = byId(id);
    if (!b) return;
    openId = id;
    $("#dlg").innerHTML =
      `<div class="ov" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-labelledby="dt"><div class="phead">${mini(b)}<div><h2 id="dt">${esc(b.title)}</h2><p class="mut" id="da">${esc(b.author)}${b.year ? " · " + esc(b.year) : ""}</p>${b.es ? `<p>Spanish: <i>${esc(b.es)}</i></p>` : ""}</div><button class="x" data-close aria-label="Close">×</button></div>
<div class="fields"><label>Status<select id="f-status">${opt(Object.entries(ST), b.status)}</select></label><label id="tierL" ${b.status === "read" ? "" : "hidden"}>Pyramid tier<select id="f-tier">${opt(
        [
          [1, TN[1]],
          [2, TN[2]],
          [3, TN[3]],
          [4, TN[4]],
          [0, TN[0]],
        ],
        b.tier ?? 4,
      )}</select></label>
<label>My score <output id="so">${b.score ? fmtS(b.score) + " / 10" : "Not rated"}</output><input type="range" id="f-score" min="0" max="10" step="0.5" value="${b.score || 0}"></label><label>Last listened<input type="month" id="f-lastRead" value="${esc(b.lastRead)}"></label>
<label class="wide">Version (the one I use or recommend)<textarea id="f-version" rows="2">${esc(b.version)}</textarea></label><label class="wide">My notes<textarea id="f-notes" rows="3" placeholder="Quotes, takeaways, what I want to apply">${esc(b.notes)}</textarea></label></div>
<section class="about">${b.summary ? `<p>${esc(b.summary)}</p>` : ""}${b.ideas.length ? `<h3>Key ideas</h3><ul>${b.ideas.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${b.why ? `<h3>How it fits my list</h3><p>${esc(b.why)}</p>` : ""}</section>
<details class="edt" ${b.title === "New book" ? "open" : ""}><summary>Edit title, author, summary and ideas</summary><div><label>Title<input id="f-title" value="${esc(b.title)}"></label><label>Author<input id="f-author" value="${esc(b.author)}"></label><label>Year<input id="f-year" value="${esc(b.year)}"></label><label>Spanish title<input id="f-es" value="${esc(b.es)}"></label><label class="wide">Summary<textarea id="f-summary" rows="3">${esc(b.summary)}</textarea></label><label class="wide">Key ideas (one per line)<textarea id="f-ideas" rows="4">${esc(b.ideas.join("\n"))}</textarea></label><label class="wide">How it fits my list<textarea id="f-why" rows="2">${esc(b.why)}</textarea></label></div></details>
<div class="pfoot"><button class="btn danger" id="del">Delete book</button><button class="btn pri" data-close>Done</button></div></div>`;
    $("#dlg .x").focus();
  }
  function closeDlg() {
    if (!openId) return;
    openId = null;
    $("#dlg").innerHTML = "";
    renderMain();
  }

  // Saving: everything is stored in this browser's localStorage
  function changed() {
    S.savedAt = Date.now();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      sv("Saved in this browser");
    } catch (e) {
      sv("Could not save in this browser");
    }
  }
  function sv(t) {
    const e = $("#sv");
    if (e) e.textContent = t;
  }
  function toast(msg, undo) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="undo">Undo</button>' : ""}`;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(() => {
      t.hidden = true;
    }, 6000);
  }
  function bk() {
    undoSnap = JSON.stringify(S);
  }

  document.getElementById("root").innerHTML = SKELETON;

  // Drag and drop (pyramid spines and the Up next queue)
  let drag = null,
    justDragged = false;
  function startDrag(d, x, y) {
    d.on = true;
    const r = d.it.getBoundingClientRect();
    d.ox = x - r.left;
    d.oy = y - r.top;
    d.p0 = d.it.parentElement;
    d.n0 = d.it.nextElementSibling;
    const w = d.p0.cloneNode(false);
    w.classList.add("ghostw");
    w.removeAttribute("data-tier");
    w.style.width = r.width + "px";
    w.appendChild(d.it.cloneNode(true));
    document.body.appendChild(w);
    d.g = w;
    d.it.classList.add("dragging");
    document.body.classList.add("is-drag");
    try {
      navigator.vibrate && navigator.vibrate(15);
    } catch (e) {}
    moveDrag(d, x, y);
  }
  function moveDrag(d, x, y) {
    d.g.style.transform = `translate(${x - d.ox}px,${y - d.oy}px)`;
    if (y < 70) window.scrollBy(0, -14);
    else if (y > innerHeight - 70) window.scrollBy(0, 14);
    let box;
    if (d.it.tagName === "LI") box = $("#main .q");
    else {
      let best = 1e9;
      for (const s of document.querySelectorAll("#main .stk[data-tier]")) {
        const r = s.parentElement.getBoundingClientRect(),
          dist = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        if (dist < best) {
          best = dist;
          box = s;
        }
      }
    }
    if (!box) return;
    const kids = [...box.children].filter(
      (c) => c !== d.it && !c.classList.contains("empty"),
    );
    const ref =
      kids.find((c) => {
        const r = c.getBoundingClientRect();
        return y < r.top + r.height / 2;
      }) || null;
    if (d.it.parentElement === box && d.it.nextElementSibling === ref) return;
    box.insertBefore(d.it, ref);
  }
  function endDrag(cancel) {
    const d = drag;
    drag = null;
    if (!d) return;
    clearTimeout(d.t);
    if (!d.on) return;
    d.g.remove();
    d.it.classList.remove("dragging");
    document.body.classList.remove("is-drag");
    justDragged = true;
    setTimeout(() => {
      justDragged = false;
    }, 80);
    if (
      cancel ||
      (d.it.parentElement === d.p0 && d.it.nextElementSibling === d.n0)
    ) {
      renderMain();
      return;
    }
    bk();
    if (d.it.tagName === "LI") {
      [...d.it.parentElement.querySelectorAll("li[data-id]")].forEach(
        (li, i) => {
          byId(li.dataset.id).order = i + 1;
        },
      );
    } else {
      const box = d.it.parentElement,
        b = byId(d.it.dataset.open);
      b.tier = +box.dataset.tier;
      [...box.querySelectorAll(".spine")].forEach((s, i) => {
        byId(s.dataset.open).rank = i;
      });
    }
    changed();
    renderMain();
    toast(
      d.it.tagName === "LI"
        ? "Queue reordered"
        : "Moved to " + TN[byId(d.it.dataset.open).tier],
      true,
    );
  }
  document.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || openId) return;
    const it = e.target.closest("#main .spine,#main .q li[data-id]");
    if (!it) return;
    const d = {
      it,
      x: e.clientX,
      y: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
      id: e.pointerId,
      touch: e.pointerType !== "mouse",
      on: false,
    };
    if (d.touch)
      d.t = setTimeout(() => {
        if (drag === d) startDrag(d, d.lx, d.ly);
      }, 350);
    drag = d;
  });
  document.addEventListener("pointermove", (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
        if (d.touch) {
          clearTimeout(d.t);
          drag = null;
        } else startDrag(d, e.clientX, e.clientY);
      } else {
        d.lx = e.clientX;
        d.ly = e.clientY;
      }
      return;
    }
    e.preventDefault();
    moveDrag(d, e.clientX, e.clientY);
  });
  document.addEventListener("pointerup", () => endDrag(false));
  document.addEventListener("pointercancel", () => endDrag(true));
  document.addEventListener(
    "touchmove",
    (e) => {
      if (drag && drag.on) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener("contextmenu", (e) => {
    if (drag) e.preventDefault();
  });

  // Clicks
  document.addEventListener("click", (e) => {
    if (justDragged) return;
    const el = e.target.closest("button,[data-close]");
    if (!el) return;
    const d = el.dataset;
    if (d.view) {
      setView(d.view);
      window.scrollTo({ top: 0 });
    } else if (d.open) openBook(d.open);
    else if ("close" in d) closeDlg();
    else if (d.filter) {
      filter = d.filter;
      renderMain();
    } else if (d.finish) {
      const b = byId(d.finish);
      bk();
      Object.assign(b, {
        status: "read",
        tier: b.tier ?? 4,
        lastRead: thisMonth(),
      });
      delete b.prev;
      changed();
      renderMain();
      openBook(b.id);
      toast("Finished! Give it a score and pick its tier.", true);
    } else if (d.start) {
      const b = byId(d.start);
      bk();
      b.status = "listening";
      changed();
      renderMain();
      toast(`Now listening: ${b.title}`, true);
    } else if (d.queue) {
      const b = byId(d.queue);
      bk();
      queueBook(b);
      changed();
      renderMain();
      toast("Added to the end of your queue", true);
    } else if (d.unqueue) {
      const b = byId(d.unqueue);
      bk();
      unqueue(b);
      changed();
      renderMain();
      toast(`Removed ${b.title} from Next in line`, true);
    } else if (d.up || d.down) {
      const qu = queue(),
        i = qu.findIndex((b) => b.id === (d.up || d.down)),
        j = d.up ? i - 1 : i + 1;
      if (qu[j]) {
        qu.forEach((b, k) => (b.order = k + 1));
        [qu[i].order, qu[j].order] = [qu[j].order, qu[i].order];
        changed();
        renderMain();
      }
    } else if (el.id === "add") {
      bk();
      const id = "b" + Date.now().toString(36);
      S.books.push({
        id,
        title: "New book",
        author: "",
        year: "",
        es: "",
        status: "later",
        tier: null,
        score: 0,
        lastRead: "",
        summary: "",
        ideas: [],
        why: "",
        version: "",
        notes: "",
        order: 0,
      });
      changed();
      renderMain();
      openBook(id);
    } else if (el.id === "del") {
      if (el.dataset.sure) {
        bk();
        const t = byId(openId).title;
        S.books = S.books.filter((b) => b.id !== openId);
        openId = null;
        $("#dlg").innerHTML = "";
        changed();
        renderMain();
        toast(`Deleted ${t}`, true);
      } else {
        el.dataset.sure = 1;
        el.textContent = "Tap again to delete";
      }
    } else if (el.id === "undo") {
      if (undoSnap) {
        S = JSON.parse(undoSnap);
        undoSnap = null;
        openId = null;
        $("#dlg").innerHTML = "";
        changed();
        renderMain();
        $("#toast").hidden = true;
      }
    } else if (el.id === "copy") {
      const txt = JSON.stringify(S);
      navigator.clipboard
        .writeText(txt)
        .then(() => toast("Backup copied. Paste it somewhere safe."))
        .catch(() => {
          const i = $("#imp");
          i.value = txt;
          i.closest("details").open = true;
          i.select();
          toast("Select and copy the text below");
        });
    } else if (el.id === "load") {
      try {
        const n = JSON.parse($("#imp").value);
        if (!Array.isArray(n.books)) throw 0;
        bk();
        S = n;
        changed();
        renderMain();
        toast("Backup loaded", true);
      } catch (x) {
        toast("That backup could not be read");
      }
    }
  });

  // Form inputs
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "q") {
      q = t.value;
      renderList();
      return;
    }
    if (t.id === "sort") {
      sort = t.value;
      renderList();
      return;
    }
    if (t.id === "addq") {
      const v = t.value;
      if (!v) return;
      bk();
      if (v === "new") {
        const id = "b" + Date.now().toString(36);
        S.books.push({
          id,
          title: "New book",
          author: "",
          year: "",
          es: "",
          status: "next",
          tier: null,
          score: 0,
          lastRead: "",
          summary: "",
          ideas: [],
          why: "",
          version: "",
          notes: "",
          order: maxOrder() + 1,
        });
        changed();
        renderMain();
        openBook(id);
      } else {
        const b = byId(v);
        queueBook(b);
        changed();
        renderMain();
        toast(`Added ${b.title} to Next in line`, true);
      }
      return;
    }
    if (!openId || !t.id.startsWith("f-")) return;
    const b = byId(openId),
      k = t.id.slice(2);
    if (k === "score") {
      b.score = +t.value;
      $("#so").textContent = b.score ? fmtS(b.score) + " / 10" : "Not rated";
    } else if (k === "tier") b.tier = +t.value;
    else if (k === "ideas")
      b.ideas = t.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (k === "status") {
      b.status = t.value;
      if (b.status === "read" && b.tier == null) b.tier = 4;
      if (b.status === "next") b.order = maxOrder() + 1;
      $("#tierL").hidden = b.status !== "read";
    } else {
      b[k] = t.value;
      if (k === "title") $("#dt").textContent = t.value;
      if (k === "author" || k === "year")
        $("#da").textContent = b.author + (b.year ? " · " + b.year : "");
    }
    changed();
    renderMain();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDlg();
  });
  window.addEventListener("hashchange", () => setView(location.hash.slice(1)));

  let v0 = location.hash.slice(1);
  if (!v0) {
    try {
      v0 = localStorage.getItem("shelf-view") || "";
    } catch (e) {}
  }
  setView(v0);
  sv("Saved in this browser");
})();
