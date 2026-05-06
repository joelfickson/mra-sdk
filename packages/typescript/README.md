# mra-sdk

TypeScript SDK for the [Malawi Revenue Authority Electronic Invoicing System (EIS)](https://eis-api.mra.mw/docs/) API.

Unofficial, community-maintained. Not affiliated with the Malawi Revenue Authority.

## Install

```sh
npm install mra-sdk
```

## Quick start

```ts
import { MraEis, InMemoryTokenStore } from 'mra-sdk';

const client = new MraEis({
  baseUrl: 'https://eis-api.mra.mw',
  tokenStore: new InMemoryTokenStore(),
});

const result = await client.sales.submit(invoice);
```

See the [docs](https://github.com/joelfickson/mra-sdk) for the full guide, offline-mode walkthrough, and signing setup.

## License

MIT
