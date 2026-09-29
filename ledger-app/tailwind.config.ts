import type { Config } from 'tailwindcss';
export default { darkMode: ['class'], content: ['./src/**/*.{ts,tsx}'], theme: { extend: { colors: { credit: 'hsl(var(--credit))', debit: 'hsl(var(--debit))', warning: 'hsl(var(--warning))' }, fontVariantNumeric: { tabular: 'tabular-nums' } } }, plugins: [] } satisfies Config;
