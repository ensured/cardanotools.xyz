'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

function PortForwardChecker({ usersIp }) {
  const [ip, setIp] = useState(usersIp || '')
  const [port, setPort] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [portHistory, setPortHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  const inputRef = useRef(null)
  const historyKey = 'portHistory'

  // Load port history from localStorage when the component mounts
  useEffect(() => {
    const storedHistory = localStorage.getItem(historyKey)
    if (storedHistory) {
      setPortHistory(JSON.parse(storedHistory))
    }
  }, [])

  // Save port history to localStorage
  const saveToHistory = (newPort) => {
    if (newPort && !portHistory.includes(newPort)) {
      const updatedHistory = [newPort, ...portHistory].slice(0, 5) // Limit to last 5 entries
      setPortHistory(updatedHistory)
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory))
    }
  }

  // Hide history when clicking outside
  const handleClickOutside = (e) => {
    if (inputRef.current && !inputRef.current.contains(e.target)) {
      setShowHistory(false)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    setResult(null)
    setError(null)
    setLoading(true)

    try {
      const response = await axios.get('/api/ping', {
        params: { ip, port },
      })
      setResult(response.data.message)
      saveToHistory(port) // Save port to history on successful submit
    } catch (err) {
      setError(err.response?.data?.message || 'Error checking port')
    }

    setLoading(false)
  }

  const handleSelectHistory = (value) => {
    setPort(value)
    setShowHistory(false)
  }

  return (
    <div className="mt-2 flex flex-col items-center justify-center gap-4 rounded-md p-6 md:flex-row md:gap-10 lg:gap-20">
      <h1 className="max-w-[269px] text-center text-2xl md:max-w-[500px] md:text-4xl">
        Check open/closed ports for any IP address
      </h1>
      <Form>
        <form onSubmit={handleSubmit}>
          <label htmlFor="ip">IP Address:</label>

          <Input
            type="text"
            id="ip"
            placeholder="69.69.69.69"
            value={ip === usersIp ? usersIp : ip}
            autoComplete={'true'}
            onChange={(e) => setIp(e.target.value)}
          />
          <br />
          <label htmlFor="port">Port Number:</label>

          <div className="relative" ref={inputRef}>
            <Input
              type="number"
              id="port"
              placeholder={'1024'}
              autoComplete={'true'}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              onFocus={() => setShowHistory(true)} // Show history when focused
              min={0}
              max={65535}
            />

            {/* Port history dropdown */}
            {showHistory && portHistory.length > 0 && (
              <ul className="absolute z-10 max-h-40 w-full overflow-auto border border-gray-300 bg-white">
                {portHistory.map((item, index) => (
                  <li
                    key={index}
                    className="cursor-pointer p-2 hover:bg-gray-100"
                    onClick={() => handleSelectHistory(item)}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="h-6">
            {result && (
              <p>
                {result.includes('Port is open') && (
                  <>
                    Port is <b className="text-green">open</b>
                  </>
                )}
                {result.includes('Port is closed') && (
                  <>
                    Port is <b className="text-red-600 opacity-90">closed</b>
                  </>
                )}
                {result.includes('Error checking port') && (
                  <>
                    <b className="text-red-600 opacity-90">Error checking port</b>
                  </>
                )}
                {result.includes('Connection timed out') && (
                  <>
                    <b className="text-red-600 opacity-90">Connection timed out</b>
                  </>
                )}
                {result.includes('Invalid IP') && (
                  <>
                    <b className="text-red-600 opacity-90">Invalid IP</b>
                  </>
                )}
              </p>
            )}
            {error && <p className="text-red-600">{error}</p>}
          </div>

          <Button
            className="relative flex w-full items-center justify-center" // Add flexbox styles
            type="submit"
            disabled={loading}
          >
            {!loading && 'Check Port'}
            {loading && (
              <>
                <span>Loading...</span>
                <svg
                  className="absolute size-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.373A8 8 0 0012 20v4c-4.418 0-8-3.582-8-8h4zM20 12c0-4.418-3.582-8-8-8v4c3.137 0 5.373 1.164 7.373 3.164l-1.732 1.732C17.373 13.622 16 12.373 16 12h4z"
                  ></path>
                </svg>
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default PortForwardChecker
