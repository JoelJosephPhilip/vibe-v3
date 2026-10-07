import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ApiError, unwrap } from '@vibe/api';
import { ArrowLeftIcon, ArrowRightIcon, BadgeCheckIcon, CheckCircle2Icon, Loader2Icon, LockIcon, ShieldAlertIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { itemTypeMeta, ProgressBar } from '@/features/courses/course-ui';
import {
  courseKeys,
  useCourseVersion,
  useCurrentPath,
  useEthicsConsent,
  useProgressPercentage,
  type CurrentPath,
} from '@/features/courses/queries';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

import { CameraBubble, CameraRequired, useCameraPresence } from './camera-presence';
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
import { TRACKS, useCourseTrack, useFlatSyllabus, type Track } from './tracks';
import { QuizRunner } from './quiz';
import { useAfterQuizSubmit } from './quiz-api';
import { YouTubePlayer } from './youtube-player';

const HEARTBEAT_MS = 30_000;
const VIEWABLE = new Set(['VIDEO', 'BLOG']);
/** The backend's reply when a linear-progression course is opened out of order. */
const OUT_OF_ORDER = /do not match current progress/i;

type LessonProps = LessonRef & { track: Track };

export function LessonPage({ track, ...ref }: LessonProps) {
  const lesson = useLesson(ref);
  const consent = useEthicsConsent(ref.courseId, ref.versionId);
  const percentage = useProgressPercentage(ref.courseId, ref.versionId);
  const [, rememberTrack] = useCourseTrack(ref.versionId);
  useEffect(() => rememberTrack(track), [track, rememberTrack]);

  const progress = percentage.data?.percentCompleted ?? 0;
  const frame = (body: ReactNode) => (
    <LessonFrame lessonRef={ref} track={track} title={lesson.data?.name} progress={progress}>
      {body}
    </LessonFrame>
  );

  if (lesson.isPending || consent.isPending) {
    return frame(
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="aspect-video w-full rounded-2xl" />
      </div>,
    );
  }
  // In linear courses the backend refuses lessons the student hasn't reached (403).
  if (lesson.isError) {
    return frame(
      lesson.error instanceof ApiError && lesson.error.status === 403 ? (
        <LockedLesson lessonRef={ref} track={track} />
      ) : (
        <Notice title="We couldn’t open this lesson" lessonRef={ref}>
          {lesson.error.message}
        </Notice>
      ),
    );
  }
  if (!consent.data?.signed) return frame(<ConsentGate courseId={ref.courseId} versionId={ref.versionId} />);

  const item = lesson.data;
  const greenQuiz = track === 'green' && item.type === 'QUIZ';
  if (!VIEWABLE.has(item.type) && !greenQuiz) {
    return frame(
      <Notice title={`${itemTypeMeta(item.type).label} lessons aren’t available here yet`} lessonRef={ref}>
        {track === 'blue'
          ? 'The blue track is for watching and reading. Assessments count only on the green track.'
          : 'This version of the app can open videos and readings so far.'}
      </Notice>,
    );
  }

  if (track === 'blue') return <BlueLesson key={ref.itemId} lessonRef={ref} item={item} progress={progress} />;

  // Green: never run a proctored lesson without its proctoring (engine is ported next).
  if (isProctored(item.proctoringDetectors)) {
    return frame(
      <Notice title="This lesson is proctored" icon={<ShieldAlertIcon className="size-6" aria-hidden />} lessonRef={ref}>
        Proctored lessons need the camera-based integrity checks, which aren’t available in this version of the app yet.
        You can still study it on the blue track.
      </Notice>,
    );
  }
  return <GreenGate key={ref.itemId} lessonRef={ref} item={item} progress={progress} />;
}

/**
 * Green track: one lesson at a time, in order. Enforced here too, so it holds
 * even in courses whose backend linear-progression setting is off.
 */
function GreenGate({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
  const path = useCurrentPath(ref.courseId, ref.versionId);
  if (path.isPending) return <LessonFrame lessonRef={ref} track="green" title={item.name} progress={progress}><Skeleton className="mx-auto mt-10 h-64 w-full max-w-3xl" /></LessonFrame>;
  const isCurrent = path.data?.item?.id === ref.itemId;
  if (!item.isAlreadyWatched && path.data?.item && !isCurrent) {
    return (
      <LessonFrame lessonRef={ref} track="green" title={item.name} progress={progress}>
        <LockedLesson lessonRef={ref} track="green" />
      </LessonFrame>
    );
  }
  if (item.type === 'QUIZ') return <GreenQuiz lessonRef={ref} item={item} progress={progress} />;
  return <GreenLesson lessonRef={ref} item={item} progress={progress} />;
}

/** Opens the next lesson the backend's progress points to (or the course page when done). */
function useGoToNext(ref: LessonRef) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useCallback(async () => {
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
        search: { track: 'green' },
      });
    } else {
      if (!next) toast.success('You’ve finished every lesson in this course.');
      await navigate({ to: '/courses/$courseId/$versionId', params: { courseId: ref.courseId, versionId: ref.versionId } });
    }
  }, [navigate, queryClient, ref]);
}

