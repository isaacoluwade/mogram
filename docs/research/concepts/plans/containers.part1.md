# Containers plans, part 1

Stage 2 plans for `catalog/containers.md` groups 3.1 to 3.4, in catalog order. They use the shared
containers/Kubernetes language that all three `containers.part*.md` files share: an **image** is a
stack of thin layers, each a coloured strip labelled with the Dockerfile line that made it; a
**container** is a running box with a small play glyph, created from an image; a **registry** is a
shelf of images with tags (a tag is a sticky label that can move; a digest is a fingerprint stamped
into the image); a **node** is a large frame (a machine) holding pods; a **pod** is a rounded
capsule holding one or two containers and its own IP; the **control plane** is a separate frame at
the top (API server in the centre, etcd as a cylinder beside it, the scheduler and controllers
around it); **desired state** is a YAML card on the left, **actual state** is the cluster on the
right, and a **reconciliation loop** arrow keeps turning between them, highlighting differences in
amber; a **Service** is a stable badge in front of pods with arrows to the pods whose label tags
match. This part also draws a VM, where it's contrasted with a container, as a box with its own
guest-kernel bar on top of a hypervisor, versus a container box sitting directly on the host's one
shared kernel.

No new technique was needed for this part; everything below uses the existing vocabulary.

## Containers

### Containers vs virtual machines (`container-vs-vm`)

**The aha**: A container is a fenced-off process sharing the host's kernel; a VM virtualises hardware and boots its own guest kernel — that's why containers start in milliseconds and pack densely, while every container on a host still shares one kernel.
**Misconception to defeat**: "Lightweight VMs."
**Cast**: One physical host at the bottom. Left stack: hypervisor strip, three VM boxes each with its own guest-kernel bar and an app on top. Right stack: one host-kernel bar, with container boxes (running box + play glyph) sitting directly on it, each holding only its own app layers.
**Opening frame**: Both stacks at rest on the same hardware. _"Same machine, two ways to divide it."_
**Story**:

