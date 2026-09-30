import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const root = resolve(import.meta.dirname, "..")

describe("package safety", () => {
  it("keeps credential values out of the bundle patch", async () => {
    const patch = await readFile(resolve(root, "cordis.patch.yml"), "utf8")

    expect(patch).not.toContain("apiKeyEnv:")
    expect(patch).not.toMatch(/Authorization\s*:/i)
    expect(patch).not.toMatch(/api_[A-Za-z0-9_-]{8,}/)
  })

  it("declares both the Host bundle and Web client entry", async () => {
    const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
      dsh?: { bundle?: { patch?: string }; client?: { platform?: string } }
      exports?: Record<string, unknown>
    }

    expect(manifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml")
    expect(manifest.dsh?.client?.platform).toBe("web")
    expect(manifest.exports).toHaveProperty("./client")
  })

  it("bounds preview Harness peers to the verified 0.2.0 contract", async () => {
    const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
      peerDependencies?: Record<string, string>
    }
    const harnessPeers = Object.entries(manifest.peerDependencies ?? {})
      .filter(([name]) => name.startsWith("@deepseek-ai/dsh-"))

    expect(harnessPeers.length).toBeGreaterThan(0)
    for (const [, range] of harnessPeers) {
      expect(range).toBe(">=0.2.0-rc.2 <0.2.1")
    }
  })

  it("registers the configuration page under the bundle's package name", async () => {
    const client = await readFile(resolve(root, "src/client/index.tsx"), "utf8")
    const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { name: string }

    expect(client).toContain(`const PACKAGE_NAME = ${JSON.stringify(manifest.name)}`)
    const registration = client.match(
      /ctx\.slots\.inject\("plugins\.bundle\.config",\s*\(\)\s*=>\s*ctx\.slots\.register\(\{([\s\S]*?)\},\s*OomolSettingsCard\)\)/,
    )?.[1]

    expect(registration).toBeDefined()
    expect(registration).toMatch(/name:\s*"plugins\.bundle\.config"/)
    expect(registration).toMatch(/key:\s*PACKAGE_NAME/)
    expect(registration).not.toMatch(/\bid\s*:/)
  })

  it("ships the doctor and authenticated verification scripts", async () => {
    const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
      files?: string[]
      scripts?: Record<string, string>
    }

    expect(manifest.files).toContain("scripts")
    expect(manifest.scripts?.doctor).toContain("scripts/doctor.mjs")
    expect(manifest.scripts?.["verify:connector"]).toContain("scripts/verify-connector.mjs")
  })
})
