import { it, expect } from "vitest";
import { validateClaims } from "../src/lib/lti";
const valid = {
  iss: "https://canvas.example",
  aud: "123",
  sub: "user-1",
  nonce: "abc",
  exp: Math.floor(Date.now() / 1000) + 60,
  "https://purl.imsglobal.org/spec/lti/claim/deployment_id": "d1",
  "https://purl.imsglobal.org/spec/lti/claim/message_type":
    "LtiResourceLinkRequest",
  "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
  "https://purl.imsglobal.org/spec/lti/claim/context": { id: "course-1" },
  "https://purl.imsglobal.org/spec/lti/claim/roles": [
    "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  ],
};
it("rejects unknown roles rather than granting teacher access", () =>
  expect(() =>
    validateClaims(
      {
        ...valid,
        "https://purl.imsglobal.org/spec/lti/claim/roles": ["Administrator"],
      },
      "abc",
      "d1",
    ),
  ).toThrow());
it("rejects a different nonce", () =>
  expect(() => validateClaims(valid, "wrong", "d1")).toThrow());
it("rejects an unregistered deployment", () =>
  expect(() => validateClaims(valid, "abc", "wrong")).toThrow());
it("extracts course and verified instructor role", () =>
  expect(validateClaims(valid, "abc", "d1")).toEqual({
    subject: "user-1",
    courseId: "course-1",
    role: "instructor",
  }));
