/** Shared MapLibre base style used by election and voter maps. */
export function createKeelMapStyle({ saturation = -0.85, opacity = 0.85 } = {}) {
  return {
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
    layers: [{
      id: "osm",
      type: "raster",
      source: "osm",
      paint: { "raster-saturation": saturation, "raster-opacity": opacity },
    }],
  };
}

export const PARTY_COLORS = {
  D: "#1A3A5C",
  R: "#A8341E",
  I: "#8B9AAB",
};

export function partyColorExpr() {
  return [
    "match",
    ["get", "party"],
    "D", PARTY_COLORS.D,
    "R", PARTY_COLORS.R,
    PARTY_COLORS.I,
  ];
}
