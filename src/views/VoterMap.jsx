import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Icon, Stat, Tag } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { createKeelMapStyle, partyColorExpr, PARTY_COLORS } from "../lib/map-style.js";
import { VoterFilters } from "./voter-filters.jsx";

const LAYER_OPTIONS = [
  { id: "boundary", label: "District boundary" },
  { id: "precincts", label: "Precinct outlines" },
  { id: "voters", label: "Voter points" },
];

// Voter-file fields (name, address, party) are third-party CSV data and must
// never be trusted as HTML. Escape every interpolated value before it reaches
// popup.setHTML(...).
function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function voterPopupHtml(props, mode) {
  if (mode === "cluster") {
    return (
      `<div style="font-weight:700;color:#1A3A5C;margin-bottom:4px">${escapeHtml(Number(props.count || 0).toLocaleString())} voters</div>` +
      `<div style="color:#5B5B58;font-size:12px">D ${escapeHtml(props.dCount || 0)} · R ${escapeHtml(props.rCount || 0)} · I ${escapeHtml(props.iCount || 0)}</div>` +
      `<div style="color:#7A7975;font-size:11px;margin-top:4px">Avg turnout ${escapeHtml(props.avgScore || 0)}</div>`
    );
  }
  return (
    `<div style="font-weight:700;color:#1A3A5C;margin-bottom:2px">${escapeHtml(props.name)}</div>` +
    `<div style="color:#5B5B58;font-size:12px">${escapeHtml(props.party)} · Score ${escapeHtml(props.score)}</div>` +
    `<div style="color:#7A7975;font-size:11px;margin-top:4px">${escapeHtml(props.address || "")}</div>` +
    (props.precinct ? `<div style="color:#8B9AAB;font-size:10px;margin-top:2px">Precinct ${escapeHtml(props.precinct)}</div>` : "")
  );
}

