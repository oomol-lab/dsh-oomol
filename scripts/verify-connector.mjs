import { probeOomolConnection } from "../lib/health.js"
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
    const result = await probeOomolConnection(connection)
    process.stdout.write(`OK   MCP initialization: ${result.serverName ?? "server"}${result.serverVersion ? ` ${result.serverVersion}` : ""}\n`)
    process.stdout.write(`OK   Progressive discovery tools: ${result.toolCount}\n`)
    process.stdout.write("The verifier never prints credential values.\n")
  } catch (error) {
    const message = error instanceof Error ? error.name : "unknown error"
    process.stderr.write(`FAIL Connector verification: ${message}\n`)
    process.stderr.write("The verifier suppresses remote error text to avoid leaking credentials or account data.\n")
    process.exitCode = 1
  }
}
