import { expect } from "chai";
import * as sinon from "sinon";
import { delay } from "../../utils/async";

describe("delay function", () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    // Use Sinon to fake timers in each test
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    // Restore the original timers after each test
    clock.restore();
  });

  it("should use setImmediate for immediate resolution", async () => {
    const setImmediateSpy = sinon.spy(global, "setImmediate");

    delay(0).then(() => {
      // Verify setImmediate was called once
      expect(setImmediateSpy.calledOnce).to.be.true;
    });

    // Fast-forward until all timers have been executed
    clock.tick(0);

    setImmediateSpy.restore();
  });

  it("should use setTimeout for delayed resolution", async () => {
    const setTimeoutSpy = sinon.spy(global, "setTimeout");
    const timeout = 100; // milliseconds

    delay(timeout).then(() => {
      // Verify setTimeout was called once with the correct timeout
      expect(setTimeoutSpy.calledOnceWithExactly(sinon.match.any, timeout)).to
        .be.true;
    });

    // Fast-forward until all timers have been executed
    clock.tick(timeout);

    setTimeoutSpy.restore();
  });

  it("should resolve immediately if the timeout is not provided", async () => {
    const setImmediateSpy = sinon.spy(global, "setImmediate");

    delay().then(() => {
      // Verify setImmediate was called once
      expect(setImmediateSpy.calledOnce).to.be.true;
    });

    // Fast-forward until all timers have been executed
    clock.tick(0);

    setImmediateSpy.restore();
  });
});
