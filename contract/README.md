# Events platform smart contract

# Quickstart

1. Make sure you have installed [node.js](https://nodejs.org/en/download/package-manager/) >= 16.
2. Install the [`NEAR CLI`](https://github.com/near/near-cli#setup)

<br />

## 1. Build and Deploy the Contract

You can automatically compile and deploy the contract in the NEAR testnet by running:

```bash
yarn run deploy
```

Once finished, check the `neardev/dev-account` file to find the address in which the contract was deployed:

```bash
cat ./neardev/dev-account
# e.g. dev-1659899566943-21539992274727
```

<br />

## 2. Create an event

`create_event` changes the contract's state, so it is a `call` method.

`Call` methods can only be invoked using a NEAR account since the account needs to pay GAS for the transaction.

```bash
# Use near-cli to create a new event
near call <dev-account> create_event '{"name":"test","type":"irl","category":"test","status":"published","description":"test","start_date":"2023-01-11T14:54:06.652Z","end_date":"2023-01-12T14:54:06.652Z","location":"here","image":[],"links":[]}' --accountId <dev-account> --deposit 1
```

**Tip:** If you would like to call `create_event` using your account, first login into NEAR using:

```bash
# Use near-cli to login your NEAR account
near login
```

and then use the logged account to sign the transaction: `--accountId <your-account>`.

<br />

## 3. Get an existing event

`get_event` does not change the contract state, it only reads it so it is a `view` method.

`View` methods can be called for **free** by anyone, even people **without a NEAR account**!

```bash
# Use near-cli to get an existing event
near view <dev-account> get_event '{"event_id":"test"}'
```

<br />

## 4. Get all existing events

`get_all_events` does not change the contract state, it only reads it so it is a `view` method.

```bash
# Use near-cli to get all existing events
near view <dev-account> get_all_events '{}'
```

<br />

## 5. Get all events created by a specified account ID

`get_all_events_by_account` does not change the contract state, it only reads it so it is a `view` method.

```bash
# Use near-cli to get all existing events
near view <dev-account> get_all_events_by_account '{"account_id":"<dev-account>"}'
```

<br />

## 6. Update an existing event

`update_event` changes the contract's state, so it is a `call` method.

```bash
# Use near-cli to update an existing event
near call <dev-account> update_event '{"event_id":"test","event":{"description":"test2"}}' --accountId <dev-account>
```

**Note:** Keep in mind that if you created the event with your account you will also have to update it using the same account.

<br />

## 7. Delete an existing event

`remove_event` changes the contract's state, so it is a `call` method.

```bash
# Use near-cli to delete an existing event
near call <dev-account> remove_event '{"event_id":"test"}' --accountId <dev-account>
```

**Note:** Keep in mind that if you created the event with your account you will also have to delete it using the same account.
