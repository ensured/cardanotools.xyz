import '@/styles/globals.css'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'
import Footer from '@/components/Footer'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import { SiteHeader } from '@/components/site-header'
import { TailwindIndicator } from '@/components/tailwind-indicator'
import { ThemeProvider } from '@/components/theme-provider'
import { Inter } from 'next/font/google'
import CustomClerkProvider from './clerk/Provider'
import { CommitProvider } from '@/components/CommitContext'
import { WalletProvider } from '@/contexts/WalletContext'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'Home',
  description: siteConfig.description,
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export default async function RootLayout({ children }) {
  return (
    <CustomClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            'min-h-screen bg-background font-sans antialiased',
            inter.variable,
            inter.className,
          )}
        >
          <WalletProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Toaster
                richColors={true}
                toastOptions={{
                  style: { minWidth: '20rem', maxWidth: '40rem' },
                  className: 'break-all',
                }}
              />
              <CommitProvider>
                <div className="relative flex min-h-screen flex-col">
                  <SiteHeader />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
                <SpeedInsights />
                <TailwindIndicator />
                <Analytics />
              </CommitProvider>
            </ThemeProvider>
          </WalletProvider>
          <ScrollToTopButton />
        </body>
      </html>
    </CustomClerkProvider>
  )
}
