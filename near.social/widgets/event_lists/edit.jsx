props.controller.setLayout('layouts:modal', {
  title: 'Edit event list',
});

const EVENTS_CONTRACT = '{{ env.EVENTS_CONTRACT }}';

if (!props.event_list_id) {
  return props.__engine.helpers.propsIsRequiredMessage('event_list_id');
}

const event_list = props.__engine.contract.view(
  EVENTS_CONTRACT,
  'get_event_list',
  {
    event_list_id: props.event_list_id,
  }
);
if (!event_list) {
  return props.__engine.loading();
}

const SECONDS_10 = 10000;
// if event_list was just updated within the last 10 seconds, return to the show page
if (
  new Date().getTime() - new Date(event_list.last_updated_at).getTime() <
  SECONDS_10
) {
  props.__engine.pop();
  return <></>;
}

function callContract(data) {
  const { name, description } = data;

  props.__engine.contract.call(EVENTS_CONTRACT, 'update_event_list', {
    event_list_id: props.event_list_id,
    event_list: {
      name,
      description,
    },
  });
}

function onSave(data) {
  callContract(data);
}

return props.__engine.renderComponent('_form', {
  onSave,
  buttonText: 'Update event list',
  model: event_list,
});
