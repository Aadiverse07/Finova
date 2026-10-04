export type Bbox = { x: number; y: number; width: number; height: number };
export type LayoutLine = { text: string; bbox: Bbox };
export type Role = 'issuer' | 'recipient' | 'neutral';
export type Line = { text: string; index: number; role: Role };
export type Scored<T> = { value: T; confidence: number; reason: string };
