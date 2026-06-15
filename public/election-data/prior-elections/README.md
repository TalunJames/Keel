# Prior elections data

Upload historical election results for the map **Prior Elections** layer.

## Files

1. **`prior-elections-manifest.json`** (in this folder’s parent) — list elections and metrics.
2. **One CSV per election** under `prior-elections/` — precinct-level numbers.

## CSV format

- First row: headers (lowercase).
- Required column: `precinct` (must match precinct IDs in `overlay-precincts.geojson`).
- Other columns: any numeric fields referenced in the manifest `field` / `opponentField`.

Example (`2024-general.csv`):

```csv
precinct,harris_pct,trump_pct,turnout_pct,votes_cast,registered
124,54.2,42.1,71.3,1820,2550
```

## Adding an election

1. Add a CSV under `prior-elections/`.
2. Add an entry to `prior-elections-manifest.json`:

```json
{
  "id": "2020-general",
  "label": "2020 General",
  "date": "Nov 3, 2020",
  "file": "prior-elections/2020-general.csv",
  "metrics": [
    {
      "id": "biden",
      "label": "Biden %",
      "field": "biden_pct",
      "scale": "diverging",
      "mid": 50,
      "stops": [[35, "#A8341E"], [47, "#C77B66"], [50, "#E6E5DA"], [53, "#6FA08A"], [65, "#1A3A5C"]],
      "opponentField": "trump_pct",
      "opponentLabel": "Trump"
    },
    {
      "id": "turnout",
      "label": "Turnout",
      "field": "turnout_pct",
      "scale": "sequential",
      "stops": [[40, "#F0EDE4"], [55, "#B8932A"], [70, "#1A3A5C"]]
    }
  ]
}
```

Reload the page after changing files (local server required).
