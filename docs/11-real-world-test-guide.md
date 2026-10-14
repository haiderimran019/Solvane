# Solvane Real-World MVP Test Guide

Use test projects and non-confidential content. Solvane should preserve explicit project state, but it cannot transfer hidden reasoning, provider cookies, passwords, model quota, or subscription access.

## 1. Sign in and verify account isolation

1. Open the hosted Solvane app.
2. Sign in with the supported ChatGPT/Sites account.
3. Open the profile and data center from the avatar.
4. Confirm the displayed email belongs to the signed-in account.
5. Choose either **Essential only** or **Allow product analytics**. Changing this choice later must also work.
6. Do not enter provider passwords inside Solvane. Claude, Gemini, ChatGPT, and Perplexity authentication happens only on their official websites.

Expected result: the workspace loads, the profile opens, the consent choice persists, and only that account's projects are visible.

## 2. Create a project and build a Capsule

1. Select **New project** and give it a recognizable test name.
2. Select **Edit** on the Continuity Capsule.
3. Add a north star, current task, at least one decision, one constraint, one completed change, and a specific next step.
4. Save the Capsule.
5. Open **Trust preview** and read the exact text Solvane will transfer.
6. Close the preview and confirm Context Health and the token estimate changed.

Expected result: the project persists after reload, the Capsule version increases, and Trust Preview contains only visible project state.

## 3. Test Browser Bridge handoff

1. Under **Continue in**, choose Claude, Gemini, ChatGPT, or Perplexity.
2. Confirm a Solvane dialog appears before any external site opens.
3. Verify the dialog names the chosen provider, Capsule version, estimated token count, and official destination.
4. Select **Copy Capsule & open**.
5. Confirm the provider opens in a new tab. Sign in on the provider's own page if needed.
6. Paste into the provider composer with `Command-V`/`Control-V` if the extension is not installed.
7. Read the Capsule before sending. Solvane must never press Send for you.
8. Return to Solvane and confirm the handoff appears in **Recent handoffs** or **Activity**.

Expected result: no popup-blocker prompt appears, the correct official site opens, the Capsule is ready to paste, and an audit record is stored.

## 4. Test the optional browser extension

1. Download the extension from **Modes & settings**.
2. Unzip it, open the browser's extension management page, enable developer mode, and load the unpacked `apps/extension` folder. Only install it after reviewing its requested permissions.
3. Reopen one of the four supported provider websites.
4. Use the floating Solvane control to insert the pending Capsule.
5. Confirm the inserted content matches Trust Preview and that the extension does not send the message.
6. Repeat once per provider because provider page markup changes independently.

Expected result: insertion works when the current provider composer is recognized. If it does not, clipboard paste remains the supported fallback.

## 5. Test provider order and zoom

1. In **Preferred route**, move providers earlier and later.
2. Reload and confirm the order persists.
3. Test browser zoom at 100%, 125%, 150%, and 175%.
4. Confirm arrow buttons stay inside their provider card.
5. At narrow widths, horizontally scroll only the provider lane; the whole page must not slide sideways.
6. On a phone, confirm the bottom navigation highlights the active section with the same Solvane yellow.

Expected result: no arrows overlap, no provider cards pile up, and the page has no unintended horizontal overflow.

## 6. Test profile, privacy, and owned data

1. Open the profile and data center.
2. Confirm project, Capsule, handoff, message, and API-connection totals are visible.
3. Change the product analytics choice and reopen the profile to confirm it persisted.
4. Export account data and inspect the downloaded JSON.
5. Confirm it contains only the signed-in user's Solvane records and contains no provider passwords or cookies.
6. Sign out and confirm the private workspace is no longer visible.

Expected result: profile controls work, export completes, privacy choice persists, and sign-out removes workspace access.

## 7. Test cross-device and second-account boundaries

1. Sign in to Solvane on a second browser or device with the same account.
2. Open the project created in step 2 and confirm the latest Capsule and provider order are present.
3. Create a harmless change on device two, save it, and refresh device one.
4. Sign in with a second admitted test account.
5. Confirm the second account cannot see the first account's projects, Capsules, handoffs, messages, exports, or API connections.

Expected result: the same account syncs across devices; different accounts remain isolated.

## 8. Test optional API Automation

1. Switch to **API mode** and confirm the active mode becomes dark and visually selected.
2. Open **Manage keys** and connect only a disposable test API key.
3. Send a harmless test message through the developer relay.
4. Confirm the response identifies the provider used and persists after reload.
5. If two providers are connected, enable fallback and deliberately use a safe quota/error test to confirm the next eligible provider is attempted.
6. Remove or rotate the disposable keys after testing.

Expected result: Browser Bridge works without provider keys; API mode works only with valid provider access and quota.

## Acceptance checklist

- [ ] Sign-in, profile, consent, export, and sign-out work.
- [ ] Project and Capsule changes persist after reload.
- [ ] Trust Preview exactly matches the transferred state.
- [ ] All four provider dialogs point to the correct official site.
- [ ] Browser Bridge opens a new tab without a popup-blocker prompt.
- [ ] Preferred-route controls remain usable at 100–175% zoom.
- [ ] Phone, tablet, and desktop have no page-level horizontal overflow.
- [ ] Same-account cross-device sync works.
- [ ] Second-account isolation works.
- [ ] Extension insertion is checked on all four current provider pages, with paste fallback confirmed.
- [ ] API response and fallback are checked only when valid test keys are available.

Record the browser, operating system, viewport or zoom level, account type, provider, exact steps, expected result, actual result, and a screenshot for every failure.
