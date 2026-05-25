function AuthLayout({ children, exiting = false, entering = false }) {
  const titleAnim = exiting
    ? 'animate-drop-out-title'
    : entering
      ? 'animate-rise-in-title'
      : ''
  const panelAnim = exiting
    ? 'animate-drop-out-panel'
    : entering
      ? 'animate-rise-in-panel'
      : ''

  // One-line tagline beneath the wordmark — Pro Max "Minimal Single Column" landing
  // pattern (hero + short description). Kept to a single phrase so the page stays quiet.
  const tagline = 'Quietly run your business.'

  return (
    <div className="h-screen overflow-hidden bg-page">
      {/* Mobile: title above the form, the whole group centered. */}
      <div className="flex h-full w-full flex-col items-center justify-center px-4 py-12 lg:hidden">
        <div className="mb-6 animate-fade-in text-center">
          <h1
            className="font-heading text-5xl text-accent leading-none"
            style={{ letterSpacing: '-0.02em' }}
          >
            Crema
          </h1>
          <p className="mt-2 text-sm text-ink-tertiary tracking-wide">
            {tagline}
          </p>
        </div>
        {children}
      </div>

      {/* Desktop: title + form as a single composition, centered on the whole screen.
          gap-24 sits between them; the group is centered as a unit, so the space to
          the left of the title equals the space to the right of the form.
          text-center on the title column centers the tagline horizontally beneath the
          wordmark (the wordmark itself fills the column width, so it doesn't shift). */}
      <div className="hidden h-full w-full lg:flex items-center justify-center gap-24 px-12">
        <div className={`text-center ${titleAnim}`}>
          <h1
            className="animate-fade-in font-heading leading-none text-accent"
            style={{ letterSpacing: '-0.02em', fontSize: 'clamp(7rem, 10vw, 10rem)' }}
          >
            Crema
          </h1>
          <p
            className="animate-fade-in mt-5 text-base text-ink-tertiary tracking-wide"
            style={{ animationDelay: '120ms' }}
          >
            {tagline}
          </p>
        </div>
        <div className={`w-[420px] shrink-0 ${panelAnim}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
