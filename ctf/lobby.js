// CTF lobby: talks to the player's local agent (127.0.0.1) and, when
// configured, the cloud API. All player-supplied text is rendered with
// textContent, never innerHTML.
(function () {
  "use strict";
  var cfg = window.CTF_CONFIG || {};
  var CLOUD = (cfg.cloudUrl || "").replace(/\/+$/, "");
  var AGENT = (cfg.agentUrl || "http://127.0.0.1:8071").replace(/\/+$/, "");
  var CHALLENGE_URL = cfg.challengeUrl || "http://127.0.0.1:8070/";
  var STORE_KEY = "cyberguard-ctf-player";

  var FALLBACK_CHALLENGES = [
    { id: "sqli-101", title: "Login Bypass", difficulty: 1, points: 100, available: false },
    { id: "idor-201", title: "Whose Record Is It?", difficulty: 2, points: 200, available: true },
    { id: "xss-301", title: "Guestbook", difficulty: 3, points: 300, available: false },
  ];

  var state = { agent: null, player: loadPlayer(), challengeId: null, pollTimer: null };

  function $(id) { return document.getElementById(id); }
  function setStatus(el, text, kind) {
    el.textContent = text;
    el.className = "status" + (kind ? " " + kind : "");
  }
  function markDone(stepId, done) { $(stepId).classList.toggle("done", !!done); }

  function loadPlayer() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; }
  }
  function savePlayer(p) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
  }

  // Practice mode = the agent says so, or no cloud is configured.
  function practice() {
    if (state.agent) return state.agent.mode === "practice";
    return !CLOUD;
  }

  function agentFetch(path, opts) {
    opts = opts || {};
    // Chrome's Local Network Access: declare the loopback target so the
    // https page may reach http://127.0.0.1 (permission prompt on first use).
    opts.targetAddressSpace = "loopback";
    return fetch(AGENT + path, opts);
  }
  function cloudFetch(path, opts) { return fetch(CLOUD + path, opts || {}); }
  function postJSON(fn, path, body) {
    return fn(path, { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body) });
  }
  function errorDetail(r) {
    return r.json().then(function (b) {
      return typeof b.detail === "string" ? b.detail : "request failed (" + r.status + ")";
    }, function () { return "request failed (" + r.status + ")"; });
  }

  // ---- step 1: copy commands
  $("copy-cmd").addEventListener("click", function () {
    var text = $("cmd").textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { $("copy-cmd").textContent = "Copied"; });
    }
  });

  // ---- step 2: connect (first loopback request must come from a click)
  function checkAgent(fromClick) {
    return agentFetch("/status").then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      return r.json();
    }).then(function (s) {
      var wasPractice = practice();
      state.agent = s;
      markDone("step-run", true);
      markDone("step-connect", true);
      setStatus($("connect-status"), "Connected to your stack (" +
        (s.mode === "practice" ? "practice mode" : "online") + ").", "ok");
      if (s.mode === "online" && !CLOUD) {
        setStatus($("connect-status"), "Connected, but your stack is in online mode and this page has no " +
          "cloud configured. Restart it with CLOUD_URL unset to play in practice mode.", "err");
      }
      if (wasPractice !== practice()) renderMode();
      renderChallenges();
      if (!state.pollTimer) state.pollTimer = setInterval(function () { checkAgent(false); }, 5000);
    }).catch(function () {
      state.agent = null;
      markDone("step-connect", false);
      clearInterval(state.pollTimer); state.pollTimer = null;
      loopbackPermission().then(function (perm) {
        if (perm === "denied") {
          setStatus($("connect-status"), "Your browser blocked this site from reaching apps on your " +
            "device. Allow “Local network” / “Loopback” access in this site's settings, then try again.", "err");
        } else if (fromClick) {
          setStatus($("connect-status"), "Couldn't reach the game on 127.0.0.1:8071. Is the " +
            "docker compose command from step 1 still running?", "err");
        } else {
          setStatus($("connect-status"), "Lost connection to your stack.", "err");
        }
      });
      renderChallenges();
    });
  }
  function loopbackPermission() {
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve("unknown");
    return navigator.permissions.query({ name: "loopback-network" })
      .then(function (p) { return p.state; }, function () { return "unknown"; });
  }
  $("connect").addEventListener("click", function () {
    setStatus($("connect-status"), "Connecting…");
    checkAgent(true);
  });
  // If permission was already granted on an earlier visit, reconnect quietly.
  loopbackPermission().then(function (p) { if (p === "granted") checkAgent(false); });

  // ---- step 3: player
  function renderPlayer() {
    if (practice()) {
      $("player-form").hidden = true;
      setStatus($("player-status"), "No account needed in practice mode.");
      markDone("step-player", true);
      return;
    }
    if (state.player) {
      $("player-form").hidden = true;
      setStatus($("player-status"), "Playing as " + state.player.handle + ". ", "ok");
      var change = document.createElement("a");
      change.href = "#"; change.textContent = "Use a different name";
      change.addEventListener("click", function (e) {
        e.preventDefault();
        state.player = null; savePlayer(null); renderPlayer(); renderChallenges();
      });
      $("player-status").appendChild(change);
      markDone("step-player", true);
    } else {
      $("player-form").hidden = false;
      setStatus($("player-status"), "");
      markDone("step-player", false);
    }
  }
  $("register").addEventListener("click", function () {
    var handle = $("handle").value.trim();
    if (!$("consent").checked) {
      setStatus($("player-status"), "Tick the box to confirm what's sent, or play in practice mode.", "err");
      return;
    }
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(handle)) {
      setStatus($("player-status"), "Use 3–20 letters, digits, _ or -.", "err");
      return;
    }
    setStatus($("player-status"), "Joining…");
    postJSON(cloudFetch, "/register", { handle: handle }).then(function (r) {
      if (!r.ok) return errorDetail(r).then(function (d) { throw new Error(d); });
      return r.json();
    }).then(function (p) {
      state.player = p; savePlayer(p); renderPlayer(); renderChallenges();
    }).catch(function (e) {
      setStatus($("player-status"), "Couldn't join: " + e.message, "err");
    });
  });

  // ---- step 4: challenges
  var challenges = FALLBACK_CHALLENGES;
  function loadChallenges() {
    if (!CLOUD) return Promise.resolve();
    return cloudFetch("/challenges").then(function (r) { return r.json(); })
      .then(function (b) { challenges = b.challenges; }, function () { /* keep fallback */ });
  }
  function renderChallenges() {
    var box = $("challenges");
    box.textContent = "";
    var ready = !!state.agent && (practice() || !!state.player);
    challenges.forEach(function (ch) {
      var row = document.createElement("div"); row.className = "challenge";
      var left = document.createElement("div");
      var title = document.createElement("b"); title.textContent = ch.title;
      var meta = document.createElement("div"); meta.className = "meta";
      meta.textContent = "Level " + ch.difficulty + " · " + ch.points + " points" +
        (ch.available ? "" : " · coming soon");
      left.appendChild(title); left.appendChild(meta);
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "button";
      var active = state.agent && state.agent.challenge_id === ch.id;
      btn.textContent = active ? "Restart" : "Start";
      btn.disabled = !ch.available || !ready;
      btn.addEventListener("click", function () { startChallenge(ch); });
      var actions = document.createElement("div"); actions.className = "row";
      actions.appendChild(btn);
      if (active) {
        var open = document.createElement("a");
        open.className = "button primary"; open.href = CHALLENGE_URL; open.target = "_blank";
        open.rel = "noopener"; open.textContent = "Open challenge";
        actions.appendChild(open);
      }
      row.appendChild(left); row.appendChild(actions);
      box.appendChild(row);
    });
    if (!state.agent) setStatus($("play-status"), "Connect your stack (step 2) to start a challenge.");
    else if (!ready) setStatus($("play-status"), "Pick a name (step 3) first.");
    else if (!state.agent.challenge_id) setStatus($("play-status"), "");
    $("submit-flag").disabled = !(state.agent && state.agent.challenge_id);
    markDone("step-play", !!(state.agent && state.agent.challenge_id));
  }
  function startChallenge(ch) {
    setStatus($("play-status"), "Starting " + ch.title + "…");
    var body = { challenge_id: ch.id };
    if (!practice() && state.player) {
      body.player_id = state.player.player_id;
      body.session_token = state.player.session_token;
    }
    postJSON(agentFetch, "/start", body).then(function (r) {
      if (!r.ok) return errorDetail(r).then(function (d) { throw new Error(d); });
      return r.json();
    }).then(function () {
      state.challengeId = ch.id;
      return checkAgent(false);
    }).then(function () {
      setStatus($("play-status"), "Running. Open the challenge, find the flag, then submit it below. " +
        "Hint: start at the page you land on, and look at what you're allowed to see.", "ok");
    }).catch(function (e) {
      setStatus($("play-status"), "Couldn't start: " + e.message, "err");
    });
  }

  // ---- step 5: flag
  $("submit-flag").addEventListener("click", function () {
    var flag = $("flag").value.trim();
    var cid = state.agent && state.agent.challenge_id;
    if (!flag || !cid) return;
    setStatus($("flag-status"), "Checking…");
    var req = practice()
      ? postJSON(agentFetch, "/check", { flag: flag })
      : postJSON(cloudFetch, "/solve", { player_id: state.player.player_id, challenge_id: cid, flag: flag });
    req.then(function (r) {
      if (!r.ok) return errorDetail(r).then(function (d) { throw new Error(d); });
      return r.json();
    }).then(function (res) {
      if (!res.correct) { setStatus($("flag-status"), "Not the flag. Keep looking.", "err"); return; }
      markDone("step-flag", true);
      var msg = "Correct!";
      if (res.already_solved) msg += " You'd already solved this one.";
      else if (res.points) msg += " +" + res.points + " points.";
      if (res.time_to_solve) msg += " Solved in " + Math.round(res.time_to_solve) + "s.";
      setStatus($("flag-status"), msg, "ok");
      loadBoard();
    }).catch(function (e) { setStatus($("flag-status"), "Couldn't check the flag: " + e.message, "err"); });
  });

  // ---- leaderboard
  function loadBoard() {
    if (!CLOUD) return;
    cloudFetch("/leaderboard").then(function (r) { return r.json(); }).then(function (b) {
      var body = $("board"); body.textContent = "";
      if (!b.players.length) {
        var tr = document.createElement("tr"), td = document.createElement("td");
        td.colSpan = 4; td.className = "status"; td.textContent = "No solves yet. Be the first.";
        tr.appendChild(td); body.appendChild(tr); return;
      }
      b.players.forEach(function (p, i) {
        var tr = document.createElement("tr");
        [String(i + 1), p.handle, String(p.solved), String(p.points)].forEach(function (v, j) {
          var td = document.createElement("td"); td.textContent = v;
          if (j >= 2) td.className = "num";
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }, function () { /* board offline; keep last render */ });
  }

  function renderMode() {
    $("practice-banner").hidden = !practice();
    $("board-section").hidden = !CLOUD;
    renderPlayer();
  }

  renderMode();
  loadChallenges().then(renderChallenges);
  loadBoard();
  if (CLOUD) setInterval(loadBoard, 30000);
})();
