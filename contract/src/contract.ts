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
import { NotRequested } from "./types";
import {
  type Event,
  type CreateEvent,
  type UpdateEvent,
  type EventListEventEntry,
  type PermissionType,
  type EventListApiResponse,
  type EventListEventEntryApiResponse,
} from "./types";
import {
  type EventList,
  type CreateEventList,
  type UpdateEventList,
} from "./types";

const FOURTY_TGAS = BigInt("40000000000000");
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

      depositMissingError("event", priceOfUsedStorage);
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
      FOURTY_TGAS
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
    event: UpdateEvent;
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

      depositMissingError("event", priceOfUsedStorage);
    }

    // We refund the signer if need be.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    const returnEventPromise = NearPromise.new(
      near.currentAccountId()
    ).functionCall(
      "return_event",
      JSON.stringify({ event_id }),
      NO_DEPOSIT,
      FOURTY_TGAS
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
  @call({ payableFunction: true })
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

    // Note: the params are swapped
    return refundDifference(priceOfFreedStorage, BigInt(0));
  }

  /**
   * Get all event lists.
   * @returns EventList[]
   */
  @view({})
  get_all_event_lists(): EventListApiResponse[] {
    return this.event_lists
      .toArray()
      .map(([, event_list]) => event_list)
      .map(
        (event_list) =>
          <EventListApiResponse>{
            ...event_list,
            has_events: event_list.events.length > 0,
            event_count: event_list.events.length,
            events: { too_expensive: true },
          }
      );
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
  }): EventListApiResponse[] {
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
  get_event_list({
    event_list_id,
    include_events,
  }: {
    event_list_id: string;
    include_events?: boolean;
  }): EventListApiResponse | null {
    const event_list = this.event_lists.get(event_list_id);
    if (!event_list) {
      return null;
    }
    return <EventListApiResponse>{
      ...event_list,
      has_events: event_list.events.length > 0,
      event_count: event_list.events.length,
      events: include_events
        ? this.get_events_in_event_list({ event_list_id })
        : <NotRequested>{},
    };
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
        new UnorderedMap(uuid + "p")
      ),
      events: <Vector<EventListEventEntry>>new Vector(uuid + "v"),
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

      depositMissingError("event_list", priceOfUsedStorage);
    }

    // If there was a sufficient amount deposited, we refund any surplus.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    // We return a promise that will return the event to the user.
    const returnEventListPromise = NearPromise.new(
      near.currentAccountId()
    ).functionCall(
      "return_event_list_api_response",
      JSON.stringify({ event_list_id: uuid }),
      NO_DEPOSIT,
      FOURTY_TGAS
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
  return_event_list_api_response(args: {
    event_list_id: string;
  }): EventListApiResponse {
    const event_list = this.event_lists.get(args.event_list_id);

    return <EventListApiResponse>{
      id: event_list.id,
      name: event_list.name,
      description: event_list.description,
      owner_account_id: event_list.owner_account_id,
      created_at: event_list.created_at,
      last_updated_at: event_list.last_updated_at,
      has_events: event_list.events.length > 0,
      event_count: event_list.events.length,
    };
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

      depositMissingError("event_list", priceOfUsedStorage);
    }

    // We refund the signer if need be.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    const returnEventListPromise = NearPromise.new(
      near.currentAccountId()
    ).functionCall(
      "return_event_list_api_response",
      JSON.stringify({ event_list_id }),
      NO_DEPOSIT,
      FOURTY_TGAS
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

    // Note: the params are swapped
    return refundDifference(priceOfFreedStorage, BigInt(0));
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
  }): NearPromise {
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
    const newEvents = <Vector<EventListEventEntry>>(
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

      depositMissingError("new event in the event_list", priceOfUsedStorage);
    }

    return refundDifference(attachedDeposit, priceOfUsedStorage);
  }

  /**
   * Check if an event is in an event list.
   * @param event_list_id The ID of the event list to check.
   * @param event_id The ID of the event to check.
   * @returns True if the event is in the event list, false otherwise.
   */
  @view({})
  is_event_in_event_list({
    event_list_id,
    event_id,
  }: {
    event_list_id: string;
    event_id: string;
  }): boolean {
    // Then we check if there is an event with the specified ID.
    if (!this.has_event({ event_id })) {
      return false;
    }
    // First we check if there is an event_list with the specified ID.
    const currentEventList = this.event_lists.get(event_list_id);
    if (!currentEventList) {
      return false;
    }

    // check
    return currentEventList.events.toArray().some((event) => {
      return event.event_id === event_id;
    });
  }

  /**
   * Get the position of an event in an event list.
   * @param event_list_id The ID of the event list to check.
   * @param event_id The ID of the event to check.
   * @returns The position of the event in the event list.
   */
  @view({})
  get_event_position_in_event_list({
    event_list_id,
    event_id,
  }: {
    event_list_id: string;
    event_id: string;
  }): number {
    // First we check if there is an event_list with the specified ID.
    const currentEventList = this.event_lists.get(event_list_id);
    assert(
      currentEventList,
      `The event_list with id: ${event_list_id} does not exist!`
    );

    // Then we check if there is an event with the specified ID.
    const currentEvent = this.events.get(event_id);
    assert(currentEvent, `The event with id: ${event_id} does not exist!`);

    // check
    const eventInEventList = currentEventList.events.toArray().find((event) => {
      return event.event_id === event_id;
    });
    assert(
      eventInEventList,
      `The event with id: ${event_id} is not in the event list with id: ${event_list_id}!`
    );

    return eventInEventList.position;
  }

  /**
   * Get the events in an event list.
   * @param event_list_id The ID of the event list to get the events from.
   * @returns The events in the event list.
   * @note This method is not paginated.
   * @note This method is not sorted.
   */
  @view({})
  get_events_in_event_list({
    event_list_id,
    limit,
  }: {
    event_list_id: string;
    limit?: number;
  }): EventListEventEntryApiResponse[] {
    // First we check if there is an event_list with the specified ID.
    const currentEventList = this.event_lists.get(event_list_id);
    assert(
      currentEventList,
      `The event_list with id: ${event_list_id} does not exist!`
    );

    if (limit && limit < 0) {
      assert(false, "Limit must be greater than 0");
    }

    return currentEventList.events.toArray()
      .sort((a, b) => a.position - b.position)
      .slice(0, limit || currentEventList.events.length)
      .map((eventEntry) => {
        return <EventListEventEntryApiResponse>{
          position: eventEntry.position,
          added_by: eventEntry.added_by,
          last_updated_by: eventEntry.last_updated_by,
          last_updated_at: eventEntry.last_updated_at,
          event: { ...this.events.get(eventEntry.event_id) },
        };
      });
  }

  /**
   * Remove an event from an event list.
   * @param event_list_id The ID of the event list to remove the event from.
   * @param event_id The ID of the event to remove.
   */
  @call({ payableFunction: true })
  remove_event_from_event_list({
    event_list_id,
    event_id,
  }: {
    event_list_id: string;
    event_id: string;
  }): NearPromise {
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

    // check if event is in event list
    const isEventInEventList = this.is_event_in_event_list({
      event_list_id,
      event_id,
    });
    assert(
      isEventInEventList,
      `The event with id: ${event_id} is not in the event list with id: ${event_list_id}!`
    );

    // We keep track of used storage again.
    const oldStorageUsage = near.storageUsage();

    // We remove the event from the event list.
    // `events.splice()` manipulates the original vector
    // so we need to create a copy of the vector first.
    // clone Vector
    const newEvents = <Vector<EventListEventEntry>>(
      new Vector(currentEventList.events.prefix)
    );

    // find event position in event list, remove it and fill gaps in positions
    const oldEvents = currentEventList.events.toArray();
    const position = oldEvents.findIndex(
      (event) => event.event_id === event_id
    );
    oldEvents.splice(position, 1);
    newEvents.extend(fillGapsInEventEntryList(oldEvents, signerAccountId));

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
    // the change and throw an error. This can happen if the event_list is very large and
    // the accountId is a long string and is removing an event from the event_list in front
    // as it updates the last_updated_by field when reordering the events.
    if (attachedDeposit < priceOfUsedStorage) {
      this.event_lists.set(event_list_id, {
        ...currentEventList,
        // set to original value
        events: currentEventList.events,
      });

      depositMissingError("event_list", priceOfUsedStorage);
    }

    return refundDifference(attachedDeposit, priceOfUsedStorage);
  }
}

