import { z } from 'zod'

const tokenResponseSchema = z.object({ value: z.string().min(1) })

export async function requestGitHubOidcToken(audience: string, signal: AbortSignal): Promise<string> {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (!requestUrl || !requestToken) {
    throw new Error('GitHub OIDC credentials are unavailable. Run the runner in a GitHub Actions job with id-token: write.')
  }

  let url: URL
  try {
    url = new URL(requestUrl)
    url.searchParams.set('audience', audience)
  } catch {
    // URL and fetch errors can contain the credential-bearing endpoint.
    throw new Error('Invalid GitHub OIDC request URL.')
  }

  let response: Response
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` }, signal })
  } catch {
    signal.throwIfAborted()
    throw new Error('Failed to request a GitHub OIDC token.')
  }

  if (!response.ok) {
    // Release the response without letting a cleanup error replace the HTTP failure.
    await response.body?.cancel().catch(() => {})
    throw new Error(`GitHub OIDC token request failed (HTTP ${response.status}).`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    signal.throwIfAborted()
    // Parser errors may include the response body, so do not attach the cause.
    throw new Error('Invalid JSON in the GitHub OIDC token response.')
  }
  const result = tokenResponseSchema.safeParse(data)
  if (!result.success) throw new Error('Invalid GitHub OIDC token response: expected a nonempty value string.')
  return result.data.value
}
