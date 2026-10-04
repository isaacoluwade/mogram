# Mogram Product Requirements Document

Oct 3, 2026 · @Isaac Oluwade

## Overview

Mogram is a web app for building animated, stateful architecture diagrams that are as easy to make as a Canva design and live in a repository as clean YAML.

You drag real tool icons onto a canvas, connect them, and the diagram shows traffic moving through the system. Every element has a state, and scenes capture what happens when things change, like a database failing or traffic spiking. Cards explain each element in depth, and tours walk a viewer through the system with a camera that follows the flow.

Behind the canvas sits a readable YAML file, or a folder of them, that teams commit, review and change like any other code. The name comes from motion plus diagram, and the product lives at mogram.app.

**Vision.** Mogram becomes the place where architecture is drawn, explained and kept true. A Mogram diagram is a living explanation of a system, not a picture of one.

## The problem

Architecture is about behaviour, but today's diagrams can only show structure, and the tools that make them force a choice between easy, maintainable and expressive.

- **Static pictures can't show what happens.** Teams care about how traffic flows, what breaks during an outage and how the system recovers. A static box diagram shows none of that, so people hand animate GIFs in design tools that take hours and can't be updated.
- **Easy tools produce unreadable files.** diagrams.net and Lucid are simple to use, but their saved files are a tangle of coordinates, style strings and random IDs. Nobody can review a change to one in a pull request.
- **AI generated diagrams focus on looks.** Tools that generate an HTML page produce something pretty that can't be meaningfully committed, edited or maintained. They model the visuals, not the architecture.
- **Documentation lives somewhere else.** The README that explains a diagram is a separate file with no way to point at individual elements. Adding comments onto the diagram itself just creates noise.
- **Diagrams go stale.** Because diagrams sit outside the normal review process, they drift away from the real system and stop being trusted.

## Goals and non goals

Mogram succeeds when anyone can build an animated, explained architecture diagram without scripting, and the result is something a team can keep in its repository for years.

**Goals**

- As easy as diagrams.net, Lucid or Canva for a first time user. Everything is drag, click and pick from presets.
- Real tool icons, a clean look, and traffic flow that is obvious at a glance.
- State on everything, with scenes that change the whole diagram in one click and animate the transition.
- A saved file that humans can read, edit and review, with one line diffs for one line changes.
- Explanation that lives inside the diagram through cards and tours, pointing at real elements.
- A shareable interactive link as the main way diagrams travel.
- Free to use, with an account needed only to save work to the cloud.

**Non goals for now**

- No scripting, code driven animation or keyframes. Motion comes from presets only.
- No video style timeline with tracks and exact timing. Scenes replace it.
- No MP4 export.
- No live data from real systems. State is authored by the person building the diagram.
- No speaker or meeting notes in tours.
- No internal icon animation, like gears turning inside an icon. Motion applies to whole icons.

## Who Mogram is for

Mogram serves two groups: builders who create diagrams, and viewers who explore them. Viewers never need an account.

| Who                            | What they do with Mogram                                                     | What matters most to them                                  |
| ------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| DevOps and platform engineers  | Document the systems they run and keep diagrams in the repo next to the code | Clean files, scenes for failure modes, fast editing        |
| Solution and cloud architects  | Design and propose architectures to teams and clients                        | Real cloud icons, polished visuals, tours for walkthroughs |
| Engineering leads              | Present designs, incidents and postmortems in meetings                       | Presenting mode, failover scenes, the share link           |
| Educators and content creators | Make animated diagrams for courses, videos and social posts                  | GIF export, clean looks, speed                             |
| New engineers onboarding       | Learn a system on their own by exploring it                                  | Cards, tours, zooming into nested diagrams                 |
| Reviewers and stakeholders     | Look at a diagram someone shared or changed                                  | A link that opens instantly, no sign up                    |
| Enterprise platform teams      | Roll Mogram out across many teams                                            | Private icon libraries, security, licensing                |

## Competitors

Individuals already pay for diagram tools, usually $5 to $20 a month, and two products overlap closely with Mogram: Ilograph and Cloudairy.

