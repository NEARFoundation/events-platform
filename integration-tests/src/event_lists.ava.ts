import { NearAccount } from "near-workspaces";

import {
  Event,
  EventList,
  CreateEvent,
  EventListApiResponse,
} from "../../contract/src/types";
import { test, THREE_HUNDRED_TGAS, ONE_NEAR } from "./_setup";
import { EventListEventEntryApiResponse } from "../../contract/src/types";

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
): Promise<EventListApiResponse> {
  const executingAccount = executingUser || contract;
  return <EventListApiResponse>await executingAccount.call(
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

async function updateEventList(
  contract: NearAccount,
  event_list_id: string,
  event_list: Partial<EventList>
): Promise<EventListApiResponse> {
  return <EventListApiResponse>await contract.call(
    contract,
    "update_event_list",
    {
      event_list_id,
      event_list,
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
): Promise<EventList | null> {
  return <EventList | null>(
    await contract.view("get_event_list", { event_list_id: event_list_id })
  );
}

async function createEventAndList(
  contract: NearAccount
): Promise<{ event: Event; event_list: EventList }> {
  const { id: event_list_id } = <EventListApiResponse>await createEventList(contract);
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

async function getEventsFromList(
  contract: NearAccount,
  event_list_id: string
): Promise<EventListEventEntryApiResponse[]> {
  return (await (<EventListApiResponse>await contract.view("get_event_list", {
    event_list_id: event_list_id,
    include_events: true,
  }))).events as unknown as EventListEventEntryApiResponse[];
}

test("create a event_list and get it from the contract", async (t) => {
  const { contract } = t.context.accounts;

  const now = new Date().toISOString();

  const { id: event_list_id } = <EventListApiResponse>await contract.call(
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

  const event_list = <EventListApiResponse>(
    await contract.view("get_event_list", { event_list_id: event_list_id })
  );

  const comparable = { ...event_list };
  delete (comparable as any).created_at;
  delete (comparable as any).last_updated_at;
  delete (comparable as any).permissions;
  delete (comparable as any).events;

  // this will for now fail
  t.deepEqual(comparable, {
    name: "test",
    description: "test 2",
    id: event_list_id,
    owner_account_id: contract.accountId,
    event_count: 0,
    has_events: false,
  });

  // compare created_at and last_updated_at are in range of +- 100 seconds
  const created_at = new Date(event_list.created_at);
  const last_updated_at = new Date(event_list.last_updated_at);
  const nowTime = new Date(now).getTime();
  t.true(created_at.getTime() - nowTime < 100000);
  t.true(last_updated_at.getTime() - nowTime < 100000);
});

test("create a event_list and add event to it", async (t) => {
  const { contract } = t.context.accounts;

  const now = new Date().toISOString();

  const { event, event_list } = <{ event: Event; event_list: EventList }>(
    await createEventAndList(contract)
  );

  const events = await getEventsFromList(contract, event_list.id);

  const comparable = {
    ...events[0],
  };

  delete (comparable as any).last_updated_at;

  t.deepEqual(comparable, {
    event: event,
    added_by: contract.accountId,
    last_updated_by: contract.accountId,
    position: 0,
  });

  // compare  last_updated_at are in range of +- 100 seconds
  const last_updated_at = new Date(events[0].last_updated_at);
  const nowTime = new Date(now).getTime();
  t.true(last_updated_at.getTime() - nowTime < 100000);
});

test("create a event_list add event and remove event", async (t) => {
  const { contract } = t.context.accounts;

  const { event, event_list } = await createEventAndList(contract);

  await removeEventFromEventList(contract, event.id, event_list.id);

  const events = await getEventsFromList(contract, event_list.id);

  t.deepEqual(events, []);
});

test("can get eventList by any user", async (t) => {
  const { contract: listOwner, root } = t.context.accounts;
  const otherAccount = await createAccount(root, "other");

  const { event, event_list } = await createEventAndList(listOwner);

  const events = await getEventsFromList(listOwner, event_list.id);

  const comparable = {
    ...events[0],
  };

  delete (comparable as any).last_updated_at;

  t.deepEqual(comparable, {
    event: event,
    position: 0,
    added_by: listOwner.accountId,
    last_updated_by: listOwner.accountId,
  });
});

test("cannot add the same event twice", async (t) => {
  const { contract } = t.context.accounts;

  const { event, event_list } = await createEventAndList(contract);

  await t.throwsAsync(
    async () => {
      await addEventToEventList(contract, event.id, event_list.id).catch(
        (e) => {
          if (e.message.includes("is already in the event list with id")) {
            throw new Error("ERR_EVENT_ALREADY_IN_EVENT_LIST");
          }
          throw e;
        }
      );
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
      await removeEventFromEventList(contract, "non_el", event_list.id).catch(
        (e) => {
          if (e.message.includes("The event with id: non_el does not exist!")) {
            throw new Error("ERR_EVENT_NOT_IN_EVENT_LIST");
          }
          throw e;
        }
      );
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
      await addEventToEventList(contract, event.id, "non_evl").catch((e) => {
        if (
          e.message.includes("The event_list with id: non_evl does not exist!")
        ) {
          throw new Error("ERR_EVENT_LIST_NOT_FOUND");
        }
        throw e;
      });
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
      await removeEventFromEventList(contract, event.id, "non_evl").catch(
        (e) => {
          if (
            e.message.includes("The event_list with id: non_evl does not exist")
          ) {
            throw new Error("ERR_EVENT_LIST_NOT_FOUND");
          }
          throw e;
        }
      );
    },
    {
      message: "ERR_EVENT_LIST_NOT_FOUND",
    }
  );
});

test("cannot get non existing event list", async (t) => {
  const { contract } = t.context.accounts;

  const el = await getEventList(contract, "non_evl");

  t.is(el, null);
});

test("can add events created by any user", async (t) => {
  const { contract: listOwner, root } = t.context.accounts;
  const otherAccount = await createAccount(root, "other");
  const event = await createEvent(listOwner, otherAccount);
  const el = await createEventList(listOwner);

  await addEventToEventList(listOwner, event.id, el.id);

  const events = await getEventsFromList(listOwner, el.id);

  const comparable = {
    ...events[0],
  };

  delete (comparable as any).last_updated_at;

  t.deepEqual(comparable, {
    event: event,
    position: 0,
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

  const events = await getEventsFromList(listOwner, event_list.id);

  t.deepEqual(events, []);
});

test("can update event list", async (t) => {
  const { contract } = t.context.accounts;

  const now = new Date().toISOString();

  const event_list = await createEventList(contract);

  const newName = "new name";
  const newDescription = "new description";

  const updatedEl = await updateEventList(contract, event_list.id, {
    name: newName,
    description: newDescription,
  });

  t.deepEqual(updatedEl, {
    ...event_list,
    last_updated_at: updatedEl.last_updated_at,
    name: newName,
    description: newDescription,
  });

  // compare created_at and last_updated_at are in range of +- 100 seconds
  const last_updated_at = new Date(event_list.last_updated_at);
  const nowTime = new Date(now).getTime();
  t.true(last_updated_at.getTime() - nowTime < 100000);
})
