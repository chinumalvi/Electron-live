import { useEffect, useState } from "react";

export default function ProductiveTime() {
  const [metrics, setMetrics] = useState({
    productiveHours: "0.00",
    productiveMinutes: 0,
    idleTime: 0,
    awayTime: 0,
  });
  const [activities, setActivities] = useState([]);

  // Format date safely
  const formatTime = (date) => (date ? new Date(date).toLocaleTimeString() : "Ongoing");

  useEffect(() => {
    // Fetch metrics
    const fetchMetrics = async () => {
      try {
        const data = await window.electronAPI.getProductiveTime();
        if (data.success) {
          setMetrics({
            productiveHours: data.productiveHours || "0.00",
            productiveMinutes: data.productiveMinutes || 0,
            idleTime: data.idleTime || 0,
            awayTime: data.awayTime || 0,
          });
        }
      } catch (err) {
        console.error("Failed to fetch productive time:", err);
      }
    };

    // Fetch activities
    const fetchActivities = async () => {
      try {
        const res = await window.electronAPI.getActivities();
        if (res.success) {
          setActivities(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch activities:", err);
      }
    };

    // Initial fetch
    fetchMetrics();
    fetchActivities();

    // Poll every 1 minute
    const interval = setInterval(() => {
      fetchMetrics();
      fetchActivities();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Time Tracker Dashboard</h2>
      <p>Productive Time Today: {metrics.productiveHours}h ({metrics.productiveMinutes} min)</p>
      <p>Idle Time: {(metrics.idleTime / 1000).toFixed(0)} s</p>
      <p>Away Time: {(metrics.awayTime / 1000).toFixed(0)} s</p>

      <h3>Activity Logs</h3>
      <ul>
        {activities.length === 0 && <li>No activity yet</li>}
        {activities.map((s) => (
          <li key={s._id}>
            {formatTime(s.startTime)} → {formatTime(s.endTime)} | Status: {s.userActivityStatus} | Reason: {s.reasonStatus || "N/A"}
          </li>
        ))}
      </ul>
    </div>
  );
}
