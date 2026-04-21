# Theme — Contracts

## Endpoints

### `GET /theme`
**Auth:** JWT required
**Response (200):**
```typescript
{ theme: 'light' | 'dark'; userId: string }
```
**Behavior:** Returns `{ theme: 'dark' }` when no saved preference exists.

### `PUT /theme`
**Auth:** JWT required
**Request:**
```typescript
{ theme: 'light' | 'dark' }
```
**Response (200):**
```typescript
{ theme: 'light' | 'dark'; userId: string }
```
**Behavior:** Upserts — creates record if none exists, updates if it does.

## Shared Types

```typescript
interface ThemePreference {
  theme: 'light' | 'dark';
  userId: string;
}

interface UpdateThemeRequest {
  theme: 'light' | 'dark';
}
```
