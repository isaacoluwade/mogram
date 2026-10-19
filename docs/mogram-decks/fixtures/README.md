# Fixtures

`terraform-course/` is a slice of the real course in the deck format from `../decks-file-format.md`. It is the acceptance test for `../decks.md`: a milestone is done when the part of this deck it carries plays correctly.

It does not read today: `diagnostics-today.txt` is what the working-tree parser said about it on 2026-10-09, and every line there is about something the plan adds. The two scenes that do read today are in the YouTube repo at `videos/2026-10-16-terraform-crash-course/visuals/mogram-proof/`.

| Slide | Folder | What it exercises | First playable at |
| --- | --- | --- | --- |
| 1 | `title` | a page; a still slide; a beat that is only a script; `frame: false` | P2 (P6 for the script) |
| 2 | `terraform_flow` to `applied` | a story in a subfolder; a stretch | P2 |
| 3 | `form_to_code` | an image with regions; code from a file with a slice; connections between parts; focus on parts | P5 |
| 4 | `first_apply` | console output revealed a part at a time | P5 |
| 5 | `reading_a_plan` | plan colours; tone and mark on a part; zoom to a part; text that wraps | P5 |
| 6 | `why_state` | text with a width, placed by a column, shown a point at a time | P4 |
| 7 | `terraform_flow` from `applied` | the same diagram returning in its `from` picture | P2 |
| all | `frame` | the frame under every slide; `%section%`, `%slide%`, `%slides%` | P2 |

Things in it that are placeholders, and say so:

- `code/plan-rename-project.txt` is written by hand in the shape of real plan output. The real one comes from the course's capture run, and the "9" in it is whatever that run prints.
- `code/apply-resource-group.txt` is trimmed from real Terraform 1.16.5 output seen on 9 Oct 2026, with the apply lines added by hand.
- `images/storage-basics.png` is not included.
