import ScanSection from "./features/scan/ScanSection";

function App() {
  return (
    <div className="app-root">
      <div className="app-blob app-blob--pink" aria-hidden="true" />
      <div className="app-blob app-blob--lavender" aria-hidden="true" />
      <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />
      <ScanSection />
    </div>
  );
}

export default App;
