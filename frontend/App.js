import "regenerator-runtime/runtime";
import React from "react";

import "./assets/global.css";

import { EducationalText, SignInPrompt, SignOutButton } from "./ui-components";

export default function App({ isSignedIn, contractId, wallet }) {
  const [valueFromBlockchain, setValueFromBlockchain] = React.useState();

  const [uiPleaseWait, setUiPleaseWait] = React.useState(true);

  // Get blockchian state once on component load
  React.useEffect(() => {
    getEvents()
      .then(setValueFromBlockchain)
      .catch(alert)
      .finally(() => {
        setUiPleaseWait(false);
      });
  }, []);

  /// If user not signed-in with wallet - show prompt
  if (!isSignedIn) {
    // Sign-in flow will reload the page later
    return (
      <SignInPrompt
        greeting={valueFromBlockchain}
        onClick={() => wallet.signIn()}
      />
    );
  }

  function changeGreeting(e) {
    e.preventDefault();
    setUiPleaseWait(true);

    let now = new Date();
    const start_date = now;
    now.setDate(now.getDate() + 1);
    const end_date = now;

    // use the wallet to send the greeting to the contract
    wallet
      .callMethod({
        method: "create_event",
        args: {
          name: "test",
          type: "irl",
          category: "test",
          status: "published",
          description: "test",
          start_date,
          end_date,
          location: "here",
          image: [],
          links: [],
        },
        contractId,
      })
      .then(async () => {
        return getEvents();
      })
      .then(setValueFromBlockchain)
      .finally(() => {
        setUiPleaseWait(false);
      });
  }

  function getEvents() {
    // use the wallet to query the contract's greeting
    return wallet.viewMethod({ method: "get_all_events", contractId });
  }

  return (
    <>
      <SignOutButton
        accountId={wallet.accountId}
        onClick={() => wallet.signOut()}
      />
      <main className={uiPleaseWait ? "please-wait" : ""}>
        <h1>
          The contract says:{" "}
          <span className="greeting">{valueFromBlockchain}</span>
        </h1>
        <form onSubmit={changeGreeting} className="change">
          <div>
            <button>
              <span>Create an event</span>
              <div className="loader"></div>
            </button>
          </div>
        </form>
        <EducationalText />
      </main>
    </>
  );
}
