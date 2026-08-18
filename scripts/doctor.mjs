import { spawnSync } from "node:child_process"

const checks = [
  commandCheck("node", ["--version"]),
  commandCheck("pnpm", ["--version"]),
  commandCheck("dsh", ["--version"], false),
  commandCheck("oo", ["--version"], false),
  {
    detail: process.env.OOMOL_MCP_API_KEY ? "configured in the launching environment" : "not set",
    name: "OOMOL_MCP_API_KEY",
    ok: Boolean(process.env.OOMOL_MCP_API_KEY),
    required: false,
  },
  {
    detail: process.env.OOMOL_CONNECT_RUNTIME_TOKEN?.trim() ? "default launch environment variable is set" : "not set",
    name: "OOMOL_CONNECT_RUNTIME_TOKEN",
    ok: Boolean(process.env.OOMOL_CONNECT_RUNTIME_TOKEN?.trim()),
    required: false,
  },
]

let failed = false
for (const check of checks) {
  const mark = check.ok ? "OK" : check.required ? "FAIL" : "NOTE"
  process.stdout.write(`${mark.padEnd(4)} ${check.name}: ${check.detail}\n`)
  if (!check.ok && check.required) failed = true
}

process.stdout.write("\nThe doctor never prints credential values.\n")
process.exitCode = failed ? 1 : 0

function commandCheck(command, args, required = true) {
  const result = spawnSync(command, args, { encoding: "utf8" })
  const firstLine = result.stdout?.trim().split("\n")[0] || result.stderr?.trim().split("\n")[0]
  return {
    detail: result.status === 0 ? firstLine || "available" : "not found or unavailable",
    name: command,
    ok: result.status === 0,
    required,
  }
}
