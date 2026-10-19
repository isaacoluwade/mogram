# Delivery: catalog

Stage 1 research for the **Delivery** area: CI/CD, release strategies, infrastructure as code,
GitOps and DevOps practice.

## Scope

**In:** how a change gets from a commit to users, and how the infrastructure it runs on is
defined and kept in shape.

- **Continuous integration**: mainline integration, pipelines and their anatomy (stages, jobs,
  steps), triggers, runners, caching, parallelism and matrices, artifacts and artifact
  repositories, PR checks and merge queues, reusable templates, monorepo affected builds,
  automated dependency updates, container image build and promotion.
- **Testing and quality in the pipeline**: test pyramid placement, quality gates, contract
  tests, flaky tests.
- **Continuous delivery**: delivery vs deployment, environment promotion, build once deploy
  many, approvals and checks, deploy vs release, versioning, release trains.
- **Release strategies**: recreate, rolling, blue/green, canary, A/B vs canary, shadow, dark
  launch, feature flags, rings, progressive delivery and automated canary analysis, rollback vs
  roll forward, zero-downtime deploys, database changes during deploys.
- **Security in delivery**: what happens inside the pipeline (secrets injection, OIDC
  federation, where scanners sit, policy as code). The underlying security ideas live in
  Security.
- **Infrastructure as code**: declarative vs imperative, plan/apply, state and locking, drift,
  modules, idempotency, dependency graph, plan-in-PR, immutable infrastructure, configuration
  management, golden images, ephemeral environments, environment parity.
- **GitOps**: the OpenGitOps principles, push vs pull, reconciliation, promotion, sync vs
  health.
- **DevOps practice**: DevOps itself, DORA metrics, small batches, shift left, platform
  engineering, inner/outer loop, value stream mapping, lightweight change approval.

**Left to other areas:**

- **Git**: branching strategies (trunk-based, GitFlow, GitHub Flow, release branches), pull
  requests, branch protection, tags, monorepo vs polyrepo, branch by abstraction.
- **Containers**: image layers, Dockerfiles and multi-stage builds, tags vs digests,
  registries, how a Kubernetes Deployment rolls out (maxSurge/maxUnavailable, readiness
  probes), Helm, Kustomize.
- **Security**: secret stores, workload identity federation as an identity mechanism, SAST,
  SCA and DAST themselves, SBOMs, signing, SLSA provenance, reproducible and hermetic builds,
  IAM.
- **Data**: schema design, online schema-change tooling, backups.
- **Reliability**: blast radius, SLOs and error budgets (including error-budget release
  freezes), incident response, disaster recovery.
- **Observability**: monitoring, deployment markers, alerting.
- **Architecture**: microservices, loose coupling, strangler fig.
- **Platform files**: Azure (deployment slots, App Configuration, Azure Deployment
  Environments, DSC/Machine Configuration, Bicep what-if), AWS (CodeDeploy, CodePipeline,
  CloudFormation change sets and StackSets, Elastic Beanstalk deployment policies, Lambda
  traffic shifting, EC2 Image Builder, Systems Manager) and Google Cloud (Cloud Build, Cloud
  Deploy).

## Sources

Syllabi and authoritative lists used for the coverage check:

