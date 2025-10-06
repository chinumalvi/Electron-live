import { useState, useEffect } from "react";

export default function ReasonModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Listen for main process event to open modal
    window.electronAPI.onShowReasonModal(() => setIsOpen(true));

    // Listen for countdown updates
    window.electronAPI.onUpdateCountdown((time) => setCountdown(time));

  }, []);

  useEffect(() => {
    if (!isOpen) setReason("");
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("Please enter a reason");
      return;
    }
    try {
      const res = await window.electronAPI.saveIdleReason(reason.trim());
      if (res?.success) {
        alert("Reason saved successfully ✅");
        setIsOpen(false);
      } else {
        alert("Save failed: " + (res?.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error while saving reason");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        background: "white",
        padding: 20,
        boxShadow: "0 0 12px rgba(0,0,0,0.25)",
        zIndex: 9999,
        borderRadius: 8,
        pointerEvents: "auto",
      }}
    >
      <h3>🟡 Why were you away?</h3>
      <p>Time left: {countdown}s</p>
      <textarea
        rows="4"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{
          width: "100%",
          marginTop: 10,
          borderRadius: 6,
          padding: 8,
          border: "1px solid #ccc",
        }}
        autoFocus
      />
      <div style={{ textAlign: "right", marginTop: 10 }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: "6px 12px",
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
