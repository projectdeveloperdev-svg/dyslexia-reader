import { useState } from "react";
import { Router as WouterRouter, Switch, Route } from "wouter";
import ScanSection from "./features/scan/ScanSection";
import VoiceLab from "./features/voice-lab/VoiceLab";
import MegaStackSheet from "./features/stack/MegaStackSheet";
import CameraView from "./features/scan/CameraView";
import PagedReader from "./features/reader/PagedReader";
import { clearSnippets } from "./features/stack/stackStore";
import "./App.css";

function MainApp() {
  const [megaStackOpen, setMegaStackOpen] = useState(false);
  const [stackPhase, setStackPhase] = useState(null); // null | "capture" | "preview"
  const [stackCount, setStackCount] = useState(0);

  function handleStackDone(count) {
    setStackCount(count);
    setStackPhase("preview");
  }

  function handleStackCancel() {
    setStackPhase(null);
  }

  function handleStackBack() {
    clearSnippets();
    setStackCount(0);
    setStackPhase(null);
  }

  if (stackPhase === "preview") {
    return (
      <div className="app-root">
        <div className="app-blob app-blob--pink" aria-hidden="true" />
        <div className="app-blob app-blob--lavender" aria-hidden="true" />
        <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />
        <PagedReader onExit={handleStackBack} />
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-blob app-blob--pink" aria-hidden="true" />
      <div className="app-blob app-blob--lavender" aria-hidden="true" />
      <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />
      <div className="app-action-row">
        <button
          className="app-action-btn"
          onClick={() => setStackPhase("capture")}
        >
          Stack
        </button>
        <button
          className="app-action-btn app-action-btn--premium"
          onClick={() => setMegaStackOpen(true)}
        >
          <span className="app-action-label">Mega Stack</span>
          <span className="app-action-badge">Coming Soon</span>
        </button>
      </div>
      <ScanSection />
      {stackPhase === "capture" && (
        <CameraView
          mode="stack"
          onDone={handleStackDone}
          onStackCancel={handleStackCancel}
        />
      )}
      <MegaStackSheet
        open={megaStackOpen}
        onClose={() => setMegaStackOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <WouterRouter base="">
      <Switch>
        <Route path="/voice-lab" component={VoiceLab} />
        <Route component={MainApp} />
      </Switch>
    </WouterRouter>
  );
}

export default App;
