import Link from "next/link"

import { siteConfig } from "@/config/site"

import { cn } from "../lib/utils"
import { Icons } from "./icons"
import { buttonVariants } from "./ui/button"

const Footer = () => {
  return (
    <footer className="border-t bg-secondary">
      <div className="flex flex-wrap">
        <div className="flex w-full justify-center gap-2 overflow-auto p-2 md:p-1.5">

          <Link
            href={siteConfig.links.twitter}
            target="_blank"
            rel="noreferrer"
          >
            <div
              className={cn(
                buttonVariants({
                  variant: "outline",
                }),
                "rounded-full px-3 py-0 md:py-[1.375rem]"
              )}
            >
              <Icons.twitter className="size-4 fill-current md:size-5" />
              <span className="sr-only">Twitter</span>
            </div>
          </Link>
        </div>

        {/* <FeedBackDrawer /> */}
      </div>
    </footer>
  )
}

export default Footer
