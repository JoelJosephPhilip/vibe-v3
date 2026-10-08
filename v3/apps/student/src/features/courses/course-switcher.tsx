import { Link } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';

import { GeneratedCover } from '@/components/generated-art';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { percentOf } from './course-ui';
import { useEnrollments } from './queries';

/**
 * Uxcel Go's course pill: shows the current course and opens a bottom sheet
 * listing the student's other active courses.
 */
export function CourseSwitcher({ current, name, className }: { current: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const enrollments = useEnrollments('active');
  const list = enrollments.data?.enrollments ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          'inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        aria-label={`Switch course. Current course: ${name}`}
      >
        <span className="truncate">{name}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <div className="px-4 pt-3 pb-3">
          <SheetTitle className="text-lg font-semibold">Your courses</SheetTitle>
          <SheetDescription>Switch to another course you’re taking.</SheetDescription>
        </div>
        <ul className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {list.map((e) => {
            const selected = e.courseVersionId === current;
            return (
              <li key={e._id}>
                <Link
                  to="/courses/$courseId/$versionId"
                  params={{ courseId: e.courseId, versionId: e.courseVersionId }}
                  onClick={() => setOpen(false)}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50',
                    selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                  )}
                >
                  <GeneratedCover seed={e.courseId} title={e.course.name} className="size-12 shrink-0 rounded-lg" compact />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium">{e.course.name}</span>
                    <span className="text-xs text-muted-foreground">{Math.round(percentOf(e))}% complete</span>
                  </span>
                  {selected && <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />}
                </Link>
              </li>
            );
          })}
          <li>
            <Link to="/courses" onClick={() => setOpen(false)} className="block py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground">
              See all courses
            </Link>
          </li>
        </ul>
      </SheetContent>
    </Sheet>
  );
}
