// Live status of the wildfire-risk-feed pipeline, read from the status.json its GitHub Actions run
// publishes every 3 hours. Same origin as this site, so no CORS setup is needed.
// Fills any element with [data-feed-status="full"] (status panel) or [data-feed-status="line"] (one line).
(function () {
  var URL_STATUS = "/wildfire-risk-feed/status.json";
  var NAMES = { calfire: "CAL FIRE", wfigs: "NIFC WFIGS", firms: "NASA FIRMS", nws: "NWS alerts" };
  var LEVELS = ["extreme", "high", "moderate", "low"];
  var STALE_HOURS = 7; // two missed runs

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { n.append(c); });
    return n;
  }
  function ago(date) {
    var mins = Math.round((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
    var h = Math.round(mins / 60);
    if (h < 48) return h + (h === 1 ? " hour ago" : " hours ago");
    return Math.round(h / 24) + " days ago";
  }
  function stamp(date) {
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  }
  function overall(s, date) {
    var hours = (Date.now() - date.getTime()) / 3600000;
    if (hours > STALE_HOURS) return { cls: "bad", label: "Behind schedule" };
    if (s.completeness !== "complete") return { cls: "warn", label: "Partial run" };
    return { cls: "ok", label: "Healthy" };
  }

  function renderLine(node, s) {
    var date = new Date(s.generated_at), o = overall(s, date);
    node.replaceChildren(
      el("span", { class: "pill " + o.cls }, [o.label]),
      " Last run " + ago(date) + ", " + Object.keys(s.sources).length + " sources checked"
    );
  }

  function renderFull(node, s) {
    var date = new Date(s.generated_at), o = overall(s, date);
    var head = el("p", { class: "status-head" }, [
      el("span", { class: "pill " + o.cls }, [o.label]),
      " Last run ", el("strong", {}, [ago(date)]), " (" + stamp(date) + "), run ",
      el("code", {}, [s.run_id])
    ]);

    var rows = Object.keys(s.sources).map(function (key) {
      var src = s.sources[key];
      var cls = src.health === "ok" ? "ok" : src.health === "stale" ? "warn" : "bad";
      var label = src.health.charAt(0).toUpperCase() + src.health.slice(1);
      return el("tr", {}, [
        el("th", { scope: "row" }, [NAMES[key] || key, el("span", { class: "detail" }, [src.detail || ""])]),
        el("td", {}, [el("span", { class: "pill " + cls }, [label])]),
        el("td", { class: "n" }, [String(src.quarantined || 0)])
      ]);
    });
    var table = el("table", {}, [
      el("caption", { class: "sr-only" }, ["Source health in the latest pipeline run"]),
      el("thead", {}, [el("tr", {}, ["Source and this run", "Health", "Quarantined"].map(function (h, i) {
        return el("th", { scope: "col", class: i === 2 ? "n" : "" }, [h]);
      }))]),
      el("tbody", {}, rows)
    ]);

    var cells = s.cells || {};
    var stats = el("dl", { class: "status-stats" }, []);
    LEVELS.forEach(function (lv) {
      stats.append(el("div", {}, [el("dt", {}, [lv[0].toUpperCase() + lv.slice(1) + " cells"]), el("dd", {}, [String(cells[lv] || 0)])]));
    });
    stats.append(el("div", {}, [el("dt", {}, ["Open alerts"]), el("dd", {}, [String(s.open_alerts || 0)])]));

    node.replaceChildren(head, el("div", { class: "scroll", tabindex: "0", role: "region", "aria-label": "Source health table" }, [table]), stats);
  }

  function fail(nodes) {
    nodes.forEach(function (n) {
      n.replaceChildren(el("span", { class: "pill warn" }, ["Unavailable"]),
        " Couldn't load the pipeline's status file. ",
        el("a", { href: URL_STATUS }, ["Open status.json"]));
    });
  }

  var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-feed-status]"));
  if (!nodes.length) return;
  fetch(URL_STATUS, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (s) {
      nodes.forEach(function (n) {
        (n.getAttribute("data-feed-status") === "full" ? renderFull : renderLine)(n, s);
        n.setAttribute("aria-busy", "false");
      });
    })
    .catch(function () { fail(nodes); });
})();
