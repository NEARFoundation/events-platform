// Find all our documentation at https://docs.near.org
import {
  NearBindgen,
  near,
  call,
  bytes,
  view,
  UnorderedMap,
  Vector,
  NearPromise,
  assert,
} from "near-sdk-js";
import { AccountId } from "near-sdk-js/lib/types";
import { EventListsMap } from "./helpers";
import {
  type Event,
  type CreateEvent,
  type UpdateEvent,
  type EventListEventEntry,
  type PermissionType,
} from "./types";
import {
  type EventList,
  type CreateEventList,
  type UpdateEventList,
} from "./types";

const TWENTY_TGAS = BigInt("200000000000000");
const NO_DEPOSIT = BigInt(0);

@NearBindgen({})
export class HelloNear {
  events: UnorderedMap<Event> = new UnorderedMap("e");
  event_lists: EventListsMap = new EventListsMap("l");

  /**
   * Get event details for an existing event.
   */
  @view({})
  get_event({ event_id }: { event_id: string }): Event {
    return this.events.get(event_id);
  }

  /**
   * Get the latest event for an account.
   */
  @view({})
  get_latest_event({ account_id }: { account_id: string }): Event {
    return this.get_all_events_by_account({ account_id }).sort((a, b) => {
      return Number(b.created_at) - Number(a.created_at);
    })[0];
  }

  /**
   * Check if an event exists.
   */
  @view({})
  has_event({ event_id }: { event_id: string }): Boolean {
    return this.events.get(event_id) !== null;
  }

  /**
   * Create a new event.
   */
  @call({ payableFunction: true })
  create_event(createEvent: CreateEvent): NearPromise {
    // We want to charge the user for storing an event in our contract.
    // This means we need to calculate how much they have to pay, so we
    // keep track of our current storage usage.
    const oldStorageUsage = near.storageUsage();
    const owner_account_id = near.signerAccountId();

    const uuid = genUUID();

    const event = <Event>{
      ...createEvent,
      id: uuid,
      owner_account_id,
      created_at: now(),
      last_updated_at: now(),
      start_date: new Date(createEvent.start_date),
      end_date: new Date(createEvent.end_date),
    };

    // Store the event in the events map.
    this.events.set(uuid, event);

    // We check how much storage was taken up by the creation and how
    // much NEAR was deposited.
    const newStorageUsage = near.storageUsage();
    const storageUsedByCall = newStorageUsage - oldStorageUsage;
    const priceOfUsedStorage = storageUsedByCall * near.storageByteCost();
    const attachedDeposit = near.attachedDeposit();

    // If there wasn't enough NEAR deposited we remove the change and
    // throw an error.
    if (attachedDeposit < priceOfUsedStorage) {
      this.events.remove(uuid);

      throw new Error(
        "You haven't attached enough NEAR to pay for the cost of the event you are storing.\n" +
        `You attached: ${near.attachedDeposit()}\n` +
        `The cost was: ${priceOfUsedStorage}`
      );
    }

    // If there was a sufficient amount deposited, we refund any surplus.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    // We return a promise that will return the event to the user.
    const returnEventPromise = NearPromise.new(
      near.currentAccountId()
    ).functionCall(
      "return_event",
      JSON.stringify({ event_id: uuid }),
      NO_DEPOSIT,
      TWENTY_TGAS
    );

    if (refundAmount > 0) {
      return NearPromise.new(owner_account_id)
        .transfer(refundAmount)
        .then(returnEventPromise);
    }
    return returnEventPromise;
  }

  @call({ privateFunction: true })
  return_event(args: { event_id: string }): Event {
    return this.events.get(args.event_id);
  }

  /**
   * Get event details for all events.
   */
  @view({})
  get_all_events(): Event[] {
    return this.events.toArray().map(([, event]) => event);
  }

  /**
   * Get event details for all events created by a passed in account ID.
   */
  @view({})
  get_all_events_by_account({
    account_id,
  }: {
    account_id: AccountId;
  }): Event[] {
    return this.get_all_events().filter(
      (event) => event.owner_account_id === account_id
    );
  }

