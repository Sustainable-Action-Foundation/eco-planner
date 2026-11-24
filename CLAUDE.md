@AGENTS.md
@docs/context/

- yarn, not npm or npx.
- planning lives on the GitHub project board "Koordineradklimatomställning" (Sustainable-Action-Foundation, project 6). keep it up to date with the work: check for a matching card/issue when starting something, and update/move cards when work lands. issues resolved by a PR should be referenced with "Closes #N".
- `yarn lint` to run tsc and eslint.
- generally work in worktrees unless being asked to work on dev explicitly. main is never worked on.
  - don't be so damn verbose in commit messages :skull:
- enum-ish consts are PascalCase, their keys are PascalCase, and the values are UPPER_SNAKE. the type is also exported with the same name next to the const
```ts
export const GraphType = {
  Main: "MAIN",
  Relative: "RELATIVE",
  Delta: "DELTA",
} as const;
export type GraphType = (typeof GraphType)[keyof typeof GraphType];
```
- when adding ui components, look at the existing generic components that could be used.
- in worktrees, symlink env file (unless incompatible db for instance) so i can evaluate the work easier
- agents: commit with plain `git commit` and the normal git config — never override user.email/user.name or --author.
- in commit messages, use lowercase for the first letter and be consise (2-15 words). Not a hard rule. 