import FluxDemoPage from "./client-page";
import { currentUser } from '@clerk/nextjs/server'
import { AlertCircle } from 'lucide-react'

// export metadata for nextjs page
export const metadata = {
    title: 'Flux Demo',
    description: 'Flux Demo',
}

export default async function page() {
    // const whitelistedEmails = process.env.WHITELISTED_EMAILS_FOR_FLUX_DEMO?.split(',') || [];
    const user = await currentUser()

    if (!user) { // || !whitelistedEmails.includes(user.emailAddresses[0].emailAddress)
        return <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
            <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-md dark:bg-destructive bg-destructive/80">
                <h1 className="text-2xl flex items-center gap-2">
                    You are not authorized to use this demo
                    <AlertCircle className="w-10 h-10" />
                </h1>
            </div>
        </div>
    }

    return <div>
        <FluxDemoPage />
    </div>
}

