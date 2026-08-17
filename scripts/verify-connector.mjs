import { resolveOomolConnection } from "../lib/runtime.js"

const key = process.env.OOMOL_MCP_API_KEY?.trim()
if (!key) {
  process.stderr.write("OOMOL_MCP_API_KEY is required for authenticated Connector verification.\n")
  process.exitCode = 2
} else {
  const connection = await resolveOomolConnection({}, {
    readCredential: async () => undefined,
    readEnvironment: (name) => process.env[name],
  })

  try {
    const url = new URL("/v1/providers", new URL(connection.endpoint).origin)
    const response = await fetch(url, { headers: connection.headers, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const envelope = await response.json()
    const providers = Array.isArray(envelope?.data) ? envelope.data.length : undefined
    if (providers === undefined) throw new Error("invalid response")
    process.stdout.write("OK   Connector authorization\n")
    process.stdout.write(`OK   Provider catalog: ${providers}\n`)
    process.stdout.write("The verifier never prints credential values.\n")
  } catch (error) {
    const message = error instanceof Error ? error.name : "unknown error"
    process.stderr.write(`FAIL Connector verification: ${message}\n`)
    process.stderr.write("The verifier suppresses remote error text to avoid leaking credentials or account data.\n")
    process.exitCode = 1
  }
}
