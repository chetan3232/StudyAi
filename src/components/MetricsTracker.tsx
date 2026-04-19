import { useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

export default function MetricsTracker() {
  useEffect(() => {
    const trackActivity = async () => {
      if (!auth.currentUser) return;

      const today = new Date().toISOString().split('T')[0];
      const metricsRef = doc(db, 'system', 'metrics', 'daily', today);

      try {
        // Increment DAU and other metrics
        // Note: This is a simplified platform-level tracking
        // In a real app, we'd use cloud functions to avoid write contention
        await setDoc(metricsRef, {
          dau: increment(1),
          date: today,
          lastUpdated: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        // Silently fail metrics tracking to not disrupt user experience
        console.debug("Metrics tracking skipped");
      }
    };

    trackActivity();
  }, []);

  return null; // Background component
}
