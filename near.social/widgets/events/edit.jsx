props.controller.setLayout('layouts:modal', {
  title: 'Edit Event',
});

const EVENTS_CONTRACT = '{{ env.EVENTS_CONTRACT }}';

const eventId = props.event_id;
if (!eventId) {
  return props.__engine.helpers.propsIsRequiredMessage('event_id');
}

const event = props.__engine.contract.view(EVENTS_CONTRACT, 'get_event', {
  event_id: props.event_id,
});
if (!event) {
  return props.__engine.loading();
}

const SECONDS_10 = 10000;
// if event was just updated within the last 10 seconds, return to the show page
if (
  new Date().getTime() - new Date(event.last_updated_at).getTime() <
  SECONDS_10
) {
  props.__engine.pop();
  return props.__engine.loading();
}

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

  props.__engine.contract.call(EVENTS_CONTRACT, 'update_event', {
    event_id: eventId,
    event: {
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
  });
}

function onSave(data) {
  callContract(data);
}

return props.__engine.renderComponent('_form', {
  onSave,
  buttonText: 'Update event',
  model: event,
});
