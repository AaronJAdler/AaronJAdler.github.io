/* Progress tracker and resume gap check for the Data Engineering Study Guide.
   Used by study-guide.html and study-guide-phone.html. Everything runs in the browser:
   progress is read from localStorage, and pasted resume text is never stored or sent anywhere. */
(function () {
  "use strict";

  var KEY = "de-guide-progress-v1";

  // Priority tiers from the guide's "How to use this guide" table.
  var TIER = {
    "part-2": 1, "part-3": 1, "part-4": 1, "part-7": 1, "part-9": 1, "part-10": 1, "part-11": 1, "part-18": 1, "part-19": 1, "part-20": 1,
    "part-5": 2, "part-6": 2, "part-8": 2, "part-12": 2, "part-14": 2, "part-15": 2, "part-16": 2,
    "part-13": 3, "part-17": 3, "part-21": 3
  };
  var TIER_NAME = { 1: "Gets you hired", 2: "Makes you senior", 3: "Differentiates you" };

  // Terms that suggest experience with a part. A match shows a term appeared, not how deep the experience is.
  var KEYWORDS = {
    "part-2": ["sql", "t-sql", "tsql", "postgresql", "postgres", "mysql", "sql server", "oracle", "window function", "cte", "stored procedure", "query optimization", "execution plan", "joins", "indexing"],
    "part-3": ["python", "pandas", "numpy", "pytest", "pyspark", "fastapi", "flask", "django", "asyncio", "type hints", "mypy", "poetry", "pip", "unit test"],
    "part-4": ["data model", "data modeling", "data modelling", "star schema", "snowflake schema", "dimensional model", "kimball", "slowly changing", "scd", "normalization", "erd", "entity relationship", "schema design", "data vault", "fact table", "dimension table"],
    "part-5": ["parquet", "avro", "orc", "columnar", "b-tree", "lsm", "index", "indexes", "partitioning", "file format", "compression", "storage engine", "write-ahead", "wal"],
    "part-6": ["distributed system", "distributed systems", "consensus", "replication", "cap theorem", "consistency", "idempotent", "idempotency", "retry", "retries", "circuit breaker", "exactly-once", "at-least-once", "sharding", "raft", "eventual consistency", "fault tolerance", "high availability", "redis"],
    "part-7": ["spark", "pyspark", "databricks", "hadoop", "emr", "dataproc", "mapreduce", "hdfs", "spark sql", "rdd", "dataframe", "big data"],
    "part-8": ["kafka", "flink", "kinesis", "event hubs", "pub/sub", "pubsub", "solace", "rabbitmq", "mqtt", "streaming", "stream processing", "consumer group", "event-driven", "event driven", "message queue", "message broker", "real-time", "real time"],
    "part-9": ["snowflake", "bigquery", "redshift", "synapse", "lakehouse", "delta lake", "iceberg", "hudi", "data warehouse", "data warehousing", "data lake", "microsoft fabric", "olap", "clickhouse", "duckdb"],
    "part-10": ["dbt", "fivetran", "airbyte", "debezium", "cdc", "change data capture", "ingestion", "etl", "elt", "data pipeline", "data pipelines", "ssis", "informatica", "talend", "dlt"],
    "part-11": ["airflow", "dagster", "prefect", "orchestration", "orchestrator", "scheduler", "dag", "dags", "azure data factory", "adf", "cron", "workflow", "luigi", "step functions", "oozie"],
    "part-12": ["data quality", "great expectations", "soda", "observability", "monitoring", "data validation", "alerting", "slo", "sla", "anomaly detection", "monte carlo", "datadog", "grafana", "prometheus", "test coverage", "unit tests", "integration tests"],
    "part-13": ["governance", "pii", "gdpr", "ccpa", "hipaa", "compliance", "lineage", "access control", "rbac", "abac", "encryption", "audit", "data catalog", "unity catalog", "purview", "regulated", "sox", "soc 2", "pci"],
    "part-14": ["azure", "aws", "gcp", "google cloud", "s3", "adls", "blob storage", "lambda", "azure functions", "eks", "aks", "ec2", "cloud", "az-104", "az-305"],
    "part-15": ["kubernetes", "k8s", "terraform", "docker", "ci/cd", "cicd", "azure devops", "github actions", "jenkins", "helm", "platform engineering", "infrastructure as code", "iac", "devops", "cloud foundry", "pivotal", "microservices", "bicep", "ansible", "gitops"],
    "part-16": ["performance tuning", "performance optimization", "optimization", "optimized", "cost optimization", "cost reduction", "caching", "throughput", "latency", "finops", "load testing", "profiling", "scalability"],
    "part-17": ["llm", "rag", "embeddings", "vector database", "vector search", "langchain", "langgraph", "feature store", "machine learning", "mlops", "openai", "anthropic", "pinecone", "pgvector", "lancedb", "fine-tuning", "prompt engineering", "generative ai", "genai", "ai agents"],
    "part-18": ["system design", "architecture", "architected", "designed", "scalable", "high availability", "design document", "design doc", "trade-off", "tradeoff", "microservices", "event-driven"],
    "part-20": ["github", "portfolio", "open source", "open-source", "side project", "personal project", "projects", "hackathon"],
    "part-21": ["certified", "certification", "az-104", "az-305", "aws certified", "databricks certified", "snowpro", "dp-203", "dp-700", "ccdak"]
  };

  var DAY = 864e5;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function loadState() {
    var base = { done: {}, cards: {}, last: null, planStart: null };
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && typeof s === "object") return Object.assign(base, s);
    } catch (e) { /* storage unavailable */ }
    return base;
  }
  function parseDay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return NaN;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(t);
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : NaN;
  }
  function planText(state) {
    var start = parseDay(state.planStart);
    if (Number.isNaN(start)) return "Not started";
    var n = new Date(), today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
    var week = Math.floor((today - start) / (7 * DAY)) + 1;
    if (week < 1) return "Starts soon";
    if (week > 26) return "Complete";
    return "Week " + week + " of 26";
  }
  function partNumber(id) { var m = /^part-(\d+)$/.exec(id); return m ? +m[1] : null; }

  function findTerms(text, words) {
    var found = [];
    words.forEach(function (w) {
      var re = new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + "(?![a-z0-9])");
      if (re.test(text)) found.push(w);
    });
    return found;
  }

  function taskStats(ctx, state) {
    var by = {};
    ctx.tasks.forEach(function (t) {
      var b = by[t.part] || (by[t.part] = { done: 0, total: 0 });
      b.total++;
      if (state.done[t.id]) b.done++;
    });
    return by;
  }

  function analyze(text, ctx, state) {
    var lower = text.toLowerCase();
    var stats = taskStats(ctx, state);
    var rows = [];
    ctx.parts.forEach(function (p) {
      var words = KEYWORDS[p.id];
      if (!words) return;
      var found = findTerms(lower, words);
      var signal = found.length >= 3 ? "strong" : found.length >= 1 ? "some" : "gap";
      var need = signal === "strong" ? 0 : signal === "some" ? 1 : 2;
      var tier = TIER[p.id] || 3;
      var st = stats[p.id] || { done: 0, total: 0 };
      var left = st.total ? 1 - st.done / st.total : 1;
      rows.push({ id: p.id, part: p, found: found, signal: signal, tier: tier, priority: (4 - tier) * need * left });
    });
    var ranked = rows.filter(function (r) { return r.priority > 0; }).sort(function (a, b) { return b.priority - a.priority || a.tier - b.tier; });
    return { rows: rows, ranked: ranked, short: text.trim().length < 300 };
  }

  function label(p) { return p.label ? p.label + ": " + p.short : p.short; }

  function buildPrompt(ctx, state, analysis, resume) {
    var guideUrl = new URL(ctx.guideUrl || "study-guide.html", location.href).href.split("#")[0];
    var stats = taskStats(ctx, state);
    var totalDone = ctx.tasks.filter(function (t) { return state.done[t.id]; }).length;
    var known = ctx.cards.filter(function (c) { return state.cards[c.id] === "known"; }).length;
    var L = [];
    L.push("I want you to build me a personalised study session for moving from software engineering into data and platform engineering.");
    L.push("");
    L.push("I am following the Data Engineering Study Guide at " + guideUrl + ". It has numbered parts and a 26-week plan. Use the part numbers below when you refer to it.");
    L.push("");
    L.push("## About me");
    L.push("- Target role: [FILL IN, for example data engineer, platform engineer or analytics engineer]");
    L.push("- Hours I can study per week: [FILL IN. The guide assumes 10]");
    L.push("");
    L.push("## My progress in the guide");
    L.push("- Drills and milestones done: " + totalDone + " of " + ctx.tasks.length);
    L.push("- Flashcards marked known: " + known + " of " + ctx.cards.length);
    L.push("- 26-week plan: " + planText(state));
    ctx.parts.forEach(function (p) {
      var s = stats[p.id];
      if (s && s.done > 0 && partNumber(p.id) !== null) L.push("- " + p.label + " (" + p.short + "): " + s.done + " of " + s.total + " drills done");
    });
    if (analysis) {
      var group = function (sig) {
        return analysis.rows.filter(function (r) { return r.signal === sig; }).map(function (r) {
          return r.part.label + " " + r.part.short + (r.found.length ? " (" + r.found.slice(0, 6).join(", ") + ")" : "");
        });
      };
      L.push("");
      L.push("## Rough keyword check of my resume");
      L.push("This came from simple keyword matching in my browser, so treat it as a starting point and check it against my actual resume.");
      L.push("- Strong signals: " + (group("strong").join("; ") || "none"));
      L.push("- Some signal: " + (group("some").join("; ") || "none"));
      L.push("- No signal: " + (group("gap").join("; ") || "none"));
      L.push("- Suggested study-first order: " + (analysis.ranked.slice(0, 6).map(function (r) { return r.part.label + " " + r.part.short; }).join("; ") || "none"));
    }
    L.push("");
    L.push("## My resume and transcripts");
    L.push(resume && resume.trim() ? resume.trim() : "[PASTE YOUR RESUME AND ANY TRANSCRIPTS HERE]");
    L.push("");
    L.push("## The guide's parts");
    ctx.parts.forEach(function (p) {
      if (partNumber(p.id) === null) return;
      var t = TIER[p.id];
      L.push("- " + p.label + ": " + p.short + (t ? " (" + TIER_NAME[t] + ")" : ""));
    });
    L.push("");
    L.push("## What to do");
    L.push("1. Read my resume and the parts above. For each part, tell me what evidence my resume gives that I already know it, quoting a few words, or say there is no evidence. Do not invent experience. A keyword match only shows a term appeared, so judge depth from the context.");
    L.push("2. If you need something I have not told you, such as my target role, hours per week or how deep I went on a tool, ask me up to five short questions first and wait for my answers.");
    L.push("3. Then give me:");
    L.push("   a. A ranked gap list: the parts I should study first for my target role, with one sentence on why for each.");
    L.push("   b. A 4-week study plan that adjusts the guide's 26-week plan. Say which weeks to compress or skip because I am already strong, and where to spend the saved time. Show it as a table with the columns week, parts to read, drills, project work and hours.");
    L.push("   c. My first study session this week, as a checklist I can finish in about 90 minutes, using exact drills from the guide.");
    L.push("   d. Three or four stories from my resume I should prepare for interviews, and the part each one supports.");
    L.push("4. State your assumptions. Be concrete and do not pad.");
    return L.join("\n");
  }

  var STYLE = [
    ".st{--st-card:var(--card,var(--surface,#fff));--st-line:var(--line,#ccc);--st-ink:var(--ink,#111);--st-muted:var(--muted,#555);--st-tint:var(--tint,var(--chip,#eee));--st-accent:var(--accent,#2b57c9);color:var(--st-ink);font-size:16px;line-height:1.5}",
    ".st *{box-sizing:border-box}",
    ".st-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:12px 0}",
    ".st-stat{background:var(--st-card);border:1px solid var(--st-line);border-radius:12px;padding:12px 14px}",
    ".st-stat b{display:block;font-size:22px;line-height:1.2;color:var(--st-ink)}",
    ".st-stat span{font-size:14px;color:var(--st-muted)}",
    ".st h4{margin:20px 0 6px;font-size:17px;color:var(--st-ink)}",
    ".st p{margin:6px 0;color:var(--st-muted);max-width:65ch}",
    ".st label{display:block;font-weight:700;color:var(--st-ink);margin:10px 0 6px}",
    ".st textarea{width:100%;min-height:140px;font:inherit;font-size:15px;padding:10px 12px;border:1px solid var(--st-line);border-radius:10px;background:var(--st-card);color:var(--st-ink);resize:vertical}",
    ".st input[type=file]{font:inherit;font-size:15px;max-width:100%;color:var(--st-ink)}",
    ".st-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0}",
    ".st-btn{font:inherit;font-weight:700;padding:10px 16px;min-height:44px;border-radius:10px;border:1px solid var(--st-line);background:var(--st-card);color:var(--st-ink);cursor:pointer}",
    ".st-btn.primary{background:var(--st-accent);border-color:var(--st-accent);color:var(--accent-ink,#fff)}",
    ".st-btn:focus-visible,.st textarea:focus-visible,.st input:focus-visible,.st summary:focus-visible,.st-scroll:focus-visible{outline:3px solid var(--st-ink);outline-offset:2px}",
    ".st-msg{min-height:1.4em;color:var(--st-muted);font-size:15px}",
    ".st-scroll{overflow-x:auto;border:1px solid var(--st-line);border-radius:10px;background:var(--st-card);margin:10px 0}",
    ".st table{border-collapse:collapse;width:100%;min-width:520px;font-size:14.5px;line-height:1.4}",
    ".st th,.st td{text-align:left;vertical-align:top;padding:8px 12px;border-bottom:1px solid var(--st-line);color:var(--st-ink)}",
    ".st th{background:var(--st-tint);font-weight:700}",
    ".st tr:last-child td{border-bottom:0}",
    ".st td a{color:var(--st-accent)}",
    ".st-bar{display:inline-block;width:56px;height:6px;border-radius:3px;background:var(--st-tint);vertical-align:middle;margin-left:8px;overflow:hidden}",
    ".st-bar i{display:block;height:100%;background:var(--st-accent)}",
    ".st-tag{display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid var(--st-line);font-size:13px;font-weight:700}",
    ".st ol.st-rank{padding-left:22px;margin:8px 0;color:var(--st-ink)}",
    ".st ol.st-rank li{margin:6px 0}",
    ".st .st-why{color:var(--st-muted);font-size:14.5px}",
    ".st details{margin:10px 0}",
    ".st summary{cursor:pointer;font-weight:700;padding:6px 0}",
    ".st-note{font-size:14px;color:var(--st-muted)}"
  ].join("\n");

  function mount(el, ctx) {
    if (!document.getElementById("st-style")) {
      var st = document.createElement("style");
      st.id = "st-style"; st.textContent = STYLE;
      document.head.appendChild(st);
    }
    var getState = ctx.getState || loadState;
    var resumeText = "";
    var analysis = null;

    var shown = ctx.parts.filter(function (p) { return partNumber(p.id) !== null && (KEYWORDS[p.id] || ctx.tasks.some(function (t) { return t.part === p.id; })); });

    el.classList.add("st");
    el.innerHTML =
      '<div class="st-stats" id="st-stats"></div>' +
      '<h4>Progress by part</h4>' +
      '<div class="st-scroll" tabindex="0" role="region" aria-label="Progress by part, scrolls sideways"><table><caption class="st-note" style="caption-side:bottom;text-align:left;padding:6px 12px">Drills come from each part&rsquo;s checklist. Resume signal appears after you run the check below.</caption><thead><tr><th scope="col">Part</th><th scope="col">Drills done</th><th scope="col">Resume signal</th></tr></thead><tbody id="st-rows"></tbody></table></div>' +
      '<h4>Check your resume for gaps</h4>' +
      '<p>Paste your resume or transcript text, or load a .txt or .md file. The check runs in your browser by matching keywords to each part, so nothing is uploaded and the text is not saved. For PDF or Word files, copy the text out and paste it.</p>' +
      '<label for="st-text">Resume or transcript text</label>' +
      '<textarea id="st-text" spellcheck="false"></textarea>' +
      '<div class="st-row"><label for="st-file" class="st-note" style="margin:0;font-weight:400">Or load a file:</label><input type="file" id="st-file" accept=".txt,.md,.markdown,text/plain,text/markdown"></div>' +
      '<div class="st-row"><button type="button" class="st-btn primary" id="st-run">Check for gaps</button><button type="button" class="st-btn" id="st-clear">Clear</button></div>' +
      '<div class="st-msg" id="st-msg" role="status" aria-live="polite"></div>' +
      '<div id="st-results"></div>' +
      '<h4>Create your study session</h4>' +
      '<p>Copy a ready-made prompt, paste it into any AI chat, and fill in the two bracketed lines. It includes your progress' + '<span id="st-incl"> and the gap check once you have run it</span>, and asks the AI to build your gap list, a 4-week plan and your first session.</p>' +
      '<div class="st-row"><button type="button" class="st-btn primary" id="st-copy">Copy prompt</button></div>' +
      '<div class="st-msg" id="st-copymsg" role="status" aria-live="polite"></div>' +
      '<details><summary>Show the prompt</summary><label for="st-prompt">Prompt text</label><textarea id="st-prompt" readonly style="min-height:240px"></textarea></details>';

    function $(id) { return el.querySelector("#" + id); }

    function renderStats() {
      var state = getState();
      var done = ctx.tasks.filter(function (t) { return state.done[t.id]; }).length;
      var known = ctx.cards.filter(function (c) { return state.cards[c.id] === "known"; }).length;
      $("st-stats").innerHTML =
        '<div class="st-stat"><b>' + done + " / " + ctx.tasks.length + '</b><span>Drills and milestones</span></div>' +
        '<div class="st-stat"><b>' + known + " / " + ctx.cards.length + '</b><span>Flashcards known</span></div>' +
        '<div class="st-stat"><b>' + esc(planText(state)) + '</b><span>26-week plan</span></div>';
    }

    function renderRows() {
      var state = getState(), stats = taskStats(ctx, state);
      var bySignal = {};
      if (analysis) analysis.rows.forEach(function (r) { bySignal[r.id] = r; });
      $("st-rows").innerHTML = shown.map(function (p) {
        var s = stats[p.id];
        var drills = s ? s.done + " / " + s.total + '<span class="st-bar" aria-hidden="true"><i style="width:' + (s.total ? (s.done / s.total * 100).toFixed(0) : 0) + '%"></i></span>' : "No drills";
        var sig = "Not checked";
        if (analysis) {
          var r = bySignal[p.id];
          sig = r ? (r.signal === "strong" ? "Strong" : r.signal === "some" ? "Some" : "No signal") : "Not detectable";
        }
        var href = ctx.partHref ? ctx.partHref(p.id) : "#" + p.id;
        return "<tr><td><a href=\"" + esc(href) + "\">" + esc(label(p)) + "</a></td><td>" + drills + "</td><td>" + esc(sig) + "</td></tr>";
      }).join("");
    }

    function renderResults() {
      var box = $("st-results");
      if (!analysis) { box.innerHTML = ""; return; }
      var html = "";
      if (analysis.short) html += '<p class="st-note">There is not much text here, so the results will be noisy. Paste the whole resume for a better check.</p>';
      if (!analysis.ranked.length) {
        html += "<p>Every part with checkable keywords shows a strong signal, or all of its drills are done. Keyword matching can&rsquo;t judge depth, so use the prompt below to get a deeper review.</p>";
      } else {
        html += "<h4>Study these first</h4><ol class=\"st-rank\">" + analysis.ranked.slice(0, 6).map(function (r) {
          var why = r.signal === "gap" ? "No related terms found in your text." : "Only " + r.found.length + " related term" + (r.found.length === 1 ? "" : "s") + " found: " + r.found.join(", ") + ".";
          var href = ctx.partHref ? ctx.partHref(r.id) : "#" + r.id;
          return "<li><a href=\"" + esc(href) + "\">" + esc(label(r.part)) + "</a> <span class=\"st-tag\">" + esc(TIER_NAME[r.tier]) + "</span><br><span class=\"st-why\">" + esc(why) + "</span></li>";
        }).join("") + "</ol>";
      }
      html += '<p class="st-note">This is keyword matching only. A term that appears does not show how well you know it, and a missing term may just be worded differently.</p>';
      box.innerHTML = html;
    }

    function refreshPrompt() {
      $("st-prompt").value = buildPrompt(ctx, getState(), analysis, resumeText);
    }

    function run() {
      resumeText = $("st-text").value.slice(0, 200000);
      if (!resumeText.trim()) { $("st-msg").textContent = "Paste some text or load a file first."; return; }
      analysis = analyze(resumeText, ctx, getState());
      $("st-msg").textContent = "Checked " + resumeText.trim().split(/\s+/).length + " words in your browser.";
      renderRows(); renderResults(); refreshPrompt();
    }

    $("st-run").addEventListener("click", run);
    $("st-clear").addEventListener("click", function () {
      $("st-text").value = ""; resumeText = ""; analysis = null; $("st-file").value = "";
      $("st-msg").textContent = "Cleared."; renderRows(); renderResults(); refreshPrompt();
    });
    $("st-file").addEventListener("change", function () {
      var f = this.files[0];
      if (!f) return;
      if (f.size > 1000000) { $("st-msg").textContent = "That file is too large. Paste the text instead."; this.value = ""; return; }
      if (!/\.(txt|md|markdown)$/i.test(f.name) && f.type && f.type.indexOf("text/") !== 0) { $("st-msg").textContent = "Only .txt and .md files are read here. For PDF or Word, copy the text and paste it."; this.value = ""; return; }
      f.text().then(function (t) { $("st-text").value = t; run(); }, function () { $("st-msg").textContent = "Could not read that file. Paste the text instead."; });
    });
    $("st-copy").addEventListener("click", function () {
      resumeText = $("st-text").value.slice(0, 200000);
      refreshPrompt();
      var text = $("st-prompt").value, msg = $("st-copymsg");
      var fallback = function () {
        var ta = $("st-prompt"), d = ta.closest("details");
        d.open = true; ta.focus(); ta.select();
        msg.textContent = "Your browser blocked copying. The prompt is selected below, so press Ctrl+C or Cmd+C.";
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { msg.textContent = "Prompt copied. Paste it into an AI chat and fill in the bracketed lines."; }, fallback);
      } else fallback();
    });

    renderStats(); renderRows(); refreshPrompt();
  }

  window.StudyTracker = { mount: mount, analyze: analyze, buildPrompt: buildPrompt, loadState: loadState };
})();
