// components/pageStatus.tsx
// Full-page loading and not-found states.

export function Loader() {
  return (
    <div className="loader">
      <div className="loader-dot" /><div className="loader-dot" /><div className="loader-dot" />
    </div>
  )
}

export function NotFound({ message }: { message: string }) {
  return (
    <div className="not-found">
      <div className="not-found-code">404</div>
      <div className="not-found-msg">{message}</div>
    </div>
  )
}
