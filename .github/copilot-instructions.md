Check the package.json for the scripts availble. Use the `npm run` command to run scripts.

To run the tests `npm test`.
To run a build use `npm run build`. (lint and build) 
To fix linting errors, run `npm run lint:fix`.
To run the test server, run `npm run start:dev`.

**IMPORTANT**: Always use `npm test` to run tests - this ensures they are built properly first. 
You cannot run individual test files directly with node - they must go through the build process.
To check for specific test output, use `npm test | grep "pattern"` to filter results.
