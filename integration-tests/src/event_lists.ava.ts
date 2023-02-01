import { Event, EventList } from "../../contract/src/types";
import { test, THREE_HUNDRED_TGAS, ONE_NEAR } from "./_setup";

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
