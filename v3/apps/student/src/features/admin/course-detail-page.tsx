import { Link } from '@tanstack/react-router';
import { ApiError } from '@vibe/api';
import { ArrowLeftIcon, FileTextIcon, Loader2Icon, SendIcon, VideoIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCourseVersion } from '@/features/courses/queries';
import { cn } from '@/lib/utils';

import { useCourse, useCourseEnrollments, useInviteInstructor } from './queries';

function Status({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={cn('text-sm', kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
      {children}
    </p>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const ITEM_ICON: Record<string, typeof VideoIcon> = { VIDEO: VideoIcon, QUIZ: FileTextIcon };

export function CourseDetailPage({ courseId, versionId }: { courseId: string; versionId: string }) {
  const course = useCourse(courseId);
  const version = useCourseVersion(versionId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All courses
      </Link>

      <h1 className="mt-3 font-aleo text-3xl tracking-tight">{course.data?.name ?? '…'}</h1>
      {course.data?.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{course.data.description}</p>}

      <section className="mt-8 border-b border-border pb-8">
        <h2 className="font-semibold">Content</h2>
        <div className="mt-4">
          {version.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {version.isError && <Status kind="error">{errorMessage(version.error)}</Status>}
          {version.data && (
            <ol className="grid gap-4">
              {version.data.modules.map((module, mi) => (
                <li key={module.moduleId}>
                  <p className="text-sm font-medium">
                    {mi + 1}. {module.name}
                  </p>
                  <ol className="mt-1.5 ml-4 grid gap-1 border-l border-border pl-4">
                    {module.sections.map((section, si) => (
                      <li key={section.sectionId} className="text-sm text-muted-foreground">
                        {mi + 1}.{si + 1} {section.name}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
              {version.data.modules.length === 0 && <p className="text-sm text-muted-foreground">No modules yet.</p>}
            </ol>
          )}
          {version.data?.itemCounts && (
            <p className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(version.data.itemCounts).map(([type, count]) => {
                const Icon = ITEM_ICON[type] ?? FileTextIcon;
                return (
                  <span key={type} className="inline-flex items-center gap-1">
                    <Icon className="size-3.5" aria-hidden /> {count} {type.toLowerCase()}
                  </span>
                );
              })}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 border-b border-border pb-8">
        <h2 className="font-semibold">Enrollments</h2>
        <div className="mt-4">
          <EnrollmentsTable courseId={courseId} versionId={versionId} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Invite an instructor</h2>
        <div className="mt-4 max-w-sm">
          <InviteInstructorForm courseId={courseId} versionId={versionId} />
        </div>
      </section>
    </div>
  );
}

function EnrollmentsTable({ courseId, versionId }: { courseId: string; versionId: string }) {
  const enrollments = useCourseEnrollments(courseId, versionId);

  if (enrollments.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (enrollments.isError) return <Status kind="error">{errorMessage(enrollments.error)}</Status>;
  if (enrollments.data.length === 0) return <p className="text-sm text-muted-foreground">No one is enrolled yet.</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.data.map((e) => (
            <tr key={e.user._id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2">
                {e.user.firstName} {e.user.lastName ?? ''}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{e.user.email}</td>
              <td className="px-4 py-2">{e.role}</td>
              <td className="px-4 py-2 text-muted-foreground">{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InviteInstructorForm({ courseId, versionId }: { courseId: string; versionId: string }) {
  const invite = useInviteInstructor();
  const [email, setEmail] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    invite.mutate({ courseId, versionId, email }, { onSuccess: () => setEmail('') });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="invite-email" className="text-xs">
          Email
        </Label>
        <Input id="invite-email" type="email" placeholder="instructor@vibe.local" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" variant="outline" disabled={invite.isPending}>
        {invite.isPending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <SendIcon className="size-4" aria-hidden />}
        Invite
      </Button>
      {invite.isSuccess && <Status kind="ok">Invited.</Status>}
      {invite.isError && <Status kind="error">{errorMessage(invite.error)}</Status>}
    </form>
  );
}