1. Zoom into a VM: hardware → hypervisor → guest kernel → app, a ~30s boot timer runs before the VM box lights up.
2. Zoom into a container: hardware → host kernel → app, a ~200ms timer, the box lights almost instantly.
3. Race three of each at once: containers are up and serving before the VMs finish booting.
4. Spotlight the single shared kernel bar on the right. _"Every container on this host depends on this one bar."_
5. Crash that kernel (red flash): every container on the host goes down together. On the left, one VM's guest kernel crashes alone; the other two VMs keep running.
   **The moment**: Beat 5's contrast: one shared failure takes every container with it, while VMs fail in isolation.
   **Interaction**: Replay the boot race; click the shared kernel bar to see which containers depend on it.
   **Ending**: Two labelled stacks side by side. _"VM: its own kernel. Container: a fenced process on the host's."_ Then the right-hand host shrinks into one VM box on a cloud rack: _"In the cloud, the host is usually a VM too."_
   **Variants**: `container-namespaces-cgroups`, `container-orchestration`.
   **Techniques**: side by side, zoom, timer, failure, spotlight, caption.
   **Review**: Improved — kept the shared-kernel crash contrast as the moment; added the ending note that cloud container hosts are themselves VMs (the catalog's point), so the two are shown as layers that combine, not rivals.

### Linux namespaces and cgroups (`container-namespaces-cgroups`)

**The aha**: Namespaces control what a process can see; cgroups control how much it can use — the kernel has no "container" object, only a process wrapped in both.
**Misconception to defeat**: Kubernetes namespaces are the same thing; or that a container is a kernel object.
**Cast**: One host, one plain process box. A dashed fence around it with labelled facets (pid, net, mount, uts, ipc, user, cgroup). Below, cgroup bars for CPU, memory, I/O and process count.
**Opening frame**: The process, unfenced, seeing everything on the host. _"Just a process. For now."_
**Story**:

1. Apply the pid namespace: inside, `ps` collapses to just itself as PID 1; from the host it's still PID 4821. _"It thinks it's alone."_
2. Apply the net namespace: a fresh loopback and veth pair appear; the host's other interfaces disappear from its view.
3. Apply the mount namespace: its filesystem view swaps to a private tree.
4. The fence closes fully. _"Namespaces: what it can see."_
5. The cgroup bars slide in, capped at 0.5 core and 512Mi. A CPU-hungry loop hits the cap and is throttled (slowed, still alive). Then the process over-allocates memory; the bar fills and it's OOM-killed. _"Cgroups: what it can use. CPU slows it. Memory kills it."_
6. Zoom out: no "container" shape exists anywhere in the kernel — just this one process, fenced and capped. _"A container is a label we give to this."_
   **The moment**: Beat 6, zooming out to find no container object at all, only the fence and the bars.
   **Interaction**: Toggle each namespace facet off to see what reappears; drag the memory cgroup down and watch the OOM-kill happen sooner.
   **Ending**: Fence and bars labelled, one process inside both.
   **Variants**: `container-vs-vm`, `container-isolation-hardening`, `k8s-namespaces` (contrast).
   **Techniques**: boundary, contents, restyle, failure, dial, caption.
   **Review**: Improved — added the cgroup namespace facet and the CPU-throttles-but-memory-kills contrast (a true, commonly surprising difference); the "no container object in the kernel" zoom-out stays as the moment.

### Container runtimes and OCI standards (`container-runtimes-oci`)

**The aha**: Any OCI-compliant image runs on any OCI-compliant runtime — Docker is one toolchain on a standard, swappable stack.
**Misconception to defeat**: "Docker" and "containers" are the same thing.
**Cast**: A vertical stack: image (OCI image-spec) on top, a high-level runtime slot (containerd/CRI-O), a low-level runtime slot (runc/crun), kernel at the bottom.
**Opening frame**: Full stack assembled, containerd and runc labelled in their slots. _"A layered stack, not one tool."_
**Story**:

1. An image built by `docker build` drops onto the stack; containerd unpacks it and hands runc a bundle; runc creates the namespaces and cgroups, starts the process and steps aside; play glyph appears. A small "Docker Engine" box is seen sitting on top of the same containerd. _"Docker itself runs on this stack."_
2. Swap containerd for CRI-O in the high-level slot; the same image flows through, same container starts. _"Swap the high-level runtime..."_
3. Swap runc for crun; same result. _"...or the low-level one. Nothing upstream changes."_
4. A small vignette: the old "dockershim" box fades out of a Kubernetes diagram, replaced by a direct CRI link to containerd. _"Kubernetes dropped Docker Engine. Docker-built images kept running."_
5. Three spec badges bracket the stack: image-spec, runtime-spec, distribution-spec (pointing at a registry).
   **The moment**: Beats 2–3, swapping runtimes mid-stack with no visible change to the running container.
   **Interaction**: Pick any high-level/low-level runtime pair from a dropdown and rerun the same image.
   **Ending**: Stack settled on containerd + runc, all three OCI badges lit.
   **Variants**: `container-vs-vm`, `k8s-extension-interfaces`.
   **Techniques**: layers, clone, restyle, spotlight, caption.
   **Review**: Improved — beat 1 now shows the real hand-off (runtime unpacks, runc creates and steps aside) and that Docker Engine itself sits on containerd, which makes "Docker is one toolchain" concrete; the swap-the-slot moment and the dockershim vignette (removed in Kubernetes 1.24) are correct and stay.

### Container isolation and sandboxing (`container-isolation-hardening`)

**The aha**: Isolation is a dial, not a switch, running from "basically root on the host" to "near-VM separation."
**Misconception to defeat**: A container simply "is" isolated.
**Cast**: A horizontal slider with five stops: Privileged, Default, Hardened, Rootless, Sandboxed/micro-VM. Above it, a container box; below, the shared host kernel with a shrinking "blast radius" circle.
**Opening frame**: Dial at Privileged, blast radius covering the whole kernel. _"Almost root on the host."_
**Story**:
Each stop keeps everything before it and adds a layer of defence. Two attacks wait at the side: **A** "mount the host disk and write to it" (needs privilege), **B** "exploit a kernel bug through an ordinary syscall".

1. Move to Default: radius shrinks slightly; a few capability icons stay lit. (Docker's default also filters syscalls with seccomp; Kubernetes pods start unconfined unless `seccompProfile: RuntimeDefault` is set.)
2. Move to Hardened: capabilities drop one by one, a seccomp mesh appears over the syscalls, an AppArmor/SELinux badge locks on; radius shrinks further.
3. Move to Rootless: the container's "root" relabels to an unprivileged host UID via a mapping arrow; radius shrinks more.
4. Move to Sandboxed: the box gets its own kernel bubble (gVisor) or micro-VM shell (Kata/Firecracker); radius collapses to just that bubble.
5. Fire both attacks at every stop. A succeeds at Privileged and dies at Default or Hardened. B still escapes at Hardened and Rootless, because the kernel is shared and the syscall is allowed; only at Sandboxed does it hit the bubble wall.
   **The moment**: Beat 5's attack B walking straight through every hardening stop and stopping only at the sandbox wall, with the cost meter ticking up alongside. Hardening shrinks what's allowed; only a separate kernel contains a kernel bug.
   **Interaction**: Drag the dial; fire the breakout at any stop; a RuntimeClass selector shows which Kubernetes field picks each sandboxed option.
   **Ending**: Dial parked at Hardened. _"Choose your blast radius."_
   **Variants**: `container-vs-vm`, `container-namespaces-cgroups`, `k8s-security-context`, `k8s-pod-security-standards`.
   **Techniques**: dial, boundary, failure, restyle, spotlight, caption.
   **Review**: Improved — one identical attack made hardening look like a complete fix; two attacks (privilege abuse vs kernel bug) now show what hardening does and does not stop, which is the real reason sandboxes exist. Added the Docker-vs-Kubernetes seccomp default difference.

### Container data: volumes, bind mounts (`container-data-persistence`)

**The aha**: A container's writable layer is disposable; anything that must survive belongs in a volume or bind mount living outside the container.
**Misconception to defeat**: Image layers are where you can save data.
**Cast**: A container box with a thin writable-layer strip on its image layers. Beside it, outside the box: a named-volume cylinder, a bind-mount folder pointing at the host disk, a tmpfs cloud icon.
**Opening frame**: Container running, writable layer empty. _"Everything written here — for now."_
**Story**:

1. The app writes `/data/counter.txt`; a mark appears in the writable layer.
2. The container is deleted (box disappears). The writable layer, and the file, vanish with it. _"Delete the container, lose the write."_
3. Rewind: mount a named volume at `/data` first. The same write now travels out of the box into the volume cylinder, outside the container.
4. Delete the container again: the box disappears, the volume survives, file intact. A new container mounts the same volume and reads it back.
5. Footnote: a bind mount does the same, pointed at a host folder; a tmpfs mount lives in memory and is gone as soon as the container stops. (The writable layer survives a stop and restart, but not removal.)
   **The moment**: Beat 2 versus beat 4: the identical delete action, opposite outcome, purely because of where the write landed.
   **Interaction**: Toggle "with volume / without," then delete the container either way.
   **Ending**: A volume cylinder surviving three successive deletions, each new container reattaching to it.
   **Variants**: `container-image-layers`, `k8s-volumes`, `k8s-persistent-volumes`.
   **Techniques**: contents, move, failure, side by side, toggle, caption.
   **Review**: Improved — fixed the tmpfs footnote (it is memory-backed and ends with the container, not "on reboot") and the stop-vs-remove nuance of the writable layer; the delete-twice contrast stays as the moment.

### Docker Compose (`container-compose`)

**The aha**: Compose starts several containers together on one host, wired onto a shared private network, with no self-healing — one command for a whole local app.
**Misconception to defeat**: Compose is a mini-Kubernetes.
**Cast**: One host box. Inside, a dashed "compose network" holding three containers: `web`, `api`, `db` (with a volume cylinder on `db`). A `compose.yaml` card on the left. A client arrow reaching only `web`'s published port.
**Opening frame**: compose.yaml beside an empty host. _"One file, one host, several services."_
**Story**:

1. `docker compose up`: the three containers appear inside the network, each addressable by its service name.
2. `web` calls `http://api:3000`: a token travels by name across the network, no IP needed.
3. The client tries `db` directly: no published port, bounces at the host wall. It reaches `web` on its mapped `8080:80`: succeeds.
4. A Dockerfile's `EXPOSE 5432` on `db` is highlighted — but nothing changes for the client. _"Documentation, not a doorway."_
5. `api`'s process is killed by hand: it greys out and stays dead (no `restart:` policy set). _"Nothing is watching."_ Then the whole host box crashes: even `restart: always` can't help, because there is nowhere else to go. _"One host. No second chance."_
   **The moment**: Beat 5, the dead container sitting there forever, then the whole host going dark — what orchestration exists to fix. (A `restart:` policy can restart a crashed container in place on the same host; that is the limit of Compose's healing.)
   **Interaction**: Click a port to try reaching it from outside; kill a container and watch nothing happen.
   **Ending**: `api` still dead, everything else running, host boundary intact.
   **Variants**: `container-orchestration`, `container-image`; contrast `k8s-service`.
   **Techniques**: boundary, token, contents, failure, caption.
   **Review**: Improved — "Compose doesn't heal failures" was too absolute (restart policies exist); the beat now separates a killed container with no policy from a dead host, which is the true line between Compose and an orchestrator.

### Container orchestration (`container-orchestration`)

**The aha**: An orchestrator turns many machines into one pool and keeps your declared number of healthy containers running, all the time.
**Misconception to defeat**: Containerising an app (packaging) is the same job as orchestrating it (running it at scale).
**Cast**: Three host machines in a row. A "brain" icon above holding a declared count, `web: 4`. Four container boxes spread across the hosts.
**Opening frame**: 4 containers spread 2/1/1, brain watching. _"4 declared, 4 running."_
**Story**:

1. A host crashes (red flash, its 2 containers grey). Count drops to 2; the gap highlights amber.
2. The brain places 2 replacements on the surviving hosts. Count returns to 4. _"It restarts failed ones, wherever there's room."_
3. Declared count is raised 4 → 6: two new containers appear on hosts with spare capacity. _"It scales them."_
4. Client requests are spread across the healthy containers wherever they sit, never to the dead one. _"...and load-balances."_
5. A new image version rolls in one or two containers at a time, the count never dropping below 5 of 6. _"...and rolls out updates without downtime."_
6. Inset: `container-compose`'s single host with its dead, unhealed container. _"A single host can't do this."_
   **The moment**: Beats 1–2, the silent, automatic recovery onto other machines after a host dies.
   **Interaction**: Click a host to crash it; drag the replica count.
   **Ending**: 6 containers spread evenly across three healthy hosts, brain idle.
   **Variants**: `container-compose`, `k8s-cluster-architecture`, `k8s-reconciliation-loop`, `k8s-deployment`.
   **Techniques**: contents, failure, clone, meter, dial, token, caption.
   **Review**: Improved — "routed to the least-loaded container" is not what Kubernetes does (it spreads connections across ready pods), so beat 4 now says "spread across healthy ones"; beat 5 states its count. The silent recovery onto other machines stays as the moment.

## Images, builds and registries

### Container image (`container-image`)

**The aha**: An image is an unchanging snapshot of a filesystem and its metadata; a container is a running instance of it — one image, many identical containers, on any machine.
**Misconception to defeat**: Image and container are the same thing, or it's like a VM image.
**Cast**: An image stack (shared layers language) on a shelf with a metadata card (entrypoint, env, ports). Three container boxes beside it, each with "created from" arrows pointing back up at the same stack.
**Opening frame**: One image stack, no containers yet. _"A snapshot, frozen."_
**Story**:

1. `docker run myapp` three times: three container boxes clone in, each with its own play glyph and its own thin writable sliver, all pointing up at `myapp`.
2. One container writes a file (its sliver marks); the image stack underneath doesn't change at all. _"Containers change. The image never does."_
3. One container is deleted; the image sits untouched, the other two keep running.
4. The whole image stack moves to a second machine; `docker run` there spins up an identical fourth container. _"One image, any machine."_
5. The metadata card expands: entrypoint, environment, declared ports (documentation only) — inherited by every container made from it.
   **The moment**: Beat 2, three containers diverging in their writable layers while the shared image stays frozen underneath all of them.
   **Interaction**: Spawn and delete containers from the same image and watch it never change.
   **Ending**: Four containers on two machines, all pointing up at one unchanged image.
   **Variants**: `container-image-layers`, `container-dockerfile`, `container-registry`.
   **Techniques**: clone, contents, move, caption.
   **Review**: Keep — the image-frozen/containers-diverge contrast is the cleanest framing; only the metadata card's ports wording was tightened.

### Image layers and copy-on-write (`container-image-layers`)

**The aha**: Layers are named by the hash of their contents and shared across images; they only ever add, so deleting a file in a later layer hides it rather than shrinking the image.
**Misconception to defeat**: Deleting a file in the Dockerfile shrinks the image.
**Cast**: Two image stacks built `FROM` the same base, the shared base layers drawn once and bracketed under both. Each stack's own layers are coloured strips labelled with the Dockerfile line that produced them.
**Opening frame**: One shared base bracketed beneath two diverging stacks. _"Named by the hash of their contents."_
**Story**:

1. Both images pull the same base layer; a disk meter shows it stored once, satisfying both stacks.
2. Each stack adds its own distinct strip (`COPY app.py .` on one, something else on the other) on top of the shared base.
3. Stack A had an earlier `RUN` that left a 200 MB `/tmp/cache`. Now it runs `RUN rm -r /tmp/cache`: a new, tiny strip is added on top — not a shrink — holding a "whiteout" marker that masks the file in the union filesystem. The size meter ticks up slightly, not down. _"A delete is a new layer that hides a file. The bytes are still there."_
4. A container is run from stack A; a thin writable layer appears, and writing to a file that lives in a lower layer copies it up first (copy-on-write flash) before the change lands in the writable layer.
5. Overlay zoom: the stacked layers merge into one visible filesystem, the masked file truly absent from view — peel the layers back and it's underneath.
   **The moment**: Beat 3, the size meter rising right after a `rm`, directly contradicting the instinct that deletions shrink an image.
   **Interaction**: Peel layers off one at a time to find the hidden file; drag a new image's base onto an existing stack and watch the meter not move.
   **Ending**: Two stacks, one shared base stored once, a size meter bigger than expected.
   **Variants**: `container-image`, `container-build-cache`, `container-multi-stage-build`.
   **Techniques**: layers, contents, clone, meter, zoom, caption.
   **Review**: Improved — the `rm` now follows a layer that actually created the file (otherwise there is nothing to hide), shows the whiteout marker, and copy-up uses a visible lower-layer file (a masked file can't be written to). The size-goes-up-after-rm moment stays; a one-line pointer to the `RUN a && rm` in one layer fix would sit well in `container-build-cache`.

### Dockerfile (`container-dockerfile`)

**The aha**: A Dockerfile turns the environment into code; `ENTRYPOINT` is what runs, `CMD` is its overridable default arguments.
**Misconception to defeat**: `ENTRYPOINT` and `CMD` do the same thing; the build context is the image's contents.
**Cast**: A Dockerfile card with lines `FROM`, `RUN`, `COPY`, `ENV`, `USER`, `EXPOSE`, `ENTRYPOINT`, `CMD`. A builder gear (BuildKit) consuming a build-context folder, producing the image stack below, each layer tagged with the line that made it.
**Opening frame**: Dockerfile and build context idle, builder waiting. _"A recipe, not a description."_
**Story**:

1. The builder runs top to bottom; each instruction lights up and a matching layer appears below it.
2. `ENTRYPOINT ["python","app.py"]` and `CMD ["--debug"]` light together, assembling into "python app.py --debug" beneath them.
3. The container runs with no override: exactly that command.
4. Run again with `docker run myimg --prod`: whatever follows the image name replaces `CMD`'s `--debug`; `ENTRYPOINT` stays fixed, now running `python app.py --prod`. _"Arguments replace CMD. The program stays."_ (Replacing ENTRYPOINT takes a deliberate `--entrypoint` flag.)
5. Beside it, a Kubernetes Pod spec highlights `command:` and `args:` mapping onto `ENTRYPOINT` and `CMD`.
6. The build context folder is shown with only the files `COPY` named going into the image; the rest stays outside. _"The context is what the builder can see, not what ships."_
   **The moment**: Beat 4, overriding only the arguments while the entrypoint program stays fixed.
   **Interaction**: Edit the override text and rerun; swap `ENTRYPOINT` and `CMD`'s positions and watch the broken command it produces.
   **Ending**: Dockerfile, image stack and the Kubernetes mapping all on screen together.
   **Variants**: `container-image-layers`, `container-build-cache`, `k8s-pod`.
   **Techniques**: layers, token, restyle, side by side, caption.
   **Review**: Improved — "ENTRYPOINT you can't override" was wrong (`--entrypoint` does); the contrast is now arguments-replace-CMD. Replaced the overclaiming "same file, same result anywhere" (base tags and package installs drift) with the build-context misconception the plan itself lists.

### Build cache (`container-build-cache`)

**The aha**: The builder reuses a layer only while its instruction and inputs are unchanged, so ordering instructions least- to most-often-changing turns a code edit into a seconds-long rebuild.
**Misconception to defeat**: "The cache" is the same thing as the image's stored layers.
**Cast**: Two Dockerfiles side by side. Left ("naive"): `COPY . .` then `RUN pip install`. Right ("ordered"): `COPY requirements.txt .`, `RUN pip install`, then `COPY . .`. Each line maps to a layer strip with a hit/miss badge.
**Opening frame**: Both built once, all layers green. _"First build: nothing to reuse."_
**Story**:

1. One line of application source is edited (not requirements). Trigger both builds.
2. Left: `COPY . .` sees changed input, turns red; because it precedes `RUN pip install`, that layer also reruns from scratch — timer: 45s.
3. Right: `COPY requirements.txt .` and `RUN pip install` stay green (unchanged); only the final `COPY . .` turns red — timer: 2s.
4. The timers freeze side by side: 45s versus 2s. _"Same one-line edit, 20x the wait on the left."_
5. A rule sweeps down from the first red badge to everything below it: "a layer rebuilds if it, or anything before it, changed."
   **The moment**: Beat 4's frozen timers from literally the same edit.
   **Interaction**: Edit either file and watch which layers go red; reorder the right Dockerfile and watch the cache behaviour change.
   **Ending**: Right side, green-green-red, 2s rebuild.
   **Variants**: `container-image-layers`, `container-dockerfile`, `container-multi-stage-build`.
   **Techniques**: layers, restyle, timer, side by side, caption.
   **Review**: Keep — identical edit, 45s versus 2s, is the sharpest possible framing, and the invalidate-everything-below rule matches how the builder works.

### Multi-stage builds and minimal base images (`container-multi-stage-build`)

**The aha**: Build tools are needed to make the app, not to run it — a multi-stage Dockerfile copies only the finished artifact into a minimal runtime base.
**Misconception to defeat**: Alpine alone makes an image minimal; multi-stage just means two Dockerfiles.
**Cast**: A tall "builder stage" stack (`FROM golang:1.25`, SDK, compiler, source) and a short "runtime stage" stack (`FROM scratch`/distroless, almost empty), with a `COPY --from=builder` arrow crossing from the builder's top artifact into the runtime stack.
**Opening frame**: Builder stack heavy (1.2 GB), runtime stack empty, both labelled with their `FROM` line. _"Two stages, one Dockerfile."_
**Story**:

1. The builder stage runs: SDK and compiler layers stack up, a single compiled binary glows at the top.
2. The `COPY --from=builder` arrow lifts only that binary into the runtime stack, as its one real layer.
3. The builder stage fades to translucent, discarded — its SDK, compiler and source never ship. Size meter: 15 MB.
4. A shell is searched for in the runtime stack: none found. An attacker's `exec /bin/sh` bounces, nothing there.
5. Footnote: a single-stage `golang:alpine` image is smaller than the Debian SDK but still ~300 MB, with compiler, package manager and shell. And even a tiny Alpine runtime base still has `sh` and `apk`. _"Small is not the same as minimal."_ (A `scratch` image also has no CA certificates or timezone data; copy them in.)
   **The moment**: Beats 3–4, the entire builder stage evaporating, leaving a 15 MB image with no shell to break into.
   **Interaction**: Toggle the runtime base (scratch, distroless, alpine, slim) and watch size and shell availability change.
   **Ending**: Runtime stack alone, 15 MB, no shell, binary inside.
   **Variants**: `container-image-layers`, `container-build-cache`, `container-isolation-hardening`.
   **Techniques**: layers, move, restyle, meter, failure, side by side, caption.
   **Review**: Improved — the old Alpine figure (120 MB) was wrong (Alpine's base is ~8 MB), which weakened the "Alpine isn't minimal" point; it now argues from shell and package manager, not size. Updated the example Go base tag and noted scratch's missing CA certs. The builder-evaporates moment stays.

### Multi-platform images (`container-multi-platform-image`)

**The aha**: A multi-platform tag points to an index listing one manifest per OS/architecture; the runtime pulls only the variant that matches its own machine.
**Misconception to defeat**: A tag names one image.
**Cast**: A tag "myapp:1.4" above a branching index with two branches, each a full image stack with its own digest: `linux/amd64` and `linux/arm64`. An Intel laptop and an ARM node below.
**Opening frame**: Tag pointing at the index, index branching into two stacks. _"The tag is a menu, not an image."_
**Story**:

1. The laptop pulls `myapp:1.4`: tag → index → amd64 branch; only that stack downloads, its digest stamped into the pulled image.
2. The ARM node pulls the same tag: tag → index → arm64 branch; different bytes, same tag name.
3. Force the ARM node to pull an amd64-only image built without an index: the container crashes instantly with "exec format error."
4. Rewind to the build step: both branches built natively, or with cross-compilation/emulation, feeding into one index.
5. Zoom out: the index itself has its own digest, bracketing both architecture digests beneath it.
   **The moment**: Beat 3's instant crash right after two clean pulls, proving the tag alone guarantees nothing about compatibility.
   **Interaction**: Pick a machine architecture and watch which branch is pulled; force a single-arch image onto the "wrong" machine.
   **Ending**: Both machines running correctly, identical tag, different bytes underneath.
   **Variants**: `container-tags-vs-digests`, `container-registry`, `container-image-layers`.
   **Techniques**: layers, token, failure, zoom, caption.
   **Review**: Keep — "the tag is a menu", then an instant exec-format-error on the wrong architecture, is accurate and memorable (the failure assumes no QEMU binfmt emulation on the node).

### Container registry (`container-registry`)

**The aha**: Build once, push to a registry, pull anywhere — layers move by digest, so a pull downloads only what the host doesn't already have.
**Misconception to defeat**: Registry and repository are the same thing; it's like a Git repository.
**Cast**: A registry shelf (shared language) with separate repository sections (`myapp`, `nginx`, `redis`), each holding tagged image stacks. A build machine pushing up on the left, two deploy hosts pulling down on the right.
**Opening frame**: Shelf with three repositories, a couple of tagged stacks each. _"Push once, pull from anywhere."_
**Story**:

1. The build machine pushes `myapp:2.0`: the stack travels up layer by layer into the `myapp` section, tag attached. Layers the registry already holds are skipped ("already exists").
2. Host A pulls `myapp:2.0`: it already has the base layers from an earlier pull (greyed, "already have it"); only the new top layers transfer.
3. Host B, pulling for the first time, downloads every layer — the full, slower transfer.
4. A Helm chart card is pushed onto the same shelf beside the image stacks. _"Registries hold more than images."_
5. Zoom out to several registries (Docker Hub, GHCR, a cloud registry) behaving the same way.
   **The moment**: Beat 2, host A skipping already-cached layers while host B pulls everything, making "digest-addressed, only the diff" concrete.
   **Interaction**: Clear a host's cache and re-pull to see every layer transfer again; push a new version and watch only the changed top layers move.
   **Ending**: Both hosts running `myapp:2.0`, pulled from the one stored copy on the shelf.
   **Variants**: `container-tags-vs-digests`, `container-image-layers`, `container-multi-platform-image`.
   **Techniques**: contents, move, meter, restyle, caption.
   **Review**: Improved — added that push also skips layers the registry has, so "only the diff" holds in both directions; the host A versus host B pull contrast stays as the moment.

### Tags vs digests (`container-tags-vs-digests`)

**The aha**: A tag is a movable sticky label; a digest is a fingerprint stamped into the image itself — only the digest always names the exact same bytes.
**Misconception to defeat**: `latest` means newest; a digest is just another version string.
**Cast**: One repository, two image stacks X and Y. A "latest" sticky label currently on X, which also carries a "1.4" label and a fingerprint stamp (`@sha256:ab12…`). Stack Y has its own stamp.
**Opening frame**: X carrying "latest", "1.4" and its fingerprint. _"Right now, three names, one image."_
**Story**:

1. A new build produces Y with its own fingerprint. Someone re-pushes `latest`; the sticky label peels off X and re-sticks onto Y. X keeps "1.4" and its own fingerprint, untouched.
2. Same trap with a version tag: `1.4` is re-pushed (a "quick fix") and now points at Y too. Node 1 already cached `myapp:1.4` (X). Pod specs with a non-`latest` tag default to `imagePullPolicy: IfNotPresent`, so Node 1 sees the tag present and keeps running X. Node 2 is new and pulls Y. Two nodes, one tag, different code. (Only `:latest` or no tag defaults to `Always`.)
3. Contrast: a deploy pinned to `@sha256:ab12…` always resolves to X, no matter how many times either tag moves.
4. A summary card: tags "can move"; digests "can't — named by content." `latest` is just a tag name, not "newest".
   **The moment**: Beat 2, two nodes nominally running "the same image" turning out to run different code, because of a moved tag and a cache policy.
   **Interaction**: Drag "1.4" and "latest" between the stacks and watch which digest each node resolves; toggle `imagePullPolicy` between `Always` and `IfNotPresent`.
   **Ending**: A deploy pinned to a digest, immune to any future tag move.
   **Variants**: `container-registry`, `container-multi-platform-image`, `k8s-rolling-update-rollback`.
   **Techniques**: move, restyle, token, side by side, caption.
   **Review**: Improved — the original used `latest` with `IfNotPresent`, but Kubernetes defaults `latest` to `Always`, so the trap would not occur by default. Rebuilt around a re-pushed `1.4` tag, where the default really is `IfNotPresent` — the realistic version of the same failure.

## Kubernetes architecture and the API model

### Kubernetes cluster architecture (`k8s-cluster-architecture`)

**The aha**: Every component talks only to the API server — `kubectl apply` records desired state, the scheduler picks a node, and the kubelet on that node actually starts the containers.
**Misconception to defeat**: "Master/worker" as commanding machines directly, or kubectl talking to nodes.
**Cast**: Control plane frame (API server centre, etcd cylinder, scheduler and controller-manager around it). Two node frames below, each with a kubelet and kube-proxy icon and pod capsules. A kubectl icon on the left, one arrow into the API server.
**Opening frame**: kubectl, control plane, two empty node frames, one arrow from kubectl to the API server. _"One door in."_
**Story**:

1. `kubectl apply -f deploy.yaml` travels straight to the API server, which writes the object into etcd (cylinder flashes).
   1b. The controller manager, watching the API server, sees a new Deployment and writes a ReplicaSet, then a Pod object, back through the API server. Still no container anywhere. _"Objects first. Containers last."_
2. The scheduler, watching the API server, spots the unscheduled pod, picks Node B, writes that decision back — never touching the node directly.
3. Node B's kubelet, watching the API server, sees the assignment, pulls the image, starts the container; a pod capsule appears in Node B's frame.
4. The kubelet reports status back up to the API server, which writes it to etcd. _"Every arrow touches the API server. Nothing talks directly to anything else."_
5. CoreDNS and a CNI add-on fade in, quietly doing the same thing: just API clients. kube-proxy on each node is highlighted last: it watches Services and keeps node networking rules in step.
   **The moment**: Beat 3, tracing one pod's whole journey and noticing every hop passes back through the API server.
   **Interaction**: Click any component to highlight only its own arrows to the API server.
   **Ending**: All arrows converging on the API server like spokes.
   **Variants**: `k8s-api-server-etcd`, `k8s-scheduler`, `k8s-kubelet`, `k8s-declarative-objects`, `k8s-reconciliation-loop`.
   **Techniques**: boundary, token, spotlight, caption.
   **Review**: Improved — `kubectl apply` of a Deployment creates no Pod; the controller manager must first write the ReplicaSet and Pod objects, so the story skipped the step that shows controllers are API clients too (added as beat 1b, renumber on build). Added kube-proxy to the spoke picture.

### API server and etcd (`k8s-api-server-etcd`)

**The aha**: etcd is the cluster's single source of truth, and the API server is the only thing that ever talks to it, after authenticating, authorizing and admitting the request.
**Misconception to defeat**: kubectl or other components read etcd directly; etcd is just another app database.
**Cast**: API server box with four gates (authn, authz, admission, write). Beside it, the etcd cylinder with a small ring of three Raft replica dots. Many client arrows (kubectl, scheduler, kubelet) converging only on the first gate.
**Opening frame**: All arrows hitting gate one, etcd sealed on the far side. _"One way in. One place state lives."_
**Story**:

1. A request passes gate 1 (a certificate checked, green).
2. Gate 2: an RBAC check, passes.
3. Gate 3: a mutating pass, then validating, tints the object.
4. Gate 4: written into etcd — the leader replicates; as soon as 2 of 3 Raft dots acknowledge, the cylinder flashes "committed."
5. An unauthorized request is stopped at gate 2, bounces red, never reaches etcd.
6. One etcd replica dot goes dark; writes continue on 2 of 3. A second goes dark; the ring freezes and new writes are refused: the control plane can no longer change anything. Pods already running on the nodes keep serving. _"Lose quorum and the cluster can't change or heal. What's running keeps running, for now."_
   **The moment**: Beat 6, the control plane freezing the instant etcd loses quorum, after surviving every earlier individual failure, while the nodes underneath carry on unaware.
   **Interaction**: Kill replica dots one at a time to find the quorum line; send a request that fails at each gate.
   **Ending**: Ring restored to 3 of 3, control plane calm.
   **Variants**: `k8s-cluster-architecture`, `k8s-api-access-control`, `k8s-rbac`.
   **Techniques**: token, boundary, failure, restyle, caption.
   **Review**: Improved — fixed two overstatements: a Raft write commits on a majority (not all three), and losing quorum freezes the control plane but does not stop running pods. The true version is a sharper lesson (nothing can change or self-heal). Gate order (authn, authz, mutating admission, validation, persist) was right.

### Scheduler (`k8s-scheduler`)

**The aha**: The scheduler only decides where a pod goes, by filtering and scoring nodes on requested resources, not actual usage — it never starts a container.
**Misconception to defeat**: The scheduler runs the pod, or reacts to current load.
**Cast**: A scheduler icon in the control plane. Three node frames below, each with a "requested" meter and a separate, divergent "actual usage" ghost meter. A pending pod capsule floats, unassigned.
**Opening frame**: Node A shows requested 90% / actual 20%; the pending pod floats above. _"It decides by what's requested, not what's used."_
**Story**:

1. Filtering: nodes without enough requested capacity dim out. Node A is filtered out even though it looks idle, because its requested capacity is nearly full. _"It looks idle. It's full on paper."_
2. Remaining nodes get numeric scores based on balance and affinity preferences.
3. The highest scorer is picked; a binding arrow draws to it, and the pod's spec is updated in the API server — not moved by the scheduler itself.
4. On the winning node, the kubelet now notices the binding and starts the container; the pod capsule drops in, play glyph appears. _"The scheduler decided. The kubelet does the work."_
5. A tooltip on Node A repeats "requested: 90% / actual: 20%." Then a pod bigger than any node's free requests arrives: every node dims in the filter step, and the pod sits in Pending with "0/3 nodes are available." _"No fit, no placement."_
   **The moment**: Beat 1, filtering out a visibly idle-looking node because the scheduler only ever sees requests.
   **Interaction**: Drag the new pod's resource request and see which nodes still fit; hold a node's actual usage low with requests high and watch it still get filtered out.
   **Ending**: Pod running on the winning node, scheduler idle, waiting for the next pending pod.
   **Variants**: `k8s-kubelet`, `k8s-requests-limits`, `k8s-node-affinity`, `k8s-qos-eviction`.
   **Techniques**: meter, spotlight, restyle, token, caption.
   **Review**: Improved — added the unschedulable ending (Pending, FailedScheduling), the visible result of filter-then-score failing and the hook into the cluster autoscaler. The filtered-out-but-idle node moment is correct and stays; "binding" is a Binding object that sets the pod's node, as shown.

### Kubelet (`k8s-kubelet`)

**The aha**: The kubelet is where desired state turns into real processes; when its heartbeats stop, the node is marked NotReady and its pods are eventually replaced elsewhere.
**Misconception to defeat**: The kubelet is just networking; the scheduler starts containers.
**Cast**: One node frame with a kubelet icon and a heartbeat pulse line running up to the control plane. A pod capsule, just bound by the scheduler, sitting unstarted.
**Opening frame**: An unstarted pod capsule in the node frame, heartbeat line steady. _"Assigned here. Not running yet."_
**Story**:

1. The kubelet notices the assignment, mounts the volumes, then asks the runtime through CRI to pull the image and start the container — play glyph appears.
2. It runs the readiness probe.
3. It reports pod status and sends a node heartbeat (a Lease renewed about every 10s) up the line.
4. The node's network is cut (failure flash): the heartbeat flatlines. After about 50s the node controller flips the node Ready → NotReady and taints it unreachable.
5. Pods tolerate that taint for 300s by default. Only then does a controller (not the kubelet, which is unreachable) evict them; replacements spin up on healthy node frames. The original node, with its orphaned pod, fades to grey.
   **The moment**: Beats 4–5, the heartbeat stopping and the rest of the cluster routing around the silence after a wait, without ever confirming the old pod actually died.
   **Interaction**: Cut and restore the heartbeat line at will; adjust the NotReady grace period.
   **Ending**: New pods running elsewhere, the old node still grey and isolated.
   **Variants**: `k8s-scheduler`, `k8s-pod-lifecycle`, `k8s-cluster-autoscaler`.
   **Techniques**: timer, failure, restyle, token, caption.
   **Review**: Improved — gave the silence real numbers (Lease heartbeat ~10s, NotReady after ~50s, default 300s toleration before eviction), fixed the start order (volumes before containers) and named the node controller as the one acting. The "routing around silence without knowing the pod died" moment is right; this is also why a StatefulSet pod isn't recreated at once.

### Objects, manifests and desired state (`k8s-declarative-objects`)

**The aha**: You describe the result you want, not the steps to get there, and applying the same manifest twice changes nothing.
**Misconception to defeat**: Imperative commands are the "real" way; spec and status are the same field.
**Cast**: A desired-state YAML card on the left (`spec: replicas: 3`). The cluster on the right with 3 pod capsules. A separate `status:` sub-card attached to the live object.
**Opening frame**: YAML says 3, cluster shows 3, status reads "readyReplicas: 3." _"What you asked for. What's true."_
**Story**:

1. `kubectl apply -f deploy.yaml` is run again, unchanged: nothing moves. _"Apply the same file twice: nothing happens."_
2. Someone runs `kubectl scale --replicas=5` directly: the cluster jumps to 5, but the YAML on disk still says 3 — a mismatch glows amber between file and live spec.
3. The unchanged YAML is re-applied from Git: `kubectl apply` re-asserts every field the file names, so live spec snaps back to 3 and two pods are removed. _"The file didn't know about the manual change. It won."_ (Fields the file doesn't mention are left alone. With server-side apply, the scale would instead show up as a field-ownership conflict.)
4. The status card is shown updating continuously on its own, while spec only moves when someone explicitly edits it.
   **The moment**: Beat 3, the imperative scale-up quietly overwritten the next time the declarative file is applied.
   **Interaction**: Edit the YAML's replica count and apply; separately, scale imperatively then re-apply the old YAML.
   **Ending**: YAML and live spec back in sync at 3, status confirming 3 ready.
   **Variants**: `k8s-reconciliation-loop`, `k8s-labels-selectors`.
   **Techniques**: side by side, restyle, token, spotlight, caption.
   **Review**: Improved — made the apply semantics precise (it overwrites fields the file names, leaves others alone) so the revert in beat 3 is a true claim and not a blanket one; the file-beats-manual-scale moment stays.

### Controllers and the reconciliation loop (`k8s-reconciliation-loop`)

**The aha**: Kubernetes works like a set of thermostats, not a script — a controller endlessly compares actual state to desired state and nudges reality toward it, and controllers never call each other directly.
**Misconception to defeat**: A Deployment "runs" a deploy script; controllers message each other.
**Cast**: Desired state YAML on the left, actual state cluster on the right, a reconciliation arrow turning between them, amber on any gap. A relay of controller icons (Deployment controller → ReplicaSet controller) along the loop, each touching only the API server.
**Opening frame**: Desired "3", actual "3", loop arrow turning calmly, no amber. _"Match. Keep watching anyway."_
**Story**:

1. A pod is killed by hand; actual drops to "2," the gap highlights amber on the loop.
2. The ReplicaSet controller notices through its own loop and creates a replacement; the loop turns, amber clears, actual returns to "3."
3. Zoom out on the relay: a Deployment template change makes the Deployment controller write a new ReplicaSet object; the ReplicaSet controller, watching for ReplicaSets, creates and removes Pod objects — each hop only ever through the API server in the middle, never directly between controllers.
4. _"A chain of thermostats, not a chain of command."_
5. The desired replica count is edited directly to "1": the gap flips the other way (too many running), and the loop removes pods until actual matches again.
   **The moment**: Beats 1–2, a pod murdered by hand, closing itself within seconds with no one telling it to.
   **Interaction**: Kill a pod repeatedly and watch it always come back; edit the desired count directly and watch the loop correct in either direction.
   **Ending**: Loop turning calmly, no amber, 3 and 3.
   **Variants**: `k8s-declarative-objects`, `k8s-deployment`, `k8s-scheduler`, `k8s-rolling-update-rollback`.
   **Techniques**: token, restyle, spotlight, failure, caption.
   **Review**: Improved — fixed beat 3: there is no new "ReplicaSet controller instance" per template change; the Deployment controller writes a new ReplicaSet object and the one ReplicaSet controller reacts to it. The thermostat framing and the kill-a-pod moment are the best available.

### Labels and selectors (`k8s-labels-selectors`)

**The aha**: Kubernetes connects objects by matching labels, not by name or ID — gain the right labels and you join; lose them and you silently drop out.
**Misconception to defeat**: Objects are wired together by name, like variable references.
**Cast**: A few pod capsules with label tags (`app=web`, `tier=frontend`). A Service badge with selector `app=web`, arrows only to matching capsules. A ReplicaSet icon doing the same match.
**Opening frame**: 3 pods tagged `app=web`, 1 tagged `app=api`; the Service's arrows reach only the 3. _"Matched by tag, not by name."_
**Story**:

1. Someone edits one `app=web` pod's label to `app=web-v2` by hand: the Service's arrow snaps away instantly — the pod keeps running, just invisible to the Service now. The pod's ReplicaSet also stops counting it and starts a replacement `app=web` pod, while the relabelled one sits quietly aside, a handy way to quarantine a pod for debugging.
2. A brand-new pod, made with no owning controller but manually tagged `app=web`, is picked up by the Service immediately. _"It doesn't care who made it — only the tag."_ (A ReplicaSet with the same selector would adopt it and may delete an extra.)
3. A NetworkPolicy and a pod-affinity rule are shown doing the identical trick on the same tagged pods.
4. An `annotations:` field (long build info) is shown on a pod: no selector ever reaches into it. _"Annotations are for reading, not matching."_
   **The moment**: Beat 1, a healthy pod disappearing from a Service's target list purely because its label text changed.
   **Interaction**: Edit any pod's label live and watch every selector-based arrow in the scene recompute instantly.
   **Ending**: Labels restored, all arrows reconnected.
   **Variants**: `k8s-service`, `k8s-namespaces`, `k8s-network-policy`, `k8s-pod-affinity`.
   **Techniques**: restyle, token, spotlight, caption.
   **Review**: Improved — beat 1 omitted that the ReplicaSet also reacts to the lost label (it replaces the pod), which is both true and a stronger demonstration that every selector-user recomputes; added adoption of matching orphans. Core moment unchanged.

### Namespaces (`k8s-namespaces`)

**The aha**: A namespace is a naming folder that other controls attach to, not a wall by itself — RBAC, quotas and NetworkPolicy can fence it, but without a NetworkPolicy pods in different namespaces talk freely.
**Misconception to defeat**: Namespaces are separate clusters, or Linux namespaces.
**Cast**: One cluster boundary with two dashed sub-boundaries, `team-a` and `team-b`, each with its own pods, RBAC and quota badges. A Node icon and a StorageClass icon sit outside both, unscoped.
**Opening frame**: Two namespaces, each with a pod named `db`, coexisting without collision. _"Two folders, same names allowed."_
**Story**:

1. A pod in `team-a` sends a request to `team-b` by cluster-DNS name: the token crosses the dashed boundary unobstructed. _"No network wall by default."_
2. A RoleBinding scoped to `team-a` lets a user act within `team-a`; the same user tries to list `team-b`'s pods and bounces, red. _"Permissions can be scoped per namespace. The wall is the binding."_
3. A ResourceQuota caps `team-a`'s CPU total; `team-b`'s quota is independent.
4. The Node and StorageClass icons sit outside both boundaries. _"Some things aren't namespaced at all."_
5. A default-deny NetworkPolicy is added to `team-b` (enforced by the CNI plugin); the same cross-namespace request from beat 1 is replayed and now bounces at the boundary. _"Only a NetworkPolicy makes it a network wall."_ A last glance shows pods from both namespaces on the same node, sharing one kernel: not a hard security boundary.
   **The moment**: Beat 1 versus beat 5, the identical request, unobstructed with no policy, blocked once one exists.
   **Interaction**: Toggle a NetworkPolicy and replay the cross-talk; try accessing another namespace's objects with RBAC scoped to just one.
   **Ending**: `team-b` walled by policy, `team-a` still open.
   **Variants**: `k8s-labels-selectors`, `k8s-network-policy`, `k8s-rbac`, `k8s-resource-quotas`; contrast `container-namespaces-cgroups`.
   **Techniques**: boundary, token, failure, restyle, caption.
   **Review**: Improved — "permission boundary" overclaimed; a namespace only scopes names, and walls appear when RBAC bindings, quotas or NetworkPolicy are attached. Reworded the aha and beat 2, noted that NetworkPolicy needs an enforcing CNI, and ended on the shared-node caveat. The same-request-before-and-after moment stays.

### Owner references, garbage collection, finalizers (`k8s-ownership-deletion`)

**The aha**: Deleting an object is a request, not an instant event — it waits on its finalizers, and deleting an owner cascades to its dependents through owner references.
**Misconception to defeat**: Delete is instantaneous; a stuck "Terminating" object is a bug rather than a finalizer waiting.
**Cast**: Deployment → ReplicaSet → 3 pod capsules, each arrow labelled "ownerReference." One pod carries a padlock icon, "finalizer: cleanup-controller."
**Opening frame**: Full tree, all green. _"Each points up to its owner."_
**Story**:

1. `kubectl delete deployment` (background deletion, the default): the Deployment vanishes at once, and its ReplicaSet and pods are left pointing at an owner that no longer exists. _"Owner gone. Dependents orphaned for a moment."_
2. Garbage collection notices the dangling owner references and removes the ReplicaSet, then all 3 pods, cascading translucent together. (With `--cascade=orphan` they would be left running; with foreground deletion the owner would instead stay, with a `deletionTimestamp`, until its dependents are gone.)
3. Now a different delete: one pod carries a finalizer padlock. Delete it: it isn't removed, it gets a `deletionTimestamp`, turns dashed, its container stops, and the padlock stays shut.
4. The controller that should remove the finalizer is itself gone (greyed out elsewhere). The pod sits in "Terminating" forever, padlock never opening. _"A delete is a request. Finalizers hold it. That's why a namespace or PVC can hang."_ (Real example: a PVC stays Terminating while a pod still uses it.)
5. The finalizer is removed by hand (padlock forced open): the pod instantly disappears.
   **The moment**: Beat 4, the stuck object and the absent controller in the same frame, making an otherwise mysterious hang completely legible.
   **Interaction**: Toggle orphan/foreground/background deletion and watch the cascade order change; add or remove the finalizer by hand.
   **Ending**: Tree gone except a ghost padlock fading last.
   **Variants**: `k8s-declarative-objects`, `k8s-graceful-termination`, `k8s-custom-resources`.
   **Techniques**: restyle, timer, failure, spotlight, caption.
   **Review**: Improved — the original had every delete leave a `deletionTimestamp` and dashed owner; that is true only for foreground deletion or objects with finalizers. The default background delete removes the owner immediately and garbage collection cleans up after. Split the story into cascade (beats 1-2) and finalizer hang (3-5); the stuck-object-with-absent-controller moment is unchanged.

## Workloads

### Pod (`k8s-pod`)

**The aha**: Kubernetes runs pods, not containers, and pods are disposable — a replacement pod gets a new name and a new IP.
**Misconception to defeat**: "Pod" and "container" are interchangeable; a dead pod comes back as itself.
**Cast**: One pod capsule with two containers inside, sharing one IP badge and a `localhost` lane between them.
**Opening frame**: One capsule, two containers, shared IP `10.0.1.7`. _"One network identity, one or more containers."_
**Story**:

1. The two containers talk over `localhost`, never leaving the capsule. _"They share a network namespace."_
2. The whole pod is deleted (failure flash): name and IP both vanish with it, no partial survival.
3. A controller creates a replacement: new capsule, new name (`web-7f9d-x2k1` vs the old `web-7f9d-m3p8`), new IP (`10.0.1.9`). _"Not restarted. Replaced — new identity."_
4. A client that cached the old IP bounces off nothing. _"Why nothing should hardcode a pod's IP."_
5. A Service badge appears in front of several such pods, its own IP never changing even as individual capsules swap underneath.
   **The moment**: Beat 3, the replacement's deliberately different name and IP, not a resurrection.
   **Interaction**: Kill the pod repeatedly and watch the identity change every time; add a second container and watch them share the IP badge.
   **Ending**: A fresh capsule, new identity, Service badge already pointed at it.
   **Variants**: `k8s-pod-lifecycle`, `k8s-service`, `k8s-deployment`, `k8s-sidecar-containers`.
   **Techniques**: contents, failure, clone, restyle, caption.
   **Review**: Keep — whole-pod deletion with a visibly different name and IP on the replacement is the right framing and is accurate (shared network namespace, new identity on every replacement).

### Pod lifecycle and restart policy (`k8s-pod-lifecycle`)

**The aha**: The kubelet restarts a failing container in place, waiting longer after each attempt up to five minutes (CrashLoopBackOff) — a pod is never moved to another node, only replaced.
**Misconception to defeat**: Running means Ready; a crashing pod gets moved elsewhere.
**Cast**: One pod on one node. Readouts: Phase, Container state, Conditions (PodScheduled, Initialized, ContainersReady, Ready), and a backoff timer below.
**Opening frame**: Phase: Pending, conditions unchecked. _"Not running yet."_
**Story**:

1. Phase flips to Running; conditions check in order, Ready last. _"Four gates, in order."_
2. The app crashes on purpose: container state flips to Terminated, Ready unchecks instantly; phase stays Running (restart policy Always). _"Running ≠ Ready."_
3. The kubelet restarts the same container in place — same capsule, same node, same identity. The backoff timer runs 10s, 20s, 40s... and between attempts the container state reads Waiting, reason "CrashLoopBackOff" (a reason, not a phase), climbing toward the 5-minute default cap; it resets after the container runs cleanly for 10 minutes. With restart policy Never the pod would simply go to phase Failed.
4. The node frame is highlighted: the pod stays nailed to this exact node through every restart. _"Never moved — only replaced, and only by a controller."_
   **The moment**: Beat 3's doubling backoff timer, racing toward its ceiling, turning "CrashLoopBackOff" into a literal, lengthening countdown.
   **Interaction**: Trigger a crash and watch the backoff double each time; toggle the restart policy (Always/OnFailure/Never) and see which crashes get restarted at all.
   **Ending**: Backoff timer frozen at its cap, same pod, same node, still cycling.
   **Variants**: `k8s-pod`, `k8s-probes`, `k8s-kubelet`.
   **Techniques**: meter, timer, restyle, failure, caption.
   **Review**: Improved — made explicit that CrashLoopBackOff is a Waiting reason, not a pod phase, that the cap is the default, and what changes with restart policy Never; the lengthening-countdown moment stays.

### Init containers (`k8s-init-containers`)

**The aha**: Init containers run one after another to completion before any app container starts; if one fails, the app never starts.
**Misconception to defeat**: Init containers are just sidecars that happen to run first.
**Cast**: One pod capsule. A queue of boxes on the left (`wait-for-db`, `run-migrations`), a divider, then dim app containers on the right.
**Opening frame**: `wait-for-db` running, app containers dim. _"Setup first. Nothing else starts."_
**Story**:

1. `wait-for-db` polls a database icon until it answers; succeeds, fades out of the queue.
2. `run-migrations` starts only now, completes, fades.
3. The divider dissolves; the app containers light up together and start. _"They ran once, in order, and they're gone."_
4. Rewind with `run-migrations` failing instead: the app containers never light up, staying dim indefinitely, a backoff timer on the failed init container. _"One failure, and the app never starts."_
5. Footnote: a sidecar container (next plan) runs continuously beside the app the whole time, contrasted against this one-and-done queue.
   **The moment**: Beat 4, the app staying permanently dark because of one failed setup step.
   **Interaction**: Pick which init container fails and watch the app's fate; reorder the queue and watch execution order follow.
   **Ending**: All green checks, app running.
   **Variants**: `k8s-sidecar-containers`, `k8s-pod`, `k8s-pod-lifecycle`.
   **Techniques**: contents, restyle, failure, timer, caption.
   **Review**: Keep — sequential run-to-completion with the app staying dark on a failed step is accurate (the failed init container is retried with backoff under restart policy Always) and clearly set against the sidecar.

### Sidecar containers and multi-container patterns (`k8s-sidecar-containers`)

**The aha**: A native sidecar is an init container with `restartPolicy: Always` — it starts before the app and stops after it, adding abilities without touching the app's code or lifetime.
**Misconception to defeat**: Sidecar and init container are the same category; a sidecar is only "the mesh proxy thing."
**Cast**: One pod capsule. A sidecar box (`log-shipper`) marked "Always," distinct colour, beside the app container box. Both share the capsule's volumes and network.
**Opening frame**: Sidecar lit and running, app dim. _"Starts first, like an init container..."_
**Story**:

1. The sidecar starts but, unlike a plain init container, doesn't fade out on success — it keeps glowing as the app container lights up beside it. _"...but it doesn't stop. It stays up with the app."_
2. The app writes log lines into a shared volume; the sidecar ships them out continuously, for the pod's whole life.
3. For a Job-style pod, the app finishes and exits. A faded "legacy sidecar" ghost (an ordinary container) would have kept running forever, blocking completion. The kubelet stops the native sidecar automatically once the app containers are done, and the Job completes cleanly. _"Native sidecars fixed this."_
4. On shutdown, the app terminates first, the sidecar right after it, in order.
5. Small variant icons: "ambassador" (proxies outgoing calls) and "adapter" (reshapes output), doing the same always-on trick.
   **The moment**: Beat 3, legacy versus native sidecar behaviour on Job completion — the exact bug class native sidecars fixed.
   **Interaction**: Toggle "legacy" versus "native" sidecar on a Job-style pod and watch whether it ever reports Completed.
   **Ending**: Native sidecar and app shutting down in clean sequence, Job marked Completed.
   **Variants**: `k8s-init-containers`, `k8s-pod`, `k8s-jobs-cronjobs`, `k8s-service-mesh`.
   **Techniques**: contents, restyle, token, side by side, timer, caption.
   **Review**: Improved — the kubelet, not a manual "told to stop", ends the sidecar when the app finishes; the rest (init container with `restartPolicy: Always`, starts first, stops last, stable since 1.33) is correct and the legacy-vs-native Job toggle stays as the moment.

### Deployment (`k8s-deployment`)

**The aha**: You manage the Deployment and never touch its ReplicaSets or Pods directly — change the template and it rolls out a new version; scale it and it adds or removes identical pods.
**Misconception to defeat**: Editing a Pod or ReplicaSet created by a Deployment is a normal way to make a change.
**Cast**: A Deployment card (`web, replicas: 3, template: v1`), an arrow to one ReplicaSet card, arrows to 3 matching pod capsules.
**Opening frame**: Deployment → one ReplicaSet → 3 pods, all v1. _"You touch the top. It touches everything below."_
**Story**:

1. Replica count is raised 3 → 5: the ReplicaSet's count updates, spawning 2 more pods. _"Scale: same template, more copies."_
2. One pod is deleted by hand: an identical replacement appears from the template. Another pod is hand-edited (its image swapped): it runs the change, but the ReplicaSet doesn't copy it or revert it; the template is the only thing new pods are cut from. _"Edits to a pod are a dead end. Only the template spreads."_
3. The template image changes v1 → v2: a second ReplicaSet card fades in beside the first, starting at 0 replicas. The hand-edited pod, like every v1 pod, is on the way out. (The roll itself is `k8s-rolling-update-rollback`.)
4. New pods under the v2 ReplicaSet grow while v1's pods shrink, ending with v1 at 0 (kept for rollback, not deleted) and v2 holding all 5; the hand edit is gone without a trace.
   **The moment**: Beat 2 into beat 4, the hand-made change evaporating at the next rollout while the template change reaches every pod.
   **Interaction**: Scale the Deployment; edit a pod by hand and watch it not propagate; change the template image and watch a new ReplicaSet appear.
   **Ending**: Deployment → v2 ReplicaSet (5 pods), the old, empty v1 ReplicaSet kept quietly aside.
   **Variants**: `k8s-rolling-update-rollback`, `k8s-reconciliation-loop`, `k8s-labels-selectors`.
   **Techniques**: restyle, clone, token, spotlight, caption.
   **Review**: Improved — the original claimed a hand-edited pod gets reverted because it "no longer matches the template"; a ReplicaSet only counts pods by label selector and never compares them to the template, so that would not happen. Reframed to what is true and still teaches the lesson: hand edits don't propagate and vanish at the next rollout.

### Rolling updates and rollback (`k8s-rolling-update-rollback`)

**The aha**: Updates have no downtime because pods are swapped a few at a time within `maxSurge`/`maxUnavailable`, only as fast as new pods become Ready — rollback is the same swap run in reverse, and Kubernetes never does it automatically.
**Misconception to defeat**: A rollout is instant and all-at-once; Kubernetes auto-rolls-back a bad deploy.
**Cast**: Two ReplicaSet cards under one Deployment, v1 (starts at 4 pods) and v2 (starts at 0), with `maxSurge`/`maxUnavailable` badges and a readiness check on each new pod.
**Opening frame**: v1 at 4, v2 at 0, template just changed; badges read `maxSurge: 1`, `maxUnavailable: 0` (the defaults are 25% each, shown on a toggle). _"Swap, a few at a time."_
**Story**:

1. `maxSurge` allows +1: a 5th pod spins up under v2. With `maxUnavailable: 0`, nothing is removed until it passes readiness. _"Wait for Ready, not just Running."_
2. Once Ready, one v1 pod is removed, net count back to 4. (With the default 25% unavailable, one v1 pod would be removed immediately alongside the surge.)
3. The cycle repeats until v1 is at 0 and v2 is at 4; the old v1 ReplicaSet is kept at 0, greyed in the corner.
4. A bad v3 is rolled out: new pods keep failing readiness. The swap never advances, and the v2 pods keep serving untouched; after the 10-minute default deadline, status flips to "ProgressDeadlineExceeded." _"Kubernetes halts it. It doesn't roll it back."_
5. `kubectl rollout undo` scales the old v2 ReplicaSet (kept at 0) back up from its remembered template and v3's down, with the same surge-and-shrink swap in reverse; no new ReplicaSet is created.
   **The moment**: Beat 4, the rollout stalling forever on a bad image with zero automatic recovery.
   **Interaction**: Set `maxSurge`/`maxUnavailable` and watch the pace change; make a version fail readiness and watch the halt; trigger rollback by hand.
   **Ending**: Back to all-v2 pods, v3's failed ReplicaSet sitting at 0, a visible scar.
   **Variants**: `k8s-deployment`, `k8s-probes`, `k8s-canary-blue-green`.
   **Techniques**: meter, dial, failure, timer, restyle, caption.
   **Review**: Improved — fixed that `rollout undo` reuses the existing kept ReplicaSet rather than creating a fresh one; made the readiness-gating claim correct by using `maxUnavailable: 0` (with the 25% default old pods are removed alongside the surge); added that v2 keeps serving while v3 stalls, the real reason a stuck rollout is safe.

### Blue-green and canary with Kubernetes primitives (`k8s-canary-blue-green`)

**The aha**: With plain Kubernetes objects, a canary's traffic share is just its share of pods behind one Service — exact percentages need something more, like Gateway API weights.
**Misconception to defeat**: Kubernetes natively supports precise traffic percentages or automated canary analysis.
**Cast**: One Service badge in front of two Deployments sharing the Service's selector label: "blue" (9 pods) and "canary" (1 pod).
**Opening frame**: The Service's arrows split 9-to-1 across blue and canary. _"Same label, same Service — roughly 1 in 10."_
**Story**:

1. Ten client tokens arrive one after another; roughly one in ten lands on the canary pod, but a few runs show 0 or 2 landing there by chance. _"Roughly 10%. Not exactly."_ Then one long-lived connection is shown pinned to a single pod for all its requests: balancing happens per connection, not per request.
2. The canary is scaled 1 → 3 pods: about 3 in 10 now land there. _"The only lever is pod count."_
3. Cut to blue-green: two full Deployments, blue (selected) and green (idle). The Service's selector flips from `version=blue` to `version=green`: every arrow snaps instantly across.
4. The selector flips back: instant revert to blue.
5. A Gateway API `HTTPRoute` fades in beside the plain Service, with explicit `weight: 10`/`weight: 90` and a header-match rule. _"Exact percentages need more than a Service."_
   **The moment**: Beat 1's visibly uneven small-sample routing, puncturing "1 of 10 pods means exactly 10%."
   **Interaction**: Scale the canary pod count and watch the split shift; flip the blue-green selector back and forth.
   **Ending**: Gateway API's exact weight dial sitting beside the blunter pod-ratio approach.
   **Variants**: `k8s-deployment`, `k8s-service`, `k8s-gateway-api`, `k8s-rolling-update-rollback`.
   **Techniques**: token, meter, dial, restyle, side by side, caption.
   **Review**: Improved — added that Service balancing is per connection, so keep-alive and gRPC clients skew the "share of pods" even further; this strengthens the case for Gateway API weights. Framing (pod ratio vs selector flip vs weights) is the right one.

### StatefulSet (`k8s-statefulset`)

**The aha**: StatefulSet replicas aren't interchangeable — each gets a stable numbered name, a stable DNS name and its own disk, created and updated in order.
**Misconception to defeat**: A Deployment plus a PersistentVolumeClaim gives you the same thing.
**Cast**: Three pod capsules, `db-0`, `db-1`, `db-2`, each with its own cylinder underneath and a stable DNS label through a headless Service.
**Opening frame**: Three pods in a vertical line, each wired to its own cylinder. _"Named, ordered, each with its own disk."_
**Story**:

1. `db-2` is deleted (failure flash, capsule vanishes). Its cylinder stays intact, untouched, waiting.
2. The StatefulSet controller creates a replacement with the exact same name, `db-2`, reattached to the same cylinder. _"Same name, same disk. Not a new one."_
3. A crossed-out Deployment-style name (`web-9f2x`) flashes briefly as a contrast: what a Deployment's replacement would look like instead. Then the node under `db-2` goes silent: the StatefulSet does not rush to recreate `db-2` elsewhere, because two pods claiming one identity and disk would be worse than waiting. _"At most one `db-2`."_
4. Scaling to `db-3` happens only after `db-2` is Ready (the default ordered policy), with a fresh cylinder of its own. Scaling back down leaves the cylinders in place by default.
5. An update rolls through `db-2`, then `db-1`, then `db-0`, in reverse-ordinal order, each waiting for the previous to be Ready. _"StatefulSet alone doesn't make the database itself highly available."_
   **The moment**: Beat 2, the dead pod's exact name and exact disk both returning together.
   **Interaction**: Delete any replica and watch the same name/disk come back; scale up and watch the strict order.
   **Ending**: `db-0` through `db-3` in a tidy column, each wired to its own persistent cylinder.
   **Variants**: `k8s-deployment`, `k8s-persistent-volumes`, `k8s-headless-service`.
   **Techniques**: contents, restyle, failure, clone, spotlight, caption.
   **Review**: Improved — kept the same-name-same-disk moment; added the at-most-one behaviour on an unreachable node (links to `k8s-kubelet`) and that ordering is the default policy while retained PVCs on scale-down is the default. Slightly over the time budget; the contrast-name flash can be cut on build.

### DaemonSet (`k8s-daemonset`)

**The aha**: A DaemonSet runs one copy of a pod on every matching node and scales with the number of nodes, not a replica count.
**Misconception to defeat**: This is just a Deployment with anti-affinity rules, or a static pod.
**Cast**: Three node frames, each with exactly one small pod capsule (`log-agent`) in the same spot. A DaemonSet icon above, with a node selector but no replica-count field.
**Opening frame**: 3 nodes, each with its one log-agent pod. _"One per node. No count to set."_
**Story**:

1. A fourth node joins the cluster: within moments, a new log-agent pod appears in it automatically. _"It scales with the fleet, not a dial."_
2. A node is removed from the cluster: its log-agent pod goes with it — no replacement elsewhere, because elsewhere already has its own. (A plain `kubectl drain` leaves DaemonSet pods in place unless told to ignore them; they would just be recreated on that node.) The agent pods also carry built-in tolerations, so they still land on NotReady or tainted nodes.
3. A replica-count field is searched for on the DaemonSet and not found; a Deployment-with-anti-affinity alternative is shown instead, needing careful rules and still capped at the node count.
4. A node selector (GPU nodes only) is applied: pods disappear from non-matching nodes, stay only on matching ones.
   **The moment**: Beat 1, a brand-new, never-configured node getting its agent pod with zero manual action.
   **Interaction**: Add and remove nodes and watch pod count track exactly; apply a node selector and watch pods vanish from non-matching nodes.
   **Ending**: 4 nodes, 4 agent pods, perfectly 1:1.
   **Variants**: `k8s-deployment`, `k8s-pod-affinity`, `k8s-extension-interfaces`.
   **Techniques**: contents, clone, failure, restyle, caption.
   **Review**: Improved — "drained: pod disappears" was wrong (drain doesn't evict DaemonSet pods); now uses node removal. Added built-in tolerations. The new-node-gets-an-agent-with-no-action moment stays.

### Jobs and CronJobs (`k8s-jobs-cronjobs`)

**The aha**: Jobs are for work that ends — Kubernetes counts successful completions instead of keeping pods alive forever — and a CronJob creates a new Job on a schedule.
**Misconception to defeat**: A Job is just a Deployment that happens to finish; a crashed Job pod is a system failure rather than a retry.
**Cast**: A Job card (`completions: 3, parallelism: 2, backoffLimit: 4`) with a progress counter. A CronJob card above with a clock face and schedule, an arrow down to a freshly created Job each tick.
**Opening frame**: Job card, 0/3 succeeded, no pods yet. _"Counts completions, not uptime."_
**Story**:

1. Two pods start in parallel; one finishes successfully (counter → 1/3), a third starts to keep 2 running.
2. One pod fails: it doesn't count against completions, but does count against `backoffLimit` (1 of 4); a replacement is tried. _"Retries, up to a limit."_
3. The counter reaches 3/3: the Job is marked Complete and its pods go grey as "Completed" — no CPU, nothing running, logs still readable — until `ttlSecondsAfterFinished` (if set) sweeps them away. _"Done means done."_
4. A Deployment card beside it is shown with pods that would just sit "Running" forever, doing nothing useful. _"Wrong tool for this."_
5. The CronJob's clock ticks: a new Job card spawns automatically, its own fresh 0/3 cycle. A second tick arrives mid-run; a concurrency-policy badge (Allow/Forbid/Replace) decides what happens.
   **The moment**: Beat 3, the Job's pods settling into a quiet "Completed" on success, directly contrasted with a Deployment's that would sit "Running" forever.
   **Interaction**: Set completions/parallelism and watch pacing change; force a failure and watch the backoff counter; set the concurrency policy and trigger an overlapping tick.
   **Ending**: CronJob clock resting, the last Job marked Complete and quietly archived.
   **Variants**: `k8s-deployment`, `k8s-pod-lifecycle`.
   **Techniques**: contents, meter, timer, restyle, failure, caption.
   **Review**: Improved — finished Job pods are not deleted; they stay as Completed until a TTL or manual cleanup, so the moment is now "done pods go quiet" rather than "vanish". Noted the example `backoffLimit: 4` differs from the default of 6. A CronJob also takes a `timeZone` and keeps a few finished Jobs by default.
