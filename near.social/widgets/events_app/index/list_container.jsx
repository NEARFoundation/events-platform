const CONTRACT = '{{ env.CONTRACT }}';
const APP_OWNER = '{{ env.APP_OWNER }}';
const APP_NAME = '{{ env.APP_NAME }}';

// accountID is used to determine for whom the events are displayed
// if no accountID is provided, all events are displayed
const accountId = props.accountId;

let events = [];
if (accountId === undefined) {
  events = Near.view(CONTRACT, 'get_all_events');
} else {
  events = Near.view(CONTRACT, 'get_all_events_by_account', {
    account_id: accountId,
  });
}

console.log({ events });

if (!events) {
  return 'Loading';
}

return (
  <Widget
    src={`${APP_OWNER}/widget/${APP_NAME}__index__list`}
    props={{ events: events }}
  />
);
