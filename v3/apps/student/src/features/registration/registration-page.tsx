import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LayersIcon,
  Loader2Icon,
  LockIcon,
  PartyPopperIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { GeneratedAvatar, GeneratedCover } from '@/components/generated-art';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { FormError } from '@/features/auth/auth-layout';
import { useAuth } from '@/features/auth/auth-provider';
import { useEnrollments } from '@/features/courses/queries';
import { Wordmark } from '@/features/landing/wordmark';
import { cn } from '@/lib/utils';

import {
  registrationErrorKind,
  usePendingRegistrations,
  useRegister,
  useRegistrationDetails,
  useRegistrationForm,
  useRejectedRegistrations,
  type RegistrationDetails,
  type RegistrationForm,
} from './queries';
import { SchemaFields, initialValues, toSubmission, validate, type FormErrors, type FormValues } from './schema-form';

/**
 * Course registration (the link instructors share). Luma-style event page:
 * cover + who teaches it on the left, title and a single registration card on
 * the right; the card is the whole flow — form → "Request sent" / "You're in".
 */
export function RegistrationPage({ versionId, cohortId }: { versionId: string; cohortId?: string }) {
  const details = useRegistrationDetails(versionId);

  return (
    <div className="relative min-h-dvh bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent" />
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/home" aria-label="ViBe home" className="rounded-md">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative mx-auto max-w-5xl px-4 pt-2 pb-16 sm:px-6 lg:pt-6">
        {details.isPending ? (
          <PageSkeleton />
        ) : details.isError ? (
          <Unavailable message={details.error.message} />
        ) : (
          <CourseRegistration details={details.data} versionId={versionId} cohortId={cohortId} />
        )}
      </main>
    </div>
  );
}