/** Green-track quiz: the attempt's submission grades it and advances progress when passed. */
function GreenQuiz({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
  const navigate = useNavigate();
  const goToNext = useGoToNext(ref);
  const refresh = useAfterQuizSubmit();
  const watchItem = useRef<Promise<string> | null>(null);

  // Already-passed quizzes can be retaken for practice without touching progress.
  const ensureWatchItem = useCallback(async () => {
    if (item.isAlreadyWatched) return undefined;
    watchItem.current ??= startItem(ref);
    return watchItem.current;
  }, [item.isAlreadyWatched, ref]);

  return (
    <LessonFrame lessonRef={ref} track="green" title={item.name} progress={progress}>
      <QuizRunner
        lessonRef={ref}
        item={item}
        ensureWatchItem={ensureWatchItem}
        onPassed={async () => {
          await refresh();
          await goToNext();
        }}
        onExit={() => navigate({ to: '/courses/$courseId/$versionId', params: { courseId: ref.courseId, versionId: ref.versionId } })}
      />
    </LessonFrame>
  );
}

function GreenLesson({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
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

  // Open a watch-time record for items not completed yet.
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
          search: { track: 'green' },
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
      <LessonFrame lessonRef={ref} track="green" title={item.name} progress={progress}>
        <LockedLesson lessonRef={ref} track="green" />
      </LessonFrame>
    );
  }

  return (
    <LessonFrame
      lessonRef={ref}
      track="green"
      title={item.name}
      progress={progress}
      footerTone={alreadyDone || (ready && item.type === 'VIDEO') ? 'success' : 'neutral'}
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
    >
      <LessonContent
        item={item}
        allowSeekForward={(settings.data?.settings.seekForwardEnabled ?? false) || alreadyDone}
        onPlayingChange={setPlaying}
        onEnded={() => setVideoEnded(true)}
      />
    </LessonFrame>
  );
}

/**
 * Blue track: study mode. Any lesson the backend will serve, free seeking,
 * previous/next through the syllabus. Camera must be on; nothing is detected,
 * reported or saved — no start/stop/heartbeat calls at all.
 */
