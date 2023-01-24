// const CONTRACT = '{{ env.CONTRACT }}';
const APP_OWNER = '{{ env.APP_OWNER }}';
const APP_NAME = '{{ env.APP_NAME }}';
const accountId = props.accountId ?? context.accountId;

const Button = styled.button`
  background-color: #4caf50;
  border: none;
  color: white;
  padding: 15px 32px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
`;

return (
  <div>
    <h1>Events</h1>
    <a
      href={`#/${APP_OWNER}/widget/${APP_NAME}__new?accountId=${accountId}`}
      className="TODO"
    >
      <Button>Create new Event</Button>
    </a>

    <a
      href={`#/${APP_OWNER}/widget/${APP_NAME}__index__list_container?accountId=${accountId}`}
      className="TODO"
    >
      <Button>My events</Button>
    </a>

    <br />

    <Widget
      src={`${APP_OWNER}/widget/${APP_NAME}__index__list_container`}
      props={{}}
    />
  </div>
);
