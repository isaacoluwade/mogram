# AWS Architecture Icons

These are Amazon Web Services' official architecture icons, release 07312026 (31 July 2026),
from https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip, linked from https://aws.amazon.com/architecture/icons/.

The files are cleaned copies made by `scripts/build-catalog.ts`: titles and editor ids are
removed and the ids that remain are prefixed with the icon's slug. Service, resource, group and
category icons are otherwise unchanged.

AWS ships some icons in two copies, one for light backgrounds and one (`_Dark`) for dark ones.
Mogram keeps one file and lets the canvas pick, which gives the copy AWS made for that
background:

- General resource icons (User, Database, …) are single-colour line drawings, drawn in the canvas
  text colour.
- AWS Cloud, AWS Cloud (logo) and AWS Marketplace are a square with a white mark. The square is
  drawn in the canvas text colour and the mark is cut out of it, so it is dark-on-light on a light
  canvas and light-on-dark on a dark one, as in AWS's two copies.

## AWS's terms

Quoted from https://aws.amazon.com/architecture/icons/:

> We allow customers and partners to use these toolkits and assets to create architecture
> diagrams. AWS architecture icons are designed to be simple, so you can easily use them in
> diagrams. You can also put icons in materials like whitepapers, presentations, data sheets, and
> posters. You can build diagrams with preexisting libraries on third-party tools. Check that
> you're using up-to-date icons, because some libraries may contain legacy icon sets.

AWS releases a new package each quarter (end of January, April and July).

## What this means for Mogram

- Mogram shows these icons only inside architecture diagrams, the use AWS allows.
- Each component shows its name next to its icon.
- The icons are never used to represent Mogram itself.
- Motion presets move the whole icon and never change its artwork. `rotate`, `bounce` and
  `shake` turn, squash or jog it while they play, which may sit uneasily with brand guidance
  against rotating or distorting icons. Users choose those presets per component.

**Flag for legal review before public launch**: confirm that a commercial diagram product may
offer these icons as a built-in library, and whether motion presets may apply to them.
