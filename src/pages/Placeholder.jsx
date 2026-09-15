// Temporary placeholder screens — will be replaced one-by-one with
// full implementations matching your Google Stitch designs.
export default function Placeholder({ title, subtitle }) {
  return (
    <div className="px-md py-lg">
      <h1 className="text-h1 font-bold text-ink-primary mb-sm">{title}</h1>
      <p className="text-body text-ink-secondary">{subtitle}</p>
      <div className="card mt-lg p-md text-ink-tertiary text-body-small">
        This screen is under construction. We'll build it together, matching
        your Stitch design exactly.
      </div>
    </div>
  )
}
