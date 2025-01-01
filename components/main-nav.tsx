'use client'
import Link from 'next/link'
import { Icons } from '@/components/icons'

export const dynamic = 'force-dynamic'

export function MainNav({ HeaderNavSheet }: { HeaderNavSheet: React.ReactNode }) {
	return (
		<div className="flex items-center gap-4 text-xs">
			<Link href="/" className="flex items-center rounded-full transition-all duration-100 hover:bg-zinc-500/10">
				<Icons.ada className="size-8 md:size-10" />
			</Link>
			{HeaderNavSheet}
		</div>
	)
}
