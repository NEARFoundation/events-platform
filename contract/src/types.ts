import { Vector, UnorderedMap } from "near-sdk-js";
import { AccountId } from "near-sdk-js/lib/types";

type ObjectValues<Object> = Object[keyof Object];

export const EventTypes = {
  virtual: "virtual",
  irl: "irl",
  mixed: "mixed",
} as const;

/**
 * Type of event.
 */
type EventType = ObjectValues<typeof EventTypes>;

export const EventStatuses = {
  draft: "draft",
  published: "published",
  cancelled: "cancelled",
} as const;

/**
 * Status of event.
 */
type EventStatus = ObjectValues<typeof EventStatuses>;

export const ImageTypes = {
  banner: "banner",
  tile: "tile",
} as const;

/**
 * Type of image.
 */
type ImageType = ObjectValues<typeof ImageTypes>;

export const LinkTypes = {
  register: "register",
  tickets: "tickets",
  join_stream: "join_stream",
} as const;

/**
 * Type of link.
 */
type LinkType = ObjectValues<typeof LinkTypes>;

/**
 * An object representing the Event and all its detials.
 */
export type Event = {
  id: string;
  owner_account_id: AccountId;
  created_at: Date;
  last_updated_at: Date;
  name: string;
  type: EventType;
  category: string;
  status: EventStatus;
  description: string;
  start_date: Date;
  end_date: Date;
  location: string;
  images: {
    url: string;
    type: ImageType;
  }[];
  links: {
    text: string;
    type: LinkType;
    url: string;
  }[];
  liked_by: string[];
};

/**
 * Data needed for event creation.
 */
export type CreateEvent = Pick<
  Event,
  | "name"
  | "type"
  | "category"
  | "status"
  | "start_date"
  | "end_date"
  | "location"
  | "images"
  | "links"
  | "description"
>;

/**
 * Data accepted for event update.
 */
export type UpdateEvent = Partial<CreateEvent>;

export const PermissionTypes = {
  add_list_entry: "add_list_entry",
  remove_list_entry: "remove_list_entry",
  change_list: "change_list",
} as const;

/**
 * Type of permission.
 */
export type PermissionType = ObjectValues<typeof PermissionTypes>;

export type EventListEventEntry = Vector<{
  event_id: string;
  last_updated_at: Date;
  added_by: AccountId;
  position: number;
  last_updated_by: AccountId;
}>;

/**
 * An object representing an EventList and all its details.
 */
export type EventList = {
  id: string;
  owner_account_id: AccountId;
  name: string;
  description: string;
  created_at: Date;
  last_updated_at: Date;

  permissions: UnorderedMap<{ permissions: PermissionType[] }>;
  events: EventListEventEntry;
};

/**
 * Data needed for event list creation.
 */
export type CreateEventList = Pick<EventList, "name" | "description">;

/**
 * Data accepted for event update.
 */
export type UpdateEventList = Partial<CreateEventList>;
