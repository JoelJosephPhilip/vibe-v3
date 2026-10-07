import { CameraOffIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

export type CameraState = 'starting' | 'on' | 'off' | 'denied';

/**
 * Blue track only asks that the camera is on. This hook holds a camera stream
 * open and reports whether it is live — no frames are analysed, captured or sent.
 */
export function useCameraPresence() {
  const [state, setState] = useState<CameraState>('starting');
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async () => {
    release();
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const track = s.getVideoTracks()[0];
      const sync = () => setState(track.readyState === 'live' && !track.muted ? 'on' : 'off');
      track.addEventListener('ended', sync);
      track.addEventListener('mute', sync);
      track.addEventListener('unmute', sync);
      streamRef.current = s;
      setStream(s);
      sync();
    } catch (error) {
      setState((error as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'off');
    }
  }, [release]);

  useEffect(() => {
    void start();
    return release;
  }, [start, release]);

  return { state, stream, retry: start };
}

/** Small mirrored self-view so students can see the camera is on. */
export function CameraBubble({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  if (!stream) return null;
  return (
    <div className="fixed right-4 bottom-20 z-40 overflow-hidden rounded-2xl border-2 border-sky-500 bg-black shadow-lg sm:bottom-24">
      <video ref={ref} autoPlay playsInline muted aria-label="Your camera" className="h-24 w-32 -scale-x-100 object-cover sm:h-28 sm:w-40" />
    </div>
  );
}

/** Covers the lesson while the camera is off; content is paused underneath. */
export function CameraRequired({ state, onRetry }: { state: CameraState; onRetry: () => void }) {
  if (state === 'on') return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="camera-required-title" className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        {state === 'starting' ? (
          <Loader2Icon className="mx-auto size-8 animate-spin text-sky-600" aria-hidden />
        ) : (
          <CameraOffIcon className="mx-auto size-8 text-sky-600" aria-hidden />
        )}
        <h2 id="camera-required-title" className="mt-4 font-aleo text-xl">
          {state === 'starting' ? 'Turning your camera on…' : 'Turn your camera on to continue'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {state === 'denied'
            ? 'Camera access is blocked. Allow it in your browser’s site settings, then try again.'
            : 'The blue track only needs your camera on. Nothing is recorded or analysed.'}
        </p>
        {state !== 'starting' && (
          <Button className="mt-5" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
