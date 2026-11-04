# tyxter-cli

Compatibility command for the official [@tyxter/cli](https://www.npmjs.com/package/@tyxter/cli).
Both packages are maintained by Tyxter and run the same CLI version.

Requires Node.js 22.12 or newer. No Docker or pnpm installation is needed.

```bash
npx @tyxter/cli --help
npx tyxter-cli --help
```

Set `TYXTER_API_KEY` to your sandbox key in your environment, then start the
listener with either package:

```bash
npx tyxter-cli listen --from-now --forward-to http://localhost:3000/webhooks/tyxter
```

See the [CLI documentation](https://github.com/tyxter/tyxter-cli#readme) for
webhook verification, state persistence, diagnostics, and commands.
