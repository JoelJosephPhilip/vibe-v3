import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, CheckIcon, CircleDashedIcon, PlusIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { CourseCover, ProgressBar, percentOf } from '@/features/courses/course-ui';
import { useCurrentPath, useEnrollments, type EnrollmentSummary } from '@/features/courses/queries';
import { readOnboarding } from '@/features/onboarding/onboarding-state';
import { cn } from '@/lib/utils';

export function HomePage() {
  const { user } = useAuth();
  const enrollments = useEnrollments('active');
  const list = enrollments.data?.enrollments ?? [];
  // Resume the course with progress that isn't finished; otherwise the newest enrolment.
  const inProgress = list.filter((e) => percentOf(e) > 0 && percentOf(e) < 100);
  const resume = inProgress[0] ?? list.find((e) => percentOf(e) < 100) ?? list[0];
  const others = list.filter((e) => e !== resume);
  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_300px] lg:py-10">
      <div className="min-w-0">
        <h1 className="font-aleo text-3xl tracking-tight">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>

        <section aria-labelledby="continue-title" className="mt-8">
          <h2 id="continue-title" className="mb-4 text-lg font-semibold">
            Continue learning
          </h2>
          {enrollments.isPending ? (
            <Skeleton className="h-52 rounded-2xl" />
          ) : enrollments.isError ? (
            <LoadError onRetry={() => enrollments.refetch()} />
          ) : resume ? (
            <ResumeCard enrollment={resume} />
          ) : (
            <EmptyCourses />
          )}
        </section>

        {others.length > 0 && (
          <section aria-labelledby="your-courses-title" className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="your-courses-title" className="text-lg font-semibold">
                Your courses
              </h2>
              <Link to="/courses" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {others.slice(0, 4).map((e) => (
                <li key={e._id}>
                  <Link
                    to="/courses/$courseId/$versionId"
                    params={{ courseId: e.courseId, versionId: e.courseVersionId }}
                    className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
                  >
                    <CourseCover name={e.course.name} className="h-28 w-full" />
                    <p className="mt-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Course</p>
                    <p className="mt-1 line-clamp-2 font-medium">{e.course.name}</p>
                    <ProgressBar value={percentOf(e)} className="mt-3" label={`${e.course.name} progress`} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-4" aria-label="Getting started">
        <GettingStarted hasCourse={list.length > 0} hasStarted={list.some((e) => percentOf(e) > 0)} uid={user?.uid ?? ''} />
      </aside>
    </div>
  );
}

function ResumeCard({ enrollment: e }: { enrollment: EnrollmentSummary }) {
  const path = useCurrentPath(e.courseId, e.courseVersionId);
  const pct = percentOf(e);
  const total = e.contentCounts?.totalItems ?? 0;
  const left = Math.max(0, total - (e.completedItems ?? 0));

  return (
    <div className="relative">
      {/* Uxcel's stacked-card hint that there's more behind this one */}
      <div aria-hidden className="absolute inset-x-4 -bottom-2 h-full rounded-2xl border border-border bg-muted/60" />
      <div className="relative grid gap-5 rounded-2xl border border-border bg-card p-4 shadow-xs sm:grid-cols-[220px_1fr] sm:p-5">
        <CourseCover name={e.course.name} className="aspect-[4/3] w-full sm:aspect-auto sm:h-full" />
        <div className="flex min-w-0 flex-col">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Course</p>
          <h3 className="mt-1 font-aleo text-xl leading-snug">{e.course.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {path.data?.item ? (
              <>
                Up next: <span className="text-foreground">{path.data.item.name}</span>
              </>
            ) : (
              e.course.description
            )}
          </p>
          <div className="mt-auto pt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(pct)}% complete</span>
              {total > 0 && <span>{left} of {total} lessons left</span>}
            </div>
            <ProgressBar value={pct} label={`${e.course.name} progress`} />
            <Link
              {...(path.data?.item && path.data.module && path.data.section
                ? {
                    to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId' as const,
                    params: {
                      courseId: e.courseId,
                      versionId: e.courseVersionId,
                      moduleId: path.data.module.id,
                      sectionId: path.data.section.id,
                      itemId: path.data.item.id,
                    },
                    search: { track: 'green' as const },
                  }
                : { to: '/courses/$courseId/$versionId' as const, params: { courseId: e.courseId, versionId: e.courseVersionId } })}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4 w-full')}
            >
              {pct > 0 ? 'Resume course' : 'Start course'}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCourses() {
  return (
    <div className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[220px_1fr]">
      <div className="grid aspect-[4/3] place-items-center rounded-xl bg-muted sm:aspect-auto sm:h-40">
        <span className="grid size-16 place-items-center rounded-full border-2 border-dashed border-muted-foreground/40 text-muted-foreground/60">
          <PlusIcon className="size-7" aria-hidden />
        </span>
      </div>
      <div className="flex flex-col justify-center">
        <h3 className="font-semibold">You don’t have any active courses</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Courses appear here once you join one through an invite or a registration link from your course team.
        </p>
      </div>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
      We couldn’t load your courses.{' '}
      <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
        Try again
      </button>
    </div>
  );
}

function GettingStarted({ uid, hasCourse, hasStarted }: { uid: string; hasCourse: boolean; hasStarted: boolean }) {
  const onboarding = readOnboarding(uid);
  const steps = [
    { label: 'Create your account', done: true, to: undefined },
    { label: 'Check your camera and microphone', done: Boolean(onboarding.mediaCheckPassedAt), to: '/onboarding' as const },
    { label: 'Join a course', done: hasCourse, to: undefined },
    { label: 'Start your first lesson', done: hasStarted, to: hasCourse ? ('/courses' as const) : undefined },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Getting started</h2>
        <span className="text-xs text-muted-foreground">
          {doneCount}/{steps.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">A few quick steps before your first proctored lesson.</p>
      <ProgressBar value={(doneCount / steps.length) * 100} className="mt-4" label="Getting started progress" />
      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((s) => {
          const content = (
            <>
              <span className="flex-1">{s.label}</span>
              {s.done ? (
                <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white">
                  <CheckIcon className="size-3" aria-hidden />
                </span>
              ) : (
                <CircleDashedIcon className="size-5 text-muted-foreground" aria-hidden />
              )}
              <span className="sr-only">{s.done ? '(done)' : '(to do)'}</span>
            </>
          );
          const cls = 'flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm';
          return (
            <li key={s.label}>
              {!s.done && s.to ? (
                <Link to={s.to} className={cn(cls, 'hover:bg-muted')}>
                  {content}
                </Link>
              ) : (
                <div className={cn(cls, s.done && 'text-muted-foreground')}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
