// packages/domain-policy/src/designated-accounts/guards.test.ts

import {
  assertDesignatedAccountMovementAllowed,
  assertDesignatedAccountTypeIsSupported,
  DesignatedAccountOperation,
  DesignatedAccountRuleError,
  isActiveForNewDesignations,
} from "./guards";
import {
  DesignatedAccountLifecycle,
  DesignatedAccountType,
  type DesignatedAccount,
} from "./types";

function makeAccount(
  overrides: Partial<DesignatedAccount> = {},
): DesignatedAccount {
  const now = new Date("2024-08-01T00:00:00Z");
  return {
    id: "acc-1",
    orgId: "org-1",
    type: DesignatedAccountType.PAYGW,
    lifecycle: DesignatedAccountLifecycle.ACTIVE,
    bankingProviderAccountId: "bank-acc-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("assertDesignatedAccountMovementAllowed", () => {
  it("allows deposits into ACTIVE accounts", () => {
    const account = makeAccount({
      lifecycle: DesignatedAccountLifecycle.ACTIVE,
    });

    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account,
        operation: DesignatedAccountOperation.DEPOSIT,
        amountCents: 10_00,
      }),
    ).not.toThrow();
  });

  it("rejects zero or negative amounts", () => {
    const account = makeAccount();

    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account,
        operation: DesignatedAccountOperation.DEPOSIT,
        amountCents: 0,
      }),
    ).toThrow(DesignatedAccountRuleError);

    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account,
        operation: DesignatedAccountOperation.DEPOSIT,
        amountCents: -100,
      }),
    ).toThrow(DesignatedAccountRuleError);
  });

  it("rejects movements for PENDING_ACTIVATION and CLOSED accounts", () => {
    const pending = makeAccount({
      lifecycle: DesignatedAccountLifecycle.PENDING_ACTIVATION,
    });
    const closed = makeAccount({
      lifecycle: DesignatedAccountLifecycle.CLOSED,
    });

    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account: pending,
        operation: DesignatedAccountOperation.DEPOSIT,
        amountCents: 10_00,
      }),
    ).toThrow(DesignatedAccountRuleError);

    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account: closed,
        operation: DesignatedAccountOperation.DEPOSIT,
        amountCents: 10_00,
      }),
    ).toThrow(DesignatedAccountRuleError);
  });

  it("allows only deposits for SUNSETTING accounts", () => {
    const sunsetting = makeAccount({
      lifecycle: DesignatedAccountLifecycle.SUNSETTING,
    });

    // Deposit is allowed
    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account: sunsetting,
        operation: DesignatedAccountOperation.DEPOSIT,
        amountCents: 10_00,
      }),
    ).not.toThrow();

    // Withdrawal is not allowed
    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account: sunsetting,
        operation: DesignatedAccountOperation.WITHDRAWAL,
        amountCents: 10_00,
      }),
    ).toThrow(DesignatedAccountRuleError);

    // Internal transfer is not allowed
    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account: sunsetting,
        operation: DesignatedAccountOperation.INTERNAL_TRANSFER,
        amountCents: 10_00,
      }),
    ).toThrow(DesignatedAccountRuleError);
  });

  it("rejects any non-deposit operation on ACTIVE accounts", () => {
    const account = makeAccount({
      lifecycle: DesignatedAccountLifecycle.ACTIVE,
    });

    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account,
        operation: DesignatedAccountOperation.WITHDRAWAL,
        amountCents: 10_00,
      }),
    ).toThrow(DesignatedAccountRuleError);

    expect(() =>
      assertDesignatedAccountMovementAllowed({
        account,
        operation: DesignatedAccountOperation.INTERNAL_TRANSFER,
        amountCents: 10_00,
      }),
    ).toThrow(DesignatedAccountRuleError);
  });
});

describe("isActiveForNewDesignations", () => {
  it("returns true only for ACTIVE accounts", () => {
    expect(
      isActiveForNewDesignations(
        makeAccount({
          lifecycle: DesignatedAccountLifecycle.ACTIVE,
        }),
      ),
    ).toBe(true);

    expect(
      isActiveForNewDesignations(
        makeAccount({
          lifecycle: DesignatedAccountLifecycle.PENDING_ACTIVATION,
        }),
      ),
    ).toBe(false);

    expect(
      isActiveForNewDesignations(
        makeAccount({
          lifecycle: DesignatedAccountLifecycle.SUNSETTING,
        }),
      ),
    ).toBe(false);

    expect(
      isActiveForNewDesignations(
        makeAccount({
          lifecycle: DesignatedAccountLifecycle.CLOSED,
        }),
      ),
    ).toBe(false);
  });
});

describe("assertDesignatedAccountTypeIsSupported", () => {
  it("accepts all known AU tax account types", () => {
    const lifecycles = [
      DesignatedAccountType.PAYGW,
      DesignatedAccountType.GST,
      DesignatedAccountType.PAYGI,
      DesignatedAccountType.FBT,
      DesignatedAccountType.OTHER,
    ];

    for (const type of lifecycles) {
      const account = makeAccount({ type });
      expect(() =>
        assertDesignatedAccountTypeIsSupported(account),
      ).not.toThrow();
    }
  });

  it("rejects unsupported account types", () => {
    const bogusAccount: DesignatedAccount = {
      ...makeAccount(),
      // Force an invalid runtime value while satisfying TypeScript
      type: "SOMETHING_ELSE" as unknown as DesignatedAccountType,
    };

    expect(() =>
      assertDesignatedAccountTypeIsSupported(bogusAccount),
    ).toThrow(DesignatedAccountRuleError);
  });
});
