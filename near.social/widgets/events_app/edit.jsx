const CONTRACT = 'nearevents.testnet';
const APP_OWNER = 'nearevents.testnet';
const APP_NAME = 'events_app';

const accountId = context.accountId;
if (!accountId) {
  return 'Please connect your NEAR wallet to create an activity';
}

const eventId = props.event_id;
if (!eventId) {
  return 'props.eventId is required';
}

const event = Near.view(CONTRACT, 'get_event', {
  event_id: props.event_id,
});
if (!event) {
  return 'Loading';
}

const TGAS_300 = '300000000000000';
const ONE_NEAR = '1000000000000000000000000';

function callContract(data) {
  const {
    name,
    type,
    category,
    status,
    start_date,
    end_date,
    location,
    images,
    links,
    description,
  } = data;
  Near.call(
    CONTRACT,
    'create_event',
    {
      account_id: accountId,
      name,
      type,
      category,
      status,
      start_date,
      end_date,
      location,
      images,
      links,
      description,
    },
    TGAS_300,
    ONE_NEAR
  );
}

function onSave(data) {
  console.log('onSave', data);

  callContract(data);
}

return (
  <>
    <h1> Edit Event</h1>
    <Widget
      src={`${APP_OWNER}/widget/${APP_NAME}___form`}
      props={{ model: event, onSave }}
    />
  </>
);
