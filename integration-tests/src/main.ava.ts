import { Worker, NearAccount, ONE_NEAR } from "near-workspaces";
import anyTest, { TestFn } from "ava";

import { Event } from "../../contract/src/types";

const THREE_HUNDRED_TGAS = "300000000000000";

const test = anyTest as TestFn<{
  worker: Worker;
  accounts: Record<string, NearAccount>;
}>;

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = await Worker.init();

  // Deploy contract
  const root = worker.rootAccount;
  const contract = await root.createSubAccount("test-account");
  // Get wasm file path from package.json test script in folder above
  await contract.deploy(process.argv[2]);

  // Save state for test runs, it is unique for each test
  t.context.worker = worker;
  t.context.accounts = { root, contract };
});

test.afterEach.always(async (t) => {
  // Stop Sandbox server
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("create a new event and get it from the contract", async (t) => {
  const { contract } = t.context.accounts;

  const now = new Date().toISOString()

  const { id: event_id } = <Event>await contract.call(
    contract,
    "create_event",
    {
      name: "test",
      type: "irl",
      category: "test",
      status: "published",
      description: "test",
      start_date: now,
      end_date: now,
      location: "here",
      images: [],
      links: [],
    },
    {
      attachedDeposit: ONE_NEAR,
      gas: THREE_HUNDRED_TGAS,
    }
  );


  const event = <Event>await contract.view("get_event", { event_id: event_id })

  const comparable = { ...event }
  delete (comparable as any).created_at
  delete (comparable as any).last_updated_at

  t.deepEqual(comparable, {
    name: "test",
    type: "irl",
    category: "test",
    status: "published",
    description: "test",
    start_date: now,
    end_date: now,
    owner_account_id: contract.accountId,
    id: event_id,
    location: "here",
    images: [],
    links: []
  });

  // compare created_at and last_updated_at are in range of +- 10 seconds
  const created_at = new Date(event.created_at)
  const last_updated_at = new Date(event.last_updated_at)
  const nowDate = new Date(now)

  t.true(created_at.getTime() - nowDate.getTime() < 10000)
  t.true(last_updated_at.getTime() - nowDate.getTime() < 10000)
});

test("create a new event and get all the events from the contract", async (t) => {
  const { contract } = t.context.accounts;
  const evt = <Event>await contract.call(
    contract,
    "create_event",
    {
      name: "test",
      type: "irl",
      category: "test",
      status: "published",
      description: "test",
      start_date: "2023-01-11T14:54:06.652Z",
      end_date: "2023-01-12T14:54:06.652Z",
      location: "here",
      images: [],
      links: [],
    },
    {
      attachedDeposit: ONE_NEAR,
      gas: THREE_HUNDRED_TGAS,
    }
  );

  const events = await contract.view("get_all_events", {});

  t.deepEqual(events, [evt]);
});

test("create a new event and delete it", async (t) => {
  const { contract } = t.context.accounts;
  const { id: event_id } = <Event>await contract.call(
    contract,
    "create_event",
    {
      name: "test",
      type: "irl",
      category: "test",
      status: "published",
      description: "test",
      start_date: "2023-01-11T14:54:06.652Z",
      end_date: "2023-01-12T14:54:06.652Z",
      location: "here",
      images: [],
      links: [],
    },
    {
      attachedDeposit: ONE_NEAR,
      gas: THREE_HUNDRED_TGAS
    }
  );

  await contract.call(contract, "remove_event", { event_id });

  const event = await contract.view("get_event", { event_id });

  t.falsy(event);
});

test("create a new event and update the description", async (t) => {
  const { contract } = t.context.accounts;
  const { id: event_id } = <Event>await contract.call(
    contract,
    "create_event",
    {
      name: "test",
      type: "irl",
      category: "test",
      status: "published",
      description: "test",
      start_date: "2023-01-11T14:54:06.652Z",
      end_date: "2023-01-12T14:54:06.652Z",
      location: "here",
      images: [],
      links: [],
    },
    { attachedDeposit: ONE_NEAR, gas: THREE_HUNDRED_TGAS }
  );

  const updatedEvent = <Event>await contract.call(
    contract,
    "update_event",
    {
      event_id: event_id,
      event: { description: "test2" },
    },
    { attachedDeposit: ONE_NEAR, gas: THREE_HUNDRED_TGAS }
  );

  const updatedEventFromApi = <Event>await contract.view("get_event", {
    event_id: event_id,
  });

  t.deepEqual(updatedEvent, updatedEventFromApi);
});
