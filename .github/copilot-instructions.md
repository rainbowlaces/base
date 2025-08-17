Check the package.json for the scripts availble. Use the `npm run` command to run scripts.

first switch to the project directory:
```bash
cd packages/base
```

To run the tests `pnpm test`.
To run a build use `pnpm build`. (lint and build) 
To fix linting errors, run `pnpm lint:fix`.
To run the test server, run `pnpm start:dev`.

**IMPORTANT**: 
Always use `pnpm test` to run tests - this ensures they are built properly first. 
You cannot run individual test files directly with node - they must go through the build process.
To check for specific test output, use `pnpm test:spec | grep "pattern"` to filter results. 

DO NOT GREP THE DOT REPORTER OUTPUT - use the full test:spec command instead.

We use the dot reporter `pnpm test` for concise output, so you generally shouldn't need to filter unless looking for specific 
test names or errors.

Generally, run all the tests. They are fast. Don't test in isolation unless you are debugging a specific issue.
