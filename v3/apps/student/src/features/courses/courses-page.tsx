import { Link } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { CourseCover, ProgressBar, percentOf } from './course-ui';
import { useEnrollments } from './queries';

type Tab = 'active' | 'archived';

export function CoursesPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const query = useEnrollments(tab, deferredSearch);
  const data = query.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-aleo text-3xl tracking-tight">My courses</h1>
      <p className="mt-2 text-sm text-muted-foreground">Everything you’re enrolled in, with your progress.</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Luma-style segmented switch */}
        <div role="tablist" aria-label="Course status" className="inline-flex w-fit rounded-lg bg-muted p-1">
          {(['active', 'archived'] as const).map((t) => {
            const count = t === 'active' ? data?.activeCount : data?.archivedCount;
            return (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === t ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'active' ? 'Active' : 'Archived'}
                {typeof count === 'number' && <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search your courses"
            placeholder="Search your courses"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9 sm:h-10"
          />
        </div>
      </div>

      <div role="tabpanel" className="mt-6">
        {query.isPending ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </ul>
        ) : query.isError ? (
          <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
            We couldn’t load your courses.{' '}
            <button type="button" onClick={() => query.refetch()} className="font-medium underline underline-offset-2">
              Try again
            </button>
          </p>
        ) : data && data.enrollments.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.enrollments.map((e) => {
              const pct = percentOf(e);
              const total = e.contentCounts?.totalItems ?? 0;
              return (
                <li key={e._id}>
                  <Link
                    to="/courses/$courseId/$versionId"
                    params={{ courseId: e.courseId, versionId: e.courseVersionId }}
                    className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
                  >
                    <CourseCover name={e.course.name} seed={e.courseId} className="h-36 w-full" />
                    <p className="mt-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Course{e.cohortName ? ` · ${e.cohortName}` : ''}
                    </p>
                    <h2 className="mt-1 line-clamp-2 font-medium">{e.course.name}</h2>
                    {e.course.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.course.description}</p>
                    )}
                    <div className="mt-auto pt-4">
                      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>{pct >= 100 ? 'Completed' : `${Math.round(pct)}% complete`}</span>
                        {total > 0 && <span>{total} lessons</span>}
                      </div>
                      <ProgressBar value={pct} label={`${e.course.name} progress`} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">
              {deferredSearch ? `No courses match “${deferredSearch}”` : tab === 'active' ? 'No active courses yet' : 'No archived courses'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === 'active' && !deferredSearch
                ? 'Join a course through an invite or registration link from your course team.'
                : 'Try a different search or tab.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
