'use client'

import styles from "./page.module.css";
import { useState } from "react";
import { coerceToArrayBuffer, showErrorAlert, coerceToBase64Url} from "./helpers";
import Swal from "sweetalert2";

export default function Home() {
  const [username, setUsername] = useState('')
  
  async function handleRegisterSubmit(event) {
    event.preventDefault();
    // possible values: none, direct, indirect
    const attestation_type = "none";
    // possible values: <empty>, platform, cross-platform
    const authenticator_attachment = "cross-platform";

    // possible values: preferred, required, discouraged
    const user_verification = "preferred";

    // possible values: discouraged, preferred, required
    const residentKey = "discouraged";

    // prepare form post data
    const data = new FormData();
    data.append('username', username);
    data.append('attType', attestation_type);
    data.append('authType', authenticator_attachment);
    data.append('userVerification', user_verification);
    data.append('residentKey', residentKey);

    // send to server for registering
    let makeCredentialOptions;
    try {
        makeCredentialOptions = await fetchMakeCredentialOptions(data);
    } catch (e) {
        console.error(e);
    }

    console.log("Credential Options Object", makeCredentialOptions);

    if (makeCredentialOptions.status === "error") {
      console.log("Error creating credential options");
      console.log(makeCredentialOptions.errorMessage);
      showErrorAlert(makeCredentialOptions.errorMessage);
      return;
    }

    // Turn the challenge back into the accepted format of padded base64
    makeCredentialOptions.challenge = coerceToArrayBuffer(makeCredentialOptions.challenge);
    // Turn ID into a UInt8Array Buffer for some reason
    makeCredentialOptions.user.id = coerceToArrayBuffer(makeCredentialOptions.user.id);

    makeCredentialOptions.excludeCredentials = makeCredentialOptions.excludeCredentials.map((c) => {
      c.id = coerceToArrayBuffer(c.id);
      return c;
    });

    if (makeCredentialOptions.authenticatorSelection.authenticatorAttachment === null) makeCredentialOptions.authenticatorSelection.authenticatorAttachment = undefined;

    console.log("Credential Options Formatted", makeCredentialOptions);

    Swal.fire({
        title: 'Registering...',
        text: 'Tap your security key to finish registration.',
        imageUrl: "/images/securitykey.min.svg",
        showCancelButton: true,
        showConfirmButton: false,
        focusConfirm: false,
        focusCancel: false
    });


    console.log("Creating PublicKeyCredential...");

    let newCredential;
    try {
        newCredential = await navigator.credentials.create({
            publicKey: makeCredentialOptions
        });
    } catch (e) {
        const msg = "Could not create credentials in browser. Probably because the username is already registered with your authenticator. Please change username or authenticator."
        console.error(msg, e);
        showErrorAlert(msg, e);
    }


    console.log("PublicKeyCredential Created", newCredential);

    try {
        registerNewCredential(newCredential);
    } catch (e) {
        showErrorAlert(e.message ? e.message : e);
    }
    }

  async function fetchMakeCredentialOptions(formData: FormData) {
    const url = 'http://localhost:5157/api/makeCredentialOptions'
    const response = await fetch(url, {
        method: 'POST', // or 'PUT'
        body: formData, // data can be `string` or {object}!
        headers: {
            'Accept': 'application/json'
        },
        credentials: 'include'
    });

    const data = await response.json();

    return data;
  } 

  // This should be used to verify the auth data with the server
  async function registerNewCredential(newCredential) {
    // Move data into Arrays incase it is super long
    const attestationObject = new Uint8Array(newCredential.response.attestationObject);
    const clientDataJSON = new Uint8Array(newCredential.response.clientDataJSON);
    const rawId = new Uint8Array(newCredential.rawId);

    const data = {
        id: newCredential.id,
        rawId: coerceToBase64Url(rawId),
        type: newCredential.type,
        extensions: newCredential.getClientExtensionResults(),
        response: {
            AttestationObject: coerceToBase64Url(attestationObject),
            clientDataJSON: coerceToBase64Url(clientDataJSON),
            transports: newCredential.response.getTransports()
        }
    };

    let response;
    try {
        response = await registerCredentialWithServer(data);
    } catch (e) {
        showErrorAlert(e);
    }

    console.log("Credential Object", response);

    // show error
    if (response.status === "error") {
        console.log("Error creating credential");
        console.log(response.errorMessage);
        showErrorAlert(response.errorMessage);
        return;
    }

    // show success 
    Swal.fire({
        title: 'Registration Successful!',
        text: 'You\'ve registered successfully.',
        icon: 'success',
        timer: 2000
    });

    // redirect to dashboard?
    //window.location.href = "/dashboard/" + state.user.displayName;
  }

  async function registerCredentialWithServer(formData) {
    let response = await fetch('http://localhost:5157/api/makeCredential', {
        method: 'POST', // or 'PUT'
        body: JSON.stringify(formData), // data can be `string` or {object}!
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    });

    let data = await response.json();

    return data;
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value)
  }

  async function handleSignInSubmit(event) {
    event.preventDefault();

    // prepare form post data
    const formData = new FormData();
    formData.append('username', username);
    formData.append('userVerification', 'discouraged');

    // send to server for registering
    let makeAssertionOptions;
    try {
        const res = await fetch('http://localhost:5157/api/assertionOptions', {
            method: 'POST', // or 'PUT'
            body: formData, // data can be `string` or {object}!
            headers: {
                'Accept': 'application/json'
            }
        });

        makeAssertionOptions = await res.json();
    } catch (e) {
        showErrorAlert("Request to server failed", e);
    }

    console.log("Assertion Options Object", makeAssertionOptions);

    // show options error to user
    if (makeAssertionOptions.status === "error") {
        console.log("Error creating assertion options");
        console.log(makeAssertionOptions.errorMessage);
        showErrorAlert(makeAssertionOptions.errorMessage);
        return;
    }

    // todo: switch this to coercebase64
    const challenge = makeAssertionOptions.challenge.replace(/-/g, "+").replace(/_/g, "/");
    makeAssertionOptions.challenge = Uint8Array.from(atob(challenge), c => c.charCodeAt(0));

    // fix escaping. Change this to coerce
    makeAssertionOptions.allowCredentials.forEach(function (listItem) {
        const fixedId = listItem.id.replace(/\_/g, "/").replace(/\-/g, "+");
        listItem.id = Uint8Array.from(atob(fixedId), c => c.charCodeAt(0));
    });

    console.log("Assertion options", makeAssertionOptions);

    Swal.fire({
        title: 'Logging In...',
        text: 'Tap your security key to login.',
        imageUrl: "/images/securitykey.min.svg",
        showCancelButton: true,
        showConfirmButton: false,
        focusConfirm: false,
        focusCancel: false
    });

    // ask browser for credentials (browser will ask connected authenticators)
    let credential;
    try {
        credential = await navigator.credentials.get({ publicKey: makeAssertionOptions })
    } catch (err) {
        showErrorAlert(err.message ? err.message : err);
    }

    try {
        await verifyAssertionWithServer(credential);
    } catch (e) {
        showErrorAlert("Could not verify assertion", e);
    }
} 

  /**
 * Sends the credential to the the FIDO2 server for assertion
 * @param {any} assertedCredential
 */
