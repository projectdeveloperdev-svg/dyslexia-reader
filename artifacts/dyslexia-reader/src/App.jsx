import ScanSection from "./features/scan/ScanSection";

function App() {
  return (
    <div className="app-root">
      <div className="app-blob app-blob--pink" aria-hidden="true" />
      <div className="app-blob app-blob--lavender" aria-hidden="true" />
      <h1 className="app-title">Dexy</h1>
      <ScanSection />
    </div>
  );
}

export default App;
