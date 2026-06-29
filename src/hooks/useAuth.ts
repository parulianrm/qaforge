import { useEffect, useState, useRef, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const IDLE_TIMEOUT = 5 * 60 * 1000;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      signOut();
    }, IDLE_TIMEOUT);
  }, [signOut]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const events = ["mousemove", "keydown", "click", "scroll"];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      subscription.unsubscribe();
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return { user, loading, signInWithGoogle, signOut };
}
