import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Box } from "@react-three/drei";
import { useMemo, Suspense } from "react";


const AccountNode = ({ account, position }) => {
  const getColor = (type) => {
    switch (type) {
      case "Assets":
        return "#22c55e";
      case "Liabilities":
        return "#ef4444";
      case "Equity":
        return "#3b82f6";
      case "Revenue":
        return "#a855f7";
      case "Expenses":
        return "#f97316";
      default:
        return "#6b7280";
    }
  };

  const getSize = (balance) => {
    // Scale box size based on balance (min 0.5, max 2)
    const normalizedSize = Math.max(
      0.5,
      Math.min(2, Math.abs(balance) / 25000)
    );
    return normalizedSize;
  };

  const size = getSize(account.balance);
  const color = getColor(account.type);

  return (
    <group position={position}>
      <Box args={[size, size, size]}>
        <meshStandardMaterial color={color} />
      </Box>
      <Text
        position={[0, size / 2 + 0.3, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
      >
        {account.name}
      </Text>
      <Text
        position={[0, size / 2 + 0.6, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
      >
        ${Math.abs(account.balance).toLocaleString()}
      </Text>
    </group>
  );
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-96 w-full bg-gray-100 rounded">
    <div className="text-gray-500">Loading 3D view...</div>
  </div>
);

const ErrorFallback = () => (
  <div className="flex items-center justify-center h-96 w-full bg-gray-100 rounded border-2 border-dashed border-gray-300">
    <div className="text-center text-gray-500">
      <p className="text-lg mb-2">3D View Unavailable</p>
      <p className="text-sm">
        Your browser may not support WebGL or 3D graphics.
      </p>
    </div>
  </div>
);

export const AccountChart3D = ({ accounts }) => {
  const accountPositions = useMemo(() => {
    if (!accounts || accounts.length === 0) return {};

    const accountTypes = [
      "Assets",
      "Liabilities",
      "Equity",
      "Revenue",
      "Expenses",
    ];
    const positions = {};

    accountTypes.forEach((type, typeIndex) => {
      const typeAccounts = accounts.filter(
        (account) => account && account.type === type
      );
      if (typeAccounts.length === 0) return;

      const radius = 3;
      const angleStep = (2 * Math.PI) / accountTypes.length;
      const typeAngle = typeIndex * angleStep;

      typeAccounts.forEach((account, accountIndex) => {
        if (!account || !account.id) return;

        const accountRadius = 1.5;
        const accountAngleStep =
          typeAccounts.length > 1 ? (2 * Math.PI) / typeAccounts.length : 0;
        const accountAngle = accountIndex * accountAngleStep;

        const x =
          Math.cos(typeAngle) * radius + Math.cos(accountAngle) * accountRadius;
        const z =
          Math.sin(typeAngle) * radius + Math.sin(accountAngle) * accountRadius;
        const y = (accountIndex - typeAccounts.length / 2) * 0.5;

        positions[account.id] = [x, y, z];
      });
    });

    return positions;
  }, [accounts]);

  // Check if we have valid accounts
  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 w-full bg-gray-100 rounded">
        <div className="text-gray-500">No accounts to display</div>
      </div>
    );
  }

  try {
    return (
      <div className="h-96 w-full">
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            camera={{ position: [10, 5, 10], fov: 60 }}
            onCreated={(state) => {
              // Ensure WebGL context is properly initialized
              console.log("3D Canvas initialized successfully");
            }}
            onError={(error) => {
              console.error("3D Canvas error:", error);
            }}
          >
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <pointLight position={[-10, -10, -10]} />

            {accounts
              .filter(
                (account) =>
                  account && account.id && accountPositions[account.id]
              )
              .map((account) => (
                <AccountNode
                  key={account.id}
                  account={account}
                  position={accountPositions[account.id]}
                />
              ))}

            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              autoRotate={true}
              autoRotateSpeed={0.5}
              maxPolarAngle={Math.PI}
              minPolarAngle={0}
            />
          </Canvas>
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error("Error rendering 3D chart:", error);
    return <ErrorFallback />;
  }
};
