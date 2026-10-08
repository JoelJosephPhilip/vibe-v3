import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2Icon, CircleIcon, EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { AuthLayout, FormError, GoogleIcon, OrDivider } from './auth-layout';
import { splitName, useAuth } from './auth-provider';

/** The backend documents these rules for sign-up passwords (AuthValidators.SignUpBody). */
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /\d/.test(p) },
  { label: 'A symbol, e.g. ! @ # $', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

/** Backend rule: names may only contain letters and spaces. */
export const NAME_PATTERN = /^[A-Za-z ]+$/;

export function SignupPage({ redirect }: { redirect?: string } = {}) {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'password'>('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameValid = NAME_PATTERN.test(fullName.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));

  function onDetails(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nameValid) return setError('Your name can only contain letters and spaces.');
    if (!emailValid) return setError('Enter a valid email address.');
    setStep('password');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!passwordValid) return;
    setError(null);
    setPending('email');
    try {
      await signUp({ ...splitName(fullName), email: email.trim(), password });
      await navigate({ to: '/onboarding', search: { redirect }, replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setPending('google');
    try {
      const { isNewUser } = await signInWithGoogle();
      await (isNewUser
        ? navigate({ to: '/onboarding', search: { redirect }, replace: true })
        : navigate({ to: redirect ?? '/home', replace: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  const loginFooter = (
    <>
      Already have an account?{' '}
      <Link to="/login" search={{ redirect }} className="font-medium text-foreground hover:underline">
        Log in
      </Link>
    </>
  );

  if (step === 'password') {
    return (
      <AuthLayout
        title="Create a password"
        subtitle={
          <>
            For <span className="font-medium text-foreground">{email.trim()}</span>.{' '}
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setStep('details')}>
              Not you?
            </button>
          </>
        }
        footer={loginFooter}
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-rules"
                className="h-11 pr-10 sm:h-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            <ul id="password-rules" className="mt-1 flex flex-col gap-1.5">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li key={rule.label} className={cn('flex items-center gap-2 text-xs', ok ? 'text-foreground' : 'text-muted-foreground')}>
                    {ok ? <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden /> : <CircleIcon className="size-4" aria-hidden />}
                    {rule.label}
                    <span className="sr-only">{ok ? '(met)' : '(not met)'}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <FormError message={error} />

          <Button type="submit" size="lg" className="w-full" disabled={!passwordValid || pending !== null}>
            {pending === 'email' && <Loader2Icon className="animate-spin" />}
            Create account
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You&apos;ll be asked for consent before any proctored course uses your camera or microphone.
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your ViBe account" subtitle="Learn in short segments and prove what you know as you go." footer={loginFooter}>
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={onGoogle} disabled={pending !== null}>
        {pending === 'google' ? <Loader2Icon className="animate-spin" /> : <GoogleIcon className="size-4" />}
        Continue with Google
      </Button>

      <OrDivider />

      <form onSubmit={onDetails} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 sm:h-10" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoCapitalize="none" spellCheck={false} autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 sm:h-10" />
        </div>

        <FormError message={error} />

        <Button type="submit" size="lg" className="w-full" disabled={!fullName.trim() || !email.trim()}>
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
