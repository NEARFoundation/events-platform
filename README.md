Near Events
==================

This app was initialized with [create-near-app]

Quick Start
===========

If you haven't installed dependencies during setup:

    yarn

Build and deploy your contract to *Mainnet* with a temporary dev account:

    NEAR_ENV=mainnet near login
    yarn build
    NEAR_ENV=mainnet deploy --accountId YOUR_ACCOUNT_ID_ON_MAINNET --wasmFile contract/build/events.wasm

Exploring The Code
==================

1. The smart-contract code lives in the `/contract` folder. See the README there for
   more info. In blockchain apps, the smart contract is the "backend" of your app.
2. The near.social code lives in the `/near.social` folder.
3. Test your contract: `yarn test`, this will run the tests in the `integration-tests` directory.

Development
===========

0. Adjust Environment Variables in `near.social/.env` file
1. Run the local development environment:

    yarn start

This will start the local near.social dev-server which will automatically redeploy your widgets on near.social

## Features

1. Automatic redeployment:
    Widgets will automatically be redeployed on near.social when you change the code in the `widgets` folder.
2. Automatic widget registration:
    Widgets will be named after the folder they are in, so if you want to deploy a widget called `my-widget`, you should
    create a file called `component.jsx` in the `widgets` folder. Nested folders will be flattened, so if you
    you create a file called `my-widget/component.jsx`, the widget will be named `my-widget__component` on near.social.
3. env var substitution:
    You can use environment variables in your widget code. For example, any occurence of `{{ env.MY_VAR  }}` will be replaced with
    the value of the `MY_VAR` environment variable from an .env file. .env files are loaded from the `widgets` folder
    and from the widget file's context. For example, if you have a file called `widgets/my-widget/.env`
    and a file called `widgets/my-widget/component.jsx`, the .env file will be loaded for the `component.jsx` file.
    This works recursively, so if you have a file called `widgets/.env` and a file called `widgets/my-widget/nested/component.jsx`,
    the .env file will also be loaded for the `component.jsx` file. Only the topmost .env file will be loaded for each widget file.
    If you want a widget to have its own .env file, you can create a folder for it and put the .env file in that folder. For example,
    if you have a file called `widgets/my-widget/component.jsx` and a file called `widgets/my-widget/component/.env`,
    the .env file will be loaded for the `component.jsx` file, but not for any other widget files except for child widget files in the
    `component` folder.
4. Speed
    Widgets will be deployed on near.social as soon as you change the code in the `widgets` folder. This means that you can
    develop your widgets locally and deploy them on near.social as soon as you're ready.
5. App-like structure
   Widgets following this structure will have access to common components and utilities:
    1. Widgets can render child widgets by referencing their names (e.g. `renderComponent('some_widget.child.another', {})`).
    2. Widgets can within layouts (e.g. `renderComponent('some_widget.child.another', {}, 'container')`).
    3. Router with methods for navigating between pages (e.g. `push('some_widget')` and `pop()`).
    4. Shared Components (e.g. `props.__.Components.Button`).
    5. Overlays/Modals via layouts (e.g. `renderComponent('some_widget.child.another', {}, 'modal')`). This is useful for
       widgets that need to render a modal on top of the current page.

## Structure

1. `widgets` folder:
    This folder contains all the widgets that will be deployed on near.social. Each widget should be in its own folder.
    The folder name will be used as the widget name. For example, if you have a file called `widgets/my-widget/component.jsx`,
    the widget will be named `my-widget__component` on near.social. Nested folders will be flattened, so if you
    you create a file called `my-widget/parent/component.jsx`, the widget will be named `my-widget__parent__component` on near.social.
2. `widgets/.env` file:
    This file contains environment variables that will be used for all widgets. You can override these variables in the
    widget's .env file.
3. *TODO*: automatic upload of widget metadata
   1. - [ ] read metadata file from disc
   2. - [ ] check if image files from metadata file exist on ipfs
   3. - [ ] upload images from metadata file to ipfs
   4. - [ ] set metadata file for widget

## Open TODOs

- [ ] refactor layouting mechanism to be able to register layouts from within the component. This enables us to use to save the state of the router in the Storage, Currently callbacks like onClick cannot be saved to Storage, which causes the state of the router to be lost when the page is refreshed.
- [ ] metadata support for widgets (not a pressing issue, can be done in the web-ui)
- [ ] purging of all widgets of a user

Later:

- [ ] VSCode extension for widget development (live preview, mocking of widgets)

Deploy
======

Every smart contract in NEAR has its [own associated account][NEAR accounts].
When you run `yarn deploy`, your smart contract gets deployed to the live NEAR *TestNet* with a temporary dev account.
When you're ready to make it permanent, here's how:

Step 0: Install the `near-cli` (optional)
-------------------------------------

[near-cli] is a command line interface (CLI) for interacting with the NEAR blockchain. It was installed to the local
`node_modules` folder when you ran `yarn`, but for best ergonomics, you may want to install it globally:

    yarn global add near-cli

Or, if you'd rather use the locally-installed version, you can prefix all `near` commands with `yarn`

Ensure that it's installed with `near --version` (or `yarn near --version`)

Step 1: Create an account for the contract
------------------------------------------

Each account on NEAR can have at most one contract deployed to it. If you've already created an account such as
`your-name.testnet`, you can deploy your contract to `near-blank-project.your-name.testnet`. Assuming you've
already created an account on [NEAR Wallet], here's how to create `near-blank-project.your-name.testnet`:

1. Authorize NEAR CLI following the commands it gives you:

      near login

2. Create a subaccount (replace `YOUR-NAME` below with your actual account name):

      near create-account near-blank-project.YOUR-NAME.testnet --masterAccount YOUR-NAME.testnet

Step 2: Deploy the contract
---------------------------

Use the CLI to deploy the contract to TestNet with your account ID.
Replace `PATH_TO_WASM_FILE` with the `wasm` that was generated in the `contract` build directory.

    near deploy --accountId near-blank-project.YOUR-NAME.testnet --wasmFile PATH_TO_WASM_FILE

-----------------------------------------------

Troubleshooting
===============

On Windows, if you're seeing an error containing `EPERM` it may be related to spaces in your path. Please see
[this issue](https://github.com/zkat/npx/issues/209) for more details.

  [create-near-app]: https://github.com/near/create-near-app
  [NEAR accounts]: https://docs.near.org/concepts/basics/account
  [NEAR Wallet]: https://wallet.testnet.near.org/
  [near-cli]: https://github.com/near/near-cli
