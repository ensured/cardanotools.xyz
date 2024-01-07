"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import Prism from "prismjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import { Button, buttonVariants } from "./ui/button"

const PrismData = () => {
  const [fontSize, setFontSize] = useState("14px") // Default font size

  const codeRef = useRef(null)

  useEffect(() => {
    Prism.highlightAll()
    adjustFontSize() // Call the function initially
    window.addEventListener("resize", adjustFontSize) // Adjust font size on window resize
    return () => {
      window.removeEventListener("resize", adjustFontSize) // Cleanup event listener
    }
  }, [])

  const adjustFontSize = () => {
    const screenWidth = window.innerWidth
    let fontSize

    if (screenWidth < 500) {
      fontSize = "0.69rem" // Adjust font size for very small screens
    } else if (screenWidth >= 512 && screenWidth < 640) {
      fontSize = "0.75rem" // Adjust font size for small screens
    } else if (screenWidth >= 640 && screenWidth < 768) {
      fontSize = "0.95rem" // Adjust font size for medium screens (sm)
    } else if (screenWidth >= 768) {
      fontSize = "1rem" // Adjust font size for large screens (md) and above
    }

    // Apply the font size to code blocks
    const codeBlocks = document.querySelectorAll("pre[class*='language-']")
    codeBlocks.forEach((block) => {
      block.style.fontSize = fontSize
    })
  }

  const handleCopy = () => {
    const text = codeRef.current.textContent
    console.log(text)
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
                    "#overlap-manager-root > div:nth-child(2)"
                );
                const goPro = document.querySelector(
                    "#overlap-manager-root > div:nth-child(2) > div"
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
      <pre className="rounded-md">
        {/* button to copy text */}
        <div className={cn("relative flex justify-end")}>
          <Button
            variant={"green"}
            className="absolute font-bold text-lg md:text-2xl"
            onClick={handleCopy}
          >
            <Image src="/copy.png" width={24} height={24} alt="Copy icon" />
            Copy
          </Button>
        </div>
        <code
          className="language-javascript"
          ref={codeRef}
          style={{ fontSize: fontSize }}
        >
          {code}
        </code>
      </pre>
      <Link
        className="flex justify-center bg-red-500 p-4 text-sm md:text-base"
        href="https://www.flaticon.com/free-icons/ui"
        title="ui icons"
      >
        Ui icons created by Radhe Icon - Flaticon
      </Link>
    </div>
  )
}

export default PrismData
