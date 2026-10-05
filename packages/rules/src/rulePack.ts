import type { GameConfig } from "./types.js";

export type RulePackMetadata = {
  rulePackVersion: string;
  configHash: string;
};

export type RulePackMismatchReason =
  | "version_missing"
  | "version_mismatch"
  | "hash_missing"
  | "hash_mismatch";

export type RulePackCompatibilityResult =
  | { ok: true }
  | {
      ok: false;
      reason: RulePackMismatchReason;
      expected: RulePackMetadata;
      received?: Partial<RulePackMetadata>;
    };

type ComparableConfig = Omit<GameConfig, "rulePackVersion">;

function sortUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Arrays preserve order because move/card order can affect deterministic gameplay flows.
    return value.map((item) => sortUnknown(item));
  }
  if (value && typeof value === "object") {
    // Object keys are sorted so we always hash the same canonical shape.
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const sorted: Record<string, unknown> = {};
    for (const [key, nested] of entries) {
      sorted[key] = sortUnknown(nested);
    }
    return sorted;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  // Stable JSON is required so hash comparisons are deterministic across runtime environments.
  return JSON.stringify(sortUnknown(value));
}

function fnv1aHash(input: string): string {
  // FNV-1a is lightweight and deterministic for config-integrity checks.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Keep hash unsigned and normalized as lowercase hex.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function withoutVersion(config: GameConfig): ComparableConfig {
  const { rulePackVersion: _version, ...rest } = config;
  return rest;
}

export function computeConfigHash(config: GameConfig): string {
  // The hash intentionally excludes the version field to avoid circular updates.
  return fnv1aHash(stableStringify(withoutVersion(config)));
}

export function getRulePackMetadata(config: GameConfig): RulePackMetadata {
  const version = config.rulePackVersion?.trim();
  if (!version) {
    throw new Error("rulePackVersion must be set on game config.");
  }
  return {
    rulePackVersion: version,
    configHash: computeConfigHash(config)
  };
}

export function checkRulePackCompatibility(
  expected: RulePackMetadata,
  received?: Partial<RulePackMetadata>
): RulePackCompatibilityResult {
  if (!received?.rulePackVersion) {
    return { ok: false, reason: "version_missing", expected, received };
  }
  if (received.rulePackVersion !== expected.rulePackVersion) {
    return { ok: false, reason: "version_mismatch", expected, received };
  }
  if (!received.configHash) {
    return { ok: false, reason: "hash_missing", expected, received };
  }
  if (received.configHash !== expected.configHash) {
    return { ok: false, reason: "hash_mismatch", expected, received };
  }
  return { ok: true };
}
