import React, { useState } from "react";
import { AppShell } from "./atoms.jsx";
import { PortfolioScreen } from "./screen-portfolio.jsx";
import { MeasureDetailScreen } from "./screen-detail.jsx";
import { ElectionNightScreen } from "./ElectionNightScreen.jsx";
import { PollingScreen, CalendarScreen, PipelineScreen, DeliverablesScreen } from "./screen-standard.jsx";

const TWEAK_DEFAULTS = {
  band: 2,
  simSpeed: 1,
  density: "comfortable",
};

export function FathomApp() {
  const [route, setRoute] = useState({ screen: "election-night", measureId: null });
  const tw = TWEAK_DEFAULTS;

  const onOpen = {
    measure: (id) => { setRoute({ screen: "measure", measureId: id }); window.scrollTo(0, 0); },
    go: (screen) => { setRoute({ screen, measureId: null }); window.scrollTo(0, 0); },
  };
  const nav = (screen) => onOpen.go(screen);
  const navScreen = route.screen === "measure" ? "portfolio" : route.screen;

  return (
    <AppShell route={{ screen: navScreen }} onNav={nav}>
      {route.screen === "portfolio" && <PortfolioScreen tw={tw} onOpen={onOpen} />}
      {route.screen === "measure" && <MeasureDetailScreen id={route.measureId} tw={tw} onBack={() => onOpen.go("portfolio")} />}
      {route.screen === "election-night" && <ElectionNightScreen band={tw.band} simSpeed={tw.simSpeed} />}
      {route.screen === "polling" && <PollingScreen tw={tw} onOpen={onOpen} />}
      {route.screen === "calendar" && <CalendarScreen />}
      {route.screen === "pipeline" && <PipelineScreen />}
      {route.screen === "deliverables" && <DeliverablesScreen onOpen={onOpen} />}
    </AppShell>
  );
}
