// Display settings: theme, colorblind-safe colors, contrast, text size, link underlines.
// Each choice becomes a data attribute on <html> that the stylesheets read. Choices are
// saved in this browser only. Without JavaScript the site uses its defaults, which follow
// the system light or dark setting.
(function () {
  "use strict";
  var KEY = "aja-display";
  var OPTIONS = [
    { key: "theme", legend: "Theme", choices: [["", "Match my system"], ["light", "Light"], ["dark", "Dark"]] },
    { key: "cvd", legend: "Chart colors", choices: [["", "Standard"], ["safe", "Colorblind-safe, with line patterns"]] },
    { key: "contrast", legend: "Contrast", choices: [["", "Standard"], ["more", "Higher contrast"]] },
    { key: "text", legend: "Text size", choices: [["", "Standard"], ["large", "Larger"]] },
    { key: "links", legend: "Links", choices: [["", "Standard"], ["underline", "Always underline"]] },
  ];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage may be blocked */ }
  }
  function apply(state) {
    var root = document.documentElement;
    OPTIONS.forEach(function (o) {
      if (state[o.key]) root.setAttribute("data-" + o.key, state[o.key]);
      else root.removeAttribute("data-" + o.key);
    });
  }

  var state = load();
  apply(state);

  function build() {
    var header = document.querySelector("header.site");
    if (!header) return;
    var bar = header.firstElementChild;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "settings-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "display-settings");
    toggle.innerHTML = '<span aria-hidden="true">&#9881;</span> Display settings';
    bar.appendChild(toggle);

    var panel = document.createElement("section");
    panel.id = "display-settings";
    panel.className = "settings-panel";
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", "display-settings-h");
    var html = '<div class="settings-inner"><h2 id="display-settings-h">Display settings</h2>' +
      '<p class="settings-note">Saved in this browser only.</p><div class="settings-grid">';
    OPTIONS.forEach(function (o) {
      html += '<fieldset><legend>' + o.legend + "</legend>";
      o.choices.forEach(function (c, i) {
        var id = "set-" + o.key + "-" + i;
        var checked = (state[o.key] || "") === c[0] ? " checked" : "";
        html += '<label for="' + id + '"><input type="radio" id="' + id + '" name="set-' + o.key +
          '" value="' + c[0] + '"' + checked + "> " + c[1] + "</label>";
      });
      html += "</fieldset>";
    });
    html += '</div><div class="settings-actions"><button type="button" class="settings-reset">Reset to defaults</button>' +
      '<button type="button" class="settings-close">Close</button></div></div>';
    panel.innerHTML = html;
    header.insertAdjacentElement("afterend", panel);

    function open(show) {
      panel.hidden = !show;
      toggle.setAttribute("aria-expanded", String(show));
      if (show) panel.querySelector("input:checked, input").focus();
      else toggle.focus();
    }
    toggle.addEventListener("click", function () { open(panel.hidden); });
    panel.querySelector(".settings-close").addEventListener("click", function () { open(false); });
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") open(false); });
    panel.addEventListener("change", function (e) {
      var input = e.target;
      if (!input.name || input.name.indexOf("set-") !== 0) return;
      state[input.name.slice(4)] = input.value;
      if (!input.value) delete state[input.name.slice(4)];
      apply(state);
      save(state);
      document.dispatchEvent(new CustomEvent("display-settings-change"));
    });
    panel.querySelector(".settings-reset").addEventListener("click", function () {
      state = {};
      apply(state);
      save(state);
      panel.querySelectorAll("input").forEach(function (i) { i.checked = i.value === ""; });
      document.dispatchEvent(new CustomEvent("display-settings-change"));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
