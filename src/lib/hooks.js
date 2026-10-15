'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeBroadcast(channelName, event, onMessage) {
  const supabase = createClient();
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    if (!channelName) return undefined;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event }, (payload) => callbackRef.current?.(payload.payload))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, event]);

  return supabase;
}

export function useCountdown(deadline, { onExpire } = {}) {
  const [remaining, setRemaining] = useState(() =>
    deadline ? Math.max(0, (new Date(deadline).getTime() - Date.now()) / 1000) : 0
  );
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;
    if (!deadline) {
      setRemaining(0);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, (new Date(deadline).getTime() - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return remaining;
}

export function useElapsed(startedAt) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!startedAt) return undefined;
    const tick = () => setSeconds(Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return seconds;
}
