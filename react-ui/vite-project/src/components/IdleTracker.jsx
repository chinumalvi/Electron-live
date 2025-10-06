import { useEffect, useState } from "react";
import CountdownTimer from "./CountdownTimer";
import ReasonModal from "./ReasonModal";

export default function IdleTracker({
  idleThresholdMs = 60 * 1000, // 1 minute
  countdownSec = 15,
}) {
  const [idleMs, setIdleMs] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activities, setActivities] = useState([]);

  // 🕐 Check idle time every second
  useEffect(() => {
    if (isModalOpen) return; // stop tracking when modal is open

    const interval = setInterval(async () => {
      const ms = await window.electronAPI.getIdleTime();
      setIdleMs(ms);

      // start countdown when idle threshold crosses
      if (ms >= idleThresholdMs && countdown === null) {
        setCountdown(countdownSec);
      }

      // reset countdown when user becomes active again
      if (ms < idleThresholdMs && countdown !== null) {
        setCountdown(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [idleThresholdMs, countdown, countdownSec, isModalOpen]);

  // 📘 Fetch activity logs initially
  useEffect(() => {
    async function fetchActivities() {
      const res = await window.electronAPI.getActivities();
      if (res?.success) setActivities(res.data);
    }
    fetchActivities();
  }, []);

  // 🕓 Format readable date
  const formatLocalTime = (utcString) =>
    new Date(utcString).toLocaleString();

  // 🧠 When countdown completes → open reason modal
  const handleCountdownComplete = () => {
    setCountdown(null);
    setIsModalOpen(true);
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div>Idle Time: {Math.floor(idleMs / 1000)} s</div>

      {countdown !== null && (
        <CountdownTimer
          countdown={countdown}
          setCountdown={setCountdown}
          onComplete={handleCountdownComplete}
        />
      )}

      <ReasonModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIdleMs(0); // reset idle
        }}
      />

      <h3 className="mt-4">Activity Logs</h3>
      <ul>
        {activities.map((a) => (
          <li key={a._id}>
            <strong>{a.userActivityStatus}</strong> ({a.workingStatus}) -{" "}
            {formatLocalTime(a.startTime)} →{" "}
            {a.endTime ? formatLocalTime(a.endTime) : "Ongoing"}
            {a.reasonStatus && ` | Reason: ${a.reasonStatus}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
