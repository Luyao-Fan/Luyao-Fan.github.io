# Personal Space · GitHub Pages

A responsive, zero-dependency personal website with a Discourum-inspired Material 3 visual style.

## Customize

- **Text:** edit `content.js` (both `zh` and `en` objects). Default content is intentionally placeholder text.
- **GitHub link:** replace the `https://github.com/Luyao-Fan` links in `index.html` if needed.
- **Email:** replace the placeholder in the contact section with your own link (`mailto:`).
- **Colors and layout:** adjust CSS variables at the top of `styles.483b085bf5.css`.
- **Theme:** automatically follows the OS, with a button cycling through system → light → dark.
- **Sections:** Home, About, Research, Projects, Notes, Contact. Add or remove sections in `index.html` and update `sections` in `script.js`.

No npm packages, build step, external fonts, analytics, or third-party requests are required.

## Preview locally

Run `python3 -m http.server 8000` from the repository directory, then visit `http://localhost:8000`.

## Publish with GitHub Pages

In repository **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**. The site is served as static HTML, CSS, and JS, and supports a project-site path without hard-coded asset roots.

For the canonical personal domain `https://Luyao-Fan.github.io/`, the repository would need to be named `Luyao-Fan.github.io`; GitHub Pages project-site URLs use the path of this repository instead.

## Asset cache safety

The HTML points to revision-named `styles.483b085bf5.css` and `script.490b3ed9fc.js`. This ensures the browser does not mix the new mobile nav HTML with old cached CSS or JavaScript. Edit those active files. When deploying future changes to CSS/JS, rename both revised assets and their references in `index.html` (and update this README) so GitHub Pages cannot serve an incompatible older copy. The unversioned `styles.css` and `script.js` are retained only for existing cached pages.
