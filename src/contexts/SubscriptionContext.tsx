import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

interface SubscriptionContextType {
  tier: 'free' | 'pro';
  loading: boolean;
  isPro: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // Listen for real-time updates to the user profile
        const unsubscribeDoc = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            if (data.subscriptionTier) {
              setTier(data.subscriptionTier);
            } else {
              // Migration: if tier is missing, set to free
              await setDoc(userRef, { subscriptionTier: 'free' }, { merge: true });
              setTier('free');
            }
          } else {
            // New user initialization
            const newProfile: UserProfile = {
              uid: user.uid,
              name: user.displayName || 'Neural Student',
              email: user.email || '',
              subscriptionTier: 'free'
            };
            await setDoc(userRef, newProfile);
            setTier('free');
          }
          setLoading(false);
        });

        return () => unsubscribeDoc();
      } else {
        setTier('free');
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <SubscriptionContext.Provider value={{ tier, loading, isPro: tier === 'pro' }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
