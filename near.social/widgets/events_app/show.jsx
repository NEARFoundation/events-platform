const CONTRACT = '{{ env.CONTRACT }}';
const APP_OWNER = '{{ env.APP_OWNER }}';
const APP_NAME = '{{ env.APP_NAME }}';

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

const images = event.images || [];

const EventImage = styled.img`
  width: 100%;
  height: auto;
`;

return (
  <>
    {images.map((image, idx) => {
      return <EventImage src={image} key={`image_idx_${idx}`} />;
    })}

    <h1>{event.name}</h1>

    <a
      href={`#/${APP_OWNER}/widget/${APP_NAME}__edit?event_id=${event.id}`}
      className="text-decoration-none"
    >
      Edit
    </a>
  </>
);
