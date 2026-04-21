# Chat — Test Plan

## Contract Tests

- [ ] Chat page at `/` (conversational AI) renders message input with placeholder matching `/type.*message/i`
- [ ] Send button is present with accessible name matching `/send/i`
- [ ] Sending a message via the UI results in a backend API call that returns a streaming response

## Behavior Tests

- [ ] Send button is disabled when message input is empty
- [ ] Send button becomes enabled when message input has text
- [ ] After sending a message, the input field is cleared (value becomes empty string)
- [ ] User's sent message appears in the chat as a visible element containing the message text
- [ ] Assistant response appears as a second message (article role with name matching `/assistant message/i`)
- [ ] Streaming response content accumulates over time (content length grows between intervals)

## E2E Scenarios

- [ ] Full send flow: log in as admin, navigate to `/`, type "Hello, AI assistant!", click send, verify message appears in chat, verify assistant response article appears within 45s
- [ ] Streaming verification: send question ("What is the capital of France?"), capture assistant message content at 1s and 3s intervals, verify content length is non-decreasing
- [ ] Input state management: verify send disabled when empty, type text, verify enabled, send, verify cleared and disabled again
