const accountId = context.accountId;

if (context.loading) {
  return 'Loading';
}

if (!accountId) {
  return 'Please sign in with NEAR wallet to use this widget';
}

const DEFAULT_APP = {
  app: {
    name: { long: 'My fancy App', short: 'My App' },
    description: {
      long: 'My app description, 2-3 paragraphs',
      short: 'Short app description, 1-2 sentences',
    },
  },
};

State.init(DEFAULT_APP);

if (!state) {
  return 'loading';
}

const normalizeKey = (key) =>
  key.replaceAll(/[^a-zA-Z0-9]/gu, '_').toLowerCase();

const appState = JSON.stringify(state.app, null, 4);
const appKey = normalizeKey(state.app.name.long);
const appName = state.app.name.long;
const appNameShort = state.app.name.short;

function _merge(origin, update) {
  for (const key of Object.keys(update)) {
    if (origin[key] && typeof origin[key] === 'object') {
      origin[key] = _merge(origin[key], update[key]);
    } else {
      origin[key] = update[key];
    }
  }
  return origin;
}

function merge(o) {
  State.update({ app: _merge(state.app, o) });
}

function TextInput(props) {
  return (
    <div className="mb-2 width-full">
      <label>{props.label}</label>
      <br />
      {props.rows && props.rows > 1 ? (
        <textarea
          onChange={(event) => props.onChange(event)}
          value={props.value}
          {...props}
        ></textarea>
      ) : (
        <input
          onChange={(event) => props.onChange(event)}
          value={props.value}
          {...props}
        ></input>
      )}
    </div>
  );
}

return (
  <div>
    <h1>App Editor</h1>
    <p>For: {accountId}</p>
    <p>App Name: {state.app.name.long}</p>
    <p>App Data: {appState}</p>

    {TextInput({
      label: 'App Name',
      onChange: (event) => merge({ name: { long: event.target.value } }),
      value: appName,
    })}

    {TextInput({
      label: 'Short Name',
      onChange: (event) => merge({ name: { short: event.target.value } }),
      value: appNameShort,
      style: { maxWidth: '10em' },
    })}

    {TextInput({
      label: 'Description',
      onChange: (event) => merge({ description: { long: event.target.value } }),
      rows: 4,
      value: state.app.description.long,
    })}

    {TextInput({
      label: 'Short description',
      onChange: (event) =>
        merge({ description: { short: event.target.value } }),
      rows: 2,
      value: state.app.description.short,
      style: { maxWidth: '20em' },
    })}

    <CommitButton
      data={{
        DISCOVERY_APPS: {
          [appKey]: state.app,
        },
      }}
    >
      Submit
    </CommitButton>
  </div>
);
