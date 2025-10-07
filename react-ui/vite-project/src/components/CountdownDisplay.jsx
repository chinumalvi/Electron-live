// CountdownDisplay.jsx
import { useEffect, useState } from "react";

export default function CountdownDisplay() {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    // Listen for countdown updates from main process
    window.electronAPI.onUpdateCountdown((value) => {
      setCountdown(value);
    });
  }, []);

  if (countdown === null) return null; // nothing to show yet
  if (countdown <= 0) return null; // hide when done (modal will appear)

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        background: "#1e293b",
        color: "#fff",
        fontSize: "20px",
        padding: "10px 18px",
        borderRadius: "8px",
        
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 9999,
      }}
    >
      ⏳ Idle in {countdown}s
    </div>
  );
}
