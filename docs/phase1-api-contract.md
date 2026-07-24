# Phase 1 Backend API Contract

Date: 2026-07-23
Status: Draft for implementation

## Auth model
- Authentication: JWT bearer token.
- User roles from `Users.Role`: `User`, `Contributor`, `Admin`.
- Authorization rules:
  - Create deck/card: `Contributor` or `Admin`
  - Edit/Delete deck/card: `Admin` only
  - Review/run endpoints: any authenticated user

## Endpoints

### 1) Auth
#### POST `/api/auth/register`
- Auth: Public
- Request:
```json
{
  "email": "user@example.com",
  "password": "P@ssw0rd!",
  "displayName": "User Name"
}
```
- Response `201`:
```json
{
  "userId": 1,
  "email": "user@example.com",
  "role": "User"
}
```

#### POST `/api/auth/login`
- Auth: Public
- Request:
```json
{
  "email": "user@example.com",
  "password": "P@ssw0rd!"
}
```
- Response `200`:
```json
{
  "accessToken": "<jwt>",
  "expiresInSeconds": 3600,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "User"
  }
}
```

### 2) Global content read
#### GET `/api/decks`
- Auth: User/Contributor/Admin
- Response `200`:
```json
[
  {
    "id": 10,
    "title": "C# Basics",
    "description": "Core syntax and control flow"
  }
]
```

#### GET `/api/decks/{deckId}/cards`
- Auth: User/Contributor/Admin
- Response `200`:
```json
[
  {
    "id": 1001,
    "deckId": 10,
    "type": "micro-coding",
    "prompt": "Write a method that returns the max of two ints.",
    "validationSpec": "{\"runner\":\"csharp\",\"tests\":[...]}"
  }
]
```

### 3) Content management
#### POST `/api/content/decks`
- Auth: Contributor/Admin
- Request:
```json
{
  "title": "React Basics",
  "description": "State and effect fundamentals"
}
```

#### POST `/api/content/cards`
- Auth: Contributor/Admin
- Request:
```json
{
  "deckId": 10,
  "type": "micro-coding",
  "prompt": "Implement sum of two numbers.",
  "validationSpec": "{\"runner\":\"csharp\",\"tests\":[...]}"
}
```

#### PUT `/api/content/decks/{deckId}`
- Auth: Admin

#### PUT `/api/content/cards/{cardId}`
- Auth: Admin

#### DELETE `/api/content/decks/{deckId}`
- Auth: Admin

#### DELETE `/api/content/cards/{cardId}`
- Auth: Admin

### 4) Review + execution
#### POST `/api/cards/{cardId}/run`
- Auth: User/Contributor/Admin
- Behavior: backend sends execution request to third-party API; result is persisted in `CardRuns`.
- Request:
```json
{
  "submittedCode": "public static int Sum(int a,int b){ return a+b; }",
  "language": "csharp"
}
```
- Response `200`:
```json
{
  "result": "PASS",
  "durationMs": 742,
  "details": "All tests passed"
}
```

#### POST `/api/reviews`
- Auth: User/Contributor/Admin
- Behavior: applies SM-2 style update and persists `ReviewRecords`.
- Request:
```json
{
  "cardId": 1001,
  "outcome": "Good"
}
```
- Response `200`:
```json
{
  "cardId": 1001,
  "nextReviewAt": "2026-07-28T09:00:00Z",
  "easeFactor": 2.5,
  "intervalDays": 5
}
```

## Common errors
- `400`: invalid payload/validation failure
- `401`: missing or invalid token
- `403`: role is not allowed for endpoint
- `404`: deck/card not found
- `429`: execution rate-limited
- `502`: third-party execution API unavailable
