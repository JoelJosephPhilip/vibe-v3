import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '@/app/app';

describe('Theme', () => {
  it('defaults to light, even when the system prefers dark', () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('dark'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onchange: null,
        }) as MediaQueryList,
    );
    render(<App />);
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('switches to dark and back', async () => {
    const user = userEvent.setup();
    render(<App />);
    const [toggle] = screen.getAllByRole('button', { name: 'Switch to dark theme' });

    await user.click(toggle);
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    const [back] = screen.getAllByRole('button', { name: 'Switch to light theme' });
    await user.click(back);
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
