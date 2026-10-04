# Microsoft Azure architecture icons

These are Microsoft's official Azure architecture icons, version V24 (July 2026), from
https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip, linked from https://learn.microsoft.com/en-us/azure/architecture/icons/.

The files are cleaned copies made by `scripts/build-catalog.ts`: comments, titles and editor
attributes are removed, inline styles become plain attributes, and gradient ids are prefixed with
the icon's slug so many icons can share one page. The artwork itself is unchanged.

## Microsoft's icon terms

Quoted from https://learn.microsoft.com/en-us/azure/architecture/icons/:

> Microsoft permits the use of these icons in architectural diagrams, training materials, or
> documentation. You can copy, distribute, and display the icons only for the permitted use unless
> granted explicit permission by Microsoft. Microsoft reserves all other rights.

General guidelines from the same page:

> Do's
>
> - Use the icon to illustrate how products can work together.
> - In diagrams, we recommend including the product name somewhere close to the icon.
> - Use the icons as they would appear within Azure.
>
> Don'ts
>
> - Don't crop, flip, or rotate icons.
> - Don't distort or change icon shape in any way.
> - Don't use Microsoft product icons to represent your product or service.

The download also contains `Microsoft_Terms_of_Use.pdf` and `Azure_Icons_FAQ.pdf`, which are
not copied here.

## What this means for Mogram

- Mogram shows these icons only inside architecture diagrams, which is the permitted use.
- Each component shows its name next to its icon, as Microsoft recommends.
- The icons are never used to represent Mogram itself.
- Motion presets move the whole icon and never change its artwork. `rotate`, `bounce` and
  `shake` turn, squash or jog it while they play, which may sit uneasily with brand guidance
  against rotating or distorting icons. Users choose those presets per component. Microsoft's terms say "Don't crop, flip, or rotate icons" and "Don't
  distort or change icon shape".

**Flag for legal review before public launch**: confirm that a commercial diagram product may
serve these icons to its users, and whether motion presets may apply to them.
