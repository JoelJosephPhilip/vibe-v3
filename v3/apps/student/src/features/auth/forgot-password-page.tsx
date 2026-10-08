import { Link } from '@tanstack/react-router';
import { Loader2Icon, MailCheckIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { AuthLayout, FormError } from './auth-layout';
import { useAuth } from './auth-provider';

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await sendPasswordReset(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const backToLogin = (
    <>
      Remember your password?{' '}
      <Link to="/login" className="font-medium text-foreground hover:underline">
        Back to log in
      </Link>
    </>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" footer={backToLogin}>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
          <MailCheckIcon className="size-8 text-primary" aria-hidden />
          <p className="text-sm">
            If an account exists for <span className="font-medium">{sentTo}</span>, a link to reset your password is on its way.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we’ll send you a link to reset it." footer={backToLogin}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoCapitalize="none" spellCheck={false} autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 sm:h-10" />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={!email.trim() || pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
