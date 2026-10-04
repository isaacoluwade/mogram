# Google Cloud product icons

These are Google Cloud's official product icons from https://cloud.google.com/icons: the core product icons
(https://services.google.com/fh/files/misc/core-products-icons.zip) and the product category icons (https://services.google.com/fh/files/misc/category-icons.zip).
Products are filed and drawn as the Google Cloud product icons guide (May 2026,
https://services.google.com/fh/files/misc/google-cloud-product-icons.pdf) directs.

The files are cleaned copies made by `scripts/build-catalog.ts`: comments and editor ids are
removed, the stylesheet classes become plain attributes, and the ids that remain are prefixed with
the icon's slug. The artwork itself is unchanged.

## Google's guidance

From https://cloud.google.com/icons:

> Welcome to the official library for Google Cloud product icons. Here you can find the Google
> Cloud product icons you need for your diagrams, technical documentation, and more.

From the product icons guide:

> Core products carry their own unique icons — not a general product category icon.

> The same category icon will be used for multiple products across our Google Cloud portfolio.

So every product without a core icon is listed under its own name and drawn with its category's
icon. The older two-tone console icons are not included; the guide says "these icons should not
be used as of 2026".

## What this means for Mogram

- Mogram shows these icons only inside architecture diagrams, the use Google describes.
- Each component shows its name next to its icon, which is what tells products that share a
  category icon apart.
- The icons are never used to represent Mogram itself.
- Motion presets move the whole icon and never change its artwork. `rotate`, `bounce` and
  `shake` turn, squash or jog it while they play, which may sit uneasily with brand guidance
  against rotating or distorting icons. Users choose those presets per component.

**Flag for legal review before public launch**: Google's pages describe the intended use but
state no licence. Confirm that a commercial diagram product may offer these icons as a built-in
library, and whether motion presets may apply to them.
