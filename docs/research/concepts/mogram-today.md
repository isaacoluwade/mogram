# What Mogram can show today

A baseline for stage 4: each technique in the vocabulary (see `README.md`) against what Mogram
can already draw, as of Step 26 (2026-10-05). The plans in stage 2 deliberately ignore this; stage
4 compares them with it.

| Technique          | Today  | How, or what's missing                                                                                                                                     |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appear / disappear | no     | Every element is always on screen. Scenes change how things look, not whether they're there.                                                               |
| move               | no     | Positions live in the layout and never change over time.                                                                                                   |
| clone              | no     | —                                                                                                                                                          |
| restyle            | partly | Scenes set state (healthy, active, scaling, degraded, overloaded, down), flow and motion, and hold capacity. Not a label, colour, icon or size per moment. |
| token              | no     | Traffic dots carry no label and aren't individual things.                                                                                                  |
| stream             | yes    | Traffic dots on connections; speed and density; traffic levels and patterns (waves, bursts) that the capacity model follows.                               |
| exchange           | no     | No ordered back-and-forth between parties.                                                                                                                 |
| contents           | partly | Capacity draws a scale set's copies, a machine's cores/memory/disks and a queue's backlog; nothing else holds items.                                       |
| layers             | no     | Can be faked with stacked shapes or containers; nothing moves through them.                                                                                |
| lanes              | no     | Containers can stand in for rows; there's no axis or lane layout.                                                                                          |
| meter              | partly | A load bar per copy and a percentage under scaling elements; no general meter.                                                                             |
| chart              | no     | —                                                                                                                                                          |
| timer              | no     | —                                                                                                                                                          |
| spotlight          | partly | Tours move the camera to an element and dim the rest; scenes and concepts can't.                                                                           |
| path trace         | no     | —                                                                                                                                                          |
| caption            | partly | Cards (opened by a click or a tour step) and static text; nothing timed to a moment.                                                                       |
| side by side       | partly | Two diagrams can share a canvas; nothing keeps them in step.                                                                                               |
| toggle             | yes    | Scenes, picked from the scene strip or chips; links can open a scene.                                                                                      |
| zoom               | yes    | Nested diagrams (`opens:`) with ports and stubs; the camera dives in and out.                                                                              |
| boundary           | yes    | Containers (cloud-aware kinds), groups, shapes.                                                                                                            |
| failure            | yes    | `down` and other states; `blocked` and `rerouted` flows; `backup_for` reroutes when the primary is blocked; capacity overloads.                            |
| choice             | yes    | Tours with choices.                                                                                                                                        |
| dial               | no     | The traffic slider was removed (D-84); patterns make load change on its own.                                                                               |

Also there: a shared clock and deterministic timelines (capacity, patterns) that the editor, the
viewer, thumbnails and exports agree on; cards with markdown; data values in labels; named
styles; themes; GIF/WebP/PNG/SVG export; the assistant.
