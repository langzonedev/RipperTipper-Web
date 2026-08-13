(() => {
  "use strict";

  const DATA_URL = "current_round.json";
  const STALE_AFTER_MS = 18 * 60 * 60 * 1000;
  const elements = {
    roundKicker: document.querySelector("#round-kicker"),
    roundDates: document.querySelector("#round-dates"),
    roundSummary: document.querySelector("#round-summary-heading"),
    dataStatus: document.querySelector("#data-status"),
    staleNotice: document.querySelector("#stale-notice"),
    loadingState: document.querySelector("#loading-state"),
    errorState: document.querySelector("#error-state"),
    errorMessage: document.querySelector("#error-message"),
    matches: document.querySelector("#matches"),
    template: document.querySelector("#match-template"),
    refreshButton: document.querySelector("#refresh-button"),
    retryButton: document.querySelector("#retry-button"),
  };

  let currentSnapshot = null;
  let requestInFlight = false;

  function safeText(value, fallback = "") { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
  function parseUpdatedAt(value) { const timestamp = Date.parse(value); return Number.isFinite(timestamp) ? timestamp : null; }
  function relativeUpdateLabel(timestamp) {
    if (!timestamp) return "Update time unavailable";
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "Updated just now";
    if (minutes === 1) return "Updated 1 minute ago";
    if (minutes < 60) return `Updated ${minutes} minutes ago`;
    if (minutes < 1440) { const hours = Math.floor(minutes / 60); return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`; }
    const days = Math.floor(minutes / 1440); return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  }
  function confidenceDetails(value) {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    if (percent >= 70) return { percent, label: "High", level: "high" };
    if (percent >= 58) return { percent, label: "Medium", level: "medium" };
    return { percent, label: "Close", level: "close" };
  }
  function validateSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tips)) throw new Error("The round data was not in the expected format.");
    if (snapshot.tips.length === 0) throw new Error("No matches are available for the current round yet.");
    return snapshot;
  }
  function renderMatch(tip, index) {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    const confidence = confidenceDetails(tip.confidence_percent);
    const away = safeText(tip.away_team, "Away team");
    const home = safeText(tip.home_team, "Home team");
    card.querySelector(".match-time").textContent = safeText(tip.start_time, "Time TBC");
    card.querySelector(".match-venue").textContent = safeText(tip.venue, "Venue TBC");
    card.querySelector(".match-number").textContent = `Match ${index + 1}`;
    card.querySelector(".recommended-team").textContent = safeText(tip.recommended_team, "Pick TBC");
    card.querySelector(".confidence-percent").textContent = `${confidence.percent}%`;
    card.querySelector(".confidence-label").textContent = confidence.label;
    card.querySelector(".confidence-pill").dataset.level = confidence.level;
    card.querySelector(".away-team").textContent = away;
    card.querySelector(".home-team").textContent = home;
    card.querySelector(".reason-text").textContent = safeText(tip.reason, "Supporting context will be added when it becomes available.");
    card.querySelector(".reason").setAttribute("aria-label", `${away} versus ${home} supporting context`);
    return card;
  }
  function updateFreshness(snapshot) {
    const timestamp = parseUpdatedAt(snapshot.updated_at);
    const freshness = timestamp ? relativeUpdateLabel(timestamp) : safeText(snapshot.updated_label, "Update time unavailable");
    elements.dataStatus.textContent = `${freshness} · ${safeText(snapshot.status, "Current round picks")}`;
    elements.staleNotice.hidden = !timestamp || Date.now() - timestamp <= STALE_AFTER_MS;
  }
  function renderSnapshot(snapshot) {
    currentSnapshot = snapshot;
    elements.roundKicker.textContent = `Next up · ${safeText(snapshot.round_name, "Current round")}`;
    elements.roundDates.textContent = safeText(snapshot.round_dates, "Match dates to be confirmed");
    elements.roundSummary.textContent = `${snapshot.tips.length} pick${snapshot.tips.length === 1 ? "" : "s"} ready`;
    updateFreshness(snapshot);
    const fragment = document.createDocumentFragment();
    snapshot.tips.forEach((tip, index) => fragment.append(renderMatch(tip, index)));
    elements.matches.replaceChildren(fragment);
    elements.matches.hidden = false; elements.loadingState.hidden = true; elements.errorState.hidden = true;
  }
  function showError(error) {
    elements.loadingState.hidden = true; elements.errorState.hidden = false;
    elements.errorMessage.textContent = error instanceof Error && error.message ? `${error.message} Please try again.` : "We couldn’t load the current round. Check your connection and try again.";
    if (!currentSnapshot) { elements.matches.hidden = true; elements.roundSummary.textContent = "Picks unavailable"; elements.dataStatus.textContent = "Couldn’t reach the latest round data"; }
  }
  async function loadSnapshot() {
    if (requestInFlight) return;
    requestInFlight = true; elements.refreshButton.disabled = true; elements.refreshButton.innerHTML = '<span aria-hidden="true">↻</span> Checking';
    if (!currentSnapshot) { elements.loadingState.hidden = false; elements.errorState.hidden = true; }
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`The live picks returned an error (${response.status}).`);
      renderSnapshot(validateSnapshot(await response.json()));
    } catch (error) { showError(error); }
    finally { requestInFlight = false; elements.refreshButton.disabled = false; elements.refreshButton.innerHTML = '<span aria-hidden="true">↻</span> Refresh'; }
  }
  elements.refreshButton.addEventListener("click", loadSnapshot);
  elements.retryButton.addEventListener("click", loadSnapshot);
  window.setInterval(() => currentSnapshot && updateFreshness(currentSnapshot), 60000);
  loadSnapshot();
})();
