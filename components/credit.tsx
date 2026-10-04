// components/credit.tsx
// "Built by …" with a link to the builder's profile. Opens in a new tab (from the installed app: in Safari), so
// nobody loses their place. Each page styles it through className.

import { CREDIT_NAME, CREDIT_URL } from '@/lib/brand'

export function Credit({ className }: { className: string }) {
  return (
    <p className={className}>
      Built by <a href={CREDIT_URL} target="_blank" rel="noopener noreferrer">{CREDIT_NAME}</a>
    </p>
  )
}
