# Simple Node Application

Includes:

- ES6 Modules
- Typescript
- Express
- Debug support in VS Code

Inspired by: https://medium.com/create-a-server-with-nodemon-express-typescript/create-a-server-with-nodemon-express-typescript-f7c88fb5ee71

## Setup

- From the [repo](https://github.com/johnnyoshika/minimal-node-typescript), select `Use this template` -> `Create a new repository`.
- Clone the new repo that was created.
- Run `npm ci` to install dependencies.
- Copy `.env.example` to `.env`.

## Start

```
npm start
```

## Debug in VS Code

<kbd>F5</kbd>

_Note: Re-compile on file change isn't available in debug mode, so stop/start is required to reflect code changes._

## Build

```
npm run build
```

Deployable build will be in `dist` folder.

Command to run production app in Linux / macOS:

```
NODE_PATH=dist/ node ./dist/index.js
```

Command to run production app in Windows:

```
$env:NODE_PATH="dist/"
node ./dist/index.js
```

Explanation of `NODE_PATH=dist/`: https://stackoverflow.com/a/65867369/188740
