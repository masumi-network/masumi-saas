export const ONBOARDING_LOGO_SRC = "/assets/logo.png";

/** Hoisted <link rel="preload"> so the welcome logo is cached before the dialog paints. */
export function OnboardingLogoPreload() {
  return (
    <link
      rel="preload"
      href={ONBOARDING_LOGO_SRC}
      as="image"
      type="image/png"
    />
  );
}
