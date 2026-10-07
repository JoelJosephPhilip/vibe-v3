import { Link } from '@tanstack/react-router';
import { MenuIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { LOGIN_HREF, NAV_LINKS, SIGNUP_HREF } from './content';
import { Wordmark } from './wordmark';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 md:top-4">
      <nav
        aria-label="Main"
        className="mx-auto w-full max-w-6xl rounded-xl border border-border/60 bg-background/80 px-4 py-2 shadow-xs backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-4">
          <a href="#top" aria-label="ViBe home" className="rounded-md py-1">
            <Wordmark />
          </a>

          <ul className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Link to={LOGIN_HREF} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Log in
            </Link>
            <Link to={SIGNUP_HREF} className={buttonVariants({ size: 'sm' })}>
              Get started
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
            >
              {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden md:hidden"
            >
              <ul className="flex flex-col gap-1 pt-3 pb-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 border-t border-border pt-3 pb-2">
                <Link to={LOGIN_HREF}
                  className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
                >
                  Log in
                </Link>
                <Link to={SIGNUP_HREF} className={cn(buttonVariants(), 'w-full')}>
                  Get started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
