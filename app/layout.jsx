import "@/styles/globals.css"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import Footer from "@/components/Footer"
import ScrollToTopButton from "@/components/ScrollToTopButton"
import { SiteHeader } from "@/components/site-header"
import { TailwindIndicator } from "@/components/tailwind-indicator"
import { ThemeProvider } from "@/components/theme-provider"
import { Inter } from "next/font/google"
import CustomClerkProvider from "./clerk/Provider"
import {GoogleOneTap } from "@clerk/nextjs"
import { CommitProvider } from "@/components/CommitContext" 
import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
  title: "Home",
  description: siteConfig.description,
  icons: {
    icon: "/favicon.svg",
  },
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}


const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

export default async function RootLayout({ children }) {
  return (
    <CustomClerkProvider>

      <html lang="en" suppressHydrationWarning>
        <body className={cn(
          "min-h-screen bg-background font-sans antialiased",
        inter.variable,
        inter.className
      )}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster
            richColors={true}
            toastOptions={{
              style: { minWidth: "20rem", maxWidth: "40rem" },
              className: "break-all",
            }}
          />
          <CommitProvider>
          <div className="flex min-h-screen flex-col">
            <div className="relative">
                <SiteHeader />
            </div>
            <main className="grow">{children}</main>
            <Footer />
          </div>
              <TailwindIndicator />
            </CommitProvider>

        </ThemeProvider>
        <ScrollToTopButton />
      </body>
    </html>
    </CustomClerkProvider>
  )
}