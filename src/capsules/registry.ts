import { run as runLeafCap } from "./leaf-capability-filter/engine";
import { LeafCapabilityPanel } from "./leaf-capability-filter/Panel";

export const capsuleRegistry = [
  {
    name: "leaf-capability-filter",
    slot: "gfd/02-leaf-model",
    run: runLeafCap,
    Panel: LeafCapabilityPanel,
  },
] as const;

