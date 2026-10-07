import { ThemeProvider } from '@/components/theme-provider';
import { LandingPage } from '@/features/landing/landing-page';

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <LandingPage />
    </ThemeProvider>
  );
}

export default App;