/**
 * Helper function to refund the difference between the attached deposit and the cost of the entity.
 * @param attachedDeposit The attached deposit.
 * @param priceOfUsedStorage The cost of the entity.
 * @returns A promise that resolves to the refund.
 */
function refundDifference(
  attachedDeposit: bigint,
  priceOfUsedStorage: bigint
): NearPromise {
  if (attachedDeposit > priceOfUsedStorage) {
    const signerAccountId = near.signerAccountId();
    return NearPromise.new(signerAccountId).transfer(
      attachedDeposit - priceOfUsedStorage
    );
  }
}

/**
 * Helper function to throw an error if the attached deposit is not enough to cover for the cost of the entity.
 * @param entity The entity that is being stored.
 * @param cost The cost of the entity.
 * throws Error
 */
function depositMissingError(entity: string, cost: bigint) {
  const attachedDeposit = near.attachedDeposit();
  assert(
    false,
    `
You haven't attached enough NEAR to pay for the cost of the ${entity} you are storing.
You attached: ${attachedDeposit}
The cost was: ${cost}
You must attach an additional: ${attachedDeposit - cost} YoctoNEAR
`
  );
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
  arr: Array<EventListEventEntry>,
  newEvent: EventListEventEntry,
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

  newEvents.push(newEvent);

  return fillGapsInEventEntryList(newEvents, signerAccountId);
}

/**
 * Helper function to fill the gaps in the positions of the events.
 * @param arr The array of events.
 * @param signerAccountId The accountId of the signer.
 * @returns Array of events with updated positions.
 */
function fillGapsInEventEntryList(
  arr: Array<EventListEventEntry>,
  signerAccountId: AccountId
): Array<EventListEventEntry> {
  return arr
    .sort((a, b) => a.position - b.position)
    .map((event, index) => {
      if (event.position !== index) {
        return {
          ...event,
          position: index,
          last_updated_at: now(),
          last_updated_by: signerAccountId,
        };
      }
      return { ...event };
    });
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
