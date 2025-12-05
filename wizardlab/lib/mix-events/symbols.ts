export function normalizeSymbol(value: unknown): string | null {
  if (!value) return null;
  const candidate = String(value).trim();
  if (!candidate) return null;
  return candidate.toUpperCase();
}

export function getSymbolFromEntryValue(entry: unknown): string | null {
  if (typeof entry === "object" && entry !== null) {
    const record = entry as Record<string, unknown>;
    return (
      normalizeSymbol(record.symbol) ??
      normalizeSymbol(record.ticker) ??
      normalizeSymbol(record.asset)
    );
  }

  return normalizeSymbol(entry);
}

export function extractSymbolsFromPositions(raw: unknown): string[] {
  if (!raw) {
    return [];
  }

  const collector: string[] = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const symbol = getSymbolFromEntryValue(entry);
      if (symbol) {
        collector.push(symbol);
      }
    }
  } else if (typeof raw === "object") {
    const symbol = getSymbolFromEntryValue(raw);
    if (symbol) {
      collector.push(symbol);
    }
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return extractSymbolsFromPositions(parsed);
    } catch {
      return raw
        .split(/[,+]/)
        .map((part) => normalizeSymbol(part))
        .filter(Boolean) as string[];
    }
  }

  return collector.filter(Boolean);
}

export function summarizePositions(raw: unknown): string {
  if (Array.isArray(raw)) {
    const parts: string[] = [];
    for (const entry of raw) {
      const symbol = getSymbolFromEntryValue(entry);
      if (!symbol) continue;

      const weightValue =
        typeof entry === "object" && entry !== null
          ? (entry as Record<string, unknown>).weight
          : undefined;

      const parsedWeight =
        typeof weightValue === "number"
          ? weightValue
          : typeof weightValue === "string" && weightValue.trim()
          ? Number(weightValue)
          : undefined;

      const normalizedWeight =
        typeof parsedWeight === "number" && Number.isFinite(parsedWeight)
          ? parsedWeight <= 1
            ? parsedWeight * 100
            : parsedWeight
          : undefined;

      const weightLabel =
        typeof normalizedWeight === "number"
          ? `${Math.round(normalizedWeight)}%`
          : undefined;

      parts.push(weightLabel ? `${symbol} ${weightLabel}` : symbol);
    }

    if (parts.length) {
      return parts.join(" · ");
    }
  }

  const symbols = extractSymbolsFromPositions(raw);
  if (symbols.length) {
    return symbols.join(" · ");
  }

  return "—";
}
