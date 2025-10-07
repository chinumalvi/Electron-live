// ReasonModal.jsx
import { useEffect, useState } from "react";

export default function ReasonModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // open modal when main process signals
    const openHandler = () => setIsOpen(true);
    window.electronAPI.onShowReasonModal(openHandler);

    // cleanup (ipcRenderer.on returns a subscription but removing is optional here)
    return () => {
      // no-op: electron will remove listeners on reload; add removal if needed
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setReason("");
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("Please enter a reason");
      return;
    }
    setSaving(true);
    try {
      const res = await window.electronAPI.saveIdleReason(reason.trim());
      if (res && res.success) {
        alert("Reason saved ✅");
        handleClose();
      } else {
        alert("Save failed: " + (res?.error || "Unknown"));
        setSaving(false);
      }
    } catch (err) {
      console.error("save error:", err);
      alert("Save failed");
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: 420,
      background: "#fff",
      padding: 18,
      boxShadow: "0 6px 26px rgba(0,0,0,0.25)",
      zIndex: 9999,
      borderRadius: 8,
    }}>
      <h3 style={{ margin: 0 }}>🟡 Why were you away?</h3>
      <p style={{ color: "#666", marginTop: 6 }}>Please enter a reason for the idle time.</p>

      <textarea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
        autoFocus
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={handleSubmit} disabled={saving} style={{
          padding: "8px 14px",
          background: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer"
        }}>
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
