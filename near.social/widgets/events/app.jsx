const APP_OWNER = '{{ env.APP_OWNER }}';
const APP_NAME = '{{ env.APP_NAME }}';
const DEBUG = '{{ env.DEBUG }}';

return (
  <Widget
    src={`${APP_OWNER}/widget/app__frame`}
    props={{
      ...props,
      appOwner: APP_OWNER,
      appName: APP_NAME,
      entryRoute: 'index',
      entryProps: {},
      DEBUG: /true|1|yes/iu.test(DEBUG),
    }}
  />
);
