import { describe, expect, it } from "vitest";
import { handler } from "./lambda.js";

describe("Lambda adapter", () => {
  it("exports the reusable Express Lambda handler", () => {
    expect(handler).toBeTypeOf("function");
  });
});
