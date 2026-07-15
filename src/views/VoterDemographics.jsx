import React, { useState, useEffect } from "react";
import { Stat } from "../components/ui.jsx";
import { voterApi } from "../lib/api.js";
import { Loading } from "../components/Loading.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { ChartCard, Donut, BarList, Columns } from "./voter-charts.jsx";

export function VoterDemographics({ clientId, filters, query }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    voterApi
      .demographics({ clientId, filters, query })
      .then((r) => { if (!controller.signal.aborted) setData(r.demographics); })
      .catch(() => { if (!controller.signal.aborted) setData(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clientId, filters, query]);

  if (loading && !data) return <Loading />;
  if (!data || !data.total) return <EmptyState title="No voters in this universe" description="Adjust the filters to include voters, then demographics will populate." icon="chart-bar" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div className="card card-pad"><Stat figure={data.total.toLocaleString()} label="Voters in universe" /></div>
        <div className="card card-pad"><Stat figure={String(data.stats.avgAge || "—")} label="Average age" /></div>
        <div className="card card-pad"><Stat figure={String(data.stats.avgScore || "—")} label="Avg turnout score" /></div>
        <div className="card card-pad"><Stat figure={String(data.stats.avgSupport || "—")} label="Avg support score" gold /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard title="Party registration" sub="Share of the current universe">
          <Donut data={data.party} byParty />
        </ChartCard>
        <ChartCard title="Gender" sub="Registered gender">
          <Donut data={data.gender.map((g) => ({ ...g, key: ({ M: "Male", F: "Female", U: "Unknown" }[g.key] || g.key) }))} />
        </ChartCard>

        <ChartCard title="Age distribution" sub="By band">
          <Columns data={data.ageBands} color="#1A3A5C" />
        </ChartCard>
        <ChartCard title="Turnout score" sub="Modeled propensity bands">
          <Columns data={data.turnoutBands} color="#B8932A" />
        </ChartCard>

        <ChartCard title="Ethnicity (modeled)" sub="Estimated composition">
          <BarList data={data.ethnicity} />
        </ChartCard>
        <ChartCard title="Registrations by year" sub="When voters registered">
          <Columns data={data.regByYear.slice(-12)} color="#4A7BA7" />
        </ChartCard>

        <ChartCard title="Top precincts" sub="Largest concentrations">
          <BarList data={data.precinct} max={12} />
        </ChartCard>
        <ChartCard title="State House districts" sub="By count">
          <BarList data={data.house} max={12} />
        </ChartCard>

        <ChartCard title="Cities" sub="By count">
          <BarList data={data.city} max={10} />
        </ChartCard>
        <ChartCard title="State Senate districts" sub="By count">
          <BarList data={data.senate} max={10} />
        </ChartCard>
      </div>
    </div>
  );
}