- DORA capability catalog: <https://dora.dev/capabilities/>
- DORA software delivery performance metrics: <https://dora.dev/guides/dora-metrics-four-keys/>
- DORA capability pages: [Continuous delivery](https://dora.dev/capabilities/continuous-delivery/),
  [Deployment automation](https://dora.dev/capabilities/deployment-automation/),
  [Database change management](https://dora.dev/capabilities/database-change-management/),
  [Streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/)
- DORA 2021 report (reliability added as a fifth measure):
  <https://cloud.google.com/blog/products/devops-sre/announcing-dora-2021-accelerate-state-of-devops-report>
- Forsgren, Humble, Kim, _Accelerate_ (2018), Appendix A, the 24 capabilities:
  <https://www.oreilly.com/library/view/accelerate/9781457191435/32-app_A.xhtml>
- Humble & Farley, _Continuous Delivery_ (2010): table of contents and
  [Anatomy of the Deployment Pipeline](https://www.informit.com/articles/article.aspx?p=1621865);
  principles at <https://continuousdelivery.com/principles/>
- Microsoft AZ-400 study guide, skills measured as of 27 July 2026:
  <https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-400>
- AWS Certified DevOps Engineer Professional (DOP-C02) exam guide:
  <https://docs.aws.amazon.com/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02.html>
  ([Domain 1](https://docs.aws.amazon.com/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02-domain1.html),
  [Domain 2](https://docs.aws.amazon.com/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02-domain2.html),
  [Domain 3](https://docs.aws.amazon.com/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02-domain3.html))
- OpenGitOps principles v1.0.0: <https://opengitops.dev/>

Concept references:

- Martin Fowler: [Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html),
  [BlueGreenDeployment](https://martinfowler.com/bliki/BlueGreenDeployment.html),
  [CanaryRelease](https://martinfowler.com/bliki/CanaryRelease.html),
  [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html) (Pete Hodgson),
  [ParallelChange](https://martinfowler.com/bliki/ParallelChange.html),
  [ImmutableServer](https://martinfowler.com/bliki/ImmutableServer.html),
  [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) (Ham Vocke)
- Terraform: [Core workflow](https://developer.hashicorp.com/terraform/intro/core-workflow),
  [State](https://developer.hashicorp.com/terraform/language/state),
  [State locking](https://developer.hashicorp.com/terraform/language/state/locking),
  [Manage resource drift](https://developer.hashicorp.com/terraform/tutorials/state/resource-drift)
- Argo CD [core concepts](https://argo-cd.readthedocs.io/en/stable/core_concepts/); Flux
  [concepts](https://fluxcd.io/flux/concepts/)
- Argo Rollouts [concepts](https://argo-rollouts.readthedocs.io/en/stable/concepts/); Flagger
  [deployment strategies](https://docs.flagger.app/usage/deployment-strategies)
- GitHub Actions [core concepts](https://docs.github.com/en/actions/get-started/understand-github-actions),
  [OpenID Connect](https://docs.github.com/en/actions/concepts/security/openid-connect),
  [merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- Azure Pipelines [key concepts](https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/key-pipelines-concepts)
- Microsoft [Safe deployment practices](https://learn.microsoft.com/en-us/devops/operate/safe-deployment-practices)
  (tiers/rings, bake time, hotfix path)
- Google Cloud [Application deployment and testing strategies](https://cloud.google.com/architecture/application-deployment-and-testing-strategies)
  (recreate, rolling, blue/green, canary, A/B, shadow)
- Google SRE Workbook [Canarying releases](https://sre.google/workbook/canarying-releases/)
- CNCF TAG App Delivery [Platforms white paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/)
- Semantic Versioning 2.0.0: <https://semver.org/>

## Catalog

75 concepts: 10 tier 1, 49 tier 2, 16 tier 3.

### Continuous integration and pipeline mechanics

| id                           | Concept                                 | Tier | Platform | What it is                                                                                                                                                      | The idea to get across                                                                                                                                                                                                                            | Often confused with                                                                          |
| ---------------------------- | --------------------------------------- | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| continuous-integration       | Continuous integration                  | 1    | any      | Everyone merges small changes into the shared mainline at least daily, and every push triggers an automated build and test run.                                 | Integrating often keeps each merge small and cheap. Waiting turns integration into a painful, unpredictable big bang. A red build gets fixed first, so main always works.                                                                         | Owning a CI server: building long-lived feature branches isn't CI. Also continuous delivery. |
| ci-cd-pipeline               | CI/CD pipeline (deployment pipeline)    | 1    | any      | The automated path every change takes from commit through build and test stages to production.                                                                  | Each stage filters for problems and builds confidence: fast, cheap checks run first and slower, realistic ones later. A change advances only if the previous stage passed, and any failure stops the line.                                        | A build script; a single CI job                                                              |
| pipeline-stages-jobs-steps   | Stages, jobs and steps                  | 2    | any      | The pipeline hierarchy: stages group jobs, each job runs on one runner, and steps run in order inside a job. Dependencies between jobs and stages form a graph. | Steps in a job share one machine and filesystem; separate jobs don't. Jobs may run at the same time on different machines and pass data only through artifacts or outputs. Any step that exits non-zero fails its job.                            | Assuming files from one job exist in the next                                                |
| pipeline-triggers            | Pipeline triggers                       | 2    | any      | Events that start a run: push, pull request, schedule, manual dispatch, another pipeline completing, a webhook or a new artifact.                               | Different triggers do different work. PR runs validate before merge, main-branch runs produce releasable artifacts, and scheduled runs catch rot. Branch and path filters decide what doesn't run.                                                | Webhooks (one way a trigger arrives)                                                         |
| pipeline-as-code             | Pipeline as code                        | 2    | any      | The pipeline definition is a file (usually YAML) in the repository, versioned and reviewed along with the code it builds.                                       | A pipeline change rides in the same pull request as the code change, with history, review and revert. Click-configured "classic" pipelines can't be diffed.                                                                                       | Infrastructure as code                                                                       |
| ci-runners                   | Runners and agents                      | 2    | any      | The machines that pick up queued jobs and run them: hosted by the CI provider, or self-hosted inside your own network.                                          | A runner polls for work and takes one job at a time; an ephemeral runner is discarded after the job. Hosted runners need no upkeep. Self-hosted runners can reach private networks and special hardware, but you own their patching and security. | The CI orchestrator/server itself                                                            |
| build-caching                | Build and dependency caching            | 2    | any      | Reusing downloaded dependencies and earlier build outputs across runs, keyed by a hash of the inputs such as a lockfile.                                        | Same inputs, same key, skip the work. Change the lockfile and the key changes, so the cache misses and rebuilds. Remote caches share results across machines and developers.                                                                      | Artifacts: a cache holds inputs reused for speed, an artifact holds outputs you ship.        |
| pipeline-parallelism-matrix  | Parallel jobs and matrix builds         | 2    | any      | Independent jobs run at the same time (fan-out, then fan-in), and a matrix expands one job definition across combinations such as OS × runtime version.         | Wall-clock time is set by the longest path through the job graph, not the sum of all jobs. A matrix multiplies coverage without copying YAML; test sharding splits one slow suite across machines.                                                | Concurrency limits (how many jobs you're allowed to run at once)                             |
| pipeline-artifacts           | Pipeline artifacts                      | 2    | any      | Files a job publishes (binaries, packages, test reports, plan files) so later jobs, stages or people can use them.                                              | Artifacts carry work across job boundaries, and they're how the exact thing that was tested reaches deployment.                                                                                                                                   | Caches; artifact repository                                                                  |
| artifact-repository          | Artifact repository and package feeds   | 2    | any      | A versioned store for built packages and images (npm, Maven, NuGet, PyPI, OCI), with upstream proxying of public sources, promotion views and retention rules.  | A version is published once and never overwritten. Upstream proxies cache public packages, so builds still work when the public registry is down or a package is pulled.                                                                          | Source control: it stores code, not built things.                                            |
| pull-request-checks          | Pull request validation checks          | 2    | any      | CI runs on every pull request, and branch protection requires those checks and reviews to pass before merge.                                                    | Problems are caught before they reach main, so main stays green. The check builds the would-be merge result, not just the branch on its own.                                                                                                      | Merge queue                                                                                  |
| merge-queue                  | Merge queue                             | 3    | any      | A queue that tests each pull request combined with main plus every PR queued ahead of it, and merges only if that combination passes.                           | Two PRs can each pass alone and still break main together. The queue tests the exact sequence that will land.                                                                                                                                     | PR checks, which test each PR against a main that may be stale                               |
| reusable-pipeline-templates  | Reusable pipeline templates             | 3    | any      | Shared pipeline building blocks that many pipelines call: YAML templates, reusable workflows, actions/tasks and variable groups.                                | Fix or harden the template once and every pipeline using it inherits the change. Teams can extend an approved template instead of copy-pasting YAML.                                                                                              | Copy-pasted pipelines                                                                        |
| monorepo-affected-builds     | Affected builds in monorepos            | 3    | any      | Monorepo build tools (Nx, Turborepo, Bazel) use the project dependency graph to build and test only what a change affects, backed by a shared cache.            | A change to one library rebuilds that library and everything that depends on it, not the whole repo. Everything else is a cache hit.                                                                                                              | Path filters (which only skip by folder, not by dependency)                                  |
| automated-dependency-updates | Automated dependency updates            | 2    | any      | Bots such as Dependabot and Renovate open pull requests that bump dependencies, and CI tests them like any other change.                                        | Small, steady updates, each checked by the pipeline, are safer than one giant upgrade a year. The test suite decides what can merge automatically.                                                                                                | Vulnerability scanning: scanning finds the problem, the update PR fixes it.                  |
| container-image-pipeline     | Container image build, push and promote | 2    | any      | CI builds an image, scans it, pushes it to a registry, then promotes that same image through environments by digest (re-tag or copy, never rebuild).            | Promote the image, don't rebuild it. Deploy by digest, because a tag like `latest` can move under you.                                                                                                                                            | Rebuilding the image for each environment                                                    |

### Testing and quality in the pipeline

| id               | Concept                      | Tier | Platform | What it is                                                                                                                                                                                                   | The idea to get across                                                                                                        | Often confused with          |
| ---------------- | ---------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| test-pyramid     | Test pyramid in the pipeline | 2    | any      | Many fast unit tests at the base, fewer integration tests, and very few slow end-to-end tests at the top, each placed in a pipeline stage by speed. Load and other non-functional tests run in later stages. | Fast feedback comes from cheap tests running first. Inverting the pyramid (the "ice-cream cone") gives slow, flaky pipelines. | Code coverage                |
| quality-gates    | Quality gates                | 2    | any      | Automated pass/fail rules a change must meet to move on: coverage threshold, static analysis, vulnerability count, post-deploy smoke tests, health metrics.                                                  | A gate turns "good enough to proceed" into a rule the pipeline enforces, not a judgment made under deadline pressure.         | Manual approvals             |
| contract-testing | Contract testing             | 3    | any      | Consumer and provider services each test against a shared contract (consumer-driven contracts, e.g. Pact) instead of a full end-to-end environment.                                                          | Each service can be tested and deployed on its own, with evidence that it won't break its callers.                            | End-to-end integration tests |
| flaky-tests      | Flaky tests                  | 3    | any      | Tests that pass and fail on the same code. Teams track them with pipeline health metrics, quarantine them, then fix them.                                                                                    | Flaky tests teach people to ignore red builds. Once "just re-run it" is normal, the pipeline stops protecting you.            | Real regressions             |

### Continuous delivery and release management

| id                                | Concept                                       | Tier | Platform | What it is                                                                                                                                                                                         | The idea to get across                                                                                                                                          | Often confused with                               |
| --------------------------------- | --------------------------------------------- | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| continuous-delivery-vs-deployment | Continuous delivery vs continuous deployment  | 1    | any      | Continuous delivery keeps every change releasable, with a push-button deploy to production. Continuous deployment removes the button: every change that passes goes live.                          | The only difference is a human decision before production. Both need the same automation underneath.                                                            | Each other; continuous integration                |
| environment-promotion             | Environment promotion                         | 1    | any      | Moving one release through a chain of environments, such as dev → test/staging → production, with each one adding confidence.                                                                      | The same artifact moves forward. Only the environment and its configuration change at each hop, never the code.                                                 | Branch per environment                            |
| build-once-deploy-many            | Build once, deploy many (immutable artifacts) | 2    | any      | Compile and package once, then deploy that identical, never-modified artifact to every environment, with configuration supplied from outside.                                                      | Rebuilding per environment means production runs something that was never tested. Keeping config outside the artifact is what lets one artifact run everywhere. | Rebuild per environment; immutable infrastructure |
| deployment-approvals              | Approvals and environment checks              | 2    | any      | Conditions on an environment that a deployment must clear: manual approvals, business-hours windows, required checks, an exclusive lock (one deploy at a time), and who may deploy.                | Approvals belong where the risk is (production) and are recorded by the pipeline. Everywhere else, changes should flow automatically.                           | Quality gates; change advisory boards             |
| deploy-vs-release                 | Deployment vs release                         | 2    | any      | Deploying puts new code on production servers; releasing exposes it to users. Feature flags and traffic routing let the two happen separately.                                                     | Separated, deploys become boring, frequent and reversible, and the business picks when users see a feature.                                                     | Each other                                        |
| semantic-versioning               | Semantic versioning                           | 2    | any      | MAJOR.MINOR.PATCH version numbers that signal breaking changes, new features and fixes. Tools can derive the version and release notes from commit messages. CalVer is the date-based alternative. | A version number tells consumers whether an upgrade is safe, and dependency ranges only work if authors honour it.                                              | Build numbers; CalVer                             |
| release-train                     | Release train                                 | 3    | any      | Releases leave on a fixed schedule. Whatever is ready boards; anything late waits for the next train.                                                                                              | Dates become predictable without holding a release for one late feature. Often a step from big-bang releases toward continuous delivery.                        | Continuous delivery (release on demand)           |

### Release strategies

| id                        | Concept                               | Tier | Platform | What it is                                                                                                                                                                      | The idea to get across                                                                                                                                                  | Often confused with                                                         |
| ------------------------- | ------------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| recreate-deployment       | Recreate deployment                   | 2    | any      | Stop every instance of the old version, then start the new one.                                                                                                                 | The simplest strategy, and two versions never run at once, but users get downtime.                                                                                      | Rolling update                                                              |
| rolling-update            | Rolling update                        | 1    | any      | Replace instances in batches, old for new, waiting for health checks before each next batch. A surge batch can add capacity first.                                              | No downtime and no second environment. For a while, old and new versions serve traffic side by side, so they must be compatible. Rolling back means rolling again.      | Canary: rolling replaces capacity, canary controls exposure                 |
| blue-green-deployment     | Blue/green deployment                 | 1    | any      | Run the new version (green) as a full environment next to the live one (blue), test it, then switch all traffic at once.                                                        | Cutover and rollback are one router switch. The cost is double capacity, and a shared database must work with both versions.                                            | Canary                                                                      |
| canary                    | Canary release                        | 1    | any      | Send a small slice of real traffic to the new version, watch its metrics, then widen the slice step by step or roll back.                                                       | It limits the blast radius: a bad release hurts 1% of users for minutes instead of everyone.                                                                            | A/B testing; blue/green                                                     |
| ab-testing                | A/B testing vs canary                 | 2    | any      | Splitting users between variants, often by header, cookie or cohort, to measure which one performs better against a business metric.                                            | A/B testing asks "which is better?" and needs days for statistical significance. A canary asks "is it broken?" and answers in minutes to hours. Mixing them skews both. | Canary                                                                      |
| shadow-deployment         | Shadow deployment (traffic mirroring) | 2    | any      | Live requests are copied to the new version. Its responses are compared and thrown away; users only ever get the old version's answer.                                          | Real production load and inputs, with zero user impact. Side effects such as writes, emails and payments must be stubbed or isolated.                                   | Canary; dark launch                                                         |
| dark-launch               | Dark launch                           | 3    | any      | A feature is deployed to production and exercised with real traffic or by internal users while customers can't see it.                                                          | Prove a feature under production load and data before launch day, then flip it visible.                                                                                 | Shadow deployment; feature flags (the usual mechanism)                      |
| feature-flags             | Feature flags                         | 1    | any      | A runtime switch around a code path, so behaviour changes through configuration (per user, percentage or environment) without a redeploy.                                       | Ship unfinished or risky code switched off, turn it on gradually, and turn it off instantly. The kill switch beats any rollback.                                        | Configuration settings; feature branches                                    |
| feature-flag-types        | Feature flag types and flag debt      | 3    | any      | Release, experiment, ops (kill switch) and permission flags differ in how long they live and how dynamically they change. A toggle router decides each flag's value.            | Release flags must be deleted once the feature ships. Every live flag doubles the paths to test, so stale flags are debt.                                               | Treating all flags as the same                                              |
| ring-deployment           | Ring deployment                       | 2    | any      | Release to widening audiences: internal users first, then early adopters, then larger rings, with bake time between rings. Hotfixes take a defined fast path through the rings. | Each ring is bigger and less tolerant of risk. Bake time lets slow-burning problems show up before the next ring.                                                       | Canary: rings select audience groups, a canary selects a traffic percentage |
| progressive-delivery      | Progressive delivery                  | 2    | any      | Gradual exposure (canary, rings, flags) combined with automated health analysis that promotes or rolls back with no human in the loop.                                          | The rollout becomes a control loop: shift a step, measure SLIs against thresholds, then advance or abort on its own.                                                    | Canary: the technique vs the automated practice                             |
| automated-canary-analysis | Automated canary analysis             | 3    | any      | Statistically comparing a canary against a baseline that runs at the same time, on the same metrics, and scoring the result pass/fail.                                          | Compare against a fresh baseline running alongside, not "before vs after". Otherwise time of day and long-running old instances distort the verdict.                    | Static threshold alerts                                                     |
| rollback-vs-roll-forward  | Rollback vs roll forward              | 2    | any      | After a bad deploy, either redeploy the last known-good version or push a fix (hotfix) through the pipeline.                                                                    | Rollback is fastest only if the old version still works with today's data and schema. A fast pipeline is what makes rolling forward safe.                               | Reverting a commit (which still needs a deploy)                             |
| zero-downtime-deployment  | Zero-downtime deployment              | 2    | any      | Deploying with no user-visible outage, by combining health checks, connection draining, backward-compatible changes and a strategy other than recreate.                         | No single tool gives zero downtime. Old instances must finish in-flight requests, and both versions must be able to run side by side.                                   | Blue/green (just one way to get there)                                      |

### Database changes in deployments

| id                              | Concept                             | Tier | Platform | What it is                                                                                                                                                    | The idea to get across                                                                         | Often confused with                        |
| ------------------------------- | ----------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| database-migrations-in-pipeline | Database migrations in the pipeline | 2    | any      | Schema changes kept as versioned migration scripts in source control and applied by the pipeline. A table in each database records which migrations have run. | The database is deployed like code: the same scripts, in the same order, in every environment. | Hand-run DBA scripts; ORM auto-sync        |
| expand-contract-migration       | Expand/contract (parallel change)   | 2    | any      | Change a schema in compatible steps: expand (add the new alongside the old), migrate code and data, then contract (remove the old).                           | Every step works with both app versions, so rolling updates, canaries and rollbacks stay safe. | Big-bang migration in a maintenance window |

### Security in delivery

| id                       | Concept                                       | Tier | Platform | What it is                                                                                                                                                                                    | The idea to get across                                                                                                                                     | Often confused with                             |
| ------------------------ | --------------------------------------------- | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| pipeline-secrets         | Secrets in pipelines                          | 2    | any      | Credentials the pipeline needs are injected at run time from a secret store or variable group, scoped to environments and masked in logs.                                                     | Secrets never live in the repo, the YAML or the artifact. A pipeline that can deploy to production is a prime target, so scope and least privilege matter. | Ordinary configuration variables                |
| pipeline-oidc-federation | Secretless deploys with OIDC federation       | 2    | any      | The CI provider issues the job a short-lived identity token, which the cloud exchanges for temporary credentials. No keys are stored.                                                         | Nothing long-lived to leak or rotate. The cloud trusts "this repo, this branch, this environment", and only for minutes.                                   | Stored service principal secrets or access keys |
| devsecops-pipeline       | Security scanning in the pipeline (DevSecOps) | 2    | any      | Automated security checks at each stage: secret scanning and SAST on commit, dependency and licence scanning (SCA) at build, image scanning before push, DAST against a deployed environment. | Each scan runs where its signal first exists, and findings block or warn like any failing test.                                                            | A yearly penetration test                       |
| policy-as-code           | Policy as code                                | 2    | any      | Rules written as code (OPA/Rego, Sentinel, cloud policy engines) and evaluated automatically against IaC plans, manifests or live resources.                                                  | Guardrails run in the pipeline and at the platform, so a non-compliant change fails before the resource exists.                                            | Manual review checklists; IAM permissions       |

### Infrastructure as code

| id                        | Concept                                  | Tier | Platform | What it is                                                                                                                                                                    | The idea to get across                                                                                                                              | Often confused with                                                                    |
| ------------------------- | ---------------------------------------- | ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| infrastructure-as-code    | Infrastructure as code                   | 1    | any      | Defining servers, networks and services in versioned files that a tool applies, instead of clicking through a console.                                                        | Environments become reproducible, reviewable and rebuildable, and the file is the source of truth.                                                  | Configuration management; ad-hoc scripts                                               |
| declarative-vs-imperative | Declarative vs imperative IaC            | 2    | any      | Declarative IaC describes the desired end state and the tool works out the steps. Imperative IaC lists the steps to run.                                                      | A declarative tool converges from any starting state. An imperative script only works from the state it assumed.                                    | General-purpose-language IaC: CDK and Pulumi still produce a declarative desired state |
| terraform-plan-apply      | Plan and apply                           | 2    | any      | Plan compares the configuration with state and real infrastructure, then shows each create, update, replace and destroy. Apply carries out exactly that plan.                 | The plan is the safety check: an innocent-looking edit can force a replace (destroy, then create).                                                  | Applying without reading the plan                                                      |
| iac-state-file            | IaC state                                | 2    | any      | The state file maps each resource in the code to the real object's ID and its last known attributes. Workspaces keep separate state per environment.                          | Without state, the tool can't tell what it created. Lose or corrupt the state and it tries to create everything again. State can also hold secrets. | The configuration code itself                                                          |
| iac-remote-state-locking  | Remote state and state locking           | 2    | any      | State lives in a shared backend that locks it during an operation, so only one plan or apply runs at a time.                                                                  | Two applies writing one state at the same time would corrupt it. The lock makes the second one wait or fail.                                        | Git, which holds the configuration, not the state                                      |
| infrastructure-drift      | Infrastructure drift and drift detection | 2    | any      | Real infrastructure diverging from what the code declares, usually through manual changes. Scheduled plans or reconcilers find it, then it is reverted or imported into code. | Drift means the code no longer describes reality, and the next apply may silently undo someone's manual hotfix. Detect it, then codify or revert.   | Configuration drift inside servers                                                     |
| iac-modules               | IaC modules                              | 2    | any      | Reusable, parameterised, versioned packages of infrastructure that other configurations compose.                                                                              | Write the pattern once with safe defaults, and every environment calls the same module with different inputs.                                       | Copy-pasting per environment                                                           |
| iac-idempotency           | Idempotency in IaC and deployments       | 2    | any      | Running the same apply or deployment again gives the same result, and makes no changes when nothing has changed.                                                              | Safe re-runs are what make retries and automation possible. A "create bucket" script fails the second time; a "bucket exists" declaration doesn't.  | Imperative scripts                                                                     |
| iac-dependency-graph      | Resource dependency graph                | 3    | any      | The IaC tool builds a graph from references between resources, creating independent ones in parallel and ordering the ones that depend on others.                             | Order comes from references, not from file order, and destroy walks the graph backwards.                                                            | File or declaration order                                                              |
| iac-plan-in-pull-request  | Plan in the pull request                 | 3    | any      | Every infrastructure PR runs validation and a plan and posts the plan for review. Merging applies it.                                                                         | Reviewers approve the change to real infrastructure, not just a diff of the code.                                                                   | GitOps reconciliation                                                                  |

### Servers, images and environments

| id                       | Concept                             | Tier | Platform | What it is                                                                                                                                                                    | The idea to get across                                                                                                                                  | Often confused with                                                                                           |
| ------------------------ | ----------------------------------- | ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| immutable-infrastructure | Immutable vs mutable infrastructure | 2    | any      | Immutable: never patch a running server; build a new one from a new image and replace the old one. Mutable: update servers in place.                                          | In-place changes pile up into unique "snowflake" servers. Replacing keeps every server identical to its image, and rollback is just the previous image. | Immutable artifacts; pets vs cattle                                                                           |
| configuration-management | Configuration management            | 2    | any      | Tools such as Ansible, Chef, Puppet and DSC that bring the software and settings inside machines to a declared state, by push or by an agent that pulls, and keep them there. | Provisioning creates the machine; configuration management sets up what runs on it and keeps it converged.                                              | Provisioning (Terraform); the _Continuous Delivery_ book's meaning (keeping everything under version control) |
| golden-image             | Golden images                       | 2    | any      | A pre-baked, hardened machine or base image built by a pipeline (e.g. Packer) and used to launch every instance.                                                              | Bake at build time instead of fry at boot: instances start fast and identical, and you patch by rebuilding the image.                                   | Snapshots and backups                                                                                         |
| ephemeral-environments   | Ephemeral preview environments      | 2    | any      | A short-lived, full environment created from IaC for each pull request and destroyed on merge or close.                                                                       | Every change can be seen and tested on its own. IaC is what makes environments cheap enough to throw away.                                              | A shared staging environment                                                                                  |
| environment-parity       | Environment parity                  | 2    | any      | Keeping dev, test and production as alike as possible in tooling, dependencies, configuration shape and deploy process.                                                       | Every difference between staging and production is a place for a bug to hide: use the same artifact, deploy process and IaC modules.                    | Identical scale or cost                                                                                       |

### GitOps

| id                           | Concept                      | Tier | Platform   | What it is                                                                                                                                                                                                | The idea to get across                                                                                                   | Often confused with                       |
| ---------------------------- | ---------------------------- | ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| gitops                       | GitOps                       | 2    | any        | An operating model built on the four OpenGitOps principles: desired state is declarative, versioned and immutable, pulled automatically, and continuously reconciled.                                     | Git becomes the control panel: change the system by merging a PR. Audit is `git log` and rollback is `git revert`.       | Any CI/CD triggered from Git; IaC         |
| push-vs-pull-deployment      | Push vs pull deployment      | 2    | any        | Push: the CI pipeline holds credentials and pushes changes into the target. Pull: an agent inside the target fetches the desired state and applies it.                                                    | Pull keeps cluster credentials out of CI and keeps correcting drift. Push only acts when a pipeline runs.                | GitOps: pull is needed but not sufficient |
| gitops-reconciliation        | GitOps reconciliation loop   | 2    | kubernetes | A controller such as Argo CD or Flux repeatedly compares the desired state in Git with the live state, reports OutOfSync, and applies the difference.                                                     | The loop never stops, so a manual change in the cluster gets reverted (self-healing).                                    | A one-time deployment                     |
| gitops-environment-promotion | GitOps environment promotion | 3    | kubernetes | Promotion is a PR that changes the per-environment config (such as an image tag), often opened automatically by image-update automation. Application code and environment config live in separate places. | Promotion becomes a reviewed, revertible commit: the app repo builds images, and the config repo decides where they run. | Branch per environment                    |
| argocd-sync-and-health       | Sync status vs health        | 3    | kubernetes | Argo CD reports two separate things: sync status (does the live state match Git?) and health (is it actually working?).                                                                                   | Synced doesn't mean healthy: Git can describe a broken app perfectly.                                                    | Each other                                |

### DevOps practice and measurement

| id                          | Concept                                               | Tier | Platform | What it is                                                                                                                                                                         | The idea to get across                                                                                                                      | Often confused with                                                                    |
| --------------------------- | ----------------------------------------------------- | ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| devops                      | DevOps                                                | 1    | any      | Culture and practices that join development and operations: the team that builds a service also ships and runs it, backed by automation and fast feedback.                         | Tear down the wall that code used to be thrown over. Shared ownership plus automation lets teams go fast and stay safe at the same time.    | A job title, team name or toolset                                                      |
| dora-metrics                | DORA metrics                                          | 2    | any      | Five measures of delivery performance. Throughput: deployment frequency, change lead time, failed deployment recovery time. Instability: change fail rate, deployment rework rate. | Speed and stability move together: the best performers deploy more often and also break less.                                               | Velocity or story points; the older four keys (and 2021's "reliability" fifth measure) |
| small-batches               | Working in small batches                              | 2    | any      | Splitting work into small changes that can each be integrated, deployed and released on their own.                                                                                 | Smaller changes are quicker to review, easier to debug and hurt less when they fail. Risk grows with batch size, not with deploy frequency. | Small teams                                                                            |
| shift-left                  | Shift left                                            | 2    | any      | Moving testing, security and quality checks earlier in the lifecycle (into the IDE, the commit and the PR) instead of leaving them to the end.                                     | A defect found at commit costs minutes to fix; found in production, it costs days.                                                          | Dropping later-stage testing                                                           |
| platform-engineering        | Platform engineering and internal developer platforms | 2    | any      | A platform team builds self-service capabilities and golden paths (templates, pipelines, environments, portals) that product teams use as a product.                               | Developers get paved roads with security and compliance built in, which cuts cognitive load without a ticket queue.                         | An ops ticket desk; a renamed "DevOps team" silo                                       |
| inner-outer-loop            | Inner loop vs outer loop                              | 3    | any      | Inner loop: edit, build, run and test on your own machine in seconds. Outer loop: PR, CI, review, deploy and operate, over minutes to days.                                        | The two loops need different tools. Make the inner loop fast and send only what needs shared resources to the outer loop.                   | CI                                                                                     |
| value-stream-mapping        | Value stream mapping                                  | 3    | any      | Drawing every step from idea or commit to production, recording working time against waiting time for each.                                                                        | Most lead time is waiting in queues, handoffs and approvals, not working, and that's where to improve.                                      | A process flowchart                                                                    |
| lightweight-change-approval | Lightweight change approval                           | 3    | any      | Replacing external change advisory boards with peer review and automated checks inside the pipeline.                                                                               | DORA found that CABs slow delivery without lowering failure rates. A reviewer close to the change plus automation is safer.                 | Having no controls                                                                     |

## Coverage check

Each source list compared against the catalog. "Folded into" means the item appears inside a
named concept rather than as its own row.

### DORA capability catalog (core model)

| Capability                                                                                      | Where                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuous delivery                                                                             | `continuous-delivery-vs-deployment`, `ci-cd-pipeline`                                                                                                                 |
| Continuous integration                                                                          | `continuous-integration`                                                                                                                                              |
| Deployment automation                                                                           | `ci-cd-pipeline`, `build-once-deploy-many`, `iac-idempotency` (the DORA page stresses the same process everywhere, one package, idempotent steps)                     |
| Database change management                                                                      | `database-migrations-in-pipeline`, `expand-contract-migration`                                                                                                        |
| Test automation                                                                                 | `test-pyramid`, `quality-gates`                                                                                                                                       |
| Test data management                                                                            | Excluded: an important practice, but no distinct mechanism to animate beyond what `ephemeral-environments` and `test-pyramid` show. Data area may cover data masking. |
| Trunk-based development                                                                         | Overlap: owned by Git                                                                                                                                                 |
| Version control                                                                                 | Overlap: owned by Git                                                                                                                                                 |
| Working in small batches                                                                        | `small-batches`                                                                                                                                                       |
| Streamlining change approval                                                                    | `lightweight-change-approval`, `deployment-approvals`                                                                                                                 |
| Pervasive security                                                                              | `devsecops-pipeline`, `shift-left`, `pipeline-secrets`                                                                                                                |
| Monitoring and observability                                                                    | Overlap: owned by Observability                                                                                                                                       |
| Loosely coupled teams                                                                           | Overlap: owned by Architecture (`contract-testing` is the delivery-side enabler)                                                                                      |
| Flexible infrastructure                                                                         | Overlap: Fundamentals (NIST cloud characteristics); `infrastructure-as-code` is the delivery side                                                                     |
| Code maintainability, documentation quality, empowering teams to choose tools                   | Excluded: engineering-culture practices, not delivery mechanisms                                                                                                      |
| Generative culture, job satisfaction, well-being, learning culture, transformational leadership | Excluded: organisational culture, not diagrammable cloud concepts                                                                                                     |
| Platform engineering (AI capabilities list)                                                     | `platform-engineering`                                                                                                                                                |
| AI-accessible internal data, clear AI stance, healthy data ecosystems, user-centric focus       | Excluded: AI-adoption practices; AI systems area if anywhere                                                                                                          |
| Customer feedback, team experimentation                                                         | `ab-testing`, `feature-flags`                                                                                                                                         |
| Visibility of work in the value stream                                                          | `value-stream-mapping`                                                                                                                                                |
| Proactive failure notification, monitoring to inform business decisions                         | Overlap: Observability                                                                                                                                                |
| Visual management, WIP limits                                                                   | Excluded: lean/agile work management, not cloud delivery                                                                                                              |

### DORA metrics

All five current metrics (change lead time, deployment frequency, failed deployment recovery
time, change fail rate, deployment rework rate) are in `dora-metrics`, along with the history:
the original four keys with "time to restore", and 2021's "reliability" as a fifth measure.
They're one concept because the point is how they relate (throughput vs instability), not
each definition on its own.

### Accelerate: the 24 capabilities

- **Continuous delivery (8):** version control → Git; deployment automation, CI, test
  automation, CD → covered above; trunk-based → Git; test data management → excluded (see
  DORA); shift left on security → `shift-left`, `devsecops-pipeline`.
- **Architecture (2):** loosely coupled architecture and empowered teams → Architecture
  overlap.
- **Product and process (4):** customer feedback and team experimentation → `ab-testing`,
  `feature-flags`; value stream → `value-stream-mapping`; small batches → `small-batches`.
- **Lean management and monitoring (5):** lightweight change approval →
  `lightweight-change-approval`; monitoring and proactive health checks → Observability; WIP
  limits and visual management → excluded (work management).
- **Cultural (5):** excluded (organisational culture).

### _Continuous Delivery_ (Humble & Farley)

| Chapter / principle                                                                                            | Where                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Principles: build quality in, small batches, automate repetition, continuous improvement, everyone responsible | `shift-left`, `small-batches`, `ci-cd-pipeline`, `devops`                                                        |
| Ch 2 Configuration management (version everything)                                                             | `pipeline-as-code`, `infrastructure-as-code`; the term's double meaning is flagged on `configuration-management` |
| Ch 3 Continuous integration                                                                                    | `continuous-integration`                                                                                         |
| Ch 4 Testing strategy                                                                                          | `test-pyramid`                                                                                                   |
| Ch 5 Anatomy of the deployment pipeline                                                                        | `ci-cd-pipeline`, `pipeline-stages-jobs-steps`, `build-once-deploy-many`                                         |
| Ch 6 Build and deployment scripting                                                                            | `pipeline-as-code`, `iac-idempotency`                                                                            |
| Ch 7 Commit stage; Ch 8 Automated acceptance testing; Ch 9 Non-functional testing                              | `test-pyramid`, `quality-gates` (load testing itself → Scaling overlap)                                          |
| Ch 10 Deploying and releasing                                                                                  | release strategies group, `rollback-vs-roll-forward`, `deploy-vs-release`                                        |
| Ch 11 Managing infrastructure and environments                                                                 | IaC group, `configuration-management`, `environment-parity`                                                      |
| Ch 12 Managing data                                                                                            | `database-migrations-in-pipeline`, `expand-contract-migration`                                                   |
| Ch 13 Managing components and dependencies                                                                     | `artifact-repository`, `semantic-versioning`, `automated-dependency-updates`                                     |
| Ch 14 Advanced version control                                                                                 | Git overlap                                                                                                      |
| Ch 15 Managing continuous delivery (maturity, risk)                                                            | `dora-metrics`, `release-train`                                                                                  |

### Martin Fowler's articles

- **Continuous Integration** practices: mainline everything, automate the build, self-testing
  build, daily push, every push builds, fix broken builds immediately, keep the build fast →
  `continuous-integration`, `pipeline-triggers`, `test-pyramid`, `build-caching`; hide work in
  progress → `feature-flags`; test in a production clone → `environment-parity`; everyone can
  see → `pull-request-checks`, `dora-metrics`; automate deployment → `ci-cd-pipeline`.
  Semi-integration and pre-integration review → Git overlap.
- **BlueGreenDeployment** → `blue-green-deployment`; its database advice → `expand-contract-migration`.
- **CanaryRelease** → `canary`; canary vs A/B → `ab-testing`; capacity testing in production
  is folded into `canary`.
- **FeatureToggles**: categories, toggle points, toggle router, configuration, carrying cost →
  `feature-flags`, `feature-flag-types`.
- **ParallelChange** → `expand-contract-migration`. **ImmutableServer** (phoenix, snowflake) →
  `immutable-infrastructure`. **Practical Test Pyramid** (contract tests, stage ordering) →
  `test-pyramid`, `contract-testing`.

### Terraform documentation

- Core workflow (write, plan, apply; team workflow with PR plans) → `terraform-plan-apply`,
  `iac-plan-in-pull-request`.
- State (purpose, remote backends, secrets in state, workspaces) → `iac-state-file`;
  locking → `iac-remote-state-locking`.
- Drift (refresh, `-refresh-only`, import then apply) → `infrastructure-drift`.
- Modules → `iac-modules`. Resource graph and parallelism → `iac-dependency-graph`.
- Providers and the HCL language are folded into `terraform-plan-apply` (no separate
  concept: they're syntax, not ideas). Bicep what-if and CloudFormation change sets are the
  same idea in platform form → platform files.

### OpenGitOps, Argo CD, Flux, progressive delivery controllers

- Four principles (declarative; versioned and immutable; pulled automatically; continuously
  reconciled) → `gitops`; pull → `push-vs-pull-deployment`; reconciliation →
  `gitops-reconciliation`.
- Argo CD core concepts (application, target state, live state, sync, sync status, refresh,
  health) → `gitops-reconciliation`, `argocd-sync-and-health`. App-of-apps and ApplicationSets
  are excluded as tool-specific scaling patterns.
- Flux (sources, Kustomization, HelmRelease, bootstrap, image automation, Gitless GitOps via
  OCI) → `gitops-reconciliation`, `gitops-environment-promotion`. Kustomize and Helm themselves
  → Containers.
- Argo Rollouts and Flagger (rollout, analysis, experiments, traffic management; canary, A/B,
  blue/green, blue/green with mirroring) → `progressive-delivery`,
  `automated-canary-analysis`, `shadow-deployment`, `ab-testing`. Traffic-splitting mechanics
  (mesh, ingress weights) → Networking/Containers.

### Microsoft AZ-400 (skills measured as of 27 July 2026)

| Skill area                                                                                                     | Where                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Flow of work, GitHub Flow, feedback cycles, work tracking (Boards, Projects), traceability                     | GitHub Flow → Git. Work tracking excluded: work-management tooling, not a delivery concept.                      |
| DevOps dashboards: cycle time, lead time, time to recovery; metrics for each lifecycle phase                   | `dora-metrics`, `value-stream-mapping`, `flaky-tests` (pipeline health)                                          |
| Wikis, Mermaid, release notes, docs from Git history, webhooks, Teams integration                              | Release notes → `semantic-versioning`; webhooks → `pipeline-triggers`; the rest excluded (collaboration tooling) |
| Source control strategy (branching, PR policies, LFS, Scalar, permissions, tags, recovering and removing data) | Git overlap                                                                                                      |
| Package management: GitHub Packages, Azure Artifacts, feeds, views, upstream sources                           | `artifact-repository`                                                                                            |
| Dependency versioning: SemVer, CalVer; pipeline artifact versioning                                            | `semantic-versioning`, `build-once-deploy-many`                                                                  |
| Quality and release gates incl. security and governance                                                        | `quality-gates`, `deployment-approvals`, `policy-as-code`                                                        |
| Testing strategy (local, unit, integration, load); tests in pipelines; code coverage                           | `test-pyramid`, `quality-gates`, `inner-outer-loop`                                                              |
| Choose GitHub Actions vs Azure Pipelines                                                                       | Excluded: product selection, not a concept                                                                       |
| Runner/agent infrastructure, self-hosted runners, hybrid pipelines, VM templates                               | `ci-runners`                                                                                                     |
| Trigger rules                                                                                                  | `pipeline-triggers`                                                                                              |
| YAML pipelines; classic → YAML migration                                                                       | `pipeline-as-code`                                                                                               |
| Job execution order, parallelism, multi-stage                                                                  | `pipeline-stages-jobs-steps`, `pipeline-parallelism-matrix`                                                      |
| Reusable elements: templates, task groups, variables, variable groups                                          | `reusable-pipeline-templates`, `pipeline-secrets`                                                                |
| Checks and approvals with YAML environments                                                                    | `deployment-approvals`                                                                                           |
| Deployment strategies: blue-green, canary, ring, progressive exposure, feature flags, A/B                      | release strategies group                                                                                         |
| Reliably ordered dependency deployments                                                                        | Folded into `pipeline-stages-jobs-steps` (stage/job dependency graph)                                            |
| Minimise downtime: load balancing, rolling, slots and swap                                                     | `zero-downtime-deployment`, `rolling-update`; slots → Azure                                                      |
| Hotfix path                                                                                                    | Folded into `rollback-vs-roll-forward` and `ring-deployment` (the hotfix fast path through rings)                |
| Resiliency strategy for deployment                                                                             | `progressive-delivery`, `rollback-vs-roll-forward`                                                               |
| Feature flags with Azure App Configuration                                                                     | `feature-flags`; the service → Azure                                                                             |
| Deploy containers, binaries, scripts                                                                           | `container-image-pipeline`, `pipeline-artifacts`                                                                 |
| Deployments that include database tasks                                                                        | `database-migrations-in-pipeline`, `expand-contract-migration`                                                   |
| Configuration management technology and strategy                                                               | `configuration-management`                                                                                       |
| IaC strategy: source control, automated testing and deployment                                                 | `infrastructure-as-code`, `iac-plan-in-pull-request`                                                             |
| Desired state configuration (Automation State Configuration, ARM, Bicep, Machine Configuration)                | `declarative-vs-imperative`, `configuration-management`; services → Azure                                        |
| Azure Deployment Environments                                                                                  | `ephemeral-environments`, `platform-engineering`; service → Azure                                                |
| Pipeline health (failure rate, duration, flaky tests)                                                          | `flaky-tests`                                                                                                    |
| Optimise for cost/time; concurrency                                                                            | `build-caching`, `pipeline-parallelism-matrix`                                                                   |
| Retention for artifacts and dependencies                                                                       | `artifact-repository`                                                                                            |
| Service principals vs managed identities; GitHub Apps, GITHUB_TOKEN, PATs; service connections                 | `pipeline-oidc-federation`, `pipeline-secrets`; identity types → Security/Azure                                  |
| Permissions and roles in GitHub/Azure DevOps; access levels                                                    | Excluded: product administration                                                                                 |
| Key Vault secrets; secretless auth (workload identity federation/OIDC); secure files; preventing leakage       | `pipeline-secrets`, `pipeline-oidc-federation`                                                                   |
| Security and compliance scanning: dependency, code, secret, licence, container, CodeQL, Dependabot alerts      | `devsecops-pipeline`, `automated-dependency-updates`; scanner internals → Security                               |
| Defender for Cloud DevOps Security, GitHub Advanced Security                                                   | Azure/Security overlap                                                                                           |
| Instrumentation (Azure Monitor, App Insights, KQL, GitHub insights, pipeline alerts)                           | Observability and Azure                                                                                          |

### AWS DOP-C02

- **Domain 1, SDLC automation (22%).** 1.1 CI/CD pipelines: code, image and artifact repos →
  `artifact-repository`, `container-image-pipeline`; version-control integration →
  `pipeline-triggers`; build processes → `ci-cd-pipeline`; build/deploy secrets →
  `pipeline-secrets`; deployment strategies → release strategies group; single- vs
  multi-account pipeline patterns → AWS overlap (the generic idea is
  `environment-promotion`); SDLC models (waterfall vs agile) → excluded as general software
  process. 1.2 testing: test types per stage, PR builds, load tests, code coverage, exit
  codes → `test-pyramid`, `pull-request-checks`, `quality-gates`,
  `pipeline-stages-jobs-steps`. 1.3 artifacts: lifecycle and secure management,
  image-build automation → `pipeline-artifacts`, `artifact-repository`, `golden-image`,
  `container-image-pipeline`. 1.4 deployment strategies: mutable vs immutable patterns →
  `immutable-infrastructure`; blue/green, canary → covered; deployment agents → `ci-runners`
  (CodeDeploy agent → AWS); per-platform methods (EC2, ECS, EKS, Lambda) → AWS.
- **Domain 2, configuration management and IaC (17%).** IaC options → `infrastructure-as-code`,
  `declarative-vs-imperative`; change management for IaC → `iac-plan-in-pull-request`,
  `lightweight-change-approval`; configuration management strategies →
  `configuration-management`; reusable templates with governance → `iac-modules`,
  `policy-as-code`; desired-state configuration and compliance → `configuration-management`,
  `policy-as-code`. CloudFormation, SAM, CDK, StackSets, Service Catalog, Organizations,
  Control Tower, Systems Manager, AWS Config and AppConfig → AWS overlap. Account vending and
  SCPs → Security/AWS.
- **Domains 3–6** (resilience, monitoring and logging, incident response, security) →
  Reliability, Observability and Security. Nothing delivery-specific is left over.

### GitHub Actions and Azure Pipelines core concepts

- GitHub Actions: workflow → `pipeline-as-code`; event → `pipeline-triggers`; job and step →
  `pipeline-stages-jobs-steps`; action and reusable workflow → `reusable-pipeline-templates`;
  runner → `ci-runners`; matrix → `pipeline-parallelism-matrix`; cache → `build-caching`;
  artifacts → `pipeline-artifacts`; environments and protection rules →
  `deployment-approvals`; OIDC → `pipeline-oidc-federation`; secrets → `pipeline-secrets`;
  concurrency groups → folded into `deployment-approvals` (one deploy at a time) and
  `pipeline-parallelism-matrix`.
- Azure Pipelines: agents → `ci-runners`; approvals and checks (incl. exclusive lock) →
  `deployment-approvals`; artifacts → `pipeline-artifacts`; CI/CD → covered; deployment jobs
  with `runOnce`/`rolling`/`canary` → `recreate-deployment`, `rolling-update`, `canary`;
  deployment groups → Azure; environments → `environment-promotion`; jobs, stages, steps,
  tasks, scripts → `pipeline-stages-jobs-steps`; library (variable groups, secure files) →
  `pipeline-secrets`; classic releases vs YAML → `pipeline-as-code`; runs and triggers →
  covered.

### Other references

- **Google Cloud strategies** (recreate, rolling, blue/green, canary, A/B, shadow): all six
  have rows.
- **Microsoft safe deployment practices** (progressive exposure, tiers, bake time, feature
  flags, user opt-in, hotfix by severity, zero downtime, deploy in working hours) →
  `ring-deployment`, `progressive-delivery`, `feature-flags`, `zero-downtime-deployment`,
  `rollback-vs-roll-forward`. User opt-in is folded into `ring-deployment`.
- **Google SRE canarying** (canary vs control, metric selection, before/after vs simultaneous)
  → `canary`, `automated-canary-analysis`.
- **CNCF Platforms white paper** (platform as product, self-service, golden paths, reduced
  cognitive load, secure by default) → `platform-engineering`.

### Brief checklist items folded rather than given their own row

- _Immutable artifacts_: part of `build-once-deploy-many`. For container images,
  tags vs digests is owned by Containers.
- _Desired state_: the core of `declarative-vs-imperative` and `gitops-reconciliation`.
- _Provisioning vs configuration_: the "often confused with" pairing on `configuration-management`.
- _Traffic mirroring_: the same mechanism as `shadow-deployment`.
- _Bake time_: part of `ring-deployment`.
- _Artifact retention, upstream sources, feed views_: part of `artifact-repository`.
- _Hotfix path_: part of `rollback-vs-roll-forward`.
- _Smoke tests and post-deployment verification_: part of `quality-gates`.
- _IaC testing (validate, lint, Terratest)_: part of `iac-plan-in-pull-request`.
- _Golden paths and service catalogs/portals_: part of `platform-engineering`.
- _Release notes and conventional commits_: part of `semantic-versioning`.
- _Snowflake and phoenix servers_: part of `immutable-infrastructure`.

## Overlaps

**At home here, also relevant elsewhere:**

| Concept (id)                                                       | Also relevant to             | Note                                                                                                |
| ------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `continuous-integration`, `pull-request-checks`, `merge-queue`     | Git                          | Git owns branching and PRs; the CI behaviour lives here                                             |
| `semantic-versioning`                                              | Git                          | Git owns tags; the meaning of version numbers lives here                                            |
| `monorepo-affected-builds`                                         | Git                          | Git owns monorepo vs polyrepo                                                                       |
| `container-image-pipeline`                                         | Containers                   | Containers owns images, registries and tags vs digests                                              |
| `rolling-update`, `blue-green-deployment`, `canary`                | Containers, platform files   | Containers owns Kubernetes rollout mechanics; Azure/AWS/GCP own slots, CodeDeploy, Cloud Deploy     |
| `gitops-reconciliation`, `argocd-sync-and-health`                  | Containers                   | Kubernetes controllers in general live in Containers                                                |
| `database-migrations-in-pipeline`, `expand-contract-migration`     | Data                         | Data owns schema design and online schema-change tools                                              |
| `pipeline-secrets`, `pipeline-oidc-federation`                     | Security                     | Security owns secret stores and workload identity federation as a mechanism                         |
| `devsecops-pipeline`, `shift-left`, `automated-dependency-updates` | Security                     | Security owns SAST/SCA/DAST, SBOM, signing, SLSA, reproducible builds                               |
| `policy-as-code`                                                   | Security, platform files     | Azure Policy, AWS SCPs and Config rules live in platform files                                      |
| `canary`, `progressive-delivery`, `ring-deployment`                | Reliability                  | Reliability owns blast radius, SLOs, error budgets                                                  |
| `automated-canary-analysis`, `progressive-delivery`                | Observability                | Observability owns the metrics, SLIs and deployment markers they read                               |
| `contract-testing`                                                 | Architecture                 | Architecture owns service boundaries and loose coupling                                             |
| `shadow-deployment`, `ab-testing`                                  | Networking                   | Networking owns traffic splitting and mirroring at load balancers and meshes                        |
| `zero-downtime-deployment`                                         | Networking, Scaling          | Connection draining and health checks at the load balancer                                          |
| `golden-image`, `immutable-infrastructure`                         | Fundamentals, platform files | Pets vs cattle may sit in Fundamentals; EC2 Image Builder and Azure Image Builder in platform files |
| `platform-engineering`, `ephemeral-environments`                   | Azure                        | Azure Deployment Environments                                                                       |
| `feature-flags`                                                    | Azure, AWS                   | Azure App Configuration, AWS AppConfig                                                              |

**At home elsewhere, referenced here:**

| Concept                                                                                                                                                                                          | Home area     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Trunk-based development, feature branches, GitFlow/GitHub Flow, release branches, branch by abstraction, branch protection                                                                       | Git           |
| Container image tags vs digests, multi-stage builds, Helm, Kustomize, Kubernetes Deployment rollout, readiness probes                                                                            | Containers    |
| Software supply chain: SBOM, image signing, SLSA provenance, reproducible/hermetic builds                                                                                                        | Security      |
| Workload identity federation, managed identities, secret vaults                                                                                                                                  | Security      |
| Blast radius, error budgets and release freezes, incident response, postmortems                                                                                                                  | Reliability   |
| Deployment markers, SLIs, alerting                                                                                                                                                               | Observability |
| Load and stress testing                                                                                                                                                                          | Scaling       |
| Strangler fig migration, microservices, loose coupling                                                                                                                                           | Architecture  |
| Deployment slots and swap, App Configuration, Deployment Environments, DSC/Machine Configuration, Bicep what-if                                                                                  | Azure         |
| CodePipeline, CodeBuild, CodeDeploy configurations and hooks, Lambda traffic shifting, Elastic Beanstalk policies, CloudFormation change sets/StackSets/drift detection, multi-account pipelines | AWS           |
| Cloud Build, Cloud Deploy, App Engine traffic splitting, managed instance group canary updates                                                                                                   | Google Cloud  |