  /**
   * Update an existing event.
   */
  @call({ payableFunction: true })
  update_event({
    event_id,
    event,
  }: {
    event_id: string;
    event: Partial<UpdateEvent>;
  }): NearPromise {
    // First we check if there is an event with the specified ID.
    const currentEvent = this.events.get(event_id);

    assert(currentEvent, `The event with id: ${event_id} does not exist!`);

    // Then we check if the signer of the transaction is the owner of the event.
    const signerAccountId = near.signerAccountId();

    assert(
      signerAccountId === currentEvent.owner_account_id,
      "You do not have permission to edit this event!"
    );

    // We keep track of used storage again.
    const oldStorageUsage = near.storageUsage();

    // We update the storage to reflect the update.
    this.events.set(event_id, {
      ...currentEvent,
      ...event,
      start_date: new Date(event.start_date || currentEvent.start_date),
      end_date: new Date(event.end_date || currentEvent.end_date),
      last_updated_at: now(),
    });

    // Then we get the storage change - in this case it might be negative as the update
    // might take up less bytes then the previous version.
    const newStorageUsage = near.storageUsage();
    const storageUsedByCall = newStorageUsage - oldStorageUsage;
    const priceOfUsedStorage = storageUsedByCall * near.storageByteCost();
    const attachedDeposit = near.attachedDeposit();

    // If the attached deposit wasn't enough to cover for the change, we revert
    // the change and throw an error.
    if (attachedDeposit < priceOfUsedStorage) {
      this.events.set(event_id, currentEvent);

      throw new Error(
        "You haven't attached enough NEAR to pay for the cost of the event you are storing.\n" +
        `You attached: ${near.attachedDeposit()}\n` +
        `The cost was: ${priceOfUsedStorage}`
      );
    }

    // We refund the signer if need be.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    const returnEventPromise = NearPromise.new(
      near.currentAccountId()
    ).functionCall(
      "return_event",
      JSON.stringify({ event_id }),
      NO_DEPOSIT,
      TWENTY_TGAS
    );

