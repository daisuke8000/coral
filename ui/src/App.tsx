import { Graph } from '@/components/Graph';
import { useGraphData } from '@/hooks/useGraphData';
import '@/index.css';

function App() {
  const { data, loading, error, refetch } = useGraphData();

  return (
    <div className="flex flex-col h-screen bg-bg-dark text-text-primary">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 md:px-6 gap-3 bg-bg-secondary border-b border-white/10">
        <div className="flex items-center">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-neon-magenta to-neon-cyan bg-clip-text text-transparent">
            🪸 Coral
          </h1>
          <span className="text-xs sm:text-sm text-text-secondary ml-3 sm:ml-4 hidden xs:inline">
            Proto Dependency Visualizer
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 sm:gap-4 md:gap-6">
          <LegendItem color="bg-neon-magenta" glow="shadow-[0_0_6px_var(--color-neon-magenta)]" label="Service" />
          <LegendItem color="bg-neon-cyan" glow="shadow-[0_0_6px_var(--color-neon-cyan)]" label="Message" />
          <LegendItem color="bg-neon-yellow" glow="shadow-[0_0_6px_var(--color-neon-yellow)]" label="Enum" />
          <LegendItem color="bg-neon-gray" glow="" label="External" />
          <LegendItem color="bg-neon-purple" glow="shadow-[0_0_6px_rgba(128,128,255,0.6)]" label="Package" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-[3px] border-white/10 border-t-neon-cyan rounded-full animate-spin" />
            <p className="text-text-secondary text-sm sm:text-base">
              Loading proto dependencies...
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-5xl">⚠️</div>
            <p className="text-red-400 text-sm sm:text-base">{error}</p>
            <button
              className="px-6 py-2.5 bg-transparent border-2 border-neon-magenta rounded-lg text-neon-magenta text-sm cursor-pointer transition-all duration-300 hover:bg-neon-magenta/10 hover:shadow-[0_0_10px_var(--color-neon-magenta)] active:scale-95 min-h-[44px] touch-manipulation"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        )}

        {data && <Graph data={data} />}
      </main>
    </div>
  );
}

interface LegendItemProps {
  color: string;
  glow: string;
  label: string;
}

function LegendItem({ color, glow, label }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-text-secondary">
      <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${color} ${glow}`} />
      <span>{label}</span>
    </div>
  );
}

export default App;
