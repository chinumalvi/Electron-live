import IdleTracker from "./IdleTracker";
import ProductiveTime from "./ProductiveTime";

export default function ElectronAppWindow() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Time Tracker Dashboard</h1>
      <IdleTracker />
      <ProductiveTime />
      {/* Add other metric components here */}
    </div>
  );
}
