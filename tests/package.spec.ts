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

  it("bounds preview Harness peers to the verified rc.7 and rc.8 contracts", async () => {
    const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as {
      peerDependencies?: Record<string, string>
    }
    const harnessPeers = Object.entries(manifest.peerDependencies ?? {})
      .filter(([name]) => name.startsWith("@deepseek-ai/dsh-"))

    expect(harnessPeers.length).toBeGreaterThan(0)
    for (const [, range] of harnessPeers) {
      expect(range).toBe(">=0.1.0-rc.7 <0.1.0-rc.9")
    }
  })

  it("registers the settings card with the keyed-slot contract", async () => {
    const client = await readFile(resolve(root, "src/client/index.tsx"), "utf8")

    expect(client).toContain('const SETTINGS_NAMESPACE = "oomol"')
    expect(client).toMatch(/name:\s*"settings\.plugin\.item",\s*key:\s*SETTINGS_NAMESPACE,/)
    expect(client).not.toMatch(/name:\s*"settings\.plugin\.item",\s*id:/)
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
