props.controller.setLayout('modal', {
  title: 'Create Event',
  back: true,
});

const EVENTS_CONTRACT = '{{ env.EVENTS_CONTRACT }}';
const APP_OWNER = '{{ env.APP_OWNER }}';
const APP_NAME = '{{ env.APP_NAME }}';

const TGAS_300 = '300000000000000';
const ONE_NEAR = '1000000000000000000000000';

function createEvent(data) {
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
    EVENTS_CONTRACT,
    'create_event',
    {
      account_id: props.__engine.accountId,
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
  createEvent(data);
}

return (
  <div>
    <Widget
      src={`${APP_OWNER}/widget/${APP_NAME}___form`}
      props={{
        onSave,
        buttonText: 'Create event',
      }}
    />
  </div>
);