| Product                                                                                           | What it is                                                  | Individual price (USD)                                 | Where Mogram aims to stand apart                                                        |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| diagrams.net                                                                                      | Free general diagram editor                                 | Free                                                   | Animated state and scenes, and files people can review in a pull request                |
| [Lucidchart](https://costbench.com/software/diagramming/lucidchart/)                              | Polished general diagramming suite                          | About $9 a month (Individual)                          | Architecture specific state, scenes and tours instead of general shapes                 |
| [Microsoft Visio](https://www.softwareadvice.com/project-management/lucidchart-profile/vs/visio/) | Microsoft's diagramming tool                                | $5 a month (Plan 1)                                    | Animation, share links and repo friendly files                                          |
| [Eraser](https://www.eraser.io/pricing-new)                                                       | Diagrams as code plus AI diagram generation                 | $15 a month yearly or $20 monthly (Starter)            | A visual, preset driven editor where code is the saved result, not the input            |
| [Ilograph](https://ilograph.com/desktop)                                                          | Interactive, zoomable architecture diagrams written as code | $11.99 a month yearly or $14.99 monthly (Desktop)      | The same depth through nested zoom, but built visually, with scenes and branching tours |
| [Cloudairy](https://neura.market/ai-tools-directory/graphic-design-tools/cloudairy)               | Workspace for animated cloud architecture diagrams          | Free plan, then $4 a month per member yearly (Starter) | State and scenes, cards and tours, and clean YAML that lives in the repo                |

Prices were checked in October 2026 from the linked pages and listings. Confirm them before quoting publicly.

**Closest competitors.** Ilograph already offers zoomable, interactive architecture diagrams, but people write them as code rather than build them visually. Cloudairy, the tool behind one of the original reference images, already makes animated cloud diagrams. Both are worth signing up for and studying before building.

**What this means for pricing.** Individuals clearly pay small monthly fees for good diagram tools. A low cost personal plan alongside enterprise licenses is a real option if Mogram needs revenue before enterprise deals land.

## Core concepts

A Mogram diagram is built in four layers: structure, state, story and depth. These terms are used the same way in the editor, the viewer and the file.

| Term           | What it is                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Diagram        | One architecture, saved as a single file or a folder of files.                                                                             |
| Component      | A single thing in the system, like a VM, a storage account or a user, shown with an icon.                                                  |
| Container      | A box that holds other elements and means something architecturally, like a region, a VNet, a subnet or a resource group. Containers nest. |
| Group          | A dashed boundary drawn around elements that span containers, like a scale set across availability zones. It has no position of its own.   |
| Connection     | A line between two elements that shows how traffic or data moves.                                                                          |
| Preset         | A named, ready made look or motion, like a traffic flow, a pulse or a down state.                                                          |
| State          | The condition of an element at a moment, like healthy, degraded or down.                                                                   |
| Scene          | A named snapshot of the whole diagram's state, like normal or region outage.                                                               |
| Card           | Documentation attached to one element, opened by clicking it.                                                                              |
| Tour           | A guided path through cards, linear or branching, with an animated camera.                                                                 |
| Nested diagram | A diagram inside a subfolder that a component opens when you zoom into it.                                                                 |
| Port           | A named entry point on a nested diagram that parent connections attach to.                                                                 |
| Instance       | One use of a nested diagram. The design is shared, but each instance has its own state.                                                    |
| Layout         | Where things sit on the canvas. Set by dragging, saved separately from the architecture.                                                   |

## Key user journeys

These journeys define what a complete Mogram experience feels like from first visit to long term use in a repository.

**1. First diagram in minutes.** A visitor opens mogram.app with no account and searches the Azure library for an Application Gateway, a VM and a storage account. They drop them into a VNet and subnets, connect them, and pick the traffic preset so dots start flowing. They export a GIF and post it.

**2. Showing a failure.** The builder adds a scene called region outage. They click the primary database and pick down, mark its connection blocked, and set the replica to active. Pressing play animates the change from normal to outage and back.

**3. Explaining the system.** The builder adds a card to the VM that points at a markdown file in the repo. They create a tour called how a request flows by clicking elements in order, and give the storage step two choices: normal read and region outage.

**4. Presenting in a meeting.** A lead opens the share link, switches to presenting mode and drives the tour with arrow keys. The camera rides each connection from element to element while scenes change underneath.

**5. Onboarding a new engineer.** A new hire clicks a link in the README that opens straight into the storage account's card. They take the tour at their own pace, wander off to explore, and resume where they left.

**6. Living in the repository.** The diagram is saved as a folder and committed. A teammate changes one scene line in a pull request, and the reviewer sees a one line diff. Someone adds a component in YAML without a position, and Mogram places it automatically until a person drags it.

**7. Zooming into depth.** A viewer clicks the AKS cluster. The icon grows into a frame and the cluster's own diagram fades in, with traffic arriving at the ingress controller. Escape zooms back out.

**8. Sharing for exploration.** A builder shares a link and turns on the advanced option that lets viewers change state. A viewer breaks a component themselves and watches traffic reroute.

## The editor

The editor is a visual canvas where everything is placed by dragging and configured by picking presets, so nobody ever types a coordinate or writes animation code.

**Canvas**

- An infinite canvas with smooth pan and zoom, and a library panel to drag icons from.
- Standard editing comforts: undo and redo, copy and paste, multi select, align and distribute, keyboard shortcuts.
- Canvas themes for backgrounds, including solid colours and gradients, chosen from presets.

**Grid and placement**

- An 8 pixel grid that snaps silently and stays hidden unless the user turns it on. Placement feels free, but positions are always whole numbers.
- Positions are stored in grid units relative to the parent container. Moving a whole VNet changes one line, not every child inside it.
- Elements added in the file without a position are placed automatically and marked unpinned. Dragging one pins it.

**Containers**

- Containers represent real architecture like regions, VNets, subnets, resource groups and clusters, and they nest inside each other.
- A container sizes itself to fit its children plus padding. A size is only saved if the user resizes it by hand.
- Each container type gets its look, colour, border and label style from a preset, so nothing visual is saved unless the user overrides it.

**Groups**

- Groups cover things that cut across containers, like a scale set spanning two availability zones.
- The user picks the members, and Mogram draws a dashed boundary around wherever they sit. Groups have no position to maintain.

**Connections**

- Drawn by dragging from one element to another, and routed automatically around other elements.
- A path is only saved if the user bends it by hand.
- A connection can attach to a named port on a nested diagram.

**Inspector**

- Selecting anything opens an inspector showing its type, name, state, presets, card and the file it lives in.
- Advanced settings for any preset live behind an advanced section, so the default view stays simple.

**Decorative elements**

- Free text, labels and highlight zones for anything that carries no architectural meaning. These live with the layout, not with the architecture.

## Icons and icon libraries

Mogram ships a curated icon library inside the product, starting with Azure, so users never have to leave the editor to find an icon.

- **Azure first.** The official Azure architecture icon set is the first cloud library.
- **Generic icons.** Users, browsers, phones, servers, databases, queues and other common shapes for anything that isn't tied to one vendor.
- **Tool logos.** Logos for widely used tools like Kubernetes, Redis, Grafana, Prometheus and Fluentd, used to identify those tools in a diagram.
- **Your own icons.** Users can upload any SVG. Uploaded icons are saved with the diagram in an icons folder and referenced by path, so the repo stays self contained.
- **Search.** One search box across every library, matching names and common aliases, so typing vm finds Virtual Machine.
- **Every preset works on every icon.** State, motion and flow presets apply to built in and uploaded icons alike. What users do with them is their choice.
- **More libraries later.** AWS and Google Cloud follow Azure.
- **Private libraries for enterprises.** Organizations can publish their own icon sets for internal services, visible only to their members.

## Presets and motion

Every visual effect in Mogram is a named preset the user picks from a list, which keeps the editor simple and the file short, since the file stores the preset's name rather than its styling.

| Preset family   | Applies to                | Built in options                                         |
| --------------- | ------------------------- | -------------------------------------------------------- |
| State           | Components and containers | Healthy, degraded, down, scaling, overloaded             |
| Flow            | Connections               | Traffic, slow, blocked, rerouted, idle                   |
| Motion          | Components                | Pulse, bounce, rotate, shake, glow                       |
| Container style | Containers                | One look per container type, like VNet, subnet or region |
| Canvas theme    | The whole diagram         | Background colours, gradients, light and dark            |

**How presets behave**

- Each state preset has a complete built in look, so marking something down needs one click and no styling.
- Flow presets animate traffic along the connection's routed path, with simple options for direction, speed and density.
- Motion applies to the whole icon. Animating parts inside an icon is out of scope for now.
- Advanced options like colour, intensity and speed sit behind an advanced section in the inspector.

**Timing**

- Every animation runs off one shared clock, so the whole diagram moves in sync.
- Preset durations divide evenly, like 1, 2 or 4 seconds, so any scene loops seamlessly. This is what makes GIF exports loop without a visible jump.

## State and scenes

Scenes replace a video timeline: instead of placing changes at exact timestamps, users describe what the system looks like in each situation and Mogram animates between them.

**State**

- Every component, container and connection has a state. With nothing set, everything is in its normal state.
- Changing state means clicking an element and picking from its state presets.
- Marking a container down cascades to everything inside it.
- State inside a container rolls up to the container. By default the worst state inside wins, and authors can override that rule when it doesn't fit their system.

**Scenes**

- A scene is a named snapshot, like normal, traffic spike or region outage. It records only what differs from normal, so it stays short.
- Scenes appear as a strip of thumbnails, like pages in Canva. Users add, rename, duplicate and reorder them.
- Switching scenes animates every change automatically. Users never set keyframes.
- Looping motion like traffic dots and pulses keeps running inside each scene.
- Play runs through scenes in order, which turns a set of scenes into a short story: normal, failure, recovery.
- Scenes can change elements inside nested diagrams by their path, like aks.ingress.

```yaml
scenes:
  region_outage:
    db_primary: down
    app_to_primary: blocked
    db_replica: active
```

A change to a scene in a pull request shows up as a one or two line diff, which is the whole point of keeping scenes this small.

## Cards

Cards put the documentation inside the diagram, attached to the exact element it describes, which removes the gap between a diagram and its README.

- **Open by clicking.** Clicking an element with a card zooms the camera in on it and opens the card beside it. Closing the card zooms back out to the full diagram.
- **Rich content.** A card has a title and a body written in markdown, with formatting, links, code snippets and images.
- **Inline or in the repo.** Short text can live in the diagram file. Longer docs live in their own markdown files and the card points to them by path, like docs/web-vm.md.
- **Links between cards.** A card can link to another element's card. Following the link moves the camera along the connection between them when one exists.
- **No clutter.** Cards stay hidden until opened. Elements with a card show a small, quiet indicator so viewers know there is more to read.
- **Write once, reuse everywhere.** A card belongs to its element, so every tour that passes through that element uses the same card.
- **Linkable.** Every card has its own deep link, so a README or a chat message can open the diagram straight onto one element's explanation.

## Tours

A tour is a guided path through a diagram's cards where the camera physically travels along the connections, so the viewer feels the flow of the system rather than jumping between boxes.

**How a tour plays**

- The viewer starts a tour and the camera zooms to the first element and opens its card.
- Pressing next or the arrow key moves the camera along the connection to the next element, following the same routed path the traffic uses.
- Each step can switch the scene, so moving from the app server to the database can show the database failing and traffic rerouting as the camera travels.
- Closing the tour zooms out to the full diagram.
- Tours cross into nested diagrams, diving into a cluster and back out as the path requires.

**Branching**

- A step can offer choices, like normal read or region outage. Each choice leads to its own next step and can set its own scene.
- This lets one tour answer what happens if questions without separate tours for every case.

**Two modes**

- **Explore** is self paced. Viewers move at their own speed, can wander off to click around, and resume the tour where they left.
- **Present** is for meetings and recordings. It goes fullscreen, hides the editing interface and is driven by the keyboard.

**Authoring**

- Builders create a tour by clicking elements in order in a tour panel, then add choices where the path should branch. No scripting.
- A diagram can have many tours, like how a request flows and what happens during failover, listed for viewers to pick from.
- Every tour step has its own deep link.

```yaml
tours:
  request_flow:
    start: web_vm
    steps:
      web_vm:
        next: storage
      storage:
        choices:
          Normal read: cdn
          Region outage:
            next: db_replica
            scene: region_outage
```

## Nested diagrams and zoom

Any component can open a full diagram of its own, so a system can be explored from the big picture down to the smallest detail in one continuous zoom.

**Linking**

- A subfolder of a diagram is its own diagram. A component opens it by pointing at that folder.
- Nesting works to any depth. Mogram refuses folders that open each other in a loop and explains which folders caused it.

**Crossing the boundary**

- A nested diagram declares named ports, the way a Terraform module declares inputs and outputs. Each port maps to an element inside it.
- Parent connections attach to a port by name, like aks.web, so traffic entering the cluster arrives at the ingress controller inside.
- Inside the nested diagram, the parent's neighbours appear as faded stubs at the edge, labelled with where traffic comes from and goes to.

**The zoom**

- Clicking a component that opens a diagram grows the icon into a frame while the camera pushes in and the inner diagram fades up.
- A traffic dot can follow the flow straight through: into the cluster icon, out of the edge stub, and on to the ingress controller.
- Breadcrumbs show where the viewer is, like Checkout, then AKS cluster. Escape zooms out one level.
- Every level has its own deep link.
- Nested diagrams load only when someone zooms into them, so very large systems stay fast.

**State across levels**

- Marking a component down in the parent puts everything inside its nested diagram down.
- Breaking something inside shows the parent component as degraded, following the same worst state wins rule as containers.

**Reuse**

- Many components can open the same folder. The folder is the blueprint, so changing it updates every place it is used.
- State belongs to each use, not the blueprint. If orders, payments and inventory share one microservice design, breaking the payments database leaves the other two healthy.
- Scenes belong to the diagram telling the story, so breaking a service in one diagram's scene never affects another diagram.

```yaml
# compute.mogram.yaml
components:
  aks:
    type: azure/aks
    opens: ./aks
connections:
  gateway_to_aks:
    from: app_gateway
    to: aks.web

# aks/mogram.yaml
ports:
  web: ingress
```

## Files and repositories

The canvas is how people edit, but the file is the source of truth: clean YAML that reads like a description of the architecture and diffs cleanly in any pull request.

**What makes the file clean**

- Elements are named by people, like web\_vm or db\_primary, never random IDs.
- Presets are referenced by name, never expanded into styling.
- Only values that differ from the defaults are written.
- Architecture sits at the top, and coordinates are kept out of the way in a layout section or file.
- Hand edits survive. Comments and the order of entries are preserved when Mogram saves.

**Extensions and names**

- Both .mogram and .mogram.yaml are supported, with identical contents. Mogram saves as .mogram.yaml by default so GitHub and every editor highlight it as YAML immediately.
- The default file name is mogram.yaml. Repos with several diagrams add a prefix, like checkout.mogram.yaml.

**One file or a folder**

- A diagram can be one file, or a folder where every Mogram file adds to the same diagram, the way Terraform treats .tf files.
- In a folder, mogram.yaml marks it as a diagram and holds settings like the name, theme and icon libraries.
- Names must be unique across all files in a folder. A duplicate gives a clear error that names both files.
- In single file mode, layout sits at the bottom of the file. In folder mode it gets its own layout.mogram.yaml that nobody needs to open.
- Subfolders are nested diagrams. Card markdown lives in a docs folder and uploaded icons in an icons folder.

```
checkout/
  mogram.yaml           name, theme, icon libraries
  network.mogram.yaml   containers
  compute.mogram.yaml   components and connections
  scenes.mogram.yaml
  tours.mogram.yaml
  layout.mogram.yaml    coordinates only
  docs/
    web-vm.md
  icons/
  aks/                  a nested diagram
    mogram.yaml
```

**Where new elements land**

- When someone adds an element on the canvas, Mogram puts it in the same file as its container, or in mogram.yaml if there is no obvious home.
- The inspector shows which file every element lives in, with a move to file option.
- Mogram never reshuffles elements between files on its own, so pull requests never show surprise moves.

**Editing in code**

- People can edit the YAML directly and Mogram picks up the changes.
- An element added in code with no position is placed automatically and marked unpinned until someone drags it.
- Invalid files show clear, plain language errors pointing at the file and line.

## Sharing and the viewer

The share link is the main way a Mogram diagram travels: it opens the live, interactive diagram in any browser, with no sign up for the viewer.

**What viewers can do**

- Pan and zoom freely around the whole diagram.
- Click elements to open their cards.
- Step through the scenes the author created, or play them in order.
- Pick and take a tour in explore mode, or switch to presenting mode.
- Zoom into nested diagrams and back out with breadcrumbs and Escape.

**Advanced viewer options**

- Authors can turn on an option that lets viewers change state themselves, like clicking a component to break it and watching traffic reroute.
- This stays off by default and lives in the advanced share settings.

**Deep links**

- A link can open on a specific scene, card, tour step or nested level.
- This is how READMEs, chat messages and docs point at an exact part of the architecture.

**Keeping links current**

- A share link shows the latest saved version of the diagram, so a link posted months ago still shows the current architecture.

## Exporting

Exports cover slides, docs and social posts, and the options offered depend on whether the diagram has any animation.

| Format        | Offered when              | Notes                                                                             |
| ------------- | ------------------------- | --------------------------------------------------------------------------------- |
| PNG           | Always                    | The default static format. Sharp lines and text, optional transparent background. |
| JPEG          | Always                    | Smaller files for places that need them.                                          |
| SVG           | Always                    | A crisp vector for docs and READMEs.                                              |
| GIF           | The diagram has animation | The default animated format, since it plays almost everywhere.                    |
| Animated WebP | The diagram has animation | Advanced option with better colour and smaller files than GIF.                    |

**Animated export options**

- Loop the current scene, like traffic flowing continuously through the normal state.
- Or play through scenes in order, like normal, then failover, then recovery, as one short story.
- Loops are seamless because every preset shares one clock and evenly dividing durations.
- Users can export the top level diagram or any nested level.

MP4 is not offered. The share link covers rich, interactive viewing instead.

## Accounts, pricing and trust

Mogram is free to use, asks for an account only when someone wants to save to the cloud, and makes money from enterprise licenses.

**Accounts**

- Anyone can open the editor and build a diagram with no account.
- Without an account, users can still open Mogram files from their computer and download their work as files.
- An account is needed to save to the cloud, create share links and keep uploaded icons in Mogram.
- Mogram runs on its own backend and database from the first release.

**Pricing**

- Individuals use Mogram for free.
- Revenue comes from enterprise licenses. Private icon libraries for internal services are the first enterprise feature.

**Trust and security**

- An architecture diagram is a map of someone's infrastructure, so security is a requirement from the first release, not a later phase.
- Diagrams are private by default until their owner shares them.
- Mogram explains clearly where diagrams are stored and who can see them, because enterprise buyers will ask before anything else.

**Brand**

- The product name is Mogram, from motion plus diagram, at mogram.app.
- The GitHub organization, npm package name and social handles should be claimed early.
- A trademark search in Canada and the US should happen before spending on branding.
- Tool logos appear only to identify the tools in a diagram, never to suggest any brand endorses Mogram.

## Release scope and roadmap

The first release is the complete product described in this document. The developer workflow and enterprise features follow it.

&#91;embedded content: Mogram roadmap · 3 phases\]

Phase 1 covers everything above except what the later phases name. Phase 2 brings Mogram into the places developers already work, and phase 3 adds more clouds and what enterprises pay for.

**Suggested build order inside the first release**

1. Editor, icons and the file format, so diagrams can be drawn and saved as clean YAML.
2. Presets, state and scenes, which make diagrams move.
3. Accounts, cloud saving, share links and exports, so diagrams can travel.
4. Cards and tours, which explain the system.
5. Nested diagrams and zoom, which add depth.

Each step leaves a usable product, which keeps a solo build shippable at every stage.

## Success measures

Mogram is working when people build animated diagrams quickly, share them, and keep them in their repositories. Targets for each measure get set after the first round of real users.

| Measure                                               | What it tells us                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Time from first visit to first animated diagram       | Whether the editor is truly as easy as promised                                         |
| Share of new diagrams that include at least one scene | Whether people use state, the core difference from static tools                         |
| Share links created and views per link                | Whether diagrams travel the way the product intends                                     |
| Viewers who open a card or start a tour               | Whether the explanation layer earns its place                                           |
| GIF and WebP exports                                  | How much Mogram spreads through posts and slides                                        |
| Public repositories containing Mogram files           | Whether the file format is being adopted, which also drives GitHub highlighting support |
| Builders who return to edit a diagram within a month  | Whether diagrams stay alive instead of being made once                                  |
| Enterprise inquiries                                  | Whether the business model has demand                                                   |

## Open questions

These decisions are still open and should be settled before or during the first release.

- [ ] How should a diagram appear in a GitHub pull request, given GitHub won't render the format? Options include a GitHub app, a command line tool that renders on commit, or the VS Code extension.
- [ ] What privacy options should share links offer: public, anyone with the link, or only people in an organization?
- [ ] Should share links always show the latest version, or can authors pin a link to a specific version?
- [ ] Should free GIF exports carry a small made with Mogram mark?
- [ ] Which features beyond private icon libraries belong in the enterprise license?
- [ ] Should users be able to save their own custom presets?
- [ ] Should several people be able to edit the same diagram at once?
- [ ] Should diagrams be embeddable in tools like Notion and Confluence?
- [ ] Should state ever be driven by live data from real systems, in a later version?
- [ ] Does the trademark search clear the Mogram name?
