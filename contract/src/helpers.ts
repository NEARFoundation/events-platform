import { assert, near, UnorderedMap, Vector } from "near-sdk-js";
import {
  type EventList,
  type PermissionType,
  type EventListEventEntry,
} from "./types";

const dummyEventList = {
  id: "",
  owner_account_id: "",
  name: "",
  description: "",
  created_at: new Date(),
  last_updated_at: new Date(),
  events: new Vector("") as unknown as Vector<EventListEventEntry>,
  permissions: new UnorderedMap("perms") as unknown as UnorderedMap<{
    permissions: PermissionType[];
  }>,
} satisfies EventList;

/**
 * Check if given value implements the EventList type.
 *
 * @param value - A value to be checked for compatibility with the EventList type.
 */
const checkIsEventList = (value: unknown): value is EventList => {
  if (typeof value !== "object") {
    return false;
  }

  const all_keys_present =
    Object.keys(dummyEventList).every((key) => key in value) &&
    Object.keys(value).every((key) => key in dummyEventList);

  if (!all_keys_present) {
    return false;
  }

  return true;
};

/**
 * Reconstructor for the EventList type.
 *
 * @param value - The value to be used to reconstruct into an EventList.
 */
export const eventListReconstructor = (value: unknown): EventList => {
  assert(
    checkIsEventList(value),
    `Value: ${value} cannot be reconstructed into EventList`
  );

  return {
    id: value.id,
    owner_account_id: value.owner_account_id,
    name: value.name,
    description: value.description,
    created_at: new Date(value.created_at),
    last_updated_at: new Date(value.last_updated_at),
    permissions: UnorderedMap.reconstruct(value.permissions),
    events: Vector.reconstruct(value.events),
  };
};

/**
 * A wrapper around the base UnorderedMap collection to make basic actions
 * more ergonomic by passing the required eventListReconstructor to the
 * appropriate methods.
 */
export class EventListsMap {
  map: UnorderedMap<EventList>;

  /**
   * @param prefix - The byte prefix to use when storing elements inside this collection.
   */
  constructor(prefix: string) {
    this.map = new UnorderedMap(prefix);
  }

  /**
   * The number of elements stored in the collection.
   */
  get length(): number {
    return this.map.length;
  }

  /**
   * Checks whether the collection is empty.
   */
  isEmpty(): boolean {
    return this.map.isEmpty();
  }

  /**
   * Get the data stored at the provided key.
   *
   * @param key - The key at which to look for the data.
   */
  get(key: string): EventList {
    return this.map.get(key, { reconstructor: eventListReconstructor });
  }

  /**
   * Store a new value at the provided key.
   *
   * @param key - The key at which to store in the collection.
   * @param value - The value to store in the collection.
   */
  set(key: string, value: EventList): EventList {
    return this.map.set(key, value);
  }

  /**
   * Removes and retrieves the element with the provided key.
   *
   * @param key - The key at which to remove data.
   */
  remove(key: string): EventList {
    return this.map.remove(key, { reconstructor: eventListReconstructor });
  }

  /**
   * Determine if the collection contains a value with the provided key.
   */
  has(key: string): boolean {
    return this.map.toArray().some(([k]) => k === key);
  }

  /**
   * Remove all of the elements stored within the collection.
   */
  clear(): void {
    return this.map.clear();
  }

  /**
   * Return a JavaScript array of the data stored within the collection.
   *
   * @param options - Options for retrieving and storing the data.
   */
  toArray(): [string, EventList][] {
    return this.map.toArray({ reconstructor: eventListReconstructor });
  }

  /**
   * Extends the current collection with the passed in array of key-value pairs.
   *
   * @param keyValuePairs - The key-value pairs to extend the collection with.
   */
  extend(keyValuePairs: [string, EventList][]): void {
    this.map.extend(keyValuePairs);
  }

  /**
   * Serialize the collection.
   */
  serialize(): string {
    return this.map.serialize();
  }

  /**
   * Converts the deserialized data from storage to a JavaScript instance of the collection.
   *
   * @param data - The deserialized data to create an instance from.
   */
  static reconstruct(data: EventListsMap): EventListsMap {
    const map = new EventListsMap(data.map.prefix);

    map.map = UnorderedMap.reconstruct(data.map);

    return map;
  }
}
