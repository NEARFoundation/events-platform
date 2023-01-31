// Find all our documentation at https://docs.near.org
import {
  NearBindgen,
  near,
  call,
  bytes,
  view,
  UnorderedMap,
  NearPromise,
  assert
} from "near-sdk-js";
import { AccountId } from "near-sdk-js/lib/types";
import { EventListsMap } from "./helpers";
import { type Event, type CreateEvent, type UpdateEvent } from "./types";

const TWENTY_TGAS = BigInt("200000000000000");
const NO_DEPOSIT = BigInt(0);
// const NO_ARGS = bytes(JSON.stringify({}));

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
      return Number(b.created_at) - Number(a.created_at)
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

    const uuid = bytes(near.randomSeed()).split('').map((c) => {
      return c.charCodeAt(0).toString(16)
    }).join('');

    const now = new Date(Number(near.blockTimestamp()) / 1000000)

    const event = <Event>{
      ...createEvent,
      id: uuid,
      owner_account_id,
      created_at: now,
      last_updated_at: now,
      start_date: new Date(createEvent.start_date),
      end_date: new Date(createEvent.end_date),
    }

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
    const eventId = JSON.stringify({ event_id: uuid })
    const returnEventPromise = NearPromise
      .new(near.currentAccountId())
      .functionCall("return_event", eventId, NO_DEPOSIT, TWENTY_TGAS)

    if (refundAmount > 0) {
      return NearPromise.new(owner_account_id).transfer(refundAmount)
        .then(returnEventPromise)
    }
    return returnEventPromise
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
    const existingEvent = this.events.get(event_id);

    assert(existingEvent, `The event with id: ${event_id} does not exist!`);

    // Then we check if the signer of the transaction is the owner of the event.
    const signerAccountId = near.signerAccountId();

    assert(
      signerAccountId === existingEvent.owner_account_id,
      "You do not have permission to edit this event!"
    );

    // We keep track of used storage again.
    const oldStorageUsage = near.storageUsage();

    const now = new Date(Number(near.blockTimestamp()) / 1000000)

    // We update the storage to reflect the update.
    this.events.set(event_id, {
      ...existingEvent,
      ...event,
      start_date: new Date(event.start_date || existingEvent.start_date),
      end_date: new Date(event.end_date || existingEvent.end_date),
      last_updated_at: now,
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
      this.events.set(event_id, existingEvent);

      throw new Error(
        "You haven't attached enough NEAR to pay for the cost of the event you are storing.\n" +
        `You attached: ${near.attachedDeposit()}\n` +
        `The cost was: ${priceOfUsedStorage}`
      );
    }

    // We refund the signer if need be.
    const refundAmount = attachedDeposit - priceOfUsedStorage;

    const eventId = JSON.stringify({ event_id })
    const returnEventPromise = NearPromise
      .new(near.currentAccountId())
      .functionCall("return_event", eventId, NO_DEPOSIT, TWENTY_TGAS)

    if (refundAmount > 0) {
      return NearPromise.new(signerAccountId).transfer(refundAmount).then(returnEventPromise)
    }
    return returnEventPromise
  }

  /**
   * Remove an event.
   */
  @call({})
  remove_event({ event_id }: { event_id: string }): NearPromise {
    // We check if the event exists.
    const existingEvent = this.events.get(event_id);

    assert(existingEvent, `The event with id: ${event_id} does not exist!`);

    // We check that the signer is the owner of the event.
    const signerAccountId = near.signerAccountId();

    assert(
      signerAccountId === existingEvent.owner_account_id,
      "You do not have permission to edit this event!"
    );

    // We keep track of the storage usage.
    const oldStorageUsage = near.storageUsage();

    // Then we remove the event.
    this.events.remove(event_id);

    // Finally we refund the signer with the amount of freed up space for
    // removing the event from storage.
    const newStorageUsage = near.storageUsage();
    const storageUsedByCall = newStorageUsage - oldStorageUsage;
    const priceOfUsedStorage = storageUsedByCall * near.storageByteCost();

    if (priceOfUsedStorage > 0) {
      return NearPromise.new(signerAccountId).transfer(priceOfUsedStorage)
    }
  }
}



function promiseResult(): { result: string, success: boolean } {
  let result, success;

  try { result = near.promiseResult(0); success = true }
  catch { result = undefined; success = false }

  return { result, success }
}