import './globals.css';
import Nav from '@/components/Nav';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getSessionUser, isInternal } from '@/lib/auth';

export const metadata = {
  title: `${process.env.BRAND_PREFIX || 'SB'} Ops — Shanti Boilers`,
  description: 'Project SLA tracking & dispatch',
};

// Set the theme before first paint so there's no light→dark flash.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }) {
  const user = getSessionUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className="min-h-screen bg-background text-foreground">
        <TooltipProvider delayDuration={200}>
          {isInternal(user) && <Nav user={user} />}
          {/* Extra bottom padding on mobile so content clears the fixed bottom tab bar (internal only). */}
          <div className={isInternal(user) ? 'pb-20 md:pb-0' : ''}>{children}</div>
        </TooltipProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
