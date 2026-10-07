import { useNavigate } from '@tanstack/react-router';
import { unwrap } from '@vibe/api';
import { updateProfile } from 'firebase/auth';
import { CheckCircle2Icon, Loader2Icon, LogOutIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initials } from '@/features/app-shell/app-shell';
import { useAuth } from '@/features/auth/auth-provider';
import { NAME_PATTERN, PASSWORD_RULES } from '@/features/auth/signup-page';
import { api } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-border py-8 last:border-b-0 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="max-w-lg">{children}</div>
    </section>
  );
}

function Status({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={cn('flex items-center gap-2 text-sm', kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
      {kind === 'ok' && <CheckCircle2Icon className="size-4" aria-hidden />}
      {children}
    </p>
  );
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const usesPassword = user?.providerData.some((p) => p.providerId === 'password') ?? false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-primary font-aleo text-xl font-semibold text-primary-foreground">
          {initials(user?.displayName, user?.email)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-aleo text-3xl tracking-tight">{user?.displayName || 'Your profile'}</h1>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="mt-6">
        <Panel title="Your name" description="Shown to your course team and on certificates.">
          <NameForm />
        </Panel>
        {usesPassword && (
          <Panel title="Password" description="Choose a new password for signing in with your email.">
            <PasswordForm />
          </Panel>
        )}
        <Panel title="Appearance" description="ViBe uses the light theme unless you choose otherwise.">
          <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg bg-muted p-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                role="radio"
                type="button"
                aria-checked={theme === t}
                onClick={() => setTheme(t)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
                  theme === t ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'light' ? <SunIcon className="size-4" aria-hidden /> : <MoonIcon className="size-4" aria-hidden />}
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Session">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await signOut();
              await navigate({ to: '/login', replace: true });
            }}
          >
            <LogOutIcon /> Log out
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function NameForm() {
  const { user } = useAuth();
  const [first, setFirst] = useState(user?.displayName?.split(' ')[0] ?? '');
  const [last, setLast] = useState(user?.displayName?.split(' ').slice(1).join(' ') ?? '');
  const [state, setState] = useState<{ pending: boolean; ok?: boolean; error?: string }>({ pending: false });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!NAME_PATTERN.test(first.trim()) || (last.trim() && !NAME_PATTERN.test(last.trim()))) {
      return setState({ pending: false, error: 'Names can only contain letters and spaces.' });
    }
    setState({ pending: true });
    try {
      unwrap(await api.PATCH('/api/users/edit', { body: { firstName: first.trim(), lastName: last.trim() || undefined } }));
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: [first.trim(), last.trim()].filter(Boolean).join(' ') });
        await auth.currentUser.reload();
      }
      setState({ pending: false, ok: true });
    } catch (err) {
      setState({ pending: false, error: (err as Error).message });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-first">First name</Label>
          <Input id="profile-first" value={first} onChange={(e) => setFirst(e.target.value)} className="h-10" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-last">Last name</Label>
          <Input id="profile-last" value={last} onChange={(e) => setLast(e.target.value)} className="h-10" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={state.pending || !first.trim()}>
          {state.pending && <Loader2Icon className="animate-spin" />}
          Save name
        </Button>
        {state.ok && <Status kind="ok">Saved</Status>}
        {state.error && <Status kind="error">{state.error}</Status>}
      </div>
    </form>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<{ pending: boolean; ok?: boolean; error?: string }>({ pending: false });
  const valid = PASSWORD_RULES.every((r) => r.test(password)) && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setState({ pending: true });
    try {
      unwrap(await api.PATCH('/api/auth/change-password', { body: { newPassword: password, newPasswordConfirm: confirm } }));
      setPassword('');
      setConfirm('');
      setState({ pending: false, ok: true });
    } catch (err) {
      setState({ pending: false, error: (err as Error).message });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-10" />
        {confirm && password !== confirm && <p className="text-xs text-destructive">Passwords don’t match.</p>}
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((r) => (
          <li key={r.label} className={cn('text-xs', r.test(password) ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
            {r.test(password) ? '✓' : '·'} {r.label}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!valid || state.pending}>
          {state.pending && <Loader2Icon className="animate-spin" />}
          Update password
        </Button>
        {state.ok && <Status kind="ok">Password updated</Status>}
        {state.error && <Status kind="error">{state.error}</Status>}
      </div>
    </form>
  );
}
