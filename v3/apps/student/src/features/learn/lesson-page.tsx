import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { unwrap } from '@vibe/api';
import { CheckCircle2Icon, Loader2Icon, LockIcon, ShieldAlertIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { itemTypeMeta, ProgressBar } from '@/features/courses/course-ui';
import { courseKeys, useCurrentPath, useEthicsConsent, useProgressPercentage, type CurrentPath } from '@/features/courses/queries';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

import { ConsentGate } from './consent-gate';
import {
  heartbeat,
  isProctored,
  startItem,
  toSeconds,
  useCompleteItem,
  useCourseSettings,
  useLesson,
  youtubeId,
  type LessonItem,
  type LessonRef,
} from './queries';
import { YouTubePlayer } from './youtube-player';

const HEARTBEAT_MS = 30_000;
/** The backend's reply when a linear-progression course is opened out of order. */
const OUT_OF_ORDER = /do not match current progress/i;
const SUPPORTED = new Set(['VIDEO', 'BLOG']);

export function LessonPage(ref: LessonRef) {
  const lesson = useLesson(ref);
  const consent = useEthicsConsent(ref.courseId, ref.versionId);
  const percentage = useProgressPercentage(ref.courseId, ref.versionId);

  let body: ReactNode;
  if (lesson.isPending || consent.isPending) {
    body = (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="aspect-video w-full rounded-2xl" />
      </div>
    );
  } else if (lesson.isError) {
    body = <Notice title="We couldn’t open this lesson" ref_={ref}>{lesson.error.message}</Notice>;
  } else if (!consent.data?.signed) {
    body = <ConsentGate courseId={ref.courseId} versionId={ref.versionId} />;
  } else if (isProctored(lesson.data.proctoringDetectors)) {
    // Never let a proctored lesson run without its proctoring. The engine is
    // being ported next; until then these lessons stay closed here.
    body = (
      <Notice title="This lesson is proctored" icon={<ShieldAlertIcon className="size-6" aria-hidden />} ref_={ref}>
        Proctored lessons need the camera-based integrity checks, which aren’t available in this version of the app yet.
      </Notice>
    );
  } else if (!SUPPORTED.has(lesson.data.type)) {
    body = (
      <Notice title={`${itemTypeMeta(lesson.data.type).label} lessons aren’t available here yet`} ref_={ref}>
        This version of the app can open videos and readings so far.
      </Notice>
    );
  } else {
    return <ActiveLesson key={ref.itemId} lessonRef={ref} item={lesson.data} progress={percentage.data?.percentCompleted ?? 0} />;
  }

  return (
    <LessonFrame lessonRef={ref} title={lesson.data?.name} progress={percentage.data?.percentCompleted ?? 0}>
      {body}
    </LessonFrame>
  );
}

function ActiveLesson({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useCourseSettings(ref.courseId, ref.versionId);
  const complete = useCompleteItem(ref);
  const watchItemId = useRef<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const alreadyDone = Boolean(item.isAlreadyWatched);

  // Open a watch-time record for items the student hasn't completed yet.
  useEffect(() => {
    if (alreadyDone) return;
    let cancelled = false;
    startItem(ref)
      .then((id) => {
        if (!cancelled) watchItemId.current = id;
      })
      .catch((e: Error) => !cancelled && setStartError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.itemId, alreadyDone]);

  // Keep it alive: readings while the tab is visible, videos while playing.
  const active = item.type === 'VIDEO' ? playing : true;
  useEffect(() => {
    if (!active || alreadyDone) return;
    const id = window.setInterval(() => {
      if (watchItemId.current && document.visibilityState === 'visible') void heartbeat(watchItemId.current, ref.itemId);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [active, alreadyDone, ref.itemId]);

  const ready = alreadyDone || (item.type === 'VIDEO' ? videoEnded : true);

  const goNext = useCallback(async () => {
    setFinishing(true);
    try {
      if (!alreadyDone) {
        if (!watchItemId.current) throw new Error(startError ?? 'The lesson hasn’t finished starting. Please try again.');
        await complete.mutateAsync(watchItemId.current);
      }
      const path = unwrap(
        await api.GET('/api/users/progress/courses/{courseId}/versions/{versionId}/current-path', {
          params: { path: { courseId: ref.courseId, versionId: ref.versionId } },
        }),
      ) as unknown as CurrentPath;
      queryClient.setQueryData(courseKeys.currentPath(ref.courseId, ref.versionId), path);
      const next = path?.item;
      if (next && next.id !== ref.itemId && path.module && path.section) {
        await navigate({
          to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId',
          params: { courseId: ref.courseId, versionId: ref.versionId, moduleId: path.module.id, sectionId: path.section.id, itemId: next.id },
        });
      } else {
        if (!next) toast.success('You’ve finished every lesson in this course.');
        await navigate({ to: '/courses/$courseId/$versionId', params: { courseId: ref.courseId, versionId: ref.versionId } });
      }
    } catch (e) {
      toast.error((e as Error).message || 'Couldn’t save your progress. Please try again.');
    } finally {
      setFinishing(false);
    }
  }, [alreadyDone, complete, navigate, queryClient, ref, startError]);

  if (startError && OUT_OF_ORDER.test(startError)) {
    return (
      <LessonFrame lessonRef={ref} title={item.name} progress={progress}>
        <LockedLesson lessonRef={ref} />
      </LessonFrame>
    );
  }

  const seekForward = settings.data?.settings.seekForwardEnabled ?? false;
  const videoId = item.type === 'VIDEO' ? youtubeId(item.details.URL) : null;

  return (
    <LessonFrame
      lessonRef={ref}
      title={item.name}
      progress={progress}
      footer={
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {alreadyDone ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4" aria-hidden /> Completed
              </span>
            ) : startError ? (
              <span className="text-destructive">{startError}</span>
            ) : item.type === 'VIDEO' && !videoEnded ? (
              'Watch to the end to continue'
            ) : null}
          </p>
          <Button size="lg" onClick={goNext} disabled={!ready || finishing || Boolean(startError && !alreadyDone)}>
            {finishing && <Loader2Icon className="animate-spin" />}
            Continue
          </Button>
        </>
      }
      footerTone={alreadyDone || (ready && item.type === 'VIDEO') ? 'success' : 'neutral'}
    >
      <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{itemTypeMeta(item.type).label}</p>
        <h1 className="mt-1 font-aleo text-2xl tracking-tight sm:text-3xl">{item.name}</h1>
        {item.description && item.description !== item.name && <p className="mt-2 text-muted-foreground">{item.description}</p>}

        <div className="mt-6">
          {item.type === 'VIDEO' &&
            (videoId ? (
              <YouTubePlayer
                videoId={videoId}
                start={toSeconds(item.details.startTime)}
                end={toSeconds(item.details.endTime)}
                allowSeekForward={seekForward || alreadyDone}
                onPlayingChange={setPlaying}
                onEnded={() => setVideoEnded(true)}
              />
            ) : (
              <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
                This video is hosted on ViBe’s own storage, which this version of the app can’t play yet.
              </p>
            ))}

          {item.type === 'BLOG' && (
            <div className="prose-vibe">
              <Markdown remarkPlugins={[remarkGfm]}>{item.details.content ?? ''}</Markdown>
              {item.details.estimatedReadTimeInMinutes ? (
                <p className="mt-8 text-xs text-muted-foreground">About {item.details.estimatedReadTimeInMinutes} min read</p>
              ) : null}
            </div>
          )}
        </div>
      </article>
    </LessonFrame>
  );
}

/** Uxcel lesson frame: close + course progress on top, sticky action bar below. */
function LessonFrame({
  lessonRef: ref,
  title,
  progress,
  children,
  footer,
  footerTone = 'neutral',
}: {
  lessonRef: LessonRef;
  title?: string;
  progress: number;
  children: ReactNode;
  footer?: ReactNode;
  footerTone?: 'neutral' | 'success';
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link
            to="/courses/$courseId/$versionId"
            params={{ courseId: ref.courseId, versionId: ref.versionId }}
            aria-label="Close lesson"
            className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted"
          >
            <XIcon className="size-5" />
          </Link>
          <ProgressBar value={progress} className="h-2 flex-1" label="Course progress" />
          <span className="hidden max-w-60 truncate text-sm text-muted-foreground sm:inline">{title}</span>
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col pb-24">
        {children}
      </main>
      {footer && (
        <footer
          className={cn(
            'fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md',
            footerTone === 'success' ? 'border-emerald-600/20 bg-emerald-50/90 dark:bg-emerald-950/60' : 'border-border bg-muted/70',
          )}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">{footer}</div>
        </footer>
      )}
    </div>
  );
}

function LockedLesson({ lessonRef: ref }: { lessonRef: LessonRef }) {
  const path = useCurrentPath(ref.courseId, ref.versionId);
  const next = path.data;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
        <LockIcon className="size-6" aria-hidden />
      </span>
      <h1 className="font-aleo text-2xl tracking-tight">Finish the earlier lessons first</h1>
      <p className="mt-2 text-sm text-muted-foreground">This course unlocks lessons in order.</p>
      {next?.item && next.module && next.section ? (
        <Link
          to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
          params={{ courseId: ref.courseId, versionId: ref.versionId, moduleId: next.module.id, sectionId: next.section.id, itemId: next.item.id }}
          className={cn(buttonVariants(), 'mt-6')}
        >
          Go to your next lesson: {next.item.name}
        </Link>
      ) : (
        <Link to="/courses/$courseId/$versionId" params={{ courseId: ref.courseId, versionId: ref.versionId }} className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
          Back to the course
        </Link>
      )}
    </div>
  );
}

function Notice({ title, icon, children, ref_ }: { title: string; icon?: ReactNode; children: ReactNode; ref_: LessonRef }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      {icon && <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">{icon}</span>}
      <h1 className="font-aleo text-2xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
      <Link
        to="/courses/$courseId/$versionId"
        params={{ courseId: ref_.courseId, versionId: ref_.versionId }}
        className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}
      >
        Back to the course
      </Link>
    </div>
  );
}