    if (refundAmount > 0) {
      return NearPromise.new(signerAccountId)
        .transfer(refundAmount)
        .then(returnEventPromise);
    }
    return returnEventPromise;
  }

  /**
   * Remove an event.
   */
  @call({})
  remove_event({ event_id }: { event_id: string }): NearPromise {
    // We check if the event exists.
    const currentEvent = this.events.get(event_id);

    assert(currentEvent, `The event with id: ${event_id} does not exist!`);

    // We check that the signer is the owner of the event.
    const signerAccountId = near.signerAccountId();

    assert(
      signerAccountId === currentEvent.owner_account_id,
      "You do not have permission to edit this event!"
    );

    // We keep track of the storage usage.
    const oldStorageUsage = near.storageUsage();

    // Then we remove the event.
    this.events.remove(event_id);

    // Finally we refund the signer with the amount of freed up space for
    // removing the event from storage.
    const newStorageUsage = near.storageUsage();
    const storageFreedByCall = newStorageUsage - oldStorageUsage;
    const priceOfFreedStorage = storageFreedByCall * near.storageByteCost();

    if (priceOfFreedStorage > 0) {
      return NearPromise.new(signerAccountId).transfer(priceOfFreedStorage);
    }
  }

  /**
   * Get all event lists.
   * @returns EventList[]
   */
  @view({})
  get_all_event_lists(): EventList[] {
    return this.event_lists.toArray().map(([, event_list]) => event_list);
  }

  /**
   * Get all event lists for a given account.
   * @param account_id the account id
   * @returns EventList[]
   */
  @view({})
  get_all_event_lists_by_account({
    account_id,
  }: {
    account_id: AccountId;
  }): EventList[] {
    return this.get_all_event_lists().filter(
      (event_list) => event_list.owner_account_id === account_id
    );
  }

  /**
   * Get a single event list.
   * @param event_list_id the event list id
   * @returns EventList | undefined
   */
  @view({})
  get_event_list({ event_list_id }: { event_list_id: string }): EventList {
    return this.event_lists.get(event_list_id);
  }

  /**
   * Get if the event list exists.
   * @param event_list_id the event list id
   * @returns boolean
   */
  @view({})
  has_event_list({ event_list_id }: { event_list_id: string }): boolean {
    return this.event_lists.has(event_list_id);
  }

  /**
   * Create a new event list.
   * @param createEventList
   * @returns NearPromise
   */
  @call({ payableFunction: true })
  create_event_list(createEventList: CreateEventList): NearPromise {
    // We want to charge the user for storing an event in our contract.
    // This means we need to calculate how much they have to pay, so we
    // keep track of our current storage usage.
    const oldStorageUsage = near.storageUsage();
    const owner_account_id = near.signerAccountId();

    const uuid = genUUID();

    const eventList = <EventList>{
      ...createEventList,
      id: uuid,
      owner_account_id,
      created_at: now(),
      last_updated_at: now(),
      permissions: <UnorderedMap<{ permissions: PermissionType[] }>>(
        new UnorderedMap("p")
      ),
      events: <EventListEventEntry>new Vector("v"),
    };

    // Store the event in the events map.
    this.event_lists.set(uuid, eventList);

    // We check how much storage was taken up by the creation and how
    // much NEAR was deposited.
    const newStorageUsage = near.storageUsage();
    const storageUsedByCall = newStorageUsage - oldStorageUsage;
    const priceOfUsedStorage = storageUsedByCall * near.storageByteCost();
    const attachedDeposit = near.attachedDeposit();

    // If there wasn't enough NEAR deposited we remove the change and
    // throw an error.
    if (attachedDeposit < priceOfUsedStorage) {
      this.event_lists.remove(uuid);

      throw new Error(
        "You haven't attached enough NEAR to pay for the cost of the event list you are storing.\n" +
        `You attached: ${near.attachedDeposit()}\n` +
        `The cost was: ${priceOfUsedStorage}`
      );
    }

    // If there was a sufficient amount deposited, we refund any surplus.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    // We return a promise that will return the event to the user.
    const returnEventListPromise = NearPromise.new(
      near.currentAccountId()
    ).functionCall(
      "return_event_list",
      JSON.stringify({ event_list_id: uuid }),
      NO_DEPOSIT,
      TWENTY_TGAS
    );

    if (refundAmount > 0) {
      return NearPromise.new(owner_account_id)
        .transfer(refundAmount)
        .then(returnEventListPromise);
    }
    return returnEventListPromise;
  }

  /**
   * private function to return an event list.
   * used as private callback
   */
  @call({ privateFunction: true })
  return_event_list(args: { event_list_id: string }): EventList {
    return this.event_lists.get(args.event_list_id);
  }

  /**
   * Update an event list.
   * @param event_list_id The ID of the event list to update.
   * @param event_list The new event list data.
   * @returns The updated event list.
   */
  @call({ payableFunction: true })
  update_event_list({
    event_list_id,
    event_list,
  }: {
    event_list_id: string;
    event_list: Partial<UpdateEventList>;
  }): NearPromise {
    // First we check if there is an event_list with the specified ID.
    const currentEventList = this.event_lists.get(event_list_id);

    assert(
      currentEventList,
      `The event_list with id: ${event_list_id} does not exist!`
    );

    // Temporary: We check if the signer of the transaction is the owner of the event_list.
    const signerAccountId = near.signerAccountId();

    // TODO: check if signer is owner or has permission to edit instead
    assert(
      signerAccountId === currentEventList.owner_account_id,
      "You do not have permission to edit this event_list!"
    );

    // We keep track of used storage again.
    const oldStorageUsage = near.storageUsage();

    // We update the storage to reflect the update.
    this.event_lists.set(event_list_id, {
      ...currentEventList,
      ...event_list,
      last_updated_at: now(),
    });

    // Then we get the storage change - in this case it might be negative as the update
    // might take up less bytes then the previous version.
    const newStorageUsage = near.storageUsage();
    const storageUsedByCall = newStorageUsage - oldStorageUsage;
    const priceOfUsedStorage = storageUsedByCall * near.storageByteCost();
    const attachedDeposit = near.attachedDeposit();

    // If the attached deposit wasn't enough to cover for the change, we revert
    // the change and throw an error.
    if (attachedDeposit < priceOfUsedStorage) {
      this.event_lists.set(event_list_id, currentEventList);

      throw new Error(
        "You haven't attached enough NEAR to pay for the cost of the event_list you are storing.\n" +
        `You attached: ${near.attachedDeposit()}\n` +
        `The cost was: ${priceOfUsedStorage}`
      );
    }

    // We refund the signer if need be.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    const returnEventListPromise = NearPromise.new(
      near.currentAccountId()
    ).functionCall(
      "return_event_list",
      JSON.stringify({ event_list_id }),
      NO_DEPOSIT,
      TWENTY_TGAS
    );

    if (refundAmount > 0) {
      return NearPromise.new(signerAccountId)
        .transfer(refundAmount)
        .then(returnEventListPromise);
    }
    return returnEventListPromise;
  }

  /**
   * Remove an event list.
   * @param event_list_id The ID of the event list to delete.
   */
  @call({ payableFunction: true })
  remove_event_list({ event_list_id }: { event_list_id: string }): NearPromise {
    // First we check if there is an event_list with the specified ID.
    const currentEventList = this.event_lists.get(event_list_id);

    assert(
      currentEventList,
      `The event_list with id: ${event_list_id} does not exist!`
    );

    // Temporary: We check if the signer of the transaction is the owner of the event_list.
    const signerAccountId = near.signerAccountId();

    // TODO: check if signer is owner or has permission to edit instead
    assert(
      signerAccountId === currentEventList.owner_account_id,
      "You do not have permission to delete this event_list!"
    );

    // We keep track of used storage again.
    const oldStorageUsage = near.storageUsage();

    // We delete the event list.
    this.event_lists.remove(event_list_id);

    // Finally we refund the signer with the amount of freed up space for
    // removing the event from storage.
    const newStorageUsage = near.storageUsage();
    const storageFreedByCall = newStorageUsage - oldStorageUsage;
    const priceOfFreedStorage = storageFreedByCall * near.storageByteCost();

    if (priceOfFreedStorage > 0) {
      return NearPromise.new(signerAccountId).transfer(priceOfFreedStorage);
    }
  }

  /**
   * Add an event to an event list.
   * @param event_list_id The ID of the event list to add the event to.
   * @param event_id The ID of the event to add.
   */
  @call({ payableFunction: true })
  add_event_to_event_list({
    event_list_id,
    event_id,
    position,
  }: {
    event_list_id: string;
    event_id: string;
    position: number;
  }): void {
    // First we check if there is an event_list with the specified ID.
    const currentEventList = this.event_lists.get(event_list_id);
    assert(
      currentEventList,
      `The event_list with id: ${event_list_id} does not exist!`
    );

    // Then we check if there is an event with the specified ID.
    const currentEvent = this.events.get(event_id);
    assert(currentEvent, `The event with id: ${event_id} does not exist!`);

    // Temporary: We check if the signer of the transaction is the owner of the event_list.
    const signerAccountId = near.signerAccountId();

    // TODO: check if signer is owner or has permission to add events instead
    assert(
      signerAccountId === currentEventList.owner_account_id,
      "You do not have permission to add events to this event_list!"
    );

    // check if event is already in event list
    const eventInEventList = currentEventList.events.toArray().find((event) => {
      return event.event_id === event_id;
    });
    assert(
      !eventInEventList,
      `The event with id: ${event_id} is already in the event list with id: ${event_list_id}!`
    );

    // We keep track of used storage again.
    const oldStorageUsage = near.storageUsage();

    // We add the event to the event list.
    // `events.push()` manipulates the original vector
    // so we need to create a copy of the vector first.
    // clone Vector
    const newEvents = <EventListEventEntry>(
      new Vector(currentEventList.events.prefix)
    );
    const reorderedEvents = buildOrderedEventEntryList(
      currentEventList.events.toArray(),
      {
        event_id,
        position,
        last_updated_at: now(),
        added_by: signerAccountId,
        last_updated_by: signerAccountId,
      },
      signerAccountId,
      position
    );
    newEvents.extend(reorderedEvents);

    // We update the event_list in storage.
    this.event_lists.set(event_list_id, {
      ...currentEventList,
      events: newEvents,
    });

    // Then we get the storage change - in this case it might be negative as the update
    // might take up less bytes then the previous version.
    const newStorageUsage = near.storageUsage();

    const storageUsedByCall = newStorageUsage - oldStorageUsage;
    const priceOfUsedStorage = storageUsedByCall * near.storageByteCost();
    const attachedDeposit = near.attachedDeposit();

    // If the attached deposit wasn't enough to cover for the change, we revert
    // the change and throw an error.
    if (attachedDeposit < priceOfUsedStorage) {
      this.event_lists.set(event_list_id, {
        ...currentEventList,
        // set to original value
        events: currentEventList.events,
      });

      throw new Error(
        "You haven't attached enough NEAR to pay for the cost of the event_list you are storing.\n" +
        `You attached: ${near.attachedDeposit()}\n` +
        `The cost was: ${priceOfUsedStorage}`
      );
    }
  }
}

