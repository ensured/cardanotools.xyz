'use client'
import { useState } from 'react'
import { Button } from './ui/button'
import { Sheet, SheetTrigger, SheetContent, SheetDescription, SheetTitle } from './ui/sheet'
import Image from 'next/image'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { CheckIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWallet } from '@/contexts/WalletContext'
import Link from 'next/link'
import Button3D from './3dButton'

interface WalletConnectProps {
	className: string
	setIsAdaHandleVisible: (value: boolean) => void
	setIsWalletAddressVisible: (value: boolean) => void
	isAdaHandleVisible: boolean
	isWalletAddressVisible: boolean
}

const WalletConnect = ({ className, isAdaHandleVisible, isWalletAddressVisible }: WalletConnectProps) => {
	const [isSheetOpen, setIsSheetOpen] = useState(false)
	const { walletState, loading, connect, disconnect, getSupportedWallets } = useWallet()

	// useEffect(() => {
	// 	const checkWalletAuth = async () => {
	// 		if (walletState.stakeAddress) {
	// 			const auth = await getWalletAuth(walletState.stakeAddress)
	// 			if (!('error' in auth) && auth.expiresAt) {
	// 				setExpiresAt(auth.expiresAt)
	// 			}
	// 		}
	// 	}

	// 	checkWalletAuth()
	// }, [walletState.stakeAddress, setExpiresAt])

	const handleOpenConnectSheet = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault()
		getSupportedWallets()
		setIsSheetOpen(true)
	}

	const handleConnect = async (wallet: string) => {
		setIsSheetOpen(false)
		await connect(wallet)
	}

	return (
		<div className="flex w-full flex-col items-center justify-center rounded-md">
			{walletState?.walletName ? (
				<div className="flex w-[15rem] flex-col rounded-md border border-border/65 bg-secondary/65">
					<div
						className={cn(
							'flex flex-row items-center justify-between gap-0.5 rounded-none px-4 pb-3 pt-2.5',
							isAdaHandleVisible && isWalletAddressVisible && 'border-b border-border/50',
						)}
					>
						<div className="flex flex-row items-center gap-0.5">
							{walletState?.walletIcon && (
								<Image
									src={walletState?.walletIcon}
									alt="wallet icon"
									width={40}
									height={40}
									className="size-10 rounded-full"
								/>
							)}
							{/* <span className="line-clamp-1 text-muted-foreground">
								{walletState.adaHandle?.handle && (
									<span>{isAdaHandleVisible ? `$${walletState.adaHandle.handle}` : ``}</span>
								)}
							</span> */}
						</div>
						<div className="relative bottom-0.5">
							<Button3D onClick={disconnect}>Disconnect</Button3D>
						</div>
					</div>

					{isAdaHandleVisible && isWalletAddressVisible && (
						<div className="mx-2 flex flex-row items-center justify-between gap-2 py-0.5 pl-3 pr-2">
							{walletState.balance !== null && (
								<span className="whitespace-nowrap text-muted-foreground">
									{`${walletState.balance.toLocaleString()} ₳`}
								</span>
							)}

							{walletState.adaHandle.total_handles && (
								<span className="whitespace-nowrap text-muted-foreground">
									{walletState.adaHandle.total_handles.toLocaleString()}{' '}
									<span className="text-green-500 dark:text-green-700">$</span>handles
								</span>
							)}

							{!walletState.adaHandle.handle && (
								<Button variant="link" size="sm" asChild className="h-auto p-1 text-muted-foreground">
									<Link
										href="https://handle.me"
										target="_blank"
										rel="noopener noreferrer"
										className="text-green-600 dark:text-green-700/95"
									>
										<span className="">Get $handle</span>
									</Link>
								</Button>
							)}
						</div>
					)}

					{/* <AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="outline" size="sm" className="w-full">
								Unlink
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
								<AlertDialogDescription>
									This will permanently delete all wallet data. Type &quot;unlink&quot; to confirm.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<form
								onSubmit={async (e) => {
									e.preventDefault()
									const button = document.getElementById('confirmUnlink') as HTMLButtonElement
									if (!button.disabled) {
										await unlink()
									}
								}}
							>
								<div className="grid gap-4 py-4">
									<div className="grid grid-cols-4 items-center gap-4">
										<Input
											id="unlinkConfirm"
											placeholder="Type 'unlink' to confirm"
											className="col-span-4"
											onChange={(e) => {
												const button = document.getElementById('confirmUnlink') as HTMLButtonElement
												if (button) {
													button.disabled = e.target.value !== 'unlink'
												}
											}}
										/>
									</div>
								</div>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										type="submit"
										id="confirmUnlink"
										disabled={true}
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										Unlink Wallet
									</AlertDialogAction>
								</AlertDialogFooter>
							</form>
						</AlertDialogContent>
					</AlertDialog> */}

					{/* {walletState?.walletName && (
						<div className="mt-2 text-xs text-muted-foreground">
							{timeLeft && (
								<div className="flex items-center justify-between">
									<span>Session expires in:</span>
									<span
										className={`font-mono ${
											timeLeft === 'Expired'
												? 'text-destructive'
												: parseInt(timeLeft?.split('m')[0] || '0') < 5
													? 'text-warning'
													: 'text-success'
										}`}
									>
										{timeLeft}
									</span>
								</div>
							)}
						</div>
					)} */}
				</div>
			) : (
				<Button3D onClick={handleOpenConnectSheet}>Connect Wallet</Button3D>
			)}

			<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
				<SheetTrigger />
				<SheetContent>
					<VisuallyHidden>
						<SheetTitle></SheetTitle>
						<SheetDescription></SheetDescription>
					</VisuallyHidden>
					<div className="flex w-full flex-col pt-1.5 font-mono tracking-[.05em] shadow-lg">
						<div className="flex flex-col items-center justify-center rounded-t-md border-b-0 border-l border-r border-t border-border p-4 px-6 text-lg outline-none md:text-xl">
							<div className="flex flex-col items-center justify-center">
								<div className="flex-1">Select a Wallet</div>
                {/* <div className="text-xs text-muted-foreground">
									You can unlink a wallet at any time by clicking the Unlink button. Deletes all associated data.
								</div> */}
							</div>
						</div>

						<div className="flex flex-col border-none">
							{Array.from(new Set(walletState.supportedWallets.map((wallet: string) => window.cardano?.[wallet]?.icon)))
								.filter((icon): icon is string => icon !== undefined)
								.map((icon, index) => {
									const wallet = Object.keys(window.cardano || {}).find((key) => {
										const cardanoWallet = window.cardano?.[key]
										return cardanoWallet?.icon === icon
									})
									const walletName = wallet ? wallet.charAt(0).toUpperCase() + wallet.slice(1).toLowerCase() : ''

									return (
										<div
											key={wallet}
											onClick={(e) => {
												e.preventDefault()
												wallet && handleConnect(wallet)
											}}
											className={cn(
												'flex w-full cursor-pointer flex-row items-center justify-between gap-2 border-x border-b border-border p-4 px-6 text-lg md:text-xl',
												index === 0 && 'border-t',
												index === walletState.supportedWallets.length - 1 && 'rounded-b-md',
												loading && 'cursor-wait opacity-50',
											)}
										>
											<div className="flex flex-row items-center gap-2">
												{typeof icon === 'string' && (
													<Image
														src={icon}
														alt={`${walletName} icon`}
														width={30}
														height={30}
														className="size-7 md:size-8"
													/>
												)}

												<span>{loading ? <Loader2 className="animate-spin" /> : walletName}</span>
											</div>
											<div>
												{walletState?.walletName &&
													walletState?.walletName.toLowerCase().replace(/ /g, '').replace('wallet', '') ===
														walletName.toLowerCase().replace(/ /g, '').replace('wallet', '') && (
														<div className="flex items-center justify-center rounded-full bg-green-500 p-1">
															<CheckIcon className="size-4" />
														</div>
													)}
											</div>
										</div>
									)
								})}
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	)
}

export default WalletConnect
