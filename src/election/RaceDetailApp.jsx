import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { Delaunay } from "d3-delaunay";
import "./race-detail.css";


    // ========================================================================
    // SEEDED RNG — mock data must be stable across renders
    // ========================================================================
    function hashSeed(str) {
      let h = 1779033703;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return h >>> 0;
    }
    function mulberry32(seed) {
      let a = seed;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const SETTINGS_STORAGE_KEY = "fs-race-detail-settings";
    const SETTINGS_DEFAULTS = {
      mapColorMode: "gradient",
      band: 2,
      colors: {
        pass: "#2F6B4F",
        fail: "#A8341E",
        watch: "#B8932A",
        yes: "#2F6B4F",
        no: "#A8341E",
        neutral: "#E6E5DA",
      },
      showStatusPill: true,
      showYesPercent: true,
      showMargin: true,
      showPercentIn: true,
      showPercentOutstanding: false,
      showBallotCount: true,
    };

    function useSettings() {
      const [settings, setSettingsState] = useState(() => {
        try {
          const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
          if (!raw) return SETTINGS_DEFAULTS;
          const parsed = JSON.parse(raw);
          return {
            ...SETTINGS_DEFAULTS,
            ...parsed,
            colors: { ...SETTINGS_DEFAULTS.colors, ...(parsed.colors || {}) },
          };
        } catch {
          return SETTINGS_DEFAULTS;
        }
      });

      const setSetting = useCallback((key, value) => {
        setSettingsState(prev => {
          const next = typeof key === "object"
            ? { ...prev, ...key, colors: key.colors ? { ...prev.colors, ...key.colors } : prev.colors }
            : { ...prev, [key]: value };
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }, []);

      const setColor = useCallback((key, value) => {
        setSettingsState(prev => {
          const next = { ...prev, colors: { ...prev.colors, [key]: value } };
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }, []);

      const resetSettings = useCallback(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
        setSettingsState(SETTINGS_DEFAULTS);
      }, []);

      return [settings, setSetting, setColor, resetSettings];
    }

    function computeReportingStats(stats) {
      const { reportedCount, totalCount, ballots, precinctProps } = stats;
      const pctInPrecincts = totalCount > 0 ? (reportedCount / totalCount) * 100 : 0;
      const pctOutPrecincts = totalCount > 0 ? ((totalCount - reportedCount) / totalCount) * 100 : 0;
      const estTotalBallots = precinctProps.reduce(
        (s, p) => s + Math.round(p.registered * p.turnoutRate / 100), 0,
      );
      const pctInBallots = estTotalBallots > 0 ? (ballots / estTotalBallots) * 100 : 0;
      const pctOutBallots = estTotalBallots > 0 ? ((estTotalBallots - ballots) / estTotalBallots) * 100 : 0;
      return { pctInPrecincts, pctOutPrecincts, pctInBallots, pctOutBallots, estTotalBallots };
    }

    function statusFor(yesPct, threshold, band) {
      if (yesPct == null) return "awaiting";
      const diff = yesPct - threshold;
      if (diff >= band) return "pass";
      if (diff <= -band) return "fail";
      return "watch";
    }

    // ========================================================================
    // DATA LAYER — single client: Colorado Springs School District 11.
    // Real jurisdiction boundary (DOLA / Census TIGER); results still mock.
    // ========================================================================
    const CLIENT = {
      id: "csd11-colorado",
      clientName: "Colorado Springs School District 11",
      measureCode: "Ballot Issue 8C",
      measureTitle: "Capital Construction Mill Levy",
      jurisdiction: "Colorado Springs, CO",
      ask: "$48M/yr mill levy",
      electionDate: "Jun 2, 2026",
      consultant: "D. Whitfield",
      threshold: 55,
      estimatedVoters: 95000,
      boundaryUrl: "/election-data/d11-boundary.geojson",
      // Real El Paso County precincts (filtered to the D11 area)
      precinctsUrl: "/election-data/overlay-precincts.geojson",
    };

    // Historical polling only — waves are frozen before election day
    const POLLING = [
      { wave: "Wave 1", date: "Feb 9",  support: 52, oppose: 33 },
      { wave: "Wave 2", date: "Mar 16", support: 55, oppose: 31 },
      { wave: "Wave 3", date: "Apr 27", support: 58, oppose: 29 },
      { wave: "Wave 4", date: "May 25", support: 60, oppose: 28 },
    ];

    const AREA_NAMES = ["Southwest Area", "Southeast Area", "Northwest Area", "Northeast Area"];
    const SCHOOL_TIER_COLORS = { 1: "#1A3A5C", 2: "#B8932A", 3: "#8B9AAB" };

    // ========================================================================
    // MAP OVERLAYS — schools, polling, drop boxes (on top of precinct view)
    // ========================================================================
    const OVERLAYS = {
      schools: {
        label: "Schools", kind: "school",
        url: "/election-data/overlay-schools.geojson",
        color: SCHOOL_TIER_COLORS[1],
      },
      polling: {
        label: "Polling Centers", kind: "point",
        url: "/election-data/Voting_Service_Polling_Center_Locations.geojson",
        color: "#1A3A5C",
        popup: (p) => `<div style="font-weight:700;color:#1A3A5C">${p.NAME}</div><div style="color:#5B5B58">${p.ADDRESS || ""}</div>`,
      },
      dropbox: {
        label: "Drop Boxes", kind: "point",
        url: "/election-data/Ballot_Drop_Boxes.geojson",
        color: "#B8932A",
        popup: (p) => `<div style="font-weight:700;color:#1A3A5C">${p.NAME}</div><div style="color:#5B5B58">${p.ADDRESS || ""}</div>`,
      },
    };

    const DATA_BASE = "/election-data";
    const ZIPS_GEOJSON_URL = `${DATA_BASE}/overlay-zips.geojson`;
    const COUNCIL_GEOJSON_URL = `${DATA_BASE}/citycouncil.geojson`;
    const PRIOR_ELECTIONS_MANIFEST_URL = `${DATA_BASE}/prior-elections-manifest.json`;

    function parsePriorElectionCsv(text) {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return {};
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const byPrecinct = {};
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (!cols.some(c => c.trim())) continue;
        const row = {};
        headers.forEach((h, j) => {
          const raw = (cols[j] || "").trim();
          if (h === "precinct") row.precinct = raw;
          else row[h] = raw === "" ? null : +raw;
        });
        if (row.precinct != null) byPrecinct[String(row.precinct)] = row;
      }
      return byPrecinct;
    }

    async function loadPriorElections(manifestUrl) {
      const manifest = await fetch(manifestUrl).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${manifestUrl}`);
        return r.json();
      });
      const elections = await Promise.all(manifest.elections.map(async (el) => {
        const url = `${DATA_BASE}/${el.file}`;
        const csv = await fetch(url).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
          return r.text();
        });
        return { ...el, byPrecinct: parsePriorElectionCsv(csv) };
      }));
      return { elections };
    }

    function enrichPrecinctsWithPrior(features, priorData, electionId) {
      const election = priorData?.elections?.find(e => e.id === electionId);
      if (!election) return features;
      return features.map(f => {
        const row = election.byPrecinct[String(f.properties.id)] || {};
        const props = { ...f.properties };
        election.metrics.forEach(m => {
          if (row[m.field] != null) props[m.field] = row[m.field];
          if (m.opponentField && row[m.opponentField] != null) props[m.opponentField] = row[m.opponentField];
        });
        return { ...f, properties: props };
      });
    }

    function rollupPriorProps(members, election) {
      if (!election) return {};
      const out = {};
      election.metrics.forEach(m => {
        const vals = members.map(f => f.properties[m.field]).filter(v => v != null && !Number.isNaN(v));
        out[m.field] = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
        if (m.opponentField) {
          const opp = members.map(f => f.properties[m.opponentField]).filter(v => v != null && !Number.isNaN(v));
          out[m.opponentField] = opp.length ? +(opp.reduce((s, v) => s + v, 0) / opp.length).toFixed(1) : null;
        }
      });
      return out;
    }

    function formatPriorMetric(p, metricDef) {
      const v = p[metricDef.field];
      if (v == null) return "No data for this area";
      if (metricDef.opponentField != null && p[metricDef.opponentField] != null) {
        const opp = p[metricDef.opponentField];
        const lead = metricDef.label.replace(/ %$/, "");
        return `${lead}: ${v}% · ${metricDef.opponentLabel}: ${opp}%`;
      }
      return metricDef.scale === "sequential" ? `${v}% turnout` : `${v}%`;
    }

    function filterSchoolFeatures(fc, { tier, showCharter }) {
      if (!fc) return { type: "FeatureCollection", features: [] };
      return {
        type: "FeatureCollection",
        features: fc.features.filter(f => {
          const p = f.properties;
          if (!showCharter && p.isCharter) return false;
          if (tier !== "all" && p.tier !== tier) return false;
          return true;
        }),
      };
    }

    function schoolFiltersForLevel(level, schoolFilters) {
      if (level === "zip") return { tier: "all", showCharter: true };
      return schoolFilters;
    }

    function assignPrecinctZip(precinctFeatures, zipFC) {
      if (!zipFC?.features?.length) return precinctFeatures;
      const zones = zipFC.features.map(f => ({ zip: String(f.properties.zip), geom: f }));
      return precinctFeatures.map(pf => {
        const pt = turf.centroid(pf);
        let zip = null;
        for (const z of zones) {
          if (turf.booleanPointInPolygon(pt, z.geom)) {
            zip = z.zip;
            break;
          }
        }
        return { ...pf, properties: { ...pf.properties, zip } };
      });
    }

    function drawSchoolMarkerCanvas(img, borderColor) {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 5;

      ctx.fillStyle = "rgba(26, 58, 92, 0.16)";
      ctx.beginPath();
      ctx.arc(cx, cy + 3, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const pad = 14;
      const glyph = size - pad * 2;
      ctx.drawImage(img, pad, pad, glyph, glyph);

      return ctx.getImageData(0, 0, size, size);
    }

    function loadSchoolIcons(map) {
      ["school-pin-1", "school-pin-2", "school-pin-3", "school-pin-charter", "school-icon"].forEach(id => {
        if (map.hasImage(id)) map.removeImage(id);
      });
      return fetch("/election-assets/schoolicon.svg")
        .then(r => { if (!r.ok) throw new Error("School icon not found"); return r.text(); })
        .then(svgText => new Promise((resolve, reject) => {
          const filledSvg = svgText.replace(/<path/g, '<path fill="#1A3A5C"');
          const img = new Image();
          img.onload = () => {
            map.addImage("school-pin-1", drawSchoolMarkerCanvas(img, SCHOOL_TIER_COLORS[1]), { pixelRatio: 2 });
            map.addImage("school-pin-2", drawSchoolMarkerCanvas(img, SCHOOL_TIER_COLORS[2]), { pixelRatio: 2 });
            map.addImage("school-pin-3", drawSchoolMarkerCanvas(img, SCHOOL_TIER_COLORS[3]), { pixelRatio: 2 });
            map.addImage("school-pin-charter", drawSchoolMarkerCanvas(img, "#B8932A"), { pixelRatio: 2 });
            map.addImage("school-icon", drawSchoolMarkerCanvas(img, SCHOOL_TIER_COLORS[1]), { pixelRatio: 2 });
            URL.revokeObjectURL(img.src);
            resolve();
          };
          img.onerror = () => reject(new Error("Failed to load school icon"));
          img.src = URL.createObjectURL(new Blob([filledSvg], { type: "image/svg+xml" }));
        }));
    }

    function bindSchoolLayerEvents(map, lyrId, popupRef, overlayHoverRef) {
      map.on("mouseenter", lyrId, (e) => {
        overlayHoverRef.current = true;
        map.getCanvas().style.cursor = "pointer";
        const f = e.features && e.features[0];
        if (f && popupRef.current) {
          popupRef.current
            .setLngLat(f.geometry.coordinates)
            .setHTML(schoolPopup(f.properties))
            .addTo(map);
        }
      });
      map.on("mouseleave", lyrId, () => {
        overlayHoverRef.current = false;
        map.getCanvas().style.cursor = "";
        if (popupRef.current) popupRef.current.remove();
      });
    }

    function addSchoolLayer(map, srcId, lyrId, data, popupRef, overlayHoverRef) {
      if (map.getSource(srcId)) {
        map.getSource(srcId).setData(data);
      } else {
        map.addSource(srcId, { type: "geojson", data });
      }
      if (!map.getLayer(lyrId)) {
        map.addLayer({
          id: lyrId, type: "symbol", source: srcId,
          layout: {
            "icon-image": [
              "case",
              ["boolean", ["get", "isCharter"], false], "school-pin-charter",
              ["match", ["get", "tier"],
                1, "school-pin-1",
                2, "school-pin-2",
                3, "school-pin-3",
                "school-pin-2",
              ],
            ],
            "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.82, 11, 1.02, 14, 1.22],
            "icon-anchor": "center",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
          paint: {
            "icon-opacity": 1,
          },
        });
        bindSchoolLayerEvents(map, lyrId, popupRef, overlayHoverRef);
      }
      if (map.getLayer(lyrId)) {
        map.moveLayer(lyrId);
      }
    }

    function schoolPopup(p) {
      return `
        <div style="font-weight:700;color:#1A3A5C;margin-bottom:6px">${p.name}</div>
        <div style="font-size:11px;color:#5B5B58;line-height:1.55">
          <div style="margin-bottom:4px"><b>${p.tierLabel}</b>${p.schoolType ? ` · ${p.schoolType}` : ""}${p.zip ? ` · ZIP ${p.zip}` : ""}</div>
          <div>Bond allocation: ${p.bond}</div>
          <div>FCI: ${p.fci}</div>
          <div>Charter school: ${p.isCharter ? "Yes" : "No"}</div>
        </div>
      `;
    }

    const DISTRICT_TYPES = {
      council: { label: "City Council", prop: "councilDist", prefix: "CC" },
      senate: { label: "Senate", prop: "senate", prefix: "SD" },
      house: { label: "House", prop: "rep", prefix: "HD" },
    };

    function assignCouncilDistrictToPrecincts(precinctFeatures, councilFC) {
      if (!councilFC?.features?.length) return precinctFeatures;
      const districts = councilFC.features.map(f => ({
        id: f.properties.DISTRICT,
        geom: f,
      }));
      return precinctFeatures.map(pf => {
        const pt = turf.centroid(pf);
        let councilDist = null;
        for (const d of districts) {
          if (turf.booleanPointInPolygon(pt, d.geom)) {
            councilDist = d.id;
            break;
          }
        }
        return {
          ...pf,
          properties: { ...pf.properties, councilDist },
        };
      });
    }

    function buildCouncilDistrictFeatures(precinctFeatures, councilFC, boundary, priorElection) {
      const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x.properties), 0);
      return [...councilFC.features]
        .sort((a, b) => a.properties.DISTRICT - b.properties.DISTRICT)
        .map(cf => {
          const districtId = cf.properties.DISTRICT;
          const members = precinctFeatures.filter(f => f.properties.councilDist === districtId);
          const rep = members.filter(f => f.properties.reported);
          const yes = sum(rep, p => p.yesVotes), no = sum(rep, p => p.noVotes);
          let geometry = cf.geometry;
          if (boundary) {
            try {
              const clipped = turf.intersect(cf, boundary);
              if (clipped) geometry = clipped.geometry;
            } catch (_) { /* keep full geometry if clip fails */ }
          }
          if (!geometry) return null;
          return {
            type: "Feature",
            id: `council-${districtId}`,
            properties: {
              id: `council-${districtId}`,
              name: cf.properties.NAME || `Council District ${districtId}`,
              county: "City Council",
              isCounty: true,
              reported: rep.length > 0,
              reportedCount: rep.length,
              totalCount: members.length,
              registered: sum(members, p => p.registered),
              turnoutRate: rep.length ? +(sum(rep, p => p.turnoutRate) / rep.length).toFixed(1) : 0,
              priorYes: members.length ? +(sum(members, p => p.priorYes) / members.length).toFixed(1) : 0,
              doorsKnocked: members.length ? Math.round(sum(members, p => p.doorsKnocked) / members.length) : 0,
              doorsTotal: sum(members, p => p.doorsKnocked),
              yesPct: yes + no > 0 ? +((yes / (yes + no)) * 100).toFixed(1) : -1,
              yesVotes: yes, noVotes: no, ballots: yes + no,
              councilDist: districtId,
              comDist: districtId,
              repName: cf.properties.RepName,
              ...rollupPriorProps(members, priorElection),
            },
            geometry,
          };
        })
        .filter(Boolean);
    }

    function buildZipDistrictFeatures(precinctFeatures, zipFC, boundary, priorElection) {
      if (!zipFC?.features?.length) return [];
      const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x.properties), 0);
      return [...zipFC.features]
        .sort((a, b) => String(a.properties.zip).localeCompare(String(b.properties.zip)))
        .map(zf => {
          const zip = String(zf.properties.zip);
          const members = precinctFeatures.filter(f => String(f.properties.zip) === zip);
          const rep = members.filter(f => f.properties.reported);
          const yes = sum(rep, p => p.yesVotes), no = sum(rep, p => p.noVotes);
          let geometry = zf.geometry;
          if (boundary) {
            try {
              const clipped = turf.intersect(zf, boundary);
              if (clipped) geometry = clipped.geometry;
            } catch (_) { /* keep full geometry if clip fails */ }
          }
          if (!geometry) return null;
          return {
            type: "Feature",
            id: `zip-${zip}`,
            properties: {
              id: `zip-${zip}`,
              name: zf.properties.name || `ZIP ${zip}`,
              county: "ZIP code",
              isCounty: true,
              reported: rep.length > 0,
              reportedCount: rep.length,
              totalCount: members.length,
              registered: sum(members, p => p.registered),
              turnoutRate: rep.length ? +(sum(rep, p => p.turnoutRate) / rep.length).toFixed(1) : 0,
              priorYes: members.length ? +(sum(members, p => p.priorYes) / members.length).toFixed(1) : 0,
              doorsKnocked: members.length ? Math.round(sum(members, p => p.doorsKnocked) / members.length) : 0,
              doorsTotal: sum(members, p => p.doorsKnocked),
              yesPct: yes + no > 0 ? +((yes / (yes + no)) * 100).toFixed(1) : -1,
              yesVotes: yes, noVotes: no, ballots: yes + no,
              zip,
              ...rollupPriorProps(members, priorElection),
            },
            geometry,
          };
        })
        .filter(Boolean);
    }

    function buildDistrictFeatures(precinctFeatures, typeKey, priorElection) {
      const cfg = DISTRICT_TYPES[typeKey];
      const groups = new Map();
      precinctFeatures.forEach(f => {
        const id = f.properties[cfg.prop];
        if (id == null) return;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(f);
      });

      const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x.properties), 0);
      return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([districtId, members]) => {
        const rep = members.filter(f => f.properties.reported);
        const yes = sum(rep, p => p.yesVotes), no = sum(rep, p => p.noVotes);
        const polys = members.flatMap(f => {
          if (f.geometry.type === "Polygon") return [f.geometry.coordinates];
          if (f.geometry.type === "MultiPolygon") return f.geometry.coordinates;
          return [];
        });
        return {
          type: "Feature",
          id: `${typeKey}-${districtId}`,
          properties: {
            id: `${typeKey}-${districtId}`,
            name: `${cfg.label} ${districtId}`,
            county: cfg.label,
            isCounty: true,
            reported: rep.length > 0,
            reportedCount: rep.length,
            totalCount: members.length,
            registered: sum(members, p => p.registered),
            turnoutRate: rep.length ? +(sum(rep, p => p.turnoutRate) / rep.length).toFixed(1) : 0,
            priorYes: +(sum(members, p => p.priorYes) / members.length).toFixed(1),
            doorsKnocked: Math.round(sum(members, p => p.doorsKnocked) / members.length),
            doorsTotal: sum(members, p => p.doorsKnocked),
            yesPct: yes + no > 0 ? +((yes / (yes + no)) * 100).toFixed(1) : -1,
            yesVotes: yes, noVotes: no, ballots: yes + no,
            comDist: members[0].properties.comDist,
            senate: members[0].properties.senate,
            rep: members[0].properties.rep,
            ...rollupPriorProps(members, priorElection),
          },
          geometry: { type: "MultiPolygon", coordinates: polys },
        };
      });
    }

    function computeStatsFromPrecincts(precinctProps) {
      const rep = precinctProps.filter(p => p.reported);
      const yes = rep.reduce((s, p) => s + p.yesVotes, 0);
      const no = rep.reduce((s, p) => s + p.noVotes, 0);
      return {
        yesPct: yes + no > 0 ? (yes / (yes + no)) * 100 : null,
        reportedCount: rep.length,
        totalCount: precinctProps.length,
        ballots: yes + no,
        precinctProps,
      };
    }

    function buildFilteredRaceView(race, level, districtType, priorCtx) {
      const priorElection = priorCtx?.election || null;
      let allPrecincts = race.precincts.features;
      if (priorCtx?.electionId && race.priorData) {
        allPrecincts = enrichPrecinctsWithPrior(allPrecincts, race.priorData, priorCtx.electionId);
      }
      const precinctProps = allPrecincts.map(f => f.properties);

      if (level === "zip") {
        const features = buildZipDistrictFeatures(allPrecincts, race.zipDistricts, race.boundary, priorElection);
        return {
          geojson: { type: "FeatureCollection", features },
          ...computeStatsFromPrecincts(precinctProps),
        };
      }

      if (level === "precinct") {
        return {
          geojson: { type: "FeatureCollection", features: allPrecincts },
          ...computeStatsFromPrecincts(precinctProps),
        };
      }

      if (level === "district") {
        const features = districtType === "council" && race.councilDistricts
          ? buildCouncilDistrictFeatures(allPrecincts, race.councilDistricts, race.boundary, priorElection)
          : buildDistrictFeatures(allPrecincts, districtType, priorElection);
        return {
          geojson: { type: "FeatureCollection", features },
          ...computeStatsFromPrecincts(precinctProps),
        };
      }

      const sum = (arr, fn) => arr.reduce((s, f) => s + fn(f.properties), 0);
      const areaFeatures = race.counties.features.map(af => {
        const q = af.properties.id - 1000;
        const members = allPrecincts.filter(f => f.properties.quad === q);
        if (!members.length) return null;
        const rep = members.filter(f => f.properties.reported);
        const yes = sum(rep, p => p.yesVotes), no = sum(rep, p => p.noVotes);
        return {
          ...af,
          properties: {
            ...af.properties,
            reported: rep.length > 0,
            reportedCount: rep.length,
            totalCount: members.length,
            registered: sum(members, p => p.registered),
            turnoutRate: rep.length ? +(sum(rep, p => p.turnoutRate) / rep.length).toFixed(1) : 0,
            priorYes: +(sum(members, p => p.priorYes) / members.length).toFixed(1),
            doorsKnocked: Math.round(sum(members, p => p.doorsKnocked) / members.length),
            doorsTotal: sum(members, p => p.doorsKnocked),
            yesPct: yes + no > 0 ? +((yes / (yes + no)) * 100).toFixed(1) : -1,
            yesVotes: yes, noVotes: no, ballots: yes + no,
            ...rollupPriorProps(members, priorElection),
          },
        };
      }).filter(Boolean);

      return {
        geojson: { type: "FeatureCollection", features: areaFeatures },
        ...computeStatsFromPrecincts(precinctProps),
      };
    }

    // Build the full mock race dataset on REAL precinct geography. Shapes and
    // IDs come from the county GIS file; results/turnout/doors are still mock,
    // seeded per precinct number so they're stable. Stats are anchored to the
    // final polling wave so the live narrative matches the historical trend.
    function makeRaceData(client, boundary, precinctsFC, councilFC, zipFC) {
      const rand = mulberry32(hashSeed(client.id));
      const anchor = POLLING.length ? POLLING[POLLING.length - 1].support : 52;
      const [minX, minY, maxX, maxY] = turf.bbox(boundary);
      const bbox = [minX, minY, maxX, maxY];

      // Area rollups: coarse 4-seed Voronoi; precincts roll up to the area
      // their centroid falls in, so the two levels stay consistent.
      const areaSeeds = AREA_NAMES.map((_, q) => [
        minX + (q % 2 ? 0.72 : 0.28) * (maxX - minX) + (rand() - 0.5) * (maxX - minX) * 0.18,
        minY + (q >= 2 ? 0.72 : 0.28) * (maxY - minY) + (rand() - 0.5) * (maxY - minY) * 0.18,
      ]);
      const areaDelaunay = Delaunay.from(areaSeeds);
      const areaVoronoi = areaDelaunay.voronoi(bbox);

      const closeRing = (poly) => {
        const ring = poly.map(([x, y]) => [x, y]);
        const [fx, fy] = ring[0], [lx, ly] = ring[ring.length - 1];
        if (fx !== lx || fy !== ly) ring.push([fx, fy]);
        return ring;
      };
      const clipToBoundary = (feature) => {
        try {
          return turf.intersect(feature, boundary);
        } catch (e) {
          return null;
        }
      };

      // Pass 1 — clip real precincts to the district; drop slivers that only
      // graze the boundary (< 2% of the precinct inside = split precinct edge)
      const inDistrict = [];
      precinctsFC.features.forEach((pf) => {
        const clipped = clipToBoundary(pf);
        if (!clipped) return;
        if (turf.area(clipped) / turf.area(pf) < 0.02) return;
        const c = turf.centroid(clipped).geometry.coordinates;
        inDistrict.push({
          num: pf.properties.PRECINCT,
          senate: pf.properties.SENATE,
          rep: pf.properties.REP,
          comDist: pf.properties.COM_DIST,
          geometry: clipped.geometry,
          quad: areaDelaunay.find(c[0], c[1]),
        });
      });

      // Pass 2 — mock stats per precinct, seeded by real precinct number
      const precinctFeatures = inDistrict.map((p) => {
        const prand = mulberry32(hashSeed(`${client.id}:precinct:${p.num}`));
        const reported = prand() > 0.35;
        const turnoutRate = +(40 + prand() * 45).toFixed(1);
        const priorYes = +(anchor - 9 + prand() * 18).toFixed(1); // spread ±9 around final wave
        const doorsKnocked = Math.round(200 + prand() * 800);
        const registered = Math.round(client.estimatedVoters / inDistrict.length * (0.7 + prand() * 0.6));

        // Live result drifts off prior support, weighted by canvass effort
        const drift = (prand() - 0.5) * 7 + (doorsKnocked - 600) / 250;
        const yesPct = reported ? +Math.min(78, Math.max(28, priorYes + drift)).toFixed(1) : null;
        const ballots = reported ? Math.round(registered * turnoutRate / 100) : 0;
        const yesVotes = reported ? Math.round(ballots * yesPct / 100) : 0;
        const noVotes = reported ? ballots - yesVotes : 0;
        const reportMin = Math.round(prand() * 150); // minutes after 8:00 PM close

        return {
          type: "Feature",
          id: p.num,
          properties: {
            id: p.num,
            name: `Precinct ${p.num}`,
            county: AREA_NAMES[p.quad],
            senate: p.senate, rep: p.rep, comDist: p.comDist,
            quad: p.quad, reported, registered,
            turnoutRate, priorYes, doorsKnocked,
            yesPct: reported ? yesPct : -1,
            yesVotes, noVotes, ballots, reportMin,
          },
          geometry: p.geometry,
        };
      });

      const precinctsWithCouncil = assignPrecinctZip(
        assignCouncilDistrictToPrecincts(precinctFeatures, councilFC),
        zipFC,
      );

      // Area level — aggregate precincts into 4 rollup areas
      const areaFeatures = AREA_NAMES.map((name, q) => {
        const members = precinctsWithCouncil.filter(f => f.properties.quad === q);
        if (!members.length) return null;
        const rep = members.filter(f => f.properties.reported);
        const sum = (arr, fn) => arr.reduce((s, f) => s + fn(f.properties), 0);
        const yes = sum(rep, p => p.yesVotes), no = sum(rep, p => p.noVotes);
        const cell = areaVoronoi.cellPolygon(q);
        const clipped = cell ? clipToBoundary(turf.polygon([closeRing(cell)])) : null;
        if (!clipped) return null;
        const geom = clipped.geometry;
        return {
          type: "Feature",
          id: 1000 + q,
          properties: {
            id: 1000 + q, name, county: name, isCounty: true,
            reported: rep.length > 0,
            reportedCount: rep.length, totalCount: members.length,
            registered: sum(members, p => p.registered),
            turnoutRate: rep.length ? +(sum(rep, p => p.turnoutRate) / rep.length).toFixed(1) : 0,
            priorYes: +(sum(members, p => p.priorYes) / members.length).toFixed(1),
            doorsKnocked: Math.round(sum(members, p => p.doorsKnocked) / members.length),
            doorsTotal: sum(members, p => p.doorsKnocked),
            yesPct: yes + no > 0 ? +((yes / (yes + no)) * 100).toFixed(1) : -1,
            yesVotes: yes, noVotes: no, ballots: yes + no,
          },
          geometry: geom,
        };
      }).filter(Boolean);

      const zipCodes = zipFC?.features
        ? [...zipFC.features].map(f => String(f.properties.zip)).sort()
        : [];

      return {
        precincts: { type: "FeatureCollection", features: precinctsWithCouncil },
        counties: { type: "FeatureCollection", features: areaFeatures },
        councilDistricts: councilFC,
        zipDistricts: zipFC,
        zipCodes,
        boundary,
      };
    }

    // ========================================================================
    // MAP METRICS — choropleth (reporting) or dot-density (field data).
    // Election-night map never uses per-ballot dots; only public rollups.
    // ========================================================================
    const dk = (p) => p.doorsTotal || p.doorsKnocked; // county carries the sum

    function resultsFillColorExpr(threshold, settings) {
      const t = threshold;
      const c = settings.colors;
      const band = settings.band;
      if (settings.mapColorMode === "passFail") {
        return [
          "case",
          ["any", ["!", ["get", "reported"]], ["<", ["get", "yesPct"], 0]], c.neutral,
          [">=", ["get", "yesPct"], ["+", t, band]], c.pass,
          ["<=", ["get", "yesPct"], ["-", t, band]], c.fail,
          c.watch,
        ];
      }
      return [
        "case",
        ["any", ["!", ["get", "reported"]], ["<", ["get", "yesPct"], 0]], c.neutral,
        ["interpolate", ["linear"], ["get", "yesPct"],
          t - 15, c.fail,
          t - 5, "#C77B66",
          t, c.watch,
          t + 5, "#6FA08A",
          t + 15, c.pass,
        ],
      ];
    }

    function formatReporting(p, threshold) {
      if (!p.reported || p.yesPct < 0) return "Awaiting results";
      const margin = p.yesPct - threshold;
      return `${p.yesPct}% yes · ${margin >= 0 ? "+" : ""}${margin.toFixed(1)} vs ${threshold}%`;
    }

    function priorFillColorExpr(metricDef) {
      const field = metricDef.field;
      const interp = ["interpolate", ["linear"], ["get", field]];
      metricDef.stops.forEach(([pct, color]) => { interp.push(pct, color); });
      return [
        "case",
        ["==", ["get", field], null], "#E6E5DA",
        interp,
      ];
    }

    function priorFillOpacityExpr(field) {
      return ["case", ["==", ["get", field], null], 0.5, 0.72];
    }

    const METRICS = {
      results: {
        label: "Reporting",
        mode: "choropleth",
        choroplethKind: "reporting",
        format: formatReporting,
      },
      priorElections: {
        label: "Prior Elections",
        mode: "choropleth",
        choroplethKind: "prior",
      },
      turnout: {
        label: "Turnout",
        mode: "dots",
        dots: {
          per: 60, unit: "voters",
          categories: [
            { key: "voted",  label: "Voted",          color: "#1A3A5C", count: (p) => Math.round(p.registered * p.turnoutRate / 100) },
            { key: "novote", label: "Didn't vote",    color: "#C8C7C1", count: (p) => p.registered - Math.round(p.registered * p.turnoutRate / 100) },
          ],
        },
        format: (p) => `${p.turnoutRate}% turnout`,
      },
      doors: {
        label: "Doors Knocked",
        mode: "dots",
        dots: {
          per: 12, unit: "doors",
          categories: [
            { key: "dfor",     label: "ID'd supporter", color: "#2F6B4F", count: (p) => Math.round(dk(p) * (p.priorYes / 100) * 0.65) },
            { key: "dagainst", label: "ID'd opposed",   color: "#A8341E", count: (p) => Math.round(dk(p) * ((100 - p.priorYes) / 100) * 0.5) },
            { key: "dnone",    label: "No answer",      color: "#C8C7C1", count: (p) => dk(p) - Math.round(dk(p) * (p.priorYes / 100) * 0.65) - Math.round(dk(p) * ((100 - p.priorYes) / 100) * 0.5) },
          ],
        },
        format: (p) => `${dk(p).toLocaleString()} doors`,
      },
    };

    // Ray-cast point-in-polygon test against a single ring
    function pointInRing(x, y, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }

    // Point-in-geometry for Polygon / MultiPolygon (outer ring minus holes)
    function pointInGeometry(x, y, geom) {
      const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
      return polys.some(rings =>
        pointInRing(x, y, rings[0]) && rings.slice(1).every(h => !pointInRing(x, y, h))
      );
    }

    function geomBBox(geom) {
      const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      polys.forEach(rings => rings[0].forEach(([x, y]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }));
      return [minX, minY, maxX, maxY];
    }

    // Scatter dots inside each area polygon — seeded, so positions are stable.
    // Rejection-sampled against the polygon so dots respect irregular shapes.
    function makeDots(geojson, metricKey, seedStr) {
      const m = METRICS[metricKey];
      if (m.mode === "choropleth") return { type: "FeatureCollection", features: [] };
      const features = [];
      geojson.features.forEach((f) => {
        const rand = mulberry32(hashSeed(`${seedStr}:${metricKey}:${f.properties.id}`));
        const geom = f.geometry;
        const [lngMin, latMin, lngMax, latMax] = geomBBox(geom);
        m.dots.categories.forEach((cat) => {
          const n = Math.round(cat.count(f.properties) / m.dots.per);
          for (let i = 0; i < n; i++) {
            let x, y, tries = 0;
            do {
              x = lngMin + rand() * (lngMax - lngMin);
              y = latMin + rand() * (latMax - latMin);
              tries++;
            } while (!pointInGeometry(x, y, geom) && tries < 30);
            if (!pointInGeometry(x, y, geom)) continue;
            features.push({
              type: "Feature",
              properties: { cat: cat.key },
              geometry: { type: "Point", coordinates: [x, y] },
            });
          }
        });
      });
      return { type: "FeatureCollection", features };
    }

    const fmtTime = (min) => {
      const t = 20 * 60 + min; // 8:00 PM close
      const h = Math.floor(t / 60), m = t % 60;
      const h12 = h > 12 ? h - 12 : h;
      return `${h12}:${String(m).padStart(2, "0")} PM`;
    };

    // ========================================================================
    // MAP — 70% canvas, precinct/county zoom, layered heatmap
    // ========================================================================
    function MapView({ geojson, dots, boundary, metric, threshold, level, fitKey, overlays, schoolFilters, priorCtx, settings, onSelect }) {
      const containerRef = useRef(null);
      const mapRef = useRef(null);
      const popupRef = useRef(null);
      const [ready, setReady] = useState(false);
      const onSelectRef = useRef(onSelect);
      onSelectRef.current = onSelect;
      const metricRef = useRef(metric);
      metricRef.current = metric;
      const thresholdRef = useRef(threshold);
      thresholdRef.current = threshold;
      const levelRef = useRef(level);
      levelRef.current = level;
      const overlaysRef = useRef(overlays);
      overlaysRef.current = overlays;
      const schoolFiltersRef = useRef(schoolFilters);
      schoolFiltersRef.current = schoolFilters;
      const priorCtxRef = useRef(priorCtx);
      priorCtxRef.current = priorCtx;
      const settingsRef = useRef(settings);
      settingsRef.current = settings;
      const overlayLoaded = useRef({});
      const schoolDataRef = useRef(null);
      const overlayHoverRef = useRef(false);

      // Init once; bind handlers once
      useEffect(() => {
        if (!containerRef.current || !maplibregl || mapRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: [
                  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.85, "raster-opacity": 0.85 } }],
          },
          center: [-98.5795, 39.8283],
          zoom: 4,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        map.once("load", () => {
          map.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" });
          map.addSource("dots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addSource("mask", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addSource("boundary", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          // Fade out everything outside the jurisdiction so it pops
          map.addLayer({
            id: "mask-fill", type: "fill", source: "mask",
            paint: { "fill-color": "#F8F7F1", "fill-opacity": 0.78 },
          });
          map.addSource("zips", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "areas-fill", type: "fill", source: "areas",
            paint: { "fill-color": "#E6E5DA", "fill-opacity": 0.04 },
          });
          map.addLayer({
            id: "zip-line", type: "line", source: "zips",
            paint: {
              "line-color": "#8B9AAB",
              "line-width": 1.5,
              "line-opacity": 0.22,
            },
          });
          map.addLayer({
            id: "dots-circle", type: "circle", source: "dots",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 1.1, 10, 1.9, 12, 3, 14, 4.6],
              "circle-color": "#999",
              "circle-opacity": 0.82,
            },
          });
          map.addLayer({
            id: "areas-line", type: "line", source: "areas",
            paint: {
              "line-color": "#1A3A5C",
              "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.35],
              "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
            },
          });
          // Jurisdiction outline — drawn on top so the district reads clearly
          map.addLayer({
            id: "boundary-line", type: "line", source: "boundary",
            paint: { "line-color": "#1A3A5C", "line-width": 2.5, "line-opacity": 0.9 },
          });

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
          popupRef.current = popup;
          let hoverId = null;

          map.on("mousemove", "areas-fill", (e) => {
            if (overlayHoverRef.current) return; // a point overlay owns the popup
            const f = e.features && e.features[0];
            if (!f) return;
            map.getCanvas().style.cursor = "pointer";
            if (hoverId !== null) map.setFeatureState({ source: "areas", id: hoverId }, { hover: false });
            hoverId = f.id;
            map.setFeatureState({ source: "areas", id: hoverId }, { hover: true });
            const p = f.properties;
            const m = METRICS[metricRef.current];
            let fmt;
            let sub = "";
            if (m.choroplethKind === "prior") {
              const ctx = priorCtxRef.current;
              fmt = ctx?.metricDef ? formatPriorMetric(p, ctx.metricDef) : "Prior election data not loaded";
              if (ctx?.election) sub = `<div style="color:#7A7975;font-size:11px">${ctx.election.label} · ${ctx.election.date}</div>`;
            } else if (m.mode === "choropleth") {
              fmt = m.format(p, thresholdRef.current);
              sub = p.reported && p.yesPct >= 0
                ? `<div style="color:#7A7975;font-size:11px">Public precinct total · ${fmtTime(p.reportMin)}</div>`
                : `<div style="color:#7A7975;font-size:11px">No totals released yet</div>`;
            } else {
              fmt = m.format(p);
            }
            popup.setLngLat(e.lngLat).setHTML(
              `<div style="font-weight:700;color:#1A3A5C;margin-bottom:2px">${p.name}</div>` +
              `<div style="color:#5B5B58">${fmt}</div>` + sub
            ).addTo(map);
          });
          map.on("mouseleave", "areas-fill", () => {
            map.getCanvas().style.cursor = "";
            if (hoverId !== null) map.setFeatureState({ source: "areas", id: hoverId }, { hover: false });
            hoverId = null;
            popup.remove();
          });
          map.on("click", "areas-fill", (e) => {
            overlayHoverRef.current = false;
            if (popupRef.current) popupRef.current.remove();
            if (e.features && e.features[0]) onSelectRef.current(e.features[0].properties);
          });

          loadSchoolIcons(map).catch(e => console.error("School icons failed:", e));

          setReady(true);
        });

        return () => { map.remove(); mapRef.current = null; };
      }, []);

      // Data updates — setData, never tear down layers
      useEffect(() => {
        if (!ready || !mapRef.current) return;
        mapRef.current.getSource("areas").setData(geojson);
      }, [ready, geojson]);

      useEffect(() => {
        if (!ready || !mapRef.current) return;
        mapRef.current.getSource("dots").setData(dots);
      }, [ready, dots]);

      // Reference overlays — schools, polling, drop boxes
      useEffect(() => {
        if (!ready || !mapRef.current) return;
        const map = mapRef.current;
        Object.entries(OVERLAYS).forEach(([key, cfg]) => {
          const on = !!overlays[key];
          const srcId = `ov-${key}`, lyrId = `ov-${key}-lyr`;
          if (on && !overlayLoaded.current[key]) {
            overlayLoaded.current[key] = "loading";
            fetch(cfg.url)
              .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
              .then(data => {
                if (!mapRef.current) return;
                if (cfg.kind === "school") {
                  schoolDataRef.current = data;
                  loadSchoolIcons(map).then(() => {
                    if (!mapRef.current) return;
                    const filtered = filterSchoolFeatures(data, schoolFiltersForLevel(levelRef.current, schoolFiltersRef.current));
                    addSchoolLayer(map, srcId, lyrId, filtered, popupRef, overlayHoverRef);
                    overlayLoaded.current[key] = true;
                    map.setLayoutProperty(lyrId, "visibility", overlaysRef.current[key] ? "visible" : "none");
                    if (map.getLayer(lyrId)) map.moveLayer(lyrId);
                  }).catch(e => console.error("Schools overlay failed:", e));
                  return;
                }
                map.addSource(srcId, { type: "geojson", data });
                map.addLayer({
                  id: lyrId, type: "circle", source: srcId,
                  paint: {
                    "circle-radius": 5.5, "circle-color": cfg.color,
                    "circle-stroke-color": "#FFFFFF", "circle-stroke-width": 1.5,
                  },
                });
                if (cfg.popup) {
                  map.on("mouseenter", lyrId, (e) => {
                    overlayHoverRef.current = true;
                    map.getCanvas().style.cursor = "pointer";
                    const f = e.features && e.features[0];
                    if (f && popupRef.current) {
                      popupRef.current.setLngLat(f.geometry.coordinates).setHTML(cfg.popup(f.properties)).addTo(map);
                    }
                  });
                  map.on("mouseleave", lyrId, () => {
                    overlayHoverRef.current = false;
                    map.getCanvas().style.cursor = "";
                    if (popupRef.current) popupRef.current.remove();
                  });
                }
                overlayLoaded.current[key] = true;
                map.setLayoutProperty(lyrId, "visibility", overlaysRef.current[key] ? "visible" : "none");
              })
              .catch(e => { console.error(`Overlay ${key} failed:`, e); overlayLoaded.current[key] = undefined; });
          } else if (overlayLoaded.current[key] === true) {
            map.setLayoutProperty(lyrId, "visibility", on ? "visible" : "none");
          }
        });
      }, [ready, overlays]);

      useEffect(() => {
        if (!ready || !mapRef.current || !schoolDataRef.current) return;
        const map = mapRef.current;
        if (!overlayLoaded.current.schools) return;
        const filtered = filterSchoolFeatures(schoolDataRef.current, schoolFiltersForLevel(level, schoolFilters));
        const src = map.getSource("ov-schools");
        if (src) src.setData(filtered);
        if (map.getLayer("ov-schools-lyr")) {
          map.setLayoutProperty("ov-schools-lyr", "visibility", overlays.schools ? "visible" : "none");
        }
      }, [ready, schoolFilters, level, overlays.schools]);

      useEffect(() => {
        if (!ready || !mapRef.current) return;
        const map = mapRef.current;
        if (map.getLayer("zip-line")) {
          map.setLayoutProperty("zip-line", "visibility", "none");
        }
      }, [ready, level]);

      // Boundary + outside-jurisdiction fade mask (world ring with the
      // district cut out as a hole)
      useEffect(() => {
        if (!ready || !mapRef.current || !boundary) return;
        const map = mapRef.current;
        map.getSource("boundary").setData(boundary);
        const g = boundary.geometry;
        const outers = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map(rings => rings[0]);
        map.getSource("mask").setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [[-179.9, -85], [179.9, -85], [179.9, 85], [-179.9, 85], [-179.9, -85]],
              ...outers,
            ],
          },
        });
      }, [ready, boundary]);

      // Refit when view or filters change
      useEffect(() => {
        if (!ready || !mapRef.current) return;
        const map = mapRef.current;
        if (!geojson.features.length) return;
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach(f => {
          const [minX, minY, maxX, maxY] = geomBBox(f.geometry);
          bounds.extend([minX, minY]);
          bounds.extend([maxX, maxY]);
        });
        map.fitBounds(bounds, { padding: 48, duration: 900 });
      }, [ready, fitKey]);

      // Paint updates — reporting uses area choropleth; field metrics use dots
      useEffect(() => {
        if (!ready || !mapRef.current) return;
        const map = mapRef.current;
        const m = METRICS[metric];
        if (m.mode === "choropleth") {
          map.setLayoutProperty("dots-circle", "visibility", "none");
          if (m.choroplethKind === "prior") {
            if (priorCtx?.metricDef) {
              map.setPaintProperty("areas-fill", "fill-color", priorFillColorExpr(priorCtx.metricDef));
              map.setPaintProperty("areas-fill", "fill-opacity", priorFillOpacityExpr(priorCtx.metricDef.field));
            } else {
              map.setPaintProperty("areas-fill", "fill-color", "#E6E5DA");
              map.setPaintProperty("areas-fill", "fill-opacity", 0.5);
            }
          } else {
            map.setPaintProperty("areas-fill", "fill-color", resultsFillColorExpr(threshold, settingsRef.current));
            map.setPaintProperty("areas-fill", "fill-opacity", [
              "case",
              ["any", ["!", ["get", "reported"]], ["<", ["get", "yesPct"], 0]], 0.5,
              0.72,
            ]);
          }
          return;
        }
        map.setLayoutProperty("dots-circle", "visibility", "visible");
        map.setPaintProperty("areas-fill", "fill-color", settingsRef.current.colors.neutral);
        map.setPaintProperty("areas-fill", "fill-opacity", 0.04);
        const matchExpr = ["match", ["get", "cat"]];
        m.dots.categories.forEach(c => matchExpr.push(c.key, c.color));
        matchExpr.push("#999999");
        map.setPaintProperty("dots-circle", "circle-color", matchExpr);
      }, [ready, metric, threshold, level, priorCtx, settings]);

      return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
    }

    // ========================================================================
    // SIDEBAR PIECES
    // ========================================================================
    const cardStyle = {
      background: "var(--fs-paper)", border: "1px solid var(--fs-border)",
      borderRadius: "var(--fs-radius-md)", padding: 16,
    };
    const eyebrowStyle = {
      fontSize: 11, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "var(--fs-tracking-caps)", color: "var(--fs-fg-accent)", marginBottom: 10,
    };

    function StatusPill({ yesPct, threshold, reportedShare, settings }) {
      const c = settings.colors;
      const band = settings.band;
      let label, bg, fg;
      const sKey = statusFor(yesPct, threshold, band);
      if (reportedShare < 0.05 || yesPct == null || sKey === "awaiting") {
        label = "Awaiting results"; bg = "var(--fs-bone-100)"; fg = "var(--fs-ink-500)";
      } else if (sKey === "pass") {
        label = "Likely Pass"; bg = `${c.pass}1F`; fg = c.pass;
      } else if (sKey === "watch") {
        label = "Too Close"; bg = `${c.watch}33`; fg = c.watch;
      } else {
        label = "Trailing"; bg = `${c.fail}1A`; fg = c.fail;
      }
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: bg, color: fg }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: fg }} />
          {label}
        </span>
      );
    }

    function LiveResultsCard({ client, stats, settings, embedded }) {
      const { yesPct, reportedCount, totalCount, ballots } = stats;
      const t = client.threshold;
      const margin = yesPct != null ? yesPct - t : null;
      const rep = computeReportingStats(stats);
      const compact = !settings.showYesPercent && !settings.showMargin;
      return (
        <div style={embedded ? { height: "100%" } : cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ ...eyebrowStyle, marginBottom: 0 }}>Live · Provisional</div>
            {settings.showStatusPill && (
              <StatusPill yesPct={yesPct} threshold={t} reportedShare={reportedCount / totalCount} settings={settings} />
            )}
          </div>
          {!compact && (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 4 }}>
                {settings.showYesPercent && (
                  <div>
                    <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 34, color: settings.colors.yes }}>
                      {yesPct != null ? yesPct.toFixed(1) : "—"}%
                    </span>
                    <span style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginLeft: 6 }}>Yes</span>
                  </div>
                )}
                {settings.showMargin && margin != null && (
                  <div>
                    <span style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 20, color: margin >= 0 ? settings.colors.yes : settings.colors.no }}>
                      {margin >= 0 ? "+" : ""}{margin.toFixed(1)}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--fs-fg-muted)", marginLeft: 6 }}>vs {t}% line</span>
                  </div>
                )}
              </div>
              {settings.showYesPercent && (
                <>
                  <div style={{ position: "relative", height: 8, background: "var(--fs-bone-100)", borderRadius: 4, margin: "10px 0 6px" }}>
                    <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${yesPct || 0}%`, background: settings.colors.yes, borderRadius: 4, transition: "width 600ms var(--fs-ease-out)" }} />
                    <div style={{ position: "absolute", top: -3, bottom: -3, left: `${t}%`, width: 2, background: "var(--fs-ink)", borderRadius: 1 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fs-fg-subtle)" }}>
                    <span>{t}% needed to pass</span>
                    {settings.showMargin && margin != null && (
                      <span style={{ fontWeight: 700, color: margin >= 0 ? settings.colors.yes : settings.colors.no }}>
                        {margin >= 0 ? "+" : ""}{margin.toFixed(1)} vs line
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {(settings.showPercentIn || settings.showPercentOutstanding || settings.showBallotCount) && (
            <div style={{ marginTop: compact ? 0 : 12, paddingTop: compact ? 0 : 12, borderTop: compact ? "none" : "1px solid var(--fs-border)", display: "flex", gap: 18, fontSize: 12, color: "var(--fs-fg-muted)", flexWrap: "wrap" }}>
              {settings.showPercentIn && (
                <span><b style={{ color: "var(--fs-navy)" }}>{rep.pctInPrecincts.toFixed(1)}%</b> precincts in · {reportedCount} of {totalCount}</span>
              )}
              {settings.showPercentOutstanding && (
                <span><b style={{ color: "var(--fs-navy)" }}>{rep.pctOutPrecincts.toFixed(1)}%</b> precincts outstanding</span>
              )}
              {settings.showBallotCount && (
                <span><b style={{ color: "var(--fs-navy)" }}>{ballots.toLocaleString()}</b> ballots counted{settings.showPercentIn ? ` · ${rep.pctInBallots.toFixed(1)}% in` : ""}{settings.showPercentOutstanding ? ` · ${rep.pctOutBallots.toFixed(1)}% outstanding` : ""}</span>
              )}
            </div>
          )}
          <div style={{ fontSize: 10, color: "var(--fs-ink-400)", marginTop: 8 }}>
            Map shows public precinct totals only — no ballot-level data.
          </div>
        </div>
      );
    }

    // Historical polling trend — SVG chart with threshold line
    function TrendChart({ polls, threshold, embedded }) {
      const W = 300, H = 150, padL = 28, padR = 30, padT = 12, padB = 24;
      const xs = (i) => padL + (i / Math.max(1, polls.length - 1)) * (W - padL - padR);
      const ys = (v) => padT + (1 - v / 80) * (H - padT - padB);
      const path = (key) => polls.map((p, i) => `${i ? "L" : "M"}${xs(i)},${ys(p[key])}`).join(" ");
      const undecided = polls.map(p => 100 - p.support - p.oppose);
      const last = polls[polls.length - 1];
      return (
        <div style={embedded ? { height: "100%" } : cardStyle}>
          <div style={eyebrowStyle}>Polling Trend · {polls.length} waves</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", maxHeight: embedded ? 280 : undefined }}>
            {[20, 40, 60, 80].map(v => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={ys(v)} y2={ys(v)} stroke="var(--fs-bone-200)" strokeWidth="1" />
                <text x={padL - 6} y={ys(v) + 3} textAnchor="end" fontSize="8" fill="var(--fs-ink-300)">{v}</text>
              </g>
            ))}
            {/* Threshold */}
            <line x1={padL} x2={W - padR} y1={ys(threshold)} y2={ys(threshold)} stroke="var(--fs-gold-700)" strokeWidth="1.2" strokeDasharray="4 3" />
            <text x={W - padR + 3} y={ys(threshold) + 3} fontSize="8" fontWeight="700" fill="var(--fs-gold-700)">{threshold}%</text>
            {/* Series */}
            <path d={path("support")} fill="none" stroke="var(--fs-success)" strokeWidth="2" />
            <path d={path("oppose")} fill="none" stroke="var(--fs-danger)" strokeWidth="2" />
            <path d={undecided.map((v, i) => `${i ? "L" : "M"}${xs(i)},${ys(v)}`).join(" ")} fill="none" stroke="var(--fs-ink-300)" strokeWidth="1.5" strokeDasharray="2 3" />
            {polls.map((p, i) => (
              <g key={i}>
                <circle cx={xs(i)} cy={ys(p.support)} r="3" fill="var(--fs-success)" />
                <circle cx={xs(i)} cy={ys(p.oppose)} r="3" fill="var(--fs-danger)" />
                <text x={xs(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="var(--fs-ink-400)">{p.date}</text>
              </g>
            ))}
          </svg>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--fs-fg-muted)", marginTop: 8 }}>
            <span><span style={{ display: "inline-block", width: 10, height: 3, background: "var(--fs-success)", verticalAlign: "middle", marginRight: 4 }} />Support {last.support}%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 3, background: "var(--fs-danger)", verticalAlign: "middle", marginRight: 4 }} />Oppose {last.oppose}%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 3, background: "var(--fs-ink-300)", verticalAlign: "middle", marginRight: 4 }} />Und. {100 - last.support - last.oppose}%</span>
          </div>
        </div>
      );
    }

    function ResultsFeed({ precincts, threshold, settings, embedded }) {
      const c = settings.colors;
      const feed = precincts
        .filter(p => p.reported)
        .sort((a, b) => b.reportMin - a.reportMin)
        .slice(0, embedded ? 24 : 8);
      return (
        <div style={embedded ? { height: "100%" } : { ...cardStyle, padding: 0 }}>
          <div style={{ ...eyebrowStyle, marginBottom: 0, padding: embedded ? "0 0 10px" : "14px 16px 10px" }}>Reporting Feed</div>
          <div style={{ fontSize: 10, color: "var(--fs-ink-400)", padding: embedded ? "0 0 8px" : "0 16px 8px" }}>
            Precincts as they release public totals — newest first.
          </div>
          <div>
            {feed.map((p) => {
              const margin = p.yesPct - threshold;
              const passing = p.yesPct >= threshold;
              return (
                <div key={p.id} className="feedrow" style={{ display: "flex", alignItems: "center", gap: 10, padding: embedded ? "10px 0" : "8px 16px", borderTop: "1px solid var(--fs-border)", fontSize: 12 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: passing ? c.pass : c.fail }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "var(--fs-fg-subtle)" }}>{p.county} · In at {fmtTime(p.reportMin)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, color: passing ? c.pass : c.fail }}>{p.yesPct}%</div>
                    <div style={{ fontSize: 10, color: "var(--fs-fg-subtle)" }}>{margin >= 0 ? "+" : ""}{margin.toFixed(1)} vs line</div>
                  </div>
                </div>
              );
            })}
            {!feed.length && <div style={{ padding: embedded ? "12px 0" : "12px 16px", fontSize: 12, color: "var(--fs-fg-muted)", borderTop: "1px solid var(--fs-border)" }}>No precincts reporting yet.</div>}
          </div>
        </div>
      );
    }

    function MeasureContextCard({ client, embedded }) {
      return (
        <div style={embedded ? { height: "100%" } : cardStyle}>
          <div style={eyebrowStyle}>Measure Context</div>
          {[
            ["Jurisdiction", client.jurisdiction],
            ["The ask", client.ask],
            ["Passage threshold", `${client.threshold}%${client.threshold > 50 ? " supermajority" : " simple majority"}`],
            ["Est. voters", `${(client.estimatedVoters / 1000).toFixed(0)}K`],
            ["Consultant", client.consultant],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i ? "1px solid var(--fs-border)" : "none", fontSize: 13 }}>
              <span style={{ color: "var(--fs-fg-muted)" }}>{k}</span>
              <span style={{ fontWeight: 600, color: "var(--fs-navy)", textAlign: "right", maxWidth: "58%" }}>{v}</span>
            </div>
          ))}
        </div>
      );
    }

    function priorDetailRows(area, priorCtx) {
      if (!priorCtx?.metricDef) return [];
      const m = priorCtx.metricDef;
      const v = area[m.field];
      if (v == null) return [["Prior election", "No data"]];
      const rows = [[m.label, `${v}%`]];
      if (m.opponentField != null && area[m.opponentField] != null) {
        rows.push([`${m.opponentLabel} %`, `${area[m.opponentField]}%`]);
      }
      if (priorCtx.election) rows.unshift(["Election", `${priorCtx.election.label} (${priorCtx.election.date})`]);
      return rows;
    }

    function SelectedAreaCard({ area, threshold, onClose, embedded, priorCtx, settings }) {
      const c = settings?.colors || SETTINGS_DEFAULTS.colors;
      const isCounty = !!area.isCounty;
      const priorRows = priorCtx ? priorDetailRows(area, priorCtx) : [];
      const rows = isCounty
        ? [
            ...(area.repName ? [["Council member", area.repName]] : []),
            ["Reporting", `${area.reportedCount} of ${area.totalCount} precincts in`],
            ["Running yes", area.yesPct >= 0 ? `${area.yesPct}%` : "—"],
            ["Avg turnout", `${area.turnoutRate}%`],
            ...priorRows,
            ["Doors knocked", Number(area.doorsTotal).toLocaleString()],
          ]
        : [
            ["Status", area.reported ? `In at ${fmtTime(area.reportMin)}` : "Awaiting results"],
            ...(area.zip ? [["ZIP code", area.zip]] : []),
            ["Precinct yes", area.reported && area.yesPct >= 0 ? `${area.yesPct}%` : "—"],
            ["Turnout", `${area.turnoutRate}%`],
            ...priorRows,
            ["Doors knocked", Number(area.doorsKnocked).toLocaleString()],
            ...(area.senate || area.comDist ? [["Districts", [
              area.comDist != null ? `CC ${area.comDist}` : null,
              area.senate != null ? `SD ${area.senate}` : null,
              area.rep != null ? `HD ${area.rep}` : null,
            ].filter(Boolean).join(" · ")]] : []),
          ];
      const passing = area.yesPct >= 0 ? area.yesPct >= threshold : null;
      return (
        <div style={embedded ? { height: "100%" } : { ...cardStyle, borderColor: "var(--fs-border-strong)", boxShadow: "var(--fs-shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 17, color: "var(--fs-navy)" }}>{area.name}</div>
              <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)" }}>
                {isCounty ? (area.repName || area.county) : area.county}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 18, lineHeight: 1, color: "var(--fs-ink-400)" }}>×</button>
          </div>
          {area.yesPct >= 0 && (
            <div style={{ fontFamily: "var(--fs-font-display)", fontWeight: 700, fontSize: 26, color: passing ? c.pass : c.fail, marginBottom: 8 }}>
              {area.yesPct}% <span style={{ fontSize: 12, fontFamily: "var(--fs-font-sans)", fontWeight: 600, color: "var(--fs-fg-muted)" }}>yes</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--fs-border)", fontSize: 12 }}>
                <span style={{ color: "var(--fs-fg-muted)" }}>{k}</span>
                <span style={{ fontWeight: 600, color: "var(--fs-navy)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ========================================================================
    // MAP OVERLAYS
    // ========================================================================
    function Legend({ metric, threshold, priorCtx, settings }) {
      const m = METRICS[metric];
      const c = settings.colors;
      if (m.mode === "choropleth") {
        const legendBox = (title, gradient, labels, footer, swatches) => (
          <div style={{
            position: "absolute", left: 14, bottom: 26, zIndex: 5,
            background: "rgba(255,255,255,0.94)", border: "1px solid var(--fs-border)",
            borderRadius: "var(--fs-radius-md)", padding: "10px 12px", boxShadow: "var(--fs-shadow-sm)", minWidth: 190,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-ink-500)", marginBottom: 6 }}>
              {title}
            </div>
            {gradient ? (
              <>
                <div style={{ height: 8, borderRadius: 4, marginBottom: 6, background: gradient }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--fs-ink-400)" }}>
                  {labels}
                </div>
              </>
            ) : swatches}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 9, color: "var(--fs-ink-400)" }}>
              <span style={{ width: 10, height: 10, background: c.neutral, border: "1px solid var(--fs-border)", borderRadius: 2, flexShrink: 0 }} />
              No data
            </div>
            {footer && (
              <div style={{ fontSize: 9, color: "var(--fs-ink-400)", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--fs-border)" }}>
                {footer}
              </div>
            )}
          </div>
        );
        if (m.choroplethKind === "prior" && priorCtx?.metricDef) {
          const md = priorCtx.metricDef;
          const colors = md.stops.map(s => s[1]);
          const labels = md.stops.filter((_, i) => i === 0 || i === Math.floor(md.stops.length / 2) || i === md.stops.length - 1)
            .map(s => <span key={s[0]}>{s[0]}%</span>);
          return legendBox(
            `${priorCtx.election?.label || "Prior"} · ${md.label}`,
            `linear-gradient(90deg, ${colors.join(", ")})`,
            labels,
            md.scale === "diverging" ? "Diverging scale — higher % toward navy" : "Turnout by precinct",
          );
        }
        if (settings.mapColorMode === "passFail") {
          return legendBox(
            m.label,
            null,
            null,
            "Pass / fail relative to threshold ± band",
            (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 2 }}>
                {[
                  { color: c.pass, label: "Leading (pass)" },
                  { color: c.watch, label: "Too close" },
                  { color: c.fail, label: "Trailing (fail)" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--fs-ink-500)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    {item.label}
                  </div>
                ))}
              </div>
            ),
          );
        }
        const t = threshold;
        const stops = [
          { pct: t - 15, color: c.fail, label: "Trailing" },
          { pct: t, color: c.watch, label: `${t}% line` },
          { pct: t + 15, color: c.pass, label: "Leading" },
        ];
        return legendBox(
          m.label,
          `linear-gradient(90deg, ${stops.map(s => s.color).join(", ")})`,
          stops.map(s => <span key={s.label}>{s.label}</span>),
          "Public precinct totals only — no ballot dots",
        );
      }
      return (
        <div style={{
          position: "absolute", left: 14, bottom: 26, zIndex: 5,
          background: "rgba(255,255,255,0.94)", border: "1px solid var(--fs-border)",
          borderRadius: "var(--fs-radius-md)", padding: "10px 12px", boxShadow: "var(--fs-shadow-sm)", minWidth: 170,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-ink-500)", marginBottom: 6 }}>
            {m.label}
          </div>
          {m.dots.categories.map((c) => (
            <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, color: "var(--fs-ink-500)", marginTop: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, flexShrink: 0 }} />
              {c.label}
            </div>
          ))}
          <div style={{ fontSize: 9, color: "var(--fs-ink-400)", marginTop: 7, paddingTop: 6, borderTop: "1px solid var(--fs-border)" }}>
            1 dot ≈ {m.dots.per} {m.dots.unit}
          </div>
        </div>
      );
    }

    function MapToolbar({
      metric, setMetric, level, setLevel, overlays, toggleOverlay,
      districtType, setDistrictType, schoolFilters, setSchoolFilters,
      priorData, priorElectionId, setPriorElectionId, priorMetricId, setPriorMetricId,
    }) {
      const seg = (active) => ({
        fontSize: 12, fontWeight: active ? 700 : 500, padding: "7px 14px",
        border: "none", background: active ? "var(--fs-navy)" : "transparent",
        color: active ? "#fff" : "var(--fs-navy)", borderRadius: 3,
      });
      const miniSeg = (active) => ({
        fontSize: 11, fontWeight: active ? 700 : 500, padding: "5px 10px",
        border: "none", background: active ? "var(--fs-navy)" : "transparent",
        color: active ? "#fff" : "var(--fs-navy)", borderRadius: 3,
      });
      const tierSeg = (active) => ({
        fontSize: 11, fontWeight: active ? 700 : 500, padding: "5px 12px",
        border: "none", background: active ? "var(--fs-navy)" : "transparent",
        color: active ? "#fff" : "var(--fs-navy)", borderRadius: 3,
      });
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(METRICS).map(([key, m]) => {
                  const active = metric === key;
                  return (
                    <button key={key} className="layerbtn" onClick={() => setMetric(key)} style={{
                      fontSize: 12, fontWeight: active ? 700 : 500, padding: "7px 12px",
                      borderRadius: "var(--fs-radius-md)",
                      border: `1px solid ${active ? "var(--fs-navy)" : "var(--fs-border)"}`,
                      background: active ? "var(--fs-navy)" : "var(--fs-paper)",
                      color: active ? "#fff" : "var(--fs-navy)",
                    }}>{m.label}</button>
                  );
                })}
              </div>
              {metric === "priorElections" && priorData?.elections?.length > 0 && (() => {
                const election = priorData.elections.find(e => e.id === priorElectionId) || priorData.elections[0];
                return (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ display: "flex", background: "var(--fs-bone-100)", border: "1px solid var(--fs-border)", borderRadius: "var(--fs-radius-md)", padding: 2, flexWrap: "wrap" }}>
                      {priorData.elections.map(el => (
                        <button
                          key={el.id}
                          style={miniSeg(priorElectionId === el.id)}
                          onClick={() => {
                            setPriorElectionId(el.id);
                            setPriorMetricId(el.metrics[0]?.id);
                          }}
                        >
                          {el.label}
                        </button>
                      ))}
                    </div>
                    {election?.metrics?.length > 0 && (
                      <div style={{ display: "flex", background: "var(--fs-bone-100)", border: "1px solid var(--fs-border)", borderRadius: "var(--fs-radius-md)", padding: 2, flexWrap: "wrap" }}>
                        {election.metrics.map(md => (
                          <button
                            key={md.id}
                            style={miniSeg(priorMetricId === md.id)}
                            onClick={() => setPriorMetricId(md.id)}
                          >
                            {md.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ display: "flex", background: "var(--fs-bone-100)", border: "1px solid var(--fs-border)", borderRadius: "var(--fs-radius-md)", padding: 2 }}>
                <button style={seg(level === "precinct")} onClick={() => setLevel("precinct")}>Precinct</button>
                <button style={seg(level === "county")} onClick={() => setLevel("county")}>Area</button>
                <button style={seg(level === "district")} onClick={() => setLevel("district")}>District</button>
                <button style={seg(level === "zip")} onClick={() => setLevel("zip")}>ZIP</button>
              </div>
              {level === "district" && (
                <div style={{ display: "flex", background: "var(--fs-bone-100)", border: "1px solid var(--fs-border)", borderRadius: "var(--fs-radius-md)", padding: 2 }}>
                  {Object.entries(DISTRICT_TYPES).map(([key, cfg]) => (
                    <button
                      key={key}
                      style={miniSeg(districtType === key)}
                      onClick={() => setDistrictType(key)}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-ink-400)", marginRight: 2 }}>
              Overlays
            </span>
            {Object.entries(OVERLAYS).map(([key, cfg]) => {
              const on = !!overlays[key];
              const color = cfg.color;
              return (
                <button key={key} className="layerbtn" onClick={() => toggleOverlay(key)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: on ? 700 : 500, padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${on ? color : "var(--fs-border)"}`,
                  background: on ? "var(--fs-paper)" : "var(--fs-bone-50)",
                  color: on ? color : "var(--fs-ink-400)",
                }}>
                  {cfg.kind === "school"
                    ? <span style={{ width: 8, height: 8, borderRadius: 999, border: `2px solid ${color}`, opacity: on ? 1 : 0.35 }} />
                    : <span style={{ width: 8, height: 8, borderRadius: 999, background: color, opacity: on ? 1 : 0.35 }} />}
                  {cfg.label}
                </button>
              );
            })}
          </div>
          {overlays.schools && level !== "zip" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingLeft: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-ink-400)" }}>
                Schools
              </span>
              <div style={{ display: "flex", background: "var(--fs-bone-100)", border: "1px solid var(--fs-border)", borderRadius: "var(--fs-radius-md)", padding: 2 }}>
                {[
                  { id: "all", label: "All" },
                  { id: 1, label: "Tier 1" },
                  { id: 2, label: "Tier 2" },
                  { id: 3, label: "Tier 3" },
                ].map(opt => (
                  <button
                    key={opt.id}
                    style={tierSeg(schoolFilters.tier === opt.id)}
                    onClick={() => setSchoolFilters(f => ({ ...f, tier: opt.id }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="layerbtn"
                onClick={() => setSchoolFilters(f => ({ ...f, showCharter: !f.showCharter }))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: schoolFilters.showCharter ? 700 : 500,
                  padding: "5px 10px", borderRadius: 999,
                  border: `1px solid ${schoolFilters.showCharter ? "#B8932A" : "var(--fs-border)"}`,
                  background: schoolFilters.showCharter ? "var(--fs-paper)" : "var(--fs-bone-50)",
                  color: schoolFilters.showCharter ? "#B8932A" : "var(--fs-ink-400)",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, border: "2px solid #B8932A", opacity: schoolFilters.showCharter ? 1 : 0.35 }} />
                Charter schools
              </button>
            </div>
          )}
        </div>
      );
    }

    // ========================================================================
    // INSIGHT PANEL — docked right column beside map
    // ========================================================================
    const PANEL_ICONS = {
      live: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
        </svg>
      ),
      polling: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 12L6 7.5L9 10L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      feed: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 4.5h10M3 8h10M3 11.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      context: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      selection: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.5c-2.2 0-4 1.6-4 3.6 0 2.8 4 7.4 4 7.4s4-4.6 4-7.4c0-2-1.8-3.6-4-3.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="8" cy="6.2" r="1.3" fill="currentColor" />
        </svg>
      ),
    };

    const SIDEBAR_TABS = [
      { id: "live", label: "Latest Update", icon: PANEL_ICONS.live },
      { id: "polling", label: "Polling", icon: PANEL_ICONS.polling },
      { id: "feed", label: "Reporting Feed", icon: PANEL_ICONS.feed },
      { id: "context", label: "Measure", icon: PANEL_ICONS.context },
      { id: "selection", label: "Selected Area", icon: PANEL_ICONS.selection, requiresSelection: true },
    ];

    function InsightIconBar({ tabs, open, activeTab, onIconClick }) {
      return (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 8,
          display: "flex", alignItems: "center", gap: 6,
          padding: 6,
          background: "rgba(255,255,255,0.96)",
          border: "1px solid var(--fs-border)",
          borderRadius: "var(--fs-radius-md)",
          boxShadow: "var(--fs-shadow-md)",
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`panel-icon-btn${open && activeTab === tab.id ? " active" : ""}`}
              aria-label={tab.label}
              title={tab.label}
              onClick={() => onIconClick(tab.id)}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      );
    }

    function InsightSidePanel({ onOpenChange, activeTab, onTabChange, tabs, selected, onClearSelection, client, stats, polls, threshold, onIconClick, priorCtx, settings }) {
      const activeLabel = tabs.find(t => t.id === activeTab)?.label || "Insights";

      return (
        <div style={{
          flexShrink: 0,
          width: "min(420px, 36vw)",
          minWidth: 320,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "var(--fs-paper)",
          border: "1px solid var(--fs-border)",
          borderRadius: "var(--fs-radius-md)",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <nav className="panel-nav-rail" aria-label="Insights navigation">
              {tabs.map(tab => (
                <button
                  key={`icon-${tab.id}`}
                  type="button"
                  className={`panel-icon-btn${activeTab === tab.id ? " active" : ""}`}
                  aria-label={tab.label}
                  title={tab.label}
                  onClick={() => onIconClick(tab.id)}
                >
                  {tab.icon}
                </button>
              ))}
              <div className="panel-nav-rail-chips">
                {tabs.map(tab => (
                  <button
                    key={`chip-${tab.id}`}
                    type="button"
                    className={`panel-tab-chip rail${activeTab === tab.id ? " active" : ""}`}
                    onClick={() => onTabChange(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid var(--fs-border)",
                flexShrink: 0,
              }}>
                <span style={{ fontFamily: "var(--fs-font-display)", fontSize: 16, fontWeight: 700, color: "var(--fs-navy)" }}>
                  {activeLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close panel"
                  style={{ background: "none", border: "none", fontSize: 20, lineHeight: 1, color: "var(--fs-ink-400)", cursor: "pointer", flexShrink: 0 }}
                >
                  ×
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
            {activeTab === "live" && <LiveResultsCard client={client} stats={stats} settings={settings} embedded />}
            {activeTab === "polling" && <TrendChart polls={polls} threshold={threshold} embedded />}
            {activeTab === "feed" && <ResultsFeed precincts={stats.precinctProps} threshold={threshold} settings={settings} embedded />}
            {activeTab === "context" && <MeasureContextCard client={client} embedded />}
            {activeTab === "selection" && selected && (
              <SelectedAreaCard
                area={selected}
                threshold={threshold}
                priorCtx={priorCtx}
                settings={settings}
                onClose={() => { onClearSelection(); onTabChange("live"); }}
                embedded
              />
            )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ========================================================================
    // SETTINGS PANEL
    // ========================================================================
    function SettingsToggle({ label, hint, value, onChange }) {
      return (
        <div className="settings-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{label}</div>
            {hint && <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)", marginTop: 2 }}>{hint}</div>}
          </div>
          <button type="button" className="settings-toggle" data-on={value ? "1" : "0"}
                  role="switch" aria-checked={!!value} aria-label={label}
                  onClick={() => onChange(!value)}><i /></button>
        </div>
      );
    }

    function SettingsColorRow({ label, value, onChange }) {
      return (
        <div className="settings-row">
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>{label}</span>
          <div className="settings-color">
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} color`} />
            <span style={{ fontSize: 11, color: "var(--fs-fg-subtle)", fontVariantNumeric: "tabular-nums" }}>{value.toUpperCase()}</span>
          </div>
        </div>
      );
    }

    function SettingsPanel({ open, onClose, settings, setSetting, setColor, resetSettings }) {
      if (!open) return null;
      return (
        <>
          <div className="settings-backdrop" onClick={onClose} aria-hidden="true" />
          <aside className="settings-panel" role="dialog" aria-label="Display settings">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--fs-border)", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 18, fontWeight: 700, color: "var(--fs-navy)" }}>Settings</div>
                <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)", marginTop: 2 }}>Adjust colors and live readout on the fly</div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close settings"
                      style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "var(--fs-ink-400)", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 18px" }}>
              <div style={{ ...eyebrowStyle, marginTop: 8 }}>Map colors</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fs-navy)", marginBottom: 6 }}>Color mode</div>
                <div className="settings-seg">
                  <button type="button" className={settings.mapColorMode === "gradient" ? "active" : ""}
                          onClick={() => setSetting("mapColorMode", "gradient")}>Gradient</button>
                  <button type="button" className={settings.mapColorMode === "passFail" ? "active" : ""}
                          onClick={() => setSetting("mapColorMode", "passFail")}>Pass / fail</button>
                </div>
              </div>
              <SettingsColorRow label="Pass / leading" value={settings.colors.pass} onChange={(v) => setColor("pass", v)} />
              <SettingsColorRow label="Fail / trailing" value={settings.colors.fail} onChange={(v) => setColor("fail", v)} />
              <SettingsColorRow label="Too close" value={settings.colors.watch} onChange={(v) => setColor("watch", v)} />
              <SettingsColorRow label="Yes %" value={settings.colors.yes} onChange={(v) => setColor("yes", v)} />
              <SettingsColorRow label="No / oppose" value={settings.colors.no} onChange={(v) => setColor("no", v)} />

              <div style={{ ...eyebrowStyle, marginTop: 16 }}>Status band</div>
              <div className="settings-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-navy)" }}>“Too close” band</div>
                  <div style={{ fontSize: 11, color: "var(--fs-fg-subtle)", marginTop: 2 }}>Points either side of threshold</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={0.5} max={5} step={0.5} value={settings.band}
                         onChange={(e) => setSetting("band", +e.target.value)}
                         style={{ width: 90 }} aria-label="Too close band" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fs-navy)", minWidth: 36 }}>{settings.band} pts</span>
                </div>
              </div>

              <div style={{ ...eyebrowStyle, marginTop: 16 }}>Live results</div>
              <SettingsToggle label="Pass / fail status pill" value={settings.showStatusPill}
                              onChange={(v) => setSetting("showStatusPill", v)} />
              <SettingsToggle label="Yes percentage" value={settings.showYesPercent}
                              hint="Turn off with margin to show pass/fail only"
                              onChange={(v) => setSetting("showYesPercent", v)} />
              <SettingsToggle label="Margin vs threshold" value={settings.showMargin}
                              onChange={(v) => setSetting("showMargin", v)} />
              <SettingsToggle label="Percent precincts in" value={settings.showPercentIn}
                              onChange={(v) => setSetting("showPercentIn", v)} />
              <SettingsToggle label="Percent outstanding" value={settings.showPercentOutstanding}
                              hint="Precincts and ballots not yet counted"
                              onChange={(v) => setSetting("showPercentOutstanding", v)} />
              <SettingsToggle label="Ballot count" value={settings.showBallotCount}
                              onChange={(v) => setSetting("showBallotCount", v)} />

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--fs-border)" }}>
                <button type="button" onClick={resetSettings}
                        style={{ fontSize: 12, fontWeight: 600, padding: "8px 12px", border: "1px solid var(--fs-border)", borderRadius: "var(--fs-radius-md)", background: "var(--fs-bone-50)", color: "var(--fs-navy)", cursor: "pointer" }}>
                  Reset to defaults
                </button>
              </div>
            </div>
          </aside>
        </>
      );
    }

    // ========================================================================
    // APP
    // ========================================================================
    const EMPTY_FC = { type: "FeatureCollection", features: [] };

    export function RaceDetailApp() {
      const [settings, setSetting, setColor, resetSettings] = useSettings();
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [metric, setMetric] = useState("results");
      const [level, setLevel] = useState("precinct");
      const [selected, setSelected] = useState(null);
      const [geo, setGeo] = useState(null); // { boundary, precincts, councilDistricts, zipDistricts }
      const [loadError, setLoadError] = useState(null);
      const [overlays, setOverlays] = useState({});
      const [schoolFilters, setSchoolFilters] = useState({ tier: "all", showCharter: true });
      const [districtType, setDistrictType] = useState("council");
      const [sidebarTab, setSidebarTab] = useState("live");
      const [panelOpen, setPanelOpen] = useState(false);
      const [priorData, setPriorData] = useState(null);
      const [priorElectionId, setPriorElectionId] = useState(null);
      const [priorMetricId, setPriorMetricId] = useState(null);
      const toggleOverlay = useCallback((key) => setOverlays(o => ({ ...o, [key]: !o[key] })), []);

      const client = CLIENT;
      const boundary = geo ? geo.boundary : null;

      // Load the real jurisdiction boundary + county precincts (WGS84 GeoJSON)
      useEffect(() => {
        const get = (url) => fetch(url).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
          return r.json();
        });
        Promise.all([
          get(client.boundaryUrl),
          get(client.precinctsUrl),
          get(COUNCIL_GEOJSON_URL),
          get(ZIPS_GEOJSON_URL),
          loadPriorElections(PRIOR_ELECTIONS_MANIFEST_URL).catch(e => { console.warn("Prior elections:", e); return null; }),
        ])
          .then(([bfc, pfc, councilFc, zipFc, prior]) => {
            setGeo({
              boundary: bfc.features ? bfc.features[0] : bfc,
              precincts: pfc,
              councilDistricts: councilFc,
              zipDistricts: zipFc,
            });
            if (prior?.elections?.length) {
              setPriorData(prior);
              setPriorElectionId(prior.elections[0].id);
              setPriorMetricId(prior.elections[0].metrics[0]?.id);
            }
          })
          .catch(e => setLoadError(String(e)));
      }, []);

      const priorCtx = useMemo(() => {
        if (!priorData || !priorElectionId) return null;
        const election = priorData.elections.find(e => e.id === priorElectionId) || priorData.elections[0];
        const metricDef = election.metrics.find(m => m.id === priorMetricId) || election.metrics[0];
        return { electionId: election.id, election, metricDef, metricId: metricDef?.id };
      }, [priorData, priorElectionId, priorMetricId]);

      // Stable mock stats on real precinct geography, built once geo is in
      const race = useMemo(() => {
        if (!geo) return null;
        const r = makeRaceData(client, geo.boundary, geo.precincts, geo.councilDistricts, geo.zipDistricts);
        return priorData ? { ...r, priorData } : r;
      }, [geo, priorData]);

      const filteredView = useMemo(() => {
        if (!race) return { geojson: EMPTY_FC, yesPct: null, reportedCount: 0, totalCount: 0, ballots: 0, precinctProps: [] };
        const ctx = metric === "priorElections" ? priorCtx : null;
        return buildFilteredRaceView(race, level, districtType, ctx);
      }, [race, level, districtType, metric, priorCtx]);

      const geojson = filteredView.geojson;
      const dots = useMemo(() => race ? makeDots(geojson, metric, client.id) : EMPTY_FC, [geojson, metric, race]);
      const polls = POLLING;

      const stats = useMemo(() => ({
        yesPct: filteredView.yesPct,
        reportedCount: filteredView.reportedCount,
        totalCount: filteredView.totalCount,
        ballots: filteredView.ballots,
        precinctProps: filteredView.precinctProps,
      }), [filteredView]);

      const handleSelect = useCallback((props) => {
        setSelected(props);
        setSidebarTab("selection");
        setPanelOpen(true);
      }, []);
      const switchLevel = (l) => { setLevel(l); setSelected(null); };

      useEffect(() => {
        if (!selected && sidebarTab === "selection") setSidebarTab("live");
      }, [selected, sidebarTab]);

      return (
        <div className="race-detail-monitor" style={{ minHeight: "calc(100vh - 120px)", height: "100%", display: "flex", flexDirection: "column" }}>
          {/* ============ Header ============ */}
          <header style={{ background: "var(--fs-navy)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
            <img src="/election-assets/logo-horizontal-white.png" alt="Fog Signal Strategies" style={{ height: 34 }} />
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ fontFamily: "var(--fs-font-display)", fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>
              Race Detail Monitor
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" className={`header-settings-btn${settingsOpen ? " active" : ""}`}
                    aria-label="Settings" title="Settings"
                    onClick={() => setSettingsOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 11.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" strokeWidth="1.4" />
                <path d="M14.1 10.1l1.1.6-.9 1.6-1.2-.2a4.6 4.6 0 0 1-1.2.7l-.2 1.2-1.8.1-.3-1.2a4.6 4.6 0 0 1-1.1-.7l-1.2.4-1.3-1.3.7-1.1a4.6 4.6 0 0 1-.1-1.3l-1.1-.7.9-1.6 1.2.2c.4-.3.8-.5 1.2-.7l.2-1.2 1.8-.1.3 1.2c.4.2.8.4 1.1.7l1.2-.4 1.3 1.3-.7 1.1c.1.4.1.9.1 1.3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </button>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fs-gold)", border: "1px solid rgba(239,197,63,0.45)", borderRadius: 999, padding: "4px 10px" }}>
              Simulated data
            </span>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", padding: "9px 14px", background: "var(--fs-navy-800)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "var(--fs-radius-md)" }}>
              {client.clientName} — {client.measureCode}
            </div>
          </header>

          {/* ============ Title strip ============ */}
          <div style={{ background: "var(--fs-paper)", borderBottom: "1px solid var(--fs-border)", padding: "14px 24px", display: "flex", alignItems: "baseline", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fs-gold-700)" }}>{client.measureCode}</span>
            <h1 style={{ fontFamily: "var(--fs-font-display)", fontSize: 22, fontWeight: 700, color: "var(--fs-navy)", lineHeight: 1.2 }}>
              {client.measureTitle}
            </h1>
            <span style={{ fontSize: 12, color: "var(--fs-fg-subtle)" }}>
              {client.jurisdiction} · {client.ask} · Election {client.electionDate} · {client.threshold}% to pass
            </span>
          </div>

          {/* ============ Content: full-width map ============ */}
          <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", minWidth: 0 }}>
              <MapToolbar
                metric={metric}
                setMetric={setMetric}
                level={level}
                setLevel={switchLevel}
                overlays={overlays}
                toggleOverlay={toggleOverlay}
                districtType={districtType}
                setDistrictType={setDistrictType}
                schoolFilters={schoolFilters}
                setSchoolFilters={setSchoolFilters}
                priorData={priorData}
                priorElectionId={priorElectionId}
                setPriorElectionId={setPriorElectionId}
                priorMetricId={priorMetricId}
                setPriorMetricId={setPriorMetricId}
              />
              <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, position: "relative", borderRadius: "var(--fs-radius-md)", border: "1px solid var(--fs-border)", background: "var(--fs-bone-200)" }}>
                  <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "var(--fs-radius-md)" }}>
                    <MapView
                      geojson={geojson}
                      dots={dots}
                      boundary={boundary}
                      metric={metric}
                      threshold={client.threshold}
                      level={level}
                      fitKey={`${race ? client.id : "loading"}:${level}:${districtType}:${metric}:${priorElectionId}:${priorMetricId}:${schoolFilters.tier}:${schoolFilters.showCharter}`}
                      overlays={overlays}
                      schoolFilters={schoolFilters}
                      priorCtx={metric === "priorElections" ? priorCtx : null}
                      settings={settings}
                      onSelect={handleSelect}
                    />
                    <Legend metric={metric} threshold={client.threshold} priorCtx={metric === "priorElections" ? priorCtx : null} settings={settings} />
                    {loadError && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(248,247,241,0.9)", zIndex: 6, fontSize: 13, color: "var(--fs-danger)" }}>
                        Failed to load jurisdiction boundary: {loadError}
                      </div>
                    )}
                  </div>
                  {!panelOpen && (
                    <InsightIconBar
                      tabs={SIDEBAR_TABS.filter(t => !t.requiresSelection || selected)}
                      open={panelOpen}
                      activeTab={sidebarTab}
                      onIconClick={(tabId) => {
                        if (panelOpen && sidebarTab === tabId) setPanelOpen(false);
                        else { setSidebarTab(tabId); setPanelOpen(true); }
                      }}
                    />
                  )}
                </div>
                {panelOpen && (
                  <InsightSidePanel
                    onOpenChange={setPanelOpen}
                    activeTab={sidebarTab}
                    onTabChange={setSidebarTab}
                    tabs={SIDEBAR_TABS.filter(t => !t.requiresSelection || selected)}
                    onIconClick={setSidebarTab}
                    selected={selected}
                    onClearSelection={() => setSelected(null)}
                    client={client}
                    stats={stats}
                    polls={polls}
                    threshold={client.threshold}
                    priorCtx={metric === "priorElections" ? priorCtx : null}
                    settings={settings}
                  />
                )}
              </div>
            </div>
          </div>

          <SettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            setSetting={setSetting}
            setColor={setColor}
            resetSettings={resetSettings}
          />

          <footer className="app-footer">
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              © OpenStreetMap contributors
            </a>
          </footer>
        </div>
      );
    }

