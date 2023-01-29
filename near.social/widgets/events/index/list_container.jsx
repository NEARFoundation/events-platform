const EVENTS_CONTRACT = '{{ env.EVENTS_CONTRACT }}';

// accountID is used to determine for whom the events are displayed
// if no accountID is provided, all events are displayed
const forAccountId = props.forAccountId;

let events = [];
if (forAccountId === undefined) {
  events = Near.view(EVENTS_CONTRACT, 'get_all_events');
} else {
  events = Near.view(EVENTS_CONTRACT, 'get_all_events_by_account', {
    account_id: forAccountId,
  });
}

const Loading = props.__engine.Components.Loading;
if (!events) {
  return <Loading>Loading events</Loading>;
}

return props.__engine.renderComponent('index.list', { events });
