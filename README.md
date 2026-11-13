# Personal Space · GitHub Pages

A responsive, zero-dependency personal website with a Discourum-inspired Material 3 visual style.

## Customize

- **Text:** edit `content.js` (both `zh` and `en` objects). Default content is intentionally placeholder text.
- **GitHub link:** replace the `https://github.com/Luyao-Fan` links in `index.html` if needed.
- **Email:** replace the placeholder in the contact section with your own link (`mailto:`).
- **Colors and layout:** adjust CSS variables at the top of the active versioned stylesheet (`styles.8875522922.css`).
- **Theme:** automatically follows the OS, with a button cycling through system → light → dark.
- **Sections:** Home, About, Research, Projects, Notes, Contact. Add or remove sections in `index.html` and update `sections` in the active `script.a5284e84d6.js`.

No npm packages, build step, external fonts, analytics, or third-party requests are required.

## Preview locally

Run `python3 -m http.server 8000` from the repository directory, then visit `http://localhost:8000`.

## Publish with GitHub Pages

In repository **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**. The site is served as static HTML, CSS, and JS, and supports a project-site path without hard-coded asset roots.

For the canonical personal domain `https://Luyao-Fan.github.io/`, the repository would need to be named `Luyao-Fan.github.io`; GitHub Pages project-site URLs use the path of this repository instead.

## Asset cache safety

`index.html` now references `styles.8875522922.css`, `script.a5284e84d6.js` (navigation), and `button-motion.20ed5df6ec.js` (other controls). The standalone button-motion layer adds mouse magnetic attraction and touch drag/deformation/rebound to theme, language, GitHub, hero, contact, and back-to-top buttons; it deliberately avoids the existing mobile tab bar and sidebar nav. Taps and keyboard activation continue to use native links/buttons. Vertical touch panning is preserved on page buttons, and drag gestures never activate their links. Reduced-motion preferences bypass these effects.

When updating CSS/JS, generate a new revision-named asset and update the reference in `index.html` so GitHub Pages cannot serve a cached incompatible script or stylesheet. Keep prior revision files because cached HTML may still reference them. The unversioned `styles.css` and `script.js` are retained for older cached pages.
