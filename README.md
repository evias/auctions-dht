# re: (auctions) for Tether.to

[![License](https://img.shields.io/badge/License-LGPL%203.0%20only-blue.svg)][license]

**re: (auctions)** is a peer-to-peer auctions house powered by DHTs, developed by [Grégory Saive][parent-url].

This software is part of a technical challenge assignment with Tether.to and should not be used in any production environment.

- [Install notes](#install-notes)
- [License](#license)

**NOTE**: The author(s) and contributor(s) of this package cannot be held responsible for any loss of money or for any malintentioned usage forms of this package. Please use this package with caution.

## Install notes

This software uses [HyperDHT][hyperdht] to power a peer-to-peer auctions house based on *distributed hash tables*.

### Bootstrapping the DHT network

A DHT network is required to run in the background, you can bootstrap one with the following command:

```bash
$ make bootstrap
```

### Creating an auction

```bash
$ npm run start:node-1
```

Title: **This is a cat**
Amount: 123
Upload a file

Then click on **Create an auction**

### Sending offers to an auction via a second node

```bash
$ npm run start:node-2
```

Use title **This is a cat** and **Find auction**

### Sending offers to an auction via a third node

```bash
$ npm run start:node-3
```

Use title **This is a cat** and **Find auction**

### 

## License

Copyright 2024-present [re:Software S.L.][parent-url], All rights reserved.

Licensed under the [LGPL v3.0](LICENSE)


[license]: https://opensource.org/licenses/LGPL-3.0
[parent-url]: https://evi.as
