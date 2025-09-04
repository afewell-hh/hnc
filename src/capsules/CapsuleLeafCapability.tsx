import React from "react";
import { capsuleRegistry } from "./registry";

export const CapsuleLeafCapability: React.FC<{
  spec: any;
  onSelectLeafModel: (id: string) => void;
}> = ({ spec, onSelectLeafModel }) => {
  const cap = capsuleRegistry.find(c => c.name === "leaf-capability-filter")!;
  const input = {
    endpointProfiles: spec?.endpointProfiles ?? [],
    uplinksPerLeaf: Number(spec?.uplinksPerLeaf ?? 0),
  };
  const [result, setResult] = React.useState<any>(null);

  return (
    <cap.Panel
      input={input}
      result={result}
      onRun={(i) => setResult(cap.run(i))}
      onSelect={onSelectLeafModel}
    />
  );
};

