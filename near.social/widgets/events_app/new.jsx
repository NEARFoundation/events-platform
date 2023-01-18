// const APP_STORE = 'solleder.near';
// const STORE_KEY = 'DISCOVERY_APPS';

if (context.loading) {
  return 'Loading';
}

const accountId = context.accountId;
if (!accountId) {
  return 'Please sign in with NEAR wallet to use this widget';
}
