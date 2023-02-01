import { NearAccount } from "near-workspaces";

import { Event, EventList, CreateEvent } from "../../contract/src/types";
import { test, THREE_HUNDRED_TGAS, ONE_NEAR } from "./_setup";

async function createEvent(
  contract: NearAccount,
  executingUser?: NearAccount
): Promise<Event> {
  const now = new Date().toISOString();

  const executingAccount = executingUser || contract;

  return <Event>await executingAccount.call(
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
}

async function createEventList(
  contract: NearAccount,
  executingUser?: NearAccount
): Promise<EventList> {
  const executingAccount = executingUser || contract;
  return <EventList>await executingAccount.call(
    contract,
    "create_event_list",
    {
      name: "test",
      description: "test 2",
    },
    {
      attachedDeposit: ONE_NEAR,
      gas: THREE_HUNDRED_TGAS,
    }
  );
}

async function addEventToEventList(
  contract: NearAccount,
  event_id: string,
  event_list_id: string
): Promise<void> {
  return <void>await contract.call(
    contract,
    "add_event_to_event_list",
    {
      event_id,
      event_list_id,
    },
    {
      attachedDeposit: ONE_NEAR,
      gas: THREE_HUNDRED_TGAS,
    }
  );
}

async function getEventList(
  contract: NearAccount,
  event_list_id: string
): Promise<EventList> {
  return <EventList>(
    await contract.view("get_event_list", { event_list_id: event_list_id })
  );
}

async function createEventAndList(
  contract: NearAccount
): Promise<{ event: Event; event_list: EventList }> {
  const { id: event_list_id } = <EventList>await createEventList(contract);
  const event = <Event>await createEvent(contract);
  await addEventToEventList(contract, event.id, event_list_id);
  const event_list = <EventList>await getEventList(contract, event_list_id);
  return { event, event_list };
}

async function getEvent(
  contract: NearAccount,
  event_id: string
): Promise<Event> {
  return <Event>await contract.view("get_event", { event_id: event_id });
}

async function removeEventFromEventList(
  contract: NearAccount,
  event_id: string,
  event_list_id: string
): Promise<void> {
  return <void>await contract.call(
    contract,
    "remove_event_from_event_list",
    {
      event_id,
      event_list_id,
    },
    {
      attachedDeposit: ONE_NEAR,
      gas: THREE_HUNDRED_TGAS,
    }
  );
}

async function createAccount(
  root: NearAccount,
  name: string
): Promise<NearAccount> {
  return <NearAccount>await root.createSubAccount(name);
}

test("create a event_list and get it from the contract", async (t) => {
  const { contract } = t.context.accounts;

  const now = new Date().toISOString();

  const { id: event_list_id } = <EventList>await contract.call(
    contract,
    "create_event_list",
    {
      name: "test",
      description: "test 2",
    },
    {
      attachedDeposit: ONE_NEAR,
      gas: THREE_HUNDRED_TGAS,
    }
  );

  const event_list = <EventList>(
    await contract.view("get_event_list", { event_list_id: event_list_id })
  );

  const comparable = { ...event_list };
  delete (comparable as any).created_at;
  delete (comparable as any).last_updated_at;

  // this will for now fail
  t.deepEqual(comparable, {
    name: "test",
    description: "test 2",
  });

  // compare created_at and last_updated_at are in range of +- 10 seconds
  const created_at = new Date(event_list.created_at);
  const last_updated_at = new Date(event_list.last_updated_at);
  const nowTime = new Date(now).getTime();
  t.true(created_at.getTime() - nowTime < 10000);
  t.true(last_updated_at.getTime() - nowTime < 10000);
});

test("create a event_list and add event to it", async (t) => {
  const { contract } = t.context.accounts;

  const now = new Date().toISOString();

  const { event, event_list } = <{ event: Event; event_list: EventList }>(
    await createEventAndList(contract)
  );

  const comparable = {
    ...(
      event_list as unknown as Array<{
        event_id: string;
        added_by: string;
        last_updated_by: string;
        last_updated_at: string;
      }>
    )[0],
  };

  delete (comparable as any).last_updated_at;

  t.deepEqual(comparable, {
    event_id: event.id,
    added_by: contract.accountId,
    last_updated_by: contract.accountId,
  });

  // compare  last_updated_at are in range of +- 10 seconds
  const last_updated_at = new Date(
    (
      event_list.events as unknown as Array<{ last_updated_at: string }>
    )[0].last_updated_at
  );
  const nowTime = new Date(now).getTime();
  t.true(last_updated_at.getTime() - nowTime < 10000);
});

test("create a event_list add event and remove event", async (t) => {
  const { contract } = t.context.accounts;

  const { event, event_list } = await createEventAndList(contract);

  await removeEventFromEventList(contract, event.id, event_list.id);

  const { events } = await getEventList(contract, event_list.id);

  t.deepEqual(events, []);
});

test("can get eventList by any user", async (t) => {
  const { contract: listOwner, root } = t.context.accounts;
  const otherAccount = await createAccount(root, "other");

  const { event, event_list } = await createEventAndList(listOwner);

  const { events } = await getEventList(otherAccount, event_list.id);

  const comparable = {
    ...(
      events as unknown as Array<{
        event_id: string;
        added_by: string;
        last_updated_by: string;
        last_updated_at: string;
      }>
    )[0],
  };

  delete (comparable as any).last_updated_at;

  t.deepEqual(comparable, {
    event_id: event.id,
    added_by: listOwner.accountId,
    last_updated_by: listOwner.accountId,
  });
});

test("cannot add the same event twice", async (t) => {
  const { contract } = t.context.accounts;

  const { event, event_list } = await createEventAndList(contract);

  await t.throwsAsync(
    async () => {
      await addEventToEventList(contract, event.id, event_list.id);
    },
    {
      message: "ERR_EVENT_ALREADY_IN_EVENT_LIST",
    }
  );
});

test("cannot remove event that is not in the event list", async (t) => {
  const { contract } = t.context.accounts;

  const { event, event_list } = await createEventAndList(contract);

  await t.throwsAsync(
    async () => {
      await removeEventFromEventList(contract, event.id, event_list.id);
    },
    {
      message: "ERR_EVENT_NOT_IN_EVENT_LIST",
    }
  );
});

test("cannot add event to non existing event list", async (t) => {
  const { contract } = t.context.accounts;

  const event = await createEvent(contract);

  await t.throwsAsync(
    async () => {
      await addEventToEventList(contract, event.id, "non_existing_event_list");
    },
    {
      message: "ERR_EVENT_LIST_NOT_FOUND",
    }
  );
});

test("cannot remove event from non existing event list", async (t) => {
  const { contract } = t.context.accounts;

  const event = await createEvent(contract);

  await t.throwsAsync(
    async () => {
      await removeEventFromEventList(
        contract,
        event.id,
        "non_existing_event_list"
      );
    },
    {
      message: "ERR_EVENT_LIST_NOT_FOUND",
    }
  );
});

test("cannot get non existing event list", async (t) => {
  const { contract } = t.context.accounts;

  await t.throwsAsync(
    async () => {
      await getEventList(contract, "non_existing_event_list");
    },
    {
      message: "ERR_EVENT_LIST_NOT_FOUND",
    }
  );
});

test("can add events created by any user", async (t) => {
  const { contract: listOwner, root } = t.context.accounts;
  const otherAccount = await createAccount(root, "other");
  const event = await createEvent(listOwner, otherAccount);
  const event_list = await createEventList(listOwner);

  await addEventToEventList(listOwner, event.id, event_list.id);

  const { events } = await getEventList(listOwner, event_list.id);

  const comparable = {
    ...(
      events as unknown as Array<{
        event_id: string;
        added_by: string;
        last_updated_by: string;
        last_updated_at: string;
      }>
    )[0],
  };

  delete (comparable as any).last_updated_at;

  t.deepEqual(comparable, {
    event_id: event.id,
    added_by: listOwner.accountId,
    last_updated_by: listOwner.accountId,
  });
});

test("can remove events created by any user", async (t) => {
  const { contract: listOwner, root } = t.context.accounts;
  const otherAccount = await createAccount(root, "other");
  const event = await createEvent(listOwner, otherAccount);
  const event_list = await createEventList(listOwner);

  await addEventToEventList(listOwner, event.id, event_list.id);

  await removeEventFromEventList(listOwner, event.id, event_list.id);

  const { events } = await getEventList(listOwner, event_list.id);

  t.deepEqual(events, []);
});
