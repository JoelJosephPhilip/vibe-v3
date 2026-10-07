import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '@/app/app';

import { FAQS, LOGIN_HREF, NAV_LINKS, SIGNUP_HREF } from './content';

describe('Landing page', () => {
  it('renders the hero headline as the only h1', () => {
    render(<App />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Learn it. Prove it. Then move on.');
  });

  it('links every nav item to a section that exists on the page', () => {
    const { container } = render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const link of NAV_LINKS) {
      const anchor = within(nav).getAllByRole('link', { name: link.label })[0];
      expect(anchor).toHaveAttribute('href', link.href);
      expect(container.querySelector(link.href)).not.toBeNull();
    }
  });

  it('points the calls to action at login and signup', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /start learning/i })).toHaveAttribute('href', SIGNUP_HREF);
    for (const link of screen.getAllByRole('link', { name: /^log in$/i })) {
      expect(link).toHaveAttribute('href', LOGIN_HREF);
    }
  });

  it('opens an FAQ answer when its question is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    const [first] = FAQS;
    const trigger = screen.getByRole('button', { name: first.q });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The panel is labelled by its question; it must be open and hold the answer.
    // (Not toBeVisible: the scroll-reveal wrapper stays at opacity 0 in jsdom.)
    const panel = await screen.findByRole('region', { name: first.q });
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).toHaveTextContent(first.a);
  });

  it('toggles the mobile menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('mobile-menu')).toBeInTheDocument();
  });
});
