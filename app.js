(() => {
  "use strict";
  const SPORTS = {
    afl: { name: "AFL", url: "current_round.json" },
    nrl: { name: "NRL", url: "nrl_current_round.json" },
  };
  const STALE_AFTER_MS = 18 * 60 * 60 * 1000;
  const $ = (s) => document.querySelector(s);
  const el = {
    sportOptions: [...document.querySelectorAll(".sport-option")],
    roundKicker: $("#round-kicker"), roundDates: $("#round-dates"),
    roundSummary: $("#round-summary-heading"), dataStatus: $("#data-status"), accuracyValue: $("#accuracy-value"),
    accuracyLabel: $("#accuracy-label"), stale: $("#stale-notice"), loading: $("#loading-state"), error: $("#error-state"),
    errorMessage: $("#error-message"), matches: $("#matches"), template: $("#match-template"), refresh: $("#refresh-button"), retry: $("#retry-button"),
  };
  let currentSportId = "afl";
  let current = null;
  let inFlight = false;
  const safe = (v, f = "") => typeof v === "string" && v.trim() ? v.trim() : f;
  const selectedSport = () => SPORTS[currentSportId] || SPORTS.afl;
  const parseTime = (v) => { const n = Date.parse(v); return Number.isFinite(n) ? n : null; };
  function freshness(ts) {
    if (!ts) return "Update time unavailable";
    const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (m < 1) return "Updated just now"; if (m === 1) return "Updated 1 minute ago"; if (m < 60) return `Updated ${m} minutes ago`;
    if (m < 1440) { const h = Math.floor(m / 60); return `Updated ${h} hour${h === 1 ? "" : "s"} ago`; }
    const d = Math.floor(m / 1440); return `Updated ${d} day${d === 1 ? "" : "s"} ago`;
  }
  function confidence(value) {
    const p = Math.max(0, Math.min(100, Number(value) || 0));
    if (p >= 70) return { p, label: "High", level: "high" };
    if (p >= 58) return { p, label: "Medium", level: "medium" };
    return { p, label: "Close", level: "close" };
  }
  function validate(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tips) || !snapshot.tips.length) throw new Error("No picks are available for this sport yet.");
    return snapshot;
  }
  function matchCard(tip, i) {
    const card = el.template.content.firstElementChild.cloneNode(true);
    const c = confidence(tip.confidence_percent);
    card.querySelector(".match-time").textContent = safe(tip.start_time, "Time TBC");
    card.querySelector(".match-venue").textContent = safe(tip.venue, "Venue TBC");
    card.querySelector(".match-number").textContent = `Match ${i + 1}`;
    card.querySelector(".recommended-team").textContent = safe(tip.recommended_team, "Pick TBC");
    card.querySelector(".confidence-percent").textContent = `${c.p}%`;
    card.querySelector(".confidence-label").textContent = c.label;
    card.querySelector(".confidence-pill").dataset.level = c.level;
    card.querySelector(".away-team").textContent = safe(tip.away_team, "Away");
    card.querySelector(".home-team").textContent = safe(tip.home_team, "Home");
    card.querySelector(".reason-text").textContent = safe(tip.reason, "Slight edge on current form and matchup.");
    return card;
  }
  function updateSportControl() {
    el.sportOptions.forEach((button) => {
      const selected = button.dataset.sport === currentSportId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function render(snapshot) {
    current = snapshot;
    const sport = selectedSport();
    el.roundKicker.textContent = `${sport.name} · ${safe(snapshot.round_name, "Current round")}`;
    el.roundDates.textContent = safe(snapshot.round_dates, "Match dates to be confirmed");
    el.roundSummary.textContent = `${snapshot.tips.length} pick${snapshot.tips.length === 1 ? "" : "s"} ready`;
    const ts = parseTime(snapshot.updated_at);
    el.dataStatus.textContent = `${ts ? freshness(ts) : safe(snapshot.updated_label, "Latest update")} · ${safe(snapshot.status, "Current picks")}`;
    el.stale.hidden = !ts || Date.now() - ts <= STALE_AFTER_MS;
    const acc = snapshot.accuracy_percent;
    el.accuracyValue.textContent = Number.isInteger(acc) ? `${acc}%` : "Tracking";
    el.accuracyLabel.textContent = safe(snapshot.accuracy_label, "Accuracy tracking is not available yet.");
    const f = document.createDocumentFragment();
    snapshot.tips.forEach((tip, i) => f.append(matchCard(tip, i)));
    el.matches.replaceChildren(f); el.matches.hidden = false; el.loading.hidden = true; el.error.hidden = true;
  }
  function showError(error) {
    el.loading.hidden = true; el.error.hidden = false; el.matches.hidden = true;
    el.errorMessage.textContent = error instanceof Error ? error.message : "Couldn’t load the latest picks.";
    el.roundSummary.textContent = `${selectedSport().name} picks unavailable`;
  }
  async function load() {
    if (inFlight) return;
    inFlight = true; current = null; el.refresh.disabled = true; el.loading.hidden = false; el.error.hidden = true; el.matches.hidden = true;
    try {
      const response = await fetch(`${selectedSport().url}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`The live picks returned an error (${response.status}).`);
      render(validate(await response.json()));
    } catch (e) { showError(e); }
    finally { inFlight = false; el.refresh.disabled = false; }
  }
  el.sportOptions.forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.sport;
    if (!SPORTS[next] || next === currentSportId) return;
    currentSportId = next;
    updateSportControl();
    load();
  }));
  el.refresh.addEventListener("click", load); el.retry.addEventListener("click", load);
  setInterval(() => current && render(current), 60000);
  updateSportControl();
  load();
})();
