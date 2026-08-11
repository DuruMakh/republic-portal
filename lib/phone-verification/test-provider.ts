import type { PhoneVerificationProvider } from "./contracts";

export function createTestPhoneVerificationProvider(): PhoneVerificationProvider {
  return {
    async send(input) {
      return { provider: "test", requestId: `test:${input.idempotencyKey}` };
    },
    async verify(input) {
      return { verified: input.requestId.startsWith("test:") && input.code === "123456" };
    },
  };
}