async function verifyAssertionWithServer(assertedCredential) {

    // Move data into Arrays incase it is super long
    const authData = new Uint8Array(assertedCredential.response.authenticatorData);
    const clientDataJSON = new Uint8Array(assertedCredential.response.clientDataJSON);
    const rawId = new Uint8Array(assertedCredential.rawId);
    const sig = new Uint8Array(assertedCredential.response.signature);
    const data = {
        id: assertedCredential.id,
        rawId: coerceToBase64Url(rawId),
        type: assertedCredential.type,
        extensions: assertedCredential.getClientExtensionResults(),
        response: {
            authenticatorData: coerceToBase64Url(authData),
            clientDataJSON: coerceToBase64Url(clientDataJSON),
            signature: coerceToBase64Url(sig)
        }
    };

    let response;
    try {
        const res = await fetch("http://localhost:5157/api/makeAssertion", {
            method: 'POST', // or 'PUT'
            body: JSON.stringify(data), // data can be `string` or {object}!
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        response = await res.json();
    } catch (e) {
        showErrorAlert("Request to server failed", e);
        throw e;
    }

    console.log("Assertion Object", response);

    // show error
    if (response.status === "error") {
        console.log("Error doing assertion");
        console.log(response.errorMessage);
        showErrorAlert(response.errorMessage);
        return;
    }

    // show success message
    await Swal.fire({
        title: 'Logged In!',
        text: 'You\'re logged in successfully.',
        icon: 'success',
        timer: 2000
    });

    // redirect to dashboard to show keys
    // window.location.href = "/dashboard/" + value("#login-username");
}

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <form>
          <input type="text" placeholder="username" value={username} onChange={handleInputChange}></input>
          <input type="submit" value="Register" onClick={handleRegisterSubmit}></input>
          <input type="submit" value="Signin" onClick={handleSignInSubmit}></input>
        </form>
      </main>
    </div>
  );
}