function CourseRegistration({ details, versionId, cohortId }: { details: RegistrationDetails; versionId: string; cohortId?: string }) {
  const name = details.course?.name ?? details.version;
  const description = details.description ?? details.course?.description;
  const cohort = cohortId ? details.cohorts?.find((c) => c.cohortId === cohortId) : undefined;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,300px)_1fr] lg:gap-12">
      <aside className="flex flex-col gap-6">
        <GeneratedCover seed={details.courseId} title={name} className="aspect-[16/9] w-full shadow-lg shadow-primary/10 md:aspect-square" />
        <Instructors instructors={details.instructors} className="hidden md:flex" />
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Course registration</Badge>
            {cohort && <Badge variant="outline">{cohort.cohortName}</Badge>}
          </div>
          <h1 className="mt-3 font-aleo text-3xl leading-tight tracking-tight sm:text-4xl">{name}</h1>
          <ul className="mt-4 flex flex-col gap-3 text-sm" aria-label="Course size">
            <Fact icon={LayersIcon} title={`${details.modules.length} ${details.modules.length === 1 ? 'module' : 'modules'}`} sub={`${details.totalItems} lessons`} />
          </ul>
        </div>

        <RegistrationCard details={details} versionId={versionId} cohortId={cohortId} />

        {description && (
          <section aria-labelledby="about-title">
            <SectionTitle id="about-title">About the course</SectionTitle>
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{description}</p>
          </section>
        )}

        {details.modules.length > 0 && (
          <section aria-labelledby="inside-title">
            <SectionTitle id="inside-title">What’s inside</SectionTitle>
            <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
              {details.modules.map((m, i) => (
                <li key={m.id} className="flex items-start gap-3 p-4">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.name}</p>
                    {m.description && <p className="mt-0.5 text-sm text-muted-foreground">{m.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {m.itemsCount} {m.itemsCount === 1 ? 'lesson' : 'lessons'}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <Instructors instructors={details.instructors} className="md:hidden" />
      </div>
    </div>
  );
}

function RegistrationCard({ details, versionId, cohortId }: { details: RegistrationDetails; versionId: string; cohortId?: string }) {
  const form = useRegistrationForm(versionId);
  const enrollments = useEnrollments('active');
  const pending = usePendingRegistrations();
  const register = useRegister(versionId);
  const [outcome, setOutcome] = useState<'APPROVED' | 'PENDING' | 'already-enrolled' | 'closed' | null>(null);

  const enrolled = enrollments.data?.enrollments.some((e) => e.courseVersionId === versionId);
  const pendingRequest = pending.data?.find((r) => r.versionId === versionId && (!cohortId || r.cohortId === cohortId));
  const cohorts = (details.cohorts ?? []).filter((c) => c.isActive);
  const linkCohort = cohortId ? details.cohorts?.find((c) => c.cohortId === cohortId) : undefined;
  const courseLink = { to: '/courses/$courseId/$versionId' as const, params: { courseId: details.courseId, versionId } };

  if (form.isPending || enrollments.isPending || pending.isPending) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  if (outcome === 'APPROVED') {
    return (
      <StatusCard
        tone="success"
        icon={PartyPopperIcon}
        title="You’re in"
        body="Your registration was approved. The course is now in My courses."
        action={
          <Link {...courseLink} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
            Start learning <ArrowRightIcon data-icon="inline-end" />
          </Link>
        }
      />
    );
  }
  if (enrolled || outcome === 'already-enrolled') {
    return (
      <StatusCard
        tone="success"
        icon={CheckIcon}
        title="You’re already in this course"
        body="Pick up where you left off."
        action={
          <Link {...courseLink} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
            Go to course <ArrowRightIcon data-icon="inline-end" />
          </Link>
        }
      />
    );
  }
  if (outcome === 'PENDING' || pendingRequest) {
    return (
      <StatusCard
        tone="waiting"
        icon={ClockIcon}
        title="Request sent"
        body={
          <>
            Your course team will review your registration
            {pendingRequest ? ` (sent ${formatDate(pendingRequest.createdAt)})` : ''}. Once it’s approved, the course appears in My courses.
          </>
        }
        action={
          <Link to="/home" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full sm:w-auto')}>
            Back to home
          </Link>
        }
      />
    );
  }
  if (form.isError) {
    return <StatusCard tone="closed" icon={LockIcon} title="Registration isn’t available" body={form.error.message} />;
  }
  if (outcome === 'closed' || !form.data.isActive || (cohortId && (!linkCohort || !linkCohort.isActive))) {
    return (
      <StatusCard
        tone="closed"
        icon={LockIcon}
        title="Registration is closed"
        body="This course isn’t taking registrations right now. If you think that’s a mistake, ask your course team for a new link."
      />
    );
  }

  return (
    <RegistrationFormCard
      form={form.data}
      versionId={versionId}
      cohorts={cohortId ? [] : cohorts}
      cohortId={cohortId}
      pending={register.isPending}
      onSubmit={async (detail) => {
        try {
          const result = await register.mutateAsync(detail);
          setOutcome(result.status);
          return null;
        } catch (err) {
          const message = (err as Error).message;
          const kind = registrationErrorKind(message);
          if (kind === 'already-registered') setOutcome('PENDING');
          else if (kind) setOutcome(kind);
          else return message;
          return null;
        }
      }}
    />
  );
}

function RegistrationFormCard({
  form,
  versionId,
  cohorts,
  cohortId,
  pending,
  onSubmit,
}: {
  form: RegistrationForm;
  versionId: string;
  cohorts: { cohortId: string; cohortName: string }[];
  cohortId?: string;
  pending: boolean;
  onSubmit: (detail: Record<string, unknown>) => Promise<string | null>;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const rejected = useRejectedRegistrations();
  const schema = form.jsonSchema;
  const prefill = useMemo(() => prefillFor(schema.properties ?? {}, user), [schema, user]);
  const [values, setValues] = useState<FormValues>(() => initialValues(schema, prefill));
  const [errors, setErrors] = useState<FormErrors>({});
  const [cohort, setCohort] = useState(cohortId ?? (cohorts.length === 1 ? cohorts[0].cohortId : ''));
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasRejected = rejected.data?.some((r) => r.versionId === versionId) ?? false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const found = validate(schema, values);
    const needsCohort = cohorts.length > 0 && !cohort;
    setErrors(found);
    setCohortError(needsCohort ? 'Choose a cohort to join.' : null);
    if (Object.keys(found).length || needsCohort) {
      const first = Object.keys(found)[0];
      document.getElementById(first ? `reg-${first.replace(/\W+/g, '-')}` : 'reg-cohort')?.focus();
      return;
    }
    setError(await onSubmit({ ...toSubmission(schema, values), ...(cohort ? { cohort } : {}) }));
  }

  async function switchAccount() {
    const here = window.location.pathname + window.location.search;
    await signOut();
    await navigate({ to: '/login', search: { redirect: here }, replace: true });
  }

  return (
    <section aria-labelledby="register-title" className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5 sm:px-5">
        <h2 id="register-title" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Registration
        </h2>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-4 sm:p-5">
        <div>
          <p className="text-sm">Welcome! To join the course, fill in a few details below.</p>
          <div className="mt-3 flex items-center gap-2.5 text-sm">
            <GeneratedAvatar seed={user?.uid ?? user?.email ?? 'student'} size={24} />
            <span className="min-w-0 truncate">
              {user?.displayName && <span className="font-medium">{user.displayName} </span>}
              <span className="text-muted-foreground">{user?.email}</span>
            </span>
            <button type="button" onClick={switchAccount} className="ml-auto shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Not you?
            </button>
          </div>
        </div>

        {wasRejected && (
          <p className="rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
            Your earlier request for this course wasn’t approved. You’re welcome to register again.
          </p>
        )}

        {cohorts.length > 0 && (
          <div className="flex flex-col gap-2">
            <span id="reg-cohort-label" className="text-sm leading-none font-medium">
              Cohort
            </span>
            <RadioGroup
              id="reg-cohort"
              aria-labelledby="reg-cohort-label"
              value={cohort}
              onValueChange={(v) => setCohort(String(v))}
              className="grid gap-2 sm:grid-cols-2"
            >
              {cohorts.map((c) => (
                <Label
                  key={c.cohortId}
                  htmlFor={`cohort-${c.cohortId}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm font-normal hover:bg-muted/60',
                    cohort === c.cohortId && 'border-primary bg-primary/5',
                  )}
                >
                  <RadioGroupItem id={`cohort-${c.cohortId}`} value={c.cohortId} />
                  <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
                  {c.cohortName}
                </Label>
              ))}
            </RadioGroup>
            {cohortError && <p className="text-xs text-destructive">{cohortError}</p>}
          </div>
        )}

        <SchemaFields
          schema={schema}
          uiSchema={form.uiSchema}
          values={values}
          errors={errors}
          disabled={pending}
          onChange={(name, value) => {
            setValues((v) => ({ ...v, [name]: value }));
            if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
          }}
        />

        <FormError message={error} />

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Register
        </Button>
      </form>
    </section>
  );
}

/** Fills the backend's default Name / Email questions from the signed-in account. */
function prefillFor(properties: Record<string, unknown>, user: { displayName: string | null; email: string | null } | null) {
  const prefill: Record<string, string | undefined> = {};
  for (const key of Object.keys(properties)) {
    if (/^(full\s*)?name$/i.test(key) && user?.displayName) prefill[key] = user.displayName;
    if (/^e-?mail$/i.test(key) && user?.email) prefill[key] = user.email;
  }
  return prefill;
}

function StatusCard({
  tone,
  icon: Icon,
  title,
  body,
  action,
}: {
  tone: 'success' | 'waiting' | 'closed';
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section role="status" aria-label={title} className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <span
        className={cn(
          'grid size-10 place-items-center rounded-full',
          tone === 'success' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
          tone === 'waiting' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
          tone === 'closed' && 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

function Instructors({ instructors, className }: { instructors: RegistrationDetails['instructors']; className?: string }) {
  if (!instructors.length) return null;
  return (
    <section aria-labelledby={`taught-by-${className ?? ''}`} className={cn('flex-col', className)}>
      <SectionTitle id={`taught-by-${className ?? ''}`}>Taught by</SectionTitle>
      <ul className="flex flex-col gap-2.5">
        {instructors.map((i) => (
          <li key={i.name} className="flex items-center gap-2.5 text-sm">
            {i.profileImage ? (
              <img src={i.profileImage} alt="" className="size-7 rounded-full object-cover" />
            ) : (
              <GeneratedAvatar seed={i.name} size={28} />
            )}
            <span className="font-medium">{i.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-muted-foreground">{sub}</span>
      </span>
    </li>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 border-b border-border pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <LockIcon className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 font-aleo text-2xl">We couldn’t open this registration link</h1>
      <p className="mt-2 text-sm text-muted-foreground">Check the link with your course team. ({message})</p>
      <Link to="/home" className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
        Go to home
      </Link>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-[300px_1fr] lg:gap-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="aspect-[16/9] rounded-2xl md:aspect-square" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'recently' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
