import React from "react";
import type { Input, Output } from "./engine";

export const LeafCapabilityPanel: React.FC<{
  input: Input;
  result?: Output;
  onRun: (input: Input) => void;
  onSelect: (leafModelId: string) => void;
}> = ({ input, result, onRun, onSelect }) => (
  <div style={{border:"1px solid #ddd", borderRadius:8, padding:12}}>
    <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:8}}>
      <strong>Leaf Capability Capsule</strong>
      <button onClick={() => onRun(input)}>Compute</button>
    </div>
    {result && (
      <>
        <div style={{marginBottom:6}}>Viable models:</div>
        <ul>
          {result.viableModels.map(id => (
            <li key={id}>
              {id} <button onClick={() => onSelect(id)}>Select</button>
            </li>
          ))}
        </ul>
        {!!result.warnings?.length && (
          <div style={{marginTop:8, fontSize:12, color:"#8a6d3b"}}>
            ⚠ {result.warnings.join(", ")}
          </div>
        )}
      </>
    )}
  </div>
);

