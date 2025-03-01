import FluxDemoPage from "./client-page";
import { currentUser } from '@clerk/nextjs/server'
import { AlertCircle } from 'lucide-react'
import { Metadata } from 'next'

// Enhanced metadata for better link previews
export const metadata: Metadata = {
    title: 'FLUX.1-dev Image Generator | cardano-tools.xyz',
    description: 'Generate stunning AI images with FLUX.1-dev - a powerful image generation tool that transforms your text prompts into beautiful visuals.',

    // Open Graph metadata for social media platforms like Facebook
    openGraph: {
        title: 'FLUX.1-dev Image Generator | cardano-tools.xyz',
        description: 'Transform your ideas into stunning visuals with our AI-powered image generator.',
        type: 'website',
        url: 'https://cardano-degen-club.vercel.app/flux-demo',
        images: [
            {
                url: '/images/flux-preview.png', // You'll need to create and add this image
                width: 1200,
                height: 630,
                alt: 'FLUX.1-dev Image Generator Preview',
            },
        ],
        siteName: 'cardano-tools.xyz',
    },

    // Twitter card metadata
    twitter: {
        card: 'summary_large_image',
        title: 'FLUX.1-dev Image Generator',
        description: 'Create beautiful AI-generated images from text prompts with FLUX.1-dev.',
        images: ['/images/flux-preview.png'], // Same image as OG
        creator: 'cardano-tools.xyz', // Replace with your actual Twitter handle
    },

    // Additional metadata
    keywords: ['AI image generator', 'FLUX', 'text-to-image', 'Cardano', 'NFT', 'digital art'],
    authors: [{ name: 'cardano-tools.xyz' }],
    creator: 'cardano-tools.xyz',
    publisher: 'cardano-tools.xyz',
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

