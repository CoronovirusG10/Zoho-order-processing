Read-only application code status check.

On /data/order-processing:
- search for code directories and list them
- if you find a codebase:
  - list top-level files
  - locate package manager files (package.json, pnpm-lock.yaml, yarn.lock, requirements.txt, pyproject.toml, *.csproj)
  - list available build/test scripts without running installs
  - run `node -v`, `npm -v` or `python --version` as appropriate
- if you do not find a codebase, state clearly that this is still a documentation-only project.

Output: what exists, what is missing, and the minimum next step to start implementation.
