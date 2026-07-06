export function formatLiveUpdated(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return null;
  }
}

export function formatResultsTimestamp(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return null;
  }
}

export function resultsSourceLabel(liveResults) {
  if (!liveResults?.contest || !liveResults?.totals) return null;
  const phase = liveResults.resultsPhase;
  const updated = formatResultsTimestamp(
    liveResults.contest?.updatedAt || liveResults.heartbeat?.lastUpdateAt
  );
  if (phase === "certified") {
    return updated ? `Certified · ${updated}` : "Certified";
  }
  if (liveResults.mode === "replay") {
    return updated ? `Replay · ${updated}` : "Replay · prior election";
  }
  return updated
    ? `Live · ${formatLiveUpdated(liveResults.heartbeat?.lastUpdateAt) || updated}`
    : "Live · El Paso ENR";
}

export function liveAreaStatus(area, resultsPhase) {
  if (area.protected) return "In — detail withheld";
  if (area.inContest === false) return "Outside contest";
  if (!area.reported) return "Awaiting results";
  return resultsPhase === "certified" ? "Certified" : "Reporting";
}

/** Match an ENR contest name to a configured ballot race entry. */
export function findBallotRace(contestName, ballotConfig) {
  if (!contestName || !ballotConfig?.groups) return null;
  const n = contestName.toLowerCase();
  for (const group of ballotConfig.groups) {
    for (const race of group.races || []) {
      if (race.enrMatch?.length) {
        if (race.enrMatch.every((m) => n.includes(String(m).toLowerCase()))) {
          return { ...race, groupLabel: group.label, groupId: group.id };
        }
      }
    }
  }
  const statewide = [
    ["governor", "governor"],
    ["u.s. senate", "united states senator"],
    ["u.s. senate", "u.s. senator"],
    ["secretary of state", "secretary of state"],
    ["attorney general", "attorney general"],
    ["state treasurer", "treasurer"],
  ];
  for (const group of ballotConfig.groups) {
    for (const race of group.races || []) {
      const label = race.label.toLowerCase();
      for (const [needle, hay] of statewide) {
        if (label.includes(needle) && n.includes(hay)) {
          return { ...race, groupLabel: group.label, groupId: group.id };
        }
      }
    }
  }
  return null;
}

export function findBallotRaceById(raceId, ballotConfig) {
  if (!raceId || !ballotConfig?.groups) return null;
  for (const group of ballotConfig.groups) {
    const race = (group.races || []).find((r) => r.id === raceId);
    if (race) return { ...race, groupLabel: group.label, groupId: group.id };
  }
  return null;
}

export function formatRaceCandidates(race) {
  if (!race?.candidates?.length) return race?.note || "";
  return race.candidates.map((c) => c.name).join(" vs ");
}

/** Primary with a single filed candidate — outcome is predetermined; track turnout instead. */
export function isRaceUnopposed(race) {
  if (!race) return false;
  if (race.unopposed === true) return true;
  if (race.unopposed === false) return false;
  return (race.candidates?.length ?? 0) === 1;
}

function meaningfulChoices(choices) {
  return (choices || []).filter((c) => {
    const n = (c.name || "").toLowerCase();
    return !/write.?in|undervote|overvote|blank|none of the above/.test(n);
  });
}

/** Prefer ballot config; fall back to live ENR choice count. */
export function isContestUnopposed({ race, totals } = {}) {
  if (race && isRaceUnopposed(race)) return true;
  const live = meaningfulChoices(totals?.choices);
  return live.length === 1;
}

export function computeTurnoutPct(ballots, registered) {
  if (ballots == null || registered == null || registered <= 0) return null;
  return +((ballots / registered) * 100).toFixed(1);
}

export function formatRaceLabel(race) {
  if (!race?.label) return "";
  return isRaceUnopposed(race) ? `${race.label} (unopposed)` : race.label;
}

export function isTrackedCandidate(name, ballotConfig) {
  if (!name || !ballotConfig) return false;
  const n = name.toLowerCase();
  if (ballotConfig.trackedCandidates?.some((t) => n.includes(t.name.toLowerCase()))) {
    return true;
  }
  for (const group of ballotConfig.groups || []) {
    for (const race of group.races || []) {
      if (race.candidates?.some((c) => c.tracked && n.includes(c.name.toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
}

export function contestLegislativeChamber(contestName) {
  const n = (contestName || "").toLowerCase();
  if (n.includes("representative district") || n.includes("state house")) return "house";
  if (n.includes("senator district") || n.includes("state senate")) return "senate";
  return null;
}

export function listBallotRaces(ballotConfig, { chamber = "all" } = {}) {
  if (!ballotConfig?.groups) return [];
  const races = [];
  for (const group of ballotConfig.groups) {
    if (chamber === "house" && group.id !== "house") continue;
    if (chamber === "senate" && group.id !== "senate") continue;
    if (chamber === "tracked") {
      for (const race of group.races || []) {
        const isTracked = race.candidates?.some((c) => c.tracked)
          || ballotConfig.trackedCandidates?.some((t) => t.raceId === race.id);
        if (isTracked) races.push({ ...race, groupLabel: group.label, groupId: group.id });
      }
      continue;
    }
    for (const race of group.races || []) {
      races.push({ ...race, groupLabel: group.label, groupId: group.id });
    }
  }
  return races;
}

export function filterContestsByChamber(contests, chamber) {
  if (!chamber || chamber === "all") return contests;
  return contests.filter((c) => contestLegislativeChamber(c.name) === chamber);
}

/** Pick the ENR contest row that best matches a configured ballot race. */
export function findContestForBallotRace(race, contests) {
  if (!race?.enrMatch?.length || !contests?.length) return null;
  return contests.find((c) =>
    race.enrMatch.every((m) => c.name.toLowerCase().includes(String(m).toLowerCase()))
  ) || null;
}

/** True when ENR/replay rows belong to the ballot race the user selected. */
export function liveResultsMatchBallotRace(liveResults, selectedBallotRace, ballotConfig) {
  if (!liveResults?.contest || !liveResults?.totals || !selectedBallotRace || !ballotConfig) {
    return false;
  }
  if (liveResults.mode === "replay") return false;
  const contestName = liveResults.contest.name || "";
  const matched = findBallotRace(contestName, ballotConfig);
  if (matched?.id === selectedBallotRace.id) return true;
  if (selectedBallotRace.enrMatch?.length) {
    return selectedBallotRace.enrMatch.every((m) =>
      contestName.toLowerCase().includes(String(m).toLowerCase())
    );
  }
  return false;
}

export function sortContestsForBallot(contests, ballotConfig) {
  if (!ballotConfig?.groups?.length) return contests;
  const order = [];
  for (const g of ballotConfig.groups) {
    for (const r of g.races || []) order.push(r);
  }
  const score = (name) => {
    const hit = findBallotRace(name, ballotConfig);
    if (!hit) return 1000;
    return order.findIndex((r) => r.id === hit.id);
  };
  return [...contests].sort((a, b) => score(a.name) - score(b.name));
}

// HTML-escape values before interpolating them into map popup .setHTML(...)
// strings. Popup content is built from external GeoJSON/ENR feed data
// (candidate/leader/place names, addresses) and must never be trusted as HTML.
export function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
