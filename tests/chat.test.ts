import { describe, expect, it } from "vitest";
import { seed } from "../src/lib/seed";
import {
  chatAccess,
  chatCursor,
  chatInput,
  attachmentBudget,
  readChatForm,
  MAX_FILE_BYTES,
  MAX_REQUEST_BYTES,
  MAX_WORKSPACE_BYTES,
} from "../src/lib/chat-policy";
const input = (body = "Hello") => ({
  teamId: "t1",
  requestId: crypto.randomUUID(),
  body,
});
describe("chat boundaries", () => {
  it("allows current team members and instructors, denies outsiders and inactive users", () => {
    expect(chatAccess(seed(), "s1", "t1").id).toBe("s1");
    expect(chatAccess(seed(), "p1", "t1").role).toBe("instructor");
    expect(() => chatAccess(seed(), "s5", "t1")).toThrow("Access denied");
    const s = seed();
    s.users.find((u) => u.id === "s1")!.active = false;
    expect(() => chatAccess(s, "s1", "t1")).toThrow("Access denied");
    expect(() => chatAccess(seed(), "s1", "missing")).toThrow("Access denied");
  });
  it("validates text and file-only messages", () => {
    expect(chatInput(input("  Hi 📚  ")).body).toBe("Hi 📚");
    expect(() => chatInput(input("  "))).toThrow("Write a message");
    expect(() => chatInput(input("a".repeat(4001)))).toThrow("4,000");
    expect(
      chatInput({ ...input(""), file: new File(["hello"], "notes.txt") }).file
        ?.name,
    ).toBe("notes.txt");
    expect(() => chatInput({ ...input(), requestId: "spoof" })).toThrow(
      "request",
    );
  });
  it("sanitizes filenames and rejects empty or oversized attachments", () => {
    const result = chatInput({
      ...input(""),
      file: new File(["ok"], '../folder/notes\r\n".txt'),
    });
    expect(result.file?.name).not.toMatch(/[\/\\\r\n"]/);
    expect(() =>
      chatInput({ ...input(), file: new File([], "empty.txt") }),
    ).toThrow("empty");
    expect(() =>
      chatInput({
        ...input(),
        file: new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.zip"),
      }),
    ).toThrow("3 MB");
  });
  it("enforces workspace attachment quota but still permits text", () => {
    expect(() => attachmentBudget(MAX_WORKSPACE_BYTES - 1, 2)).toThrow("50 MB");
    expect(() => attachmentBudget(MAX_WORKSPACE_BYTES, 0)).not.toThrow();
    expect(() => attachmentBudget(MAX_WORKSPACE_BYTES - 2, 2)).not.toThrow();
  });
  it("accepts only bounded bigint cursors", () => {
    expect(chatCursor(null)).toBeNull();
    expect(chatCursor("123")).toBe("123");
    for (const c of [
      "-1",
      "0",
      "1.2",
      "1;DROP",
      "9223372036854775808",
      "x".repeat(1000),
    ])
      expect(() => chatCursor(c)).toThrow("cursor");
  });
  it("bounds streamed bodies even when content-length is missing or dishonest", async () => {
    for (const length of [undefined, "1"]) {
      const req = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data; boundary=x",
          ...(length ? { "Content-Length": length } : {}),
        },
        body: new Uint8Array(MAX_REQUEST_BYTES + 1),
      });
      await expect(readChatForm(req)).rejects.toThrow("3 MB");
    }
  });
});
