'use client';
export function NlSuggestions({ onPick, examples }: { onPick:(q:string)=>void; examples:string[] }) { return <div className="nlq-suggestions"><span>Try asking</span>{examples.slice(0,5).map(x=><button key={x} onClick={()=>onPick(x)}>“{x}”</button>)}</div>; }
