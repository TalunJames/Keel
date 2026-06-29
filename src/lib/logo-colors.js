/** Sample dominant colors from a logo image (data URL). Returns hex strings. */
export function extractColorsFromDataUrl(dataUrl, maxColors = 5) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      const buckets = new Map();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 128) continue;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max - min < 18) continue;
        if (max > 238 && min > 210) continue;
        if (max < 28) continue;

        const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      const colors = [...buckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxColors)
        .map(([key]) => {
          const [r, g, b] = key.split(",").map(Number);
          return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
        });

      resolve(colors);
    };
    img.onerror = () => reject(new Error("Could not read logo image"));
    img.src = dataUrl;
  });
}

export function isCssColor(value) {
  return typeof value === "string" && (value.startsWith("#") || value.startsWith("var("));
}

export function colorToHex(value) {
  if (!value) return "#1a2744";
  if (value.startsWith("#")) return value.length === 7 ? value : value.slice(0, 7);
  return "#1a2744";
}