function BlueLesson({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
  const camera = useCameraPresence();
  const version = useCourseVersion(ref.versionId);
  const { items } = useFlatSyllabus(version.data);
  const index = items.findIndex((i) => i._id === ref.itemId);
  const prev = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 ? items[index + 1] : undefined;
  const blocked = camera.state !== 'on';

  const linkTo = (target: (typeof items)[number]) => ({
    to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId' as const,
    params: { courseId: ref.courseId, versionId: ref.versionId, moduleId: target.moduleId, sectionId: target.sectionId, itemId: target._id },
    search: { track: 'blue' as const },
  });

  return (
    <LessonFrame
      lessonRef={ref}
      track="blue"
      title={item.name}
      progress={progress}
      footer={
        <>
          {prev ? (
            <Link {...linkTo(prev)} className={buttonVariants({ variant: 'ghost' })}>
              <ArrowLeftIcon data-icon="inline-start" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="hidden text-xs text-muted-foreground sm:block">Study mode · not saved to your progress</p>
          {next ? (
            <Link {...linkTo(next)} className={buttonVariants({ size: 'lg' })}>
              Next <ArrowRightIcon data-icon="inline-end" />
            </Link>
          ) : (
            <Link to="/courses/$courseId/$versionId" params={{ courseId: ref.courseId, versionId: ref.versionId }} className={buttonVariants({ size: 'lg' })}>
              Back to the course
            </Link>
          )}
        </>
      }
    >
      <div className={cn(blocked && 'pointer-events-none select-none blur-sm')} aria-hidden={blocked}>
        <LessonContent item={item} allowSeekForward paused={blocked} />
      </div>
      <CameraBubble stream={camera.stream} />
      <CameraRequired state={camera.state} onRetry={camera.retry} />
    </LessonFrame>
  );
}

function LessonContent({
  item,
  allowSeekForward,
  paused,
  onPlayingChange,
  onEnded,
}: {
  item: LessonItem;
  allowSeekForward: boolean;
  paused?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}) {
  const videoId = item.type === 'VIDEO' ? youtubeId(item.details.URL) : null;
  return (
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
              allowSeekForward={allowSeekForward}
              paused={paused}
              onPlayingChange={onPlayingChange}
              onEnded={onEnded}
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
  );
}

/** Blue / green track ticks, using the shadcn Badge with custom colours. */
const TRACK_BADGE: Record<Track, string> = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  green: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
};

export function TrackBadge({ track, className }: { track: Track; className?: string }) {
  return (
    <Badge className={cn(TRACK_BADGE[track], className)}>
      <BadgeCheckIcon data-icon="inline-start" aria-hidden />
      {TRACKS[track].label}
    </Badge>
  );
}

/** Uxcel lesson frame: close, course progress and track on top; sticky action bar below. */
function LessonFrame({
  lessonRef: ref,
  track,
  title,
  progress,
  children,
  footer,
  footerTone = 'neutral',
}: {
  lessonRef: LessonRef;
  track: Track;
  title?: string;
  progress: number;
  children: ReactNode;
  footer?: ReactNode;
  footerTone?: 'neutral' | 'success';
}) {
  const other: Track = track === 'blue' ? 'green' : 'blue';
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className={cn('sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md', track === 'blue' ? 'border-sky-500/30' : 'border-emerald-500/30')}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            to="/courses/$courseId/$versionId"
            params={{ courseId: ref.courseId, versionId: ref.versionId }}
            aria-label="Close lesson"
            className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted"
          >
            <XIcon className="size-5" />
          </Link>
          <ProgressBar value={progress} className="h-2 flex-1" label="Certified progress (green track)" />
          <span className="hidden max-w-52 truncate text-sm text-muted-foreground md:inline">{title}</span>
          <TrackBadge track={track} />
          <Link
            to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
            params={ref}
            search={{ track: other }}
            className="hidden text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:inline"
          >
            Switch to {TRACKS[other].short.toLowerCase()}
          </Link>
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

function LockedLesson({ lessonRef: ref, track }: { lessonRef: LessonRef; track: Track }) {
  const path = useCurrentPath(ref.courseId, ref.versionId);
  const next = path.data;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
        <LockIcon className="size-6" aria-hidden />
      </span>
      <h1 className="font-aleo text-2xl tracking-tight">{track === 'blue' ? 'Not unlocked yet' : 'Finish the earlier lessons first'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {track === 'blue'
          ? 'This course unlocks lessons as you complete them on the green track. Lessons you’ve already reached are open for study.'
          : 'The green track goes one lesson at a time, in order.'}
      </p>
      {next?.item && next.module && next.section ? (
        <Link
          to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
          params={{ courseId: ref.courseId, versionId: ref.versionId, moduleId: next.module.id, sectionId: next.section.id, itemId: next.item.id }}
          search={{ track: 'green' }}
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

function Notice({ title, icon, children, lessonRef: ref }: { title: string; icon?: ReactNode; children: ReactNode; lessonRef: LessonRef }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      {icon && <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">{icon}</span>}
      <h1 className="font-aleo text-2xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
      <Link
        to="/courses/$courseId/$versionId"
        params={{ courseId: ref.courseId, versionId: ref.versionId }}
        className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}
      >
        Back to the course
      </Link>
    </div>
  );
}
