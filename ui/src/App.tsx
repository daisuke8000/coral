import { Graph } from '@/components/Graph';
import { useGraphData } from '@/hooks/useGraphData';
import '@/index.css';

function App() {
  const { data, loading, error, refetch } = useGraphData();

  return (
    <div className="app-container">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 className="app-title">🪸 Coral</h1>
          <span className="app-subtitle">Proto Dependency Visualizer</span>
        </div>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot service"></span>
            <span>Service</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot message"></span>
            <span>Message</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot enum"></span>
            <span>Enum</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot external"></span>
            <span>External</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot package"></span>
            <span>Package</span>
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading proto dependencies...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <p className="error-message">{error}</p>
            <button className="retry-button" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        )}

        {data && <Graph data={data} />}
      </main>
    </div>
  );
}

export default App;
