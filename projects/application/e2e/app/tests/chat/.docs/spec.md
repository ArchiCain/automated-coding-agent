# Chat Tests — Requirements

## What It Tests

Chat interface functionality, message sending, and streaming responses.

## Tests (`chat/send-message.spec.ts`)

- [ ] Chat interface renders with message input placeholder and visible send button
- [ ] User can send a message and see it appear in chat; assistant response appears as a second message
- [ ] Input field is cleared after sending a message
- [ ] Send button is disabled when input is empty and enabled when input has text
- [ ] Streaming response content accumulates over time in the assistant message