/**
 *
 * @param arr
 * @param newEvent
 * @param signerAccountId
 * @param position
 * @returns Array of events with updated positions and new event added
 */

function buildOrderedEventEntryList(
  arr: Array<{
    position: number;
    last_updated_at: Date;
    last_updated_by: AccountId;
    added_by: AccountId;
    event_id: string;
  }>,
  newEvent: {
    position: number;
    last_updated_at: Date;
    last_updated_by: AccountId;
    added_by: AccountId;
    event_id: string;
  },
  signerAccountId: AccountId,
  position: number
) {
  // we need to update the position of all events after the new event
  // and update who and when updated the event
  const newEvents = arr.map((event) => {
    if (event.position >= position) {
      return {
        ...event,
        position: event.position + 1,
        last_updated_at: now(),
        last_updated_by: signerAccountId,
      };
    }
    return { ...event };
  });

  // then we add the new event
  newEvents.push(newEvent);

  // and fill the gaps in the positions
  for (let i = 0; i < newEvents.length; i++) {
    if (newEvents[i].position !== i) {
      newEvents[i].position = i;
      newEvents[i].last_updated_at = now();
      newEvents[i].last_updated_by = signerAccountId;
    }
  }

  return newEvents;
}

/**
 * @returns {string} A random string.
 */
function genUUID(): string {
  return bytes(near.randomSeed())
    .split("")
    .map((c) => {
      return c.charCodeAt(0).toString(16);
    })
    .join("");
}

/**
 * @returns {Date} The current date.
 */
function now() {
  return new Date(Number(near.blockTimestamp()) / 1000000);
}
