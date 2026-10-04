import { AWS_SOURCE } from "./aws";
import { AZURE_SOURCE } from "./azure";
import { GCP_SOURCE } from "./gcp";
import { KUBERNETES_SOURCE } from "./kubernetes";
import type { ToolCredit } from "./tools";

/**
 * What every cloud notice says about motion. The PRD makes every preset work on every icon
 * (IC-6) and leaves the choice to the user; vendors ask that icons are not rotated or distorted.
 */
const MOTION_NOTE = `- Motion presets move the whole icon and never change its artwork. \`rotate\`, \`bounce\` and
  \`shake\` turn, squash or jog it while they play, which may sit uneasily with brand guidance
  against rotating or distorting icons. Users choose those presets per component.`;

/**
 * The Azure icon terms, quoted from Microsoft's download page (AZURE_SOURCE.page) when V24 was
 * adopted. Kept verbatim so legal review reads Microsoft's words, not a paraphrase.
 */
export function azureNotice(): string {
  return `# Microsoft Azure architecture icons

These are Microsoft's official Azure architecture icons, version ${AZURE_SOURCE.version} (${AZURE_SOURCE.published}), from
${AZURE_SOURCE.url}, linked from ${AZURE_SOURCE.page}.

The files are cleaned copies made by \`scripts/build-catalog.ts\`: comments, titles and editor
attributes are removed, inline styles become plain attributes, and gradient ids are prefixed with
the icon's slug so many icons can share one page. The artwork itself is unchanged.

## Microsoft's icon terms

Quoted from ${AZURE_SOURCE.page}:

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

The download also contains \`Microsoft_Terms_of_Use.pdf\` and \`Azure_Icons_FAQ.pdf\`, which are
not copied here.

## What this means for Mogram

- Mogram shows these icons only inside architecture diagrams, which is the permitted use.
- Each component shows its name next to its icon, as Microsoft recommends.
- The icons are never used to represent Mogram itself.
${MOTION_NOTE} Microsoft's terms say "Don't crop, flip, or rotate icons" and "Don't
  distort or change icon shape".

**Flag for legal review before public launch**: confirm that a commercial diagram product may
serve these icons to its users, and whether motion presets may apply to them.
`;
}

/** AWS's terms, quoted from AWS_SOURCE.page when the 07312026 package was adopted. */
export function awsNotice(): string {
  return `# AWS Architecture Icons

These are Amazon Web Services' official architecture icons, release ${AWS_SOURCE.release} (${AWS_SOURCE.published}),
from ${AWS_SOURCE.url}, linked from ${AWS_SOURCE.page}.

The files are cleaned copies made by \`scripts/build-catalog.ts\`: titles and editor ids are
removed and the ids that remain are prefixed with the icon's slug. Service, resource, group and
category icons are otherwise unchanged.

AWS ships some icons in two copies, one for light backgrounds and one (\`_Dark\`) for dark ones.
Mogram keeps one file and lets the canvas pick, which gives the copy AWS made for that
background:

- General resource icons (User, Database, …) are single-colour line drawings, drawn in the canvas
  text colour.
- AWS Cloud, AWS Cloud (logo) and AWS Marketplace are a square with a white mark. The square is
  drawn in the canvas text colour and the mark is cut out of it, so it is dark-on-light on a light
  canvas and light-on-dark on a dark one, as in AWS's two copies.

## AWS's terms

Quoted from ${AWS_SOURCE.page}:

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
${MOTION_NOTE}

**Flag for legal review before public launch**: confirm that a commercial diagram product may
offer these icons as a built-in library, and whether motion presets may apply to them.
`;
}

/** Google's guidance, quoted from GCP_SOURCE.page and the product icons guide it links. */
export function gcpNotice(): string {
  return `# Google Cloud product icons

These are Google Cloud's official product icons from ${GCP_SOURCE.page}: the core product icons
(${GCP_SOURCE.core.url}) and the product category icons (${GCP_SOURCE.categories.url}).
Products are filed and drawn as the Google Cloud product icons guide (${GCP_SOURCE.guideUpdated},
${GCP_SOURCE.guide}) directs.

The files are cleaned copies made by \`scripts/build-catalog.ts\`: comments and editor ids are
removed, the stylesheet classes become plain attributes, and the ids that remain are prefixed with
the icon's slug. The artwork itself is unchanged.

## Google's guidance

From ${GCP_SOURCE.page}:

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
${MOTION_NOTE}

**Flag for legal review before public launch**: Google's pages describe the intended use but
state no licence. Confirm that a commercial diagram product may offer these icons as a built-in
library, and whether motion presets may apply to them.
`;
}

/** Credits the Kubernetes icon set under CC BY 4.0, one of the two licences it is offered under. */
export function kubernetesNotice(): string {
  return `# Kubernetes icons

These icons are the Kubernetes Icons Set by the Kubernetes community, from
${KUBERNETES_SOURCE.repository}, at commit ${KUBERNETES_SOURCE.commit}.

## Licence

The project's README says:

> The Kubernetes Icons Set is licensed under a choice of either Apache-2.0 or CC-BY-4.0
> (Creative Commons Attribution 4.0 International). The Kubernetes logo is a registered trademark
> of The Linux Foundation, and use of it as a trademark is subject to The Linux Foundation's
> Trademark Usage Guidelines at https://www.linuxfoundation.org/trademark-usage/.

Mogram uses the icons under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

**Changes made**: Inkscape metadata, editor attributes and unused ids are removed, inline styles
become plain attributes, the ids that remain are prefixed with the icon's slug, and the files are
renamed after the Kubernetes kinds (\`pod.svg\`, \`configmap.svg\`). The artwork is unchanged.
Control plane and node components exist only in the labelled versions, which are used as they are.

The Kubernetes logo itself is in the tool logos (\`tool/kubernetes\`), not here.
`;
}

export function toolNotice(
  credits: readonly ToolCredit[],
  skipped: readonly string[],
  simpleIconsVersion: string,
): string {
  const logos = credits.map((credit) => `- ${describeCredit(credit)}`).join("\n");
  const missing =
    skipped.length === 0
      ? "Every requested logo was available."
      : `Simple Icons ${simpleIconsVersion} does not carry these, so they were skipped: ${skipped
          .map((slug) => `\`${slug}\``)
          .join(", ")}.`;
  return `# Tool logos

These logos come from [Simple Icons](https://simpleicons.org) ${simpleIconsVersion}. Simple Icons
publishes its collection under CC0-1.0, but each logo is a trademark of its owner and some carry
their own licence or brand guidelines, listed below.

- Logos appear in Mogram only to identify the tools in a diagram.
- They never suggest that any brand endorses Mogram, and they are not used in Mogram's own
  branding or marketing.
- Each logo is drawn as published, in its brand colour, with its shape unchanged.

## Logos

${logos}

## Not included

${missing}
`;
}

function describeCredit(credit: ToolCredit): string {
  const parts = [
    `${credit.title} (\`tool/${credit.slug}\`, Simple Icons \`${credit.simpleIcon}\`)`,
  ];
  if (credit.license !== null) parts.push(`licence ${credit.license}`);
  if (credit.guidelines !== null) parts.push(`guidelines ${credit.guidelines}`);
  return parts.join(", ");
}
