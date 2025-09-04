import { checkLeafCapability, DEFAULT_LEAF_MODELS } from "@/domain/leaf-capability-filter";
import type { EndpointProfile } from "@/components/gfd/MultiProfileEndpointEditor";

export type Input = { endpointProfiles: EndpointProfile[]; uplinksPerLeaf: number };
export type Output = { viableModels: string[]; warnings: string[] };

export function run(input: Input): Output {
  const warnings: string[] = [];
  const viable = DEFAULT_LEAF_MODELS
    .map(m => ({ m, res: checkLeafCapability(m, input.endpointProfiles ?? [], input.uplinksPerLeaf ?? 0) }))
    .filter(x => x.res.feasible);

  for (const v of viable) if (v.res.warnings?.length) warnings.push(...v.res.warnings);
  return { viableModels: viable.map(v => v.m.id), warnings };
}

