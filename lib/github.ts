import { Octokit } from 'octokit'

export function createOctokit(accessToken: string) {
  return new Octokit({ auth: accessToken })
}

export async function getRepoContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string = ''
): Promise<Array<{
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
}>> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    })

    if (Array.isArray(data)) {
      return data.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir',
        size: item.size,
      }))
    }

    return []
  } catch (error) {
    console.error('Error fetching repo contents:', error)
    return []
  }
}

export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    })

    if (!Array.isArray(data) && data.type === 'file' && 'content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return { content, sha: data.sha }
    }

    return null
  } catch (error) {
    console.error('Error fetching file content:', error)
    return null
  }
}

export async function createBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string = 'main'
): Promise<boolean> {
  try {
    // Get the SHA of the base branch
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    })

    // Create the new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    })

    return true
  } catch (error) {
    console.error('Error creating branch:', error)
    return false
  }
}

export async function commitFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  existingSha?: string
): Promise<{ sha: string } | null> {
  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha: existingSha,
    })

    return { sha: data.content?.sha || '' }
  } catch (error) {
    console.error('Error committing file:', error)
    return null
  }
}

export async function createPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string = 'main'
): Promise<{ number: number; url: string } | null> {
  try {
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    })

    return { number: data.number, url: data.html_url }
  } catch (error) {
    console.error('Error creating pull request:', error)
    return null
  }
}

export async function mergePullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  commitTitle?: string
): Promise<boolean> {
  try {
    await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      commit_title: commitTitle,
      merge_method: 'squash',
    })

    return true
  } catch (error) {
    console.error('Error merging pull request:', error)
    return false
  }
}

export async function closePullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<boolean> {
  try {
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      state: 'closed',
    })

    return true
  } catch (error) {
    console.error('Error closing pull request:', error)
    return false
  }
}

export async function getUserRepos(
  octokit: Octokit
): Promise<Array<{
  id: number
  name: string
  full_name: string
  private: boolean
  default_branch: string
  html_url: string
}>> {
  try {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    })

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch || 'main',
      html_url: repo.html_url,
    }))
  } catch (error) {
    console.error('Error fetching user repos:', error)
    return []
  }
}

export async function getPackageJson(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<Record<string, unknown> | null> {
  const file = await getFileContent(octokit, owner, repo, 'package.json')
  if (!file) return null

  try {
    return JSON.parse(file.content)
  } catch {
    return null
  }
}

export async function findNextJsPages(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string[]> {
  const pages: string[] = []

  // Check for App Router pages
  const appDir = await getRepoContents(octokit, owner, repo, 'app')
  if (appDir.length > 0) {
    await scanForPages(octokit, owner, repo, 'app', pages)
  }

  // Check for Pages Router
  const pagesDir = await getRepoContents(octokit, owner, repo, 'pages')
  if (pagesDir.length > 0) {
    await scanForPages(octokit, owner, repo, 'pages', pages)
  }

  // Check for src/app or src/pages
  const srcAppDir = await getRepoContents(octokit, owner, repo, 'src/app')
  if (srcAppDir.length > 0) {
    await scanForPages(octokit, owner, repo, 'src/app', pages)
  }

  const srcPagesDir = await getRepoContents(octokit, owner, repo, 'src/pages')
  if (srcPagesDir.length > 0) {
    await scanForPages(octokit, owner, repo, 'src/pages', pages)
  }

  return pages
}

async function scanForPages(
  octokit: Octokit,
  owner: string,
  repo: string,
  basePath: string,
  pages: string[],
  currentPath: string = ''
): Promise<void> {
  const fullPath = currentPath ? `${basePath}/${currentPath}` : basePath
  const contents = await getRepoContents(octokit, owner, repo, fullPath)

  for (const item of contents) {
    if (item.type === 'dir') {
      // Skip api routes and private folders
      if (!item.name.startsWith('_') && !item.name.startsWith('api')) {
        await scanForPages(
          octokit,
          owner,
          repo,
          basePath,
          pages,
          currentPath ? `${currentPath}/${item.name}` : item.name
        )
      }
    } else if (
      item.type === 'file' &&
      (item.name === 'page.tsx' ||
        item.name === 'page.jsx' ||
        item.name === 'page.ts' ||
        item.name === 'page.js' ||
        item.name.match(/^index\.(tsx|jsx|ts|js)$/))
    ) {
      pages.push(item.path)
    }
  }
}
