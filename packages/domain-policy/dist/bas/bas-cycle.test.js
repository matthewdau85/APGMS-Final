// Example only - adjust imports/namespaces to your actual BAS domain.
import { BasCycleState, BasCycleError } from "./bas-cycle";
function makeBasCycle(overrides = {}) {
    return {
        id: "bas-1",
        orgId: "org-1",
        periodStart: new Date("2024-07-01"),
        periodEnd: new Date("2024-09-30"),
        state: BasCycleState.DRAFT,
        ...overrides,
    };
}
describe("BasCycle state machine", () => {
    it("allows DRAFT → READY → LODGED → PAID", () => {
        let bas = makeBasCycle();
        bas = bas.markReady();
        expect(bas.state).toBe(BasCycleState.READY);
        bas = bas.markLodged({ atoReference: "123-ABC" });
        expect(bas.state).toBe(BasCycleState.LODGED);
        bas = bas.markPaid({ paymentDate: new Date("2024-10-21") });
        expect(bas.state).toBe(BasCycleState.PAID);
    });
    it("rejects invalid transitions", () => {
        const bas = makeBasCycle({ state: BasCycleState.LODGED });
        expect(() => bas.markReady()).toThrow(BasCycleError);
        expect(() => bas.markDraft()).toThrow(BasCycleError);
    });
});
