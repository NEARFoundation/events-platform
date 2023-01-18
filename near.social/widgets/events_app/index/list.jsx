const CONTRACT = 'events_v1.near';

let events = Near.view(CONTRACT, 'get_all_events');

// return data;
if (!events) {
  return 'Loading';
}
console.log(events);

const IndexList = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  & > * {
    margin: 1rem;
  }

  & > *:nth-child(3n + 1) {
    margin-left: 0;
  }

  & > *:nth-child(3n) {
    margin-right: 0;
  }
`;

const eventsList = events.map((event) => {
  console.log(event);
  return (
    <Widget
      src={'minz.near/widget/ViewActivity'}
      props={{ event }}
      key={event.event_id}
    />
  );
});

return <IndexList>{eventsList}</IndexList>;
