"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { CopyIcon } from "lucide-react"
import Prism from "prismjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

const PrismData = () => {
  const [fontSize, setFontSize] = useState("14px")
  const [isMounted, setIsMounted] = useState(false)
  const codeRef = useRef(null)

  useEffect(() => {
    setIsMounted(true)
    Prism.highlightAll()
    adjustFontSize()
    window.addEventListener("resize", adjustFontSize)
    return () => {
      window.removeEventListener("resize", adjustFontSize)
    }
  }, [])

  const adjustFontSize = () => {
    if (!isMounted) return
    
    const screenWidth = window.innerWidth
    let fontSize

    if (screenWidth < 500) {
      fontSize = "0.69rem"
    } else if (screenWidth >= 512 && screenWidth < 640) {
      fontSize = "0.75rem"
    } else if (screenWidth >= 640 && screenWidth < 768) {
      fontSize = "0.95rem"
    } else if (screenWidth >= 768) {
      fontSize = "1rem"
    }

    setFontSize(fontSize)
  }

  const handleCopy = () => {
    const text = codeRef.current.textContent
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success("Copied to clipboard!", {
          position: "top-right",
          duration: 2000,
          style: "",
        })
      },
      (err) => {
        console.error("Failed to copy:", err)
      }
    )
  }

  const code = `const handleMutations = (mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === "childList") {
                const overlapManager = document.querySelector(
                    "#overlap-manager-root > div:nth-child(3)"
                );
                const goPro = document.querySelector(
                    "#overlap-manager-root > div:nth-child(3) > div"
                );
                const span = document.querySelector(
                    "#overlap-manager-root > div:nth-child(4) > div"
                );

                if (overlapManager) {
                    if (goPro) {
                        console.log("Ads found!");
                        goPro.remove();
                        console.log("Ads removed :)");
                    }
                    if (span) {
                        console.log("Ads found!");
                        span.remove();
                        console.log("Ads removed :)");
                    }
                }
            }
        }
    };

    const observerConfig = {
        childList: true,
        subtree: true
    };

    const observer = new MutationObserver(handleMutations);

    observer.observe(document.body, observerConfig);
    `

  return (
    <div>
      <pre 
        className={cn("rounded-md", "language-javascript")}
        tabIndex={0}
      >
        <div className={cn("relative flex")}>
          <CopyIcon
            size={"30px"}
            onClick={handleCopy}
            className="absolute right-0 rounded-sm bg-slate-900 p-2 transition-all hover:scale-110 hover:cursor-pointer hover:bg-slate-950 hover:text-green"
          />
        </div>
        <code
          className="language-javascript"
          ref={codeRef}
          style={{ fontSize: isMounted ? fontSize : "14px" }}
        >
          {code}
        </code>
      </pre>
      <Link
        className="flex justify-center text-xs text-gray-400"
        href="https://www.flaticon.com/free-icons/ui"
        title="ui icons"
      >
        Ui icons created by Radhe Icon - Flaticon
      </Link>
    </div>
  )
}

export default PrismData
