# Contributing

#### **Please Read Before Making Changes❗❗**

Contributions are welcome and appreciated. Free Sleep is open source, but it is maintainer-led and prioritizes stability for real users on real hardware over rapid experimentation.


## RULE #1 — COORDINATE BEFORE YOU START ❗
- Send a message in the Discord server and tag @free_sleep before starting any new feature 
  - Small bug fixes or changes under ~100 lines are welcome without prior discussion.
- Do not expect changes to be merged without **explicit prior approval**.
- This helps avoid duplicate work and misaligned expectations.
- Work started without coordination may be declined regardless of effort.

## 🚫 Core Project Policies 🚫

To keep Free Sleep stable, predictable, and easy for everyone to work on, there are a few core parts of the project that should not be changed without explicit discussion first:

## 1. Project Direction & Ownership
- Free Sleep is not a shared-ownership or consensus-driven project.
- Final decisions on scope, architecture, and merges rest with the maintainer.
- Open source means the code is public and contributions are welcome — it does not mean all changes will be merged.

**If you strongly disagree with the project’s direction, forking is the intended and encouraged path.**


## 2. UI rewrites
- You’re welcome to suggest UI changes or provide mockups.
- Suggestions or mockups do not guarantee approval or implementation.
- UI is subjective, and repeated redesigns create churn and instability.

If you want to explore an alternative UI direction, please do so in a fork or separate branch.

## 3. Don’t switch core tooling
Tools like:
- Volta (for Node version management)
- npm (for package management)
- TypeScript
- Prettier / ESLint configuration

These are intentionally chosen and should not be replaced with alternatives like Bun, Yarn, or other system-wide changes.

If you think a tool could be upgraded or swapped, please discuss it first in Discord. The Pod has a finicky environment and stability is important.


## 4. Avoid editing shell scripts unless necessary
- The scripts in scripts/*.sh handle installation, updates, and automation across many Pods in real homes.
- Small changes can break installs or updates for users, so:
  - Don’t modify shell scripts unless absolutely needed.
  - Open an issue or discuss changes on Discord before making a PR.


## 5. Code Style & Quality
- Run `npm run lint` & `npm run build` in both server/ and app/ before opening a PR.
- Keep changes clean, consistent, and focused on a single purpose.


## 6. Git & Pull Requests
- Your branch must be conflict-free with main before submitting.
- I don’t have bandwidth to resolve merge conflicts for contributors.
- Write clear commit messages so others can understand your changes.
- Test your changes on an actual Pod if possible, or clearly describe what environment you used.


## 7. TypeScript Only
- All contributions must be in TypeScript — no JavaScript or mixed-language files.


## 8. Keep PRs Small
- Smaller, focused PRs are much easier to review and merge quickly.
- Large “kitchen sink” PRs will be delayed or rejected.
- Test your changes.


## 9. Be Respectful of Stability
- Free Sleep runs on real hardware that people depend on every night.
- **Please avoid** risky changes without testing or discussion first.
