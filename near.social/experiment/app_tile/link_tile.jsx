const accountId = props.accountId || context.accountId;
const widgetId = props.widgetId || context.widgetId;

return (
  <a
    href={`#/${accountId}/widget/discovery.1?w=${widgetId}`}
    className="text-decoration-none"
  >
    <Widget
      src="mob.near/widget/WidgetImage"
      props={{
        tooltip: true,
        accountId: accountId,
        widgetName: widgetId,
      }}
    />
  </a>
);
