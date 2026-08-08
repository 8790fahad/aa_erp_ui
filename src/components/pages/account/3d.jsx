import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Grid, RoundedBox } from "@react-three/drei";
import { Component, Suspense, useMemo } from "react";

const NATURES = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"];

const NATURE_COLORS = {
  Assets: "#22c55e",
  Liabilities: "#ef4444",
  Equity: "#3b82f6",
  Revenue: "#a855f7",
  Expenses: "#f97316",
};

class ThreeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "WebGL error" };
  }

  componentDidCatch(error) {
    console.error("AccountChart3D error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[32rem] w-full items-center justify-center bg-slate-900">
          <div className="px-6 text-center text-slate-300">
            <p className="mb-2 text-lg font-medium">3D View Unavailable</p>
            <p className="text-sm text-slate-400">
              {this.state.message ||
                "Your browser may not support WebGL or 3D graphics."}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NatureCube({ nature, count, position, color }) {
  const height = Math.max(1.6, Math.min(4.5, 1.2 + count / 35));
  const width = 2.2;

  return (
    <group position={position}>
      <RoundedBox
        args={[width, height, width]}
        radius={0.12}
        smoothness={4}
        position={[0, height / 2, 0]}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.2}
          roughness={0.35}
          emissive={color}
          emissiveIntensity={0.12}
        />
      </RoundedBox>

      {/* Always-readable DOM label (avoids broken drei Text fonts) */}
      <Html position={[0, height + 0.55, 0]} center distanceFactor={10}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-white/20 bg-slate-950/85 px-3 py-1.5 text-center shadow-lg backdrop-blur-sm">
          <div className="text-sm font-semibold text-white">{nature}</div>
          <div className="text-[11px] text-slate-300">
            {count} account{count === 1 ? "" : "s"}
          </div>
        </div>
      </Html>
    </group>
  );
}

function Scene({ clusters }) {
  return (
    <>
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 10, 4]} intensity={1.25} castShadow />
      <pointLight position={[-6, 4, -4]} intensity={0.55} color="#93c5fd" />

      <Grid
        position={[0, 0, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#334155"
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor="#475569"
        fadeDistance={28}
        fadeStrength={1}
        infiniteGrid
      />

      {clusters.map((cluster) => (
        <NatureCube
          key={cluster.nature}
          nature={cluster.nature}
          count={cluster.count}
          position={cluster.position}
          color={cluster.color}
        />
      ))}

      <OrbitControls
        makeDefault
        target={[0, 1.5, 0]}
        enablePan
        enableZoom
        enableRotate
        autoRotate
        autoRotateSpeed={0.55}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={6}
        maxDistance={30}
      />
    </>
  );
}

const LoadingFallback = () => (
  <div className="flex h-[32rem] w-full items-center justify-center bg-slate-900">
    <div className="text-slate-400">Loading 3D view...</div>
  </div>
);

export const AccountChart3D = ({ accounts }) => {
  const clusters = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts : [];
    const spacing = 3.6;
    const present = NATURES.map((nature) => {
      const count = list.filter((a) => a?.type === nature).length;
      return { nature, count, color: NATURE_COLORS[nature] };
    }).filter((c) => c.count > 0);

    const startX = -((present.length - 1) * spacing) / 2;
    return present.map((c, index) => ({
      ...c,
      position: [startX + index * spacing, 0, 0],
    }));
  }, [accounts]);

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex h-[32rem] w-full items-center justify-center bg-slate-900">
        <div className="text-slate-400">No accounts to display</div>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="flex h-[32rem] w-full items-center justify-center bg-slate-900">
        <div className="text-slate-400">
          Accounts loaded, but no nature groups found for 3D layout
        </div>
      </div>
    );
  }

  return (
    <ThreeErrorBoundary>
      <div className="relative h-[32rem] w-full bg-slate-900">
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            camera={{ position: [0, 7, 14], fov: 42, near: 0.1, far: 100 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          >
            <Scene clusters={clusters} />
          </Canvas>
        </Suspense>

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
          {clusters.map((c) => (
            <span
              key={c.nature}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] text-white backdrop-blur"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: c.color }}
              />
              {c.nature}: {c.count}
            </span>
          ))}
        </div>
      </div>
    </ThreeErrorBoundary>
  );
};