export function VoterMap({
  clientId,
  meta,
  filters,
  setFilters,
  query,
  setQuery,
  cuts,
  onApplyCut,
  onBboxChange,
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const popupRef = useRef(null);
  const fetchTimer = useRef(null);
  const mapAbortRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [layers, setLayers] = useState({ boundary: true, precincts: false, voters: true });
  const [mapStats, setMapStats] = useState({ matchingInView: 0, geocodedTotal: 0, mode: "cluster" });
  const [selected, setSelected] = useState(null);
  const filtersRef = useRef(filters);
  const queryRef = useRef(query);
  filtersRef.current = filters;
  queryRef.current = query;

  const mapConfig = meta?.map || {};
  const geocodedPct = meta?.recordCount
    ? Math.round(((meta.geocodedCount || 0) / meta.recordCount) * 100)
    : 0;

  const reportBbox = useCallback((map) => {
    if (!map || !onBboxChange) return;
    const b = map.getBounds();
    onBboxChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  }, [onBboxChange]);

  const loadMapData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const bounds = map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    reportBbox(map);
    // Cancel any in-flight request so a slow older response can't overwrite a
    // newer one when bounds/filters change rapidly.
    if (mapAbortRef.current) mapAbortRef.current.abort();
    const controller = new AbortController();
    mapAbortRef.current = controller;
    setLoading(true);
    api("/voter/map", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        clientId,
        filters: filtersRef.current,
        query: queryRef.current,
        bbox,
        zoom: map.getZoom(),
      }),
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setMapStats({
          matchingInView: data.matchingInView || 0,
          geocodedTotal: data.geocodedTotal || 0,
          mode: data.mode || "cluster",
        });
        const src = map.getSource("voters");
        if (src) {
          src.setData({ type: "FeatureCollection", features: data.features || [] });
        }
        const isPoints = data.mode === "points";
        if (map.getLayer("voters-circle")) {
          map.setPaintProperty("voters-circle", "circle-radius", isPoints
            ? ["interpolate", ["linear"], ["zoom"], 13, 4, 15, 6, 17, 9]
            : ["interpolate", ["linear"], ["zoom"], 8, 8, 11, 12, 13, 16]);
          map.setPaintProperty("voters-circle", "circle-stroke-width", isPoints ? 1.5 : 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mapAbortRef.current === controller) mapAbortRef.current = null;
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [clientId, ready, reportBbox]);

  // moveend is bound once at map creation; route through a ref so the handler
  // always sees the latest loadMapData (with current ready/clientId) instead of
  // the stale mount-time closure where ready was still false.
  const loadMapDataRef = useRef(loadMapData);
  useEffect(() => { loadMapDataRef.current = loadMapData; }, [loadMapData]);

  const scheduleLoad = useCallback(() => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => loadMapDataRef.current(), 250);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createKeelMapStyle(),
      center: mapConfig.center || [-104.8214, 38.8339],
      zoom: mapConfig.zoom || 11,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.once("load", () => {
      map.addSource("voters", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("boundary", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("precincts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      map.addLayer({
        id: "precincts-fill",
        type: "fill",
        source: "precincts",
        paint: { "fill-color": "#1A3A5C", "fill-opacity": 0.03 },
        layout: { visibility: "none" },
      });
      map.addLayer({
        id: "precincts-line",
        type: "line",
        source: "precincts",
        paint: { "line-color": "#1A3A5C", "line-opacity": 0.25, "line-width": 1 },
        layout: { visibility: "none" },
      });
      map.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: { "line-color": "#B8932A", "line-width": 2.5, "line-opacity": 0.9 },
        layout: { visibility: "visible" },
      });
      map.addLayer({
        id: "voters-circle",
        type: "circle",
        source: "voters",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 8, 11, 12, 13, 16],
          "circle-color": partyColorExpr(),
          "circle-opacity": 0.88,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 0,
        },
        layout: { visibility: "visible" },
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      popupRef.current = popup;

      const onVoterHover = (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const mode = f.properties.count != null ? "cluster" : "points";
        popup.setLngLat(f.geometry.coordinates).setHTML(voterPopupHtml(f.properties, mode)).addTo(map);
      };
      map.on("mouseenter", "voters-circle", onVoterHover);
      map.on("mousemove", "voters-circle", onVoterHover);
      map.on("mouseleave", "voters-circle", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("click", "voters-circle", (e) => {
        const f = e.features?.[0];
        if (f?.properties?.name) setSelected(f.properties);
      });

      if (mapConfig.boundaryUrl) {
        fetch(mapConfig.boundaryUrl)
          .then((r) => r.json())
          .then((data) => {
            if (mapRef.current?.getSource("boundary")) {
              mapRef.current.getSource("boundary").setData(data);
            }
          })
          .catch(() => {});
      }
      if (mapConfig.precinctsUrl) {
        fetch(mapConfig.precinctsUrl)
          .then((r) => r.json())
          .then((data) => {
            if (mapRef.current?.getSource("precincts")) {
              mapRef.current.getSource("precincts").setData(data);
            }
          })
          .catch(() => {});
      }

      setReady(true);
    });

    map.on("moveend", scheduleLoad);

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      if (mapAbortRef.current) mapAbortRef.current.abort();
      map.remove();
      mapRef.current = null;
      onBboxChange?.(null);
    };
  }, []);

  useEffect(() => { scheduleLoad(); }, [filters, query, ready, clientId, scheduleLoad]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    map.setLayoutProperty("boundary-line", "visibility", layers.boundary ? "visible" : "none");
    map.setLayoutProperty("precincts-fill", "visibility", layers.precincts ? "visible" : "none");
    map.setLayoutProperty("precincts-line", "visibility", layers.precincts ? "visible" : "none");
    map.setLayoutProperty("voters-circle", "visibility", layers.voters ? "visible" : "none");
  }, [layers, ready]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
      <aside className="col" style={{ gap: 12 }}>
        <div className="card">
          <div className="card-head"><h3>Filters</h3></div>
          <VoterFilters
            filters={filters}
            setFilters={setFilters}
            query={query}
            setQuery={setQuery}
            meta={meta}
            cuts={cuts}
            onApplyCut={onApplyCut}
            compact
          />
        </div>

        <div className="card">
          <div className="card-head"><h3>Layers</h3></div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {LAYER_OPTIONS.map((l) => (
              <label key={l.id} className="row" style={{ fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={!!layers[l.id]}
                  onChange={(e) => setLayers((prev) => ({ ...prev, [l.id]: e.target.checked }))} />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        <div className="card card-pad col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: PARTY_COLORS.D }} /> Democrat
            <span style={{ width: 10, height: 10, borderRadius: 999, background: PARTY_COLORS.R }} /> Republican
            <span style={{ width: 10, height: 10, borderRadius: 999, background: PARTY_COLORS.I }} /> Other
          </div>
          <p className="mut" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            Filters sync with the Voter File tab. Zoom in past street level to see individual households.
          </p>
        </div>
      </aside>

      <div className="col" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="card card-pad" style={{ flex: 1 }}><Stat figure={(mapStats.matchingInView || 0).toLocaleString()} label="In view" /></div>
          <div className="card card-pad" style={{ flex: 1 }}><Stat figure={(meta?.geocodedCount || 0).toLocaleString()} label="Geocoded" /></div>
          <div className="card card-pad" style={{ flex: 1 }}><Stat figure={geocodedPct + "%"} label="Map coverage" /></div>
          <div className="card card-pad" style={{ flex: 1 }}><Stat figure={mapStats.mode === "points" ? "House" : "Cluster"} label="Detail level" /></div>
        </div>

        {geocodedPct < 100 && (
          <div className="card card-pad" style={{ fontSize: 13, color: "var(--fs-fg-muted)" }}>
            <Icon name="map" size={14} /> {geocodedPct}% of voters geocoded.
            Run <code>npm run voter:geocode -- --client {clientId}</code> to map remaining addresses.
          </div>
        )}

        <div className="card" style={{ position: "relative", height: 620, overflow: "hidden" }}>
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
          {loading && (
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, background: "var(--fs-paper)", padding: "6px 10px", borderRadius: 4, fontSize: 12, border: "1px solid var(--fs-border)" }}>
              Updating…
            </div>
          )}
        </div>

        {selected && (
          <div className="card card-pad">
            <div className="row between">
              <div>
                <strong style={{ color: "var(--fs-navy)" }}>{selected.name}</strong>
                <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>{selected.address}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Tag>{selected.party}</Tag>
                <span className="num">Score {selected.score}</span>
                <button type="button" className="btn ghost sm" onClick={() => setSelected(null)}><Icon name="x" size={14} /></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
