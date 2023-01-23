const CONTRACT = 'nearevents.testnet';
const APP_NAME = 'events_app';
const APP_OWNER = 'nearevents.testnet';

const accountId = context.accountId;
if (!accountId) {
  return 'Please connect your NEAR wallet to create an activity';
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
    image,
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
      image,
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
  <div>
    <Widget
      src={`${APP_OWNER}/widget/${APP_NAME}___form`}
      props={{
        onSave,
      }}
    />
  </div>
);
