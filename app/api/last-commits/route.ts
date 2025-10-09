import { NextResponse } from 'next/server'

const GITHUB_API_URL = 'https://api.github.com/repos'
const GITHUB_HEADERS = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
}

const fetchJson = async (url: string) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

  try {
    const response = await fetch(url, {
      headers: GITHUB_HEADERS,
      signal: controller.signal,
      next: {
        revalidate: 45,
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${url}`)
    }
    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout for ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

const fetchLatestRepoCommit = async ({ owner, repo }: { owner: string; repo: string }) => {
  const url = `${GITHUB_API_URL}/${owner}/${repo}/commits`
  const commits = await fetchJson(url)
  return {
    repo: repo,
    message: commits[0]?.commit?.message,
    date: commits[0]?.commit?.committer?.date,
    hash: commits[0]?.sha,
  }
}

const fetchFolderCommits = async ({ owner, repo }: { owner: string; repo: string }) => {
  const url = `${GITHUB_API_URL}/${owner}/${repo}/contents/app`
  const folders = await fetchJson(url)

  return Promise.all(
    folders.map(async (folder: any) => {
      const commitUrl = `${GITHUB_API_URL}/${owner}/${repo}/commits?path=${folder.path}`
      const commits = await fetchJson(commitUrl)
      return {
        folder: folder.name,
        lastCommitDate: commits[0]?.commit?.committer?.date,
      }
    }),
  )
}

export async function GET() {
  const repos = [
    { owner: 'ensured', repo: 'cardanotools.xyz' },
    { owner: 'ensured', repo: 'phone-backup-app-android' },
  ]

  try {
    const folderCommits = await Promise.all(repos.map(fetchFolderCommits))
    const latestRepoCommit = await Promise.all(repos.map(fetchLatestRepoCommit))

    return NextResponse.json({ folderCommits, latestRepoCommit })
  } catch (error: any) {
    console.error('Error fetching commits:', error.message)
    return NextResponse.json({ error: 'Failed to fetch commit messages.' }, { status: 500 })
  }
}
