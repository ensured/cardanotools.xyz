/* eslint-disable tailwindcss/classnames-order */
'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useResizeObserver } from '@wojtekmaj/react-hooks'
import { jsPDF } from 'jspdf'
import { Document, Page } from 'react-pdf'
import { pdfjs } from 'react-pdf'

import './PdfViewer.css'
import '../node_modules/react-pdf/dist/esm/Page/AnnotationLayer.css'
import '../node_modules/react-pdf/dist/esm/Page/TextLayer.css'
import { useWindowSize } from '@uidotdev/usehooks'
import { DownloadIcon, X } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { Button } from './ui/button'
import { Input } from './ui/input'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
}

const resizeObserverOptions = {}

type PDFFile = string | File | null

async function processBatch(
  batchIndex: number,
  batchSize: number,
  numPages: number | undefined,
  doc: jsPDF,
  totalBatches: number,
) {
  const startPage = batchIndex * batchSize + 1
  const endPage = Math.min((batchIndex + 1) * batchSize, numPages ?? 0)

  for (let i = startPage; i <= endPage; i++) {
    const canvas = document.getElementById(`page_canvas_${i}`)
    if (canvas instanceof HTMLCanvasElement) {
      doc.addImage(
        canvas,
        'canvas',
        0,
        0,
        doc.internal.pageSize.getWidth(),
        doc.internal.pageSize.getHeight(),
      )
    } else {
      console.error(`Canvas not found for page ${i}`)
    }

    if (i !== endPage) {
      doc.addPage()
    }
  }

  // Add a new page if it's not the last batch
  if (batchIndex < totalBatches - 1) {
    doc.addPage()
  }
}

// Add these new props to the component
interface PDFViewerProps {
  inputFile: File | null
  onProgress?: (progress: number) => void
}

export default function PDFViewer({ inputFile, onProgress }: PDFViewerProps) {
  const [file, setFile] = useState<PDFFile>(inputFile)
  const [numPages, setNumPages] = useState<number>()
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>()
  const [filename, setFilename] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isSwitchChecked, setIsSwitchChecked] = useState(false)
  const [isContainerDivHidden, setIsContainerDivHidden] = useState(true)
  const [progress, setProgress] = useState(0)

  const moveCursor = useCallback(async () => {
    if (inputRef.current) {
      const inputLength = filename.length
      const pdfIndex = filename.lastIndexOf('.pdf')

      if (pdfIndex !== -1) {
        const cursorPosition = Math.min(inputRef.current.selectionStart ?? inputLength, pdfIndex)
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition)
      }
    }
  }, [filename])

  useEffect(() => {
    moveCursor()
  }, [filename, moveCursor])

  const size = useWindowSize()

  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries

    if (entry) {
      setContainerWidth(entry.contentRect.width)
    }
  }, [])

  useEffect(() => {
    setFile(inputFile)
  }, [inputFile])

  useResizeObserver(containerRef, resizeObserverOptions, onResize)

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    try {
      const { files } = event.target

      if (files && files[0]) {
        setFile(files[0] || null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      inputRef.current?.focus()
    }
  }

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setIsContainerDivHidden(false)
    setNumPages(numPages)
  }

  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        moveCursor() // Move cursor if needed
      }
    })

    const targetNode = document.body // or a more specific element containing your input
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [moveCursor])

  const handleHideDiv = (opt: boolean) => setIsContainerDivHidden(opt)

  if (!size.width || !size.height) return null

  return (
    <div aria-hidden={isContainerDivHidden} className={`${isContainerDivHidden ? 'hidden' : ''}`}>
      <label htmlFor="file"></label> <input onChange={onFileChange} type="file" hidden />
      <div
        ref={setContainerRef}
        className={`absolute inset-x-0 top-0 z-40 border-border shadow-md ${
          file ? 'rounded-sm border bg-background p-2' : ''
        }`}
      >
        {!file ||
          (file !== null && (
            <div className="mb-2 flex flex-row flex-wrap items-center justify-between pb-1">
              <div className="flex w-full flex-wrap gap-2 p-1">
                <h1 className="text-xl font-semibold">Pdf Preview</h1>
                <div className="flex w-full items-center justify-center">
                  <Button
                    className="absolute right-2 top-2"
                    onClick={() => {
                      if (file) {
                        setFile(null)
                        handleHideDiv(true)
                      }
                    }}
                  >
                    <X size={size.width < 520 ? 20 : size.width < 840 ? 28 : 36} className="" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        <Document file={file} noData={''} onLoadSuccess={onDocumentLoadSuccess} options={options}>
          {numPages !== undefined &&
            Array.from(new Array(numPages), (el, index) => (
              <Page
                className="rounded-sm"
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={containerWidth}
                canvasRef={(el) => {
                  if (el) {
                    el.id = `page_canvas_${index + 1}`
                  }
                }}
              />
            ))}
        </Document>
      </div>
    </div>
  )
}
