import { useEffect } from "react";

export default function CountdownTimer({ countdown, setCountdown, onComplete }) {
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete(); // when reaches 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown, setCountdown, onComplete]);

  return (
    <p style={{ color: "orange", fontWeight: "bold" }}>
      ⚠️ Idle Countdown: {countdown}s
    </p>
  );
}
