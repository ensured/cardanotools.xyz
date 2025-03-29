import { MainNav } from '@/components/main-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { HeaderNavSheet } from './HeaderNavSheet'
import { EpochTime } from './EpochTime'
import { getEpochData } from '../app/actions'
import UserLoginButtons from './UserLoginButtons'
import { FeedbackForm } from './FeedbackForm'

export async function SiteHeader() {
  const epochData = await getEpochData()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-1 px-2 pt-2 md:px-2">
        <MainNav HeaderNavSheet={<HeaderNavSheet />} />

        <div className="flex flex-1 items-center justify-end space-x-4 overflow-hidden">
          <nav className="flex items-center gap-1 text-xs">
            <div className="flex shrink-0 items-center justify-center">
              <UserLoginButtons />
            </div>
            <FeedbackForm />
            <ThemeToggle />
          </nav>
        </div>
      </div>
      <EpochTime epochData={epochData} />
    </header>
  )
}
