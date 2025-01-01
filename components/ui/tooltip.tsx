"use client"
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  const [maxWidth, setMaxWidth] = React.useState(0)

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setMaxWidth(window.innerWidth)
      const handleResize = () => setMaxWidth(window.innerWidth)

      window.addEventListener("resize", handleResize)
      return () => window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <TooltipPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 flex flex-wrap rounded-md border border-border bg-popover px-3 py-1.5 text-xl text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", // Added flex-wrap
        className
      )}
      style={{ maxWidth: maxWidth }}
      {...props}
    />
  )
})

TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
