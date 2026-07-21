import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks explicites (avec factory) plutôt que l'automock de vi.mock(path) seul :
// l'automock importerait le vrai module pour en inspecter la forme, ce qui
// chargerait src/db/client.ts et exigerait DATABASE_URL.
vi.mock("./eb-sync", () => ({ syncBanks: vi.fn() }));
vi.mock("../../scripts/import", () => ({ main: vi.fn() }));
vi.mock("../../scripts/categorize", () => ({ main: vi.fn() }));

import { syncBanks } from "./eb-sync";
import { main as runImport } from "../../scripts/import";
import { main as runCategorize } from "../../scripts/categorize";
import { performSync } from "./sync-core";

const syncMock = vi.mocked(syncBanks);
const runImportMock = vi.mocked(runImport);
const runCategorizeMock = vi.mocked(runCategorize);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("performSync", () => {
  it("appelle sync, import puis categorize dans l'ordre en cas de succès", async () => {
    syncMock.mockResolvedValue({ expired: [], rateLimited: [] });
    runImportMock.mockResolvedValue(false);
    runCategorizeMock.mockResolvedValue(undefined);

    await performSync();

    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(runImportMock).toHaveBeenCalledTimes(1);
    expect(runCategorizeMock).toHaveBeenCalledTimes(1);
  });

  it("transmet les PSU headers à syncBanks (accès « PSU présent »)", async () => {
    syncMock.mockResolvedValue({ expired: [], rateLimited: [] });
    runImportMock.mockResolvedValue(false);
    runCategorizeMock.mockResolvedValue(undefined);

    const psuHeaders = { "Psu-Ip-Address": "203.0.113.7", "Psu-User-Agent": "Firefox" };
    await performSync(psuHeaders);

    expect(syncMock).toHaveBeenCalledWith(psuHeaders);
  });

  it("remonte les banques expirées et celles limitées en accès", async () => {
    syncMock.mockResolvedValue({ expired: ["Revolut"], rateLimited: ["Société Générale"] });
    runImportMock.mockResolvedValue(false);
    runCategorizeMock.mockResolvedValue(undefined);

    await expect(performSync()).resolves.toEqual({
      expired: ["Revolut"],
      rateLimited: ["Société Générale"],
    });
  });

  it("rejette un appel concurrent pendant qu'une synchronisation est en cours", async () => {
    let resolveSync!: (value: { expired: string[]; rateLimited: string[] }) => void;
    syncMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve;
      }),
    );

    const first = performSync();
    await expect(performSync()).rejects.toThrow("Une synchronisation est déjà en cours.");

    runImportMock.mockResolvedValue(false);
    runCategorizeMock.mockResolvedValue(undefined);
    resolveSync({ expired: [], rateLimited: [] });
    await first;
  });

  it("relâche le verrou après un échec, pour permettre un nouvel essai", async () => {
    syncMock.mockRejectedValueOnce(new Error("boom"));
    await expect(performSync()).rejects.toThrow("boom");

    syncMock.mockResolvedValue({ expired: [], rateLimited: [] });
    runImportMock.mockResolvedValue(false);
    runCategorizeMock.mockResolvedValue(undefined);
    await expect(performSync()).resolves.toEqual({ expired: [], rateLimited: [] });
  });

  it("lève une erreur explicite si l'import échoue, sans appeler categorize", async () => {
    syncMock.mockResolvedValue({ expired: [], rateLimited: [] });
    runImportMock.mockResolvedValue(true);

    await expect(performSync()).rejects.toThrow("Échec de l'import");
    expect(runCategorizeMock).not.toHaveBeenCalled();
  });

  it("n'échoue pas si la catégorisation échoue (best-effort)", async () => {
    syncMock.mockResolvedValue({ expired: [], rateLimited: [] });
    runImportMock.mockResolvedValue(false);
    runCategorizeMock.mockRejectedValue(new Error("boom catégorisation"));

    await expect(performSync()).resolves.toEqual({ expired: [], rateLimited: [] });
  });
});
