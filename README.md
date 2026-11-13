# Personal Space · GitHub Pages

A responsive, zero-dependency personal website with a Discourum-inspired Material 3 visual style.

## Customize

- **Text:** edit `content.js` (both `zh` and `en` objects). Default content is intentionally placeholder text.
- **GitHub link:** replace the `https://github.com/Luyao-Fan` links in `index.html` if needed.
- **Email:** replace the placeholder in the contact section with your own link (`mailto:`).
- **Colors and layout:** adjust CSS variables at the top of `styles.css`.
- **Theme:** automatically follows the OS, with a button cycling through system → light → dark.
- **Sections:** Home, About, Research, Projects, Notes, Contact. Add or remove sections in `index.html` and update `sections` in `script.js`.

No npm packages, build step, external fonts, analytics, or third-party requests are required.

## Preview locally

Run `python3 -m http.server 8000` from the repository directory, then visit `http://localhost:8000`.

## Publish with GitHub Pages

In repository **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**. The site is served as static HTML, CSS, and JS, and supports a project-site path without hard-coded asset roots.

For the canonical personal domain `https://Luyao-Fan.github.io/`, the repository would need to be named `Luyao-Fan.github.io`; GitHub Pages project-site URLs use the path of this repository instead.
