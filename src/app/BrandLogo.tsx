/** The logo with its tagline (English, as the brand's). Dark text in light mode, white text in dark mode. */
export function BrandLogo() {
  return (
    <>
      <img className="setup-logo logo-on-light" src="/brand/logo-tagline-dark.svg" alt="showctrl · Know The Show" />
      <img className="setup-logo logo-on-dark" src="/brand/logo-tagline.svg" alt="showctrl · Know The Show" />
    </>
  )
}
