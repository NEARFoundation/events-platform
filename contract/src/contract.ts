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
