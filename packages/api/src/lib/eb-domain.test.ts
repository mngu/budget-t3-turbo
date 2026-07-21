import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  clampValidUntil,
  consentBadge,
  makeJwt,
  parseSessionAccounts,
  reconcileAccounts,
} from "./eb-domain";

const NOW = new Date("2026-07-19T12:00:00Z");
const DAY = 24 * 3600 * 1000;

describe("makeJwt", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  it("produit un JWT RS256 signé, avec kid = application_id", () => {
    const jwt = makeJwt("app-123", privateKey, NOW);
    const [header, payload, signature] = jwt.split(".") as [string, string, string];

    const decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString());
    expect(decodedHeader).toEqual({ typ: "JWT", alg: "RS256", kid: "app-123" });

    const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(decodedPayload.iss).toBe("enablebanking.com");
    expect(decodedPayload.aud).toBe("api.enablebanking.com");
    expect(decodedPayload.exp - decodedPayload.iat).toBe(3600);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("rejette une clé privée invalide", () => {
    expect(() => makeJwt("app-123", "pas une clé PEM", NOW)).toThrow();
  });
});

describe("clampValidUntil", () => {
  it("demande 180 jours quand l'ASPSP n'annonce pas de maximum", () => {
    expect(clampValidUntil(null, NOW)).toBe(new Date(NOW.getTime() + 180 * DAY).toISOString());
    expect(clampValidUntil(undefined, NOW)).toBe(new Date(NOW.getTime() + 180 * DAY).toISOString());
  });

  it("borne à maximum_consent_validity quand il est plus court (ex. 90 j)", () => {
    expect(clampValidUntil(90 * 24 * 3600, NOW)).toBe(
      new Date(NOW.getTime() + 90 * DAY).toISOString(),
    );
  });

  it("ne dépasse jamais 180 jours même si l'ASPSP permet plus", () => {
    expect(clampValidUntil(365 * 24 * 3600, NOW)).toBe(
      new Date(NOW.getTime() + 180 * DAY).toISOString(),
    );
  });
});

describe("consentBadge", () => {
  it("ok quand il reste plus de 30 jours", () => {
    expect(consentBadge(new Date(NOW.getTime() + 100 * DAY), NOW)).toEqual({
      level: "ok",
      daysLeft: 100,
    });
  });

  it("warning à 30 jours ou moins", () => {
    expect(consentBadge(new Date(NOW.getTime() + 30 * DAY), NOW)).toEqual({
      level: "warning",
      daysLeft: 30,
    });
    expect(consentBadge(new Date(NOW.getTime() + 1 * DAY), NOW).level).toBe("warning");
  });

  it("expired quand la date est passée, daysLeft à 0", () => {
    expect(consentBadge(new Date(NOW.getTime() - 1 * DAY), NOW)).toEqual({
      level: "expired",
      daysLeft: 0,
    });
  });
});

describe("parseSessionAccounts", () => {
  it("accepte les formes string et objet, ignore les entrées sans uid", () => {
    expect(
      parseSessionAccounts([
        "uid-simple",
        { uid: "uid-objet", account_id: { iban: "FR7600000000000000000000000" } },
        { pas_de_uid: true },
      ]),
    ).toEqual([
      { uid: "uid-simple", iban: null },
      { uid: "uid-objet", iban: "FR7600000000000000000000000" },
    ]);
  });

  it("tolère une liste absente", () => {
    expect(parseSessionAccounts(undefined)).toEqual([]);
  });
});

describe("reconcileAccounts", () => {
  const existing = [
    { id: 1, uid: "ancien-uid-a", iban: "FR76AAAA" },
    { id: 2, uid: "ancien-uid-b", iban: null },
  ];

  it("réconcilie par IBAN : uid changé au renouvellement → update, pas de doublon", () => {
    const { updates, creates } = reconcileAccounts(existing, [
      { uid: "nouveau-uid-a", iban: "FR76AAAA" },
    ]);
    expect(updates).toEqual([{ id: 1, uid: "nouveau-uid-a" }]);
    expect(creates).toEqual([]);
  });

  it("réconcilie par uid quand il n'y a pas d'IBAN", () => {
    const { updates, creates } = reconcileAccounts(existing, [{ uid: "ancien-uid-b", iban: null }]);
    expect(updates).toEqual([{ id: 2, uid: "ancien-uid-b" }]);
    expect(creates).toEqual([]);
  });

  it("crée les comptes inconnus", () => {
    const { updates, creates } = reconcileAccounts(existing, [{ uid: "uid-c", iban: "FR76CCCC" }]);
    expect(updates).toEqual([]);
    expect(creates).toEqual([{ uid: "uid-c", iban: "FR76CCCC" }]);
  });
});
