# Supabase REST Catalog

This document summarizes the REST interfaces exposed by the Supabase project that power the Lost & Found application. All endpoints live under the project base URL:

```
https://<project-ref>.supabase.co
```

Every request must include the `apikey` header containing the project's anon key. Authenticated requests also require an `Authorization: Bearer <access_token>` header using the GoTrue session token issued during sign in.

## Auth (GoTrue)

| Purpose | Method & Path | Notes |
| --- | --- | --- |
| Sign up | `POST /auth/v1/signup` | Creates a new user and (when email confirmation is disabled) returns an authenticated session. |
| Sign in | `POST /auth/v1/token?grant_type=password` | Exchanges credentials for an access and refresh token pair. |
| Sign out | `POST /auth/v1/logout` | Revokes the active refresh token. |
| Current user | `GET /auth/v1/user` | Returns profile information for the authenticated user. |

### Sign in example

```http
POST /auth/v1/token?grant_type=password HTTP/1.1
Host: <project-ref>.supabase.co
apikey: <anon-key>
Content-Type: application/json

{
  "email": "student@example.edu",
  "password": "secret-password"
}
```

Successful response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "MU8lJ9...",
  "user": {
    "id": "6d4c8c24-98e5-4eb0-9d7d-404fc1f984f2",
    "email": "student@example.edu",
    "created_at": "2024-02-20T18:42:08.279891+00:00"
  }
}
```

Error responses follow the GoTrue schema, for example:

```json
{
  "error": "invalid_grant",
  "error_description": "Invalid login credentials"
}
```

## Database tables (PostgREST)

The PostgREST API is available at `/rest/v1`. Supply a `select` query parameter to specify the columns to return. Filters use PostgREST syntax (e.g. `?status=eq.active`).

### `profiles`

- **List:** `GET /rest/v1/profiles?select=*`
- **Fetch single:** `GET /rest/v1/profiles?id=eq.<uuid>&select=*`
- **Insert:** `POST /rest/v1/profiles`
- **Update:** `PATCH /rest/v1/profiles?id=eq.<uuid>`

Example insert:

```http
POST /rest/v1/profiles HTTP/1.1
Host: <project-ref>.supabase.co
apikey: <anon-key>
Authorization: Bearer <access-token>
Content-Type: application/json
Prefer: return=representation

{
  "id": "6d4c8c24-98e5-4eb0-9d7d-404fc1f984f2",
  "email": "student@example.edu",
  "full_name": "Student Example"
}
```

Response:

```json
[
  {
    "id": "6d4c8c24-98e5-4eb0-9d7d-404fc1f984f2",
    "email": "student@example.edu",
    "full_name": "Student Example",
    "created_at": "2024-02-20T18:42:08.279891+00:00",
    "updated_at": "2024-02-20T18:42:08.279891+00:00"
  }
]
```

### `lost_items`

| Operation | Request |
| --- | --- |
| List | `GET /rest/v1/lost_items?select=*` |
| Filter by owner | `GET /rest/v1/lost_items?user_id=eq.<uuid>&select=*` |
| Fetch single | `GET /rest/v1/lost_items?id=eq.<uuid>&select=*` |
| Create | `POST /rest/v1/lost_items` with `Prefer: return=representation` |
| Update | `PATCH /rest/v1/lost_items?id=eq.<uuid>` with `Prefer: return=representation` |
| Delete | `DELETE /rest/v1/lost_items?id=eq.<uuid>` |

Sample response when listing:

```json
[
  {
    "id": "d5354217-2c61-4a6f-9c65-a0193492a8d3",
    "user_id": "6d4c8c24-98e5-4eb0-9d7d-404fc1f984f2",
    "category": "electronics",
    "description": "Space gray MacBook Pro",
    "location_lost": "Engineering lab",
    "status": "active",
    "created_at": "2024-02-22T15:07:11.184231+00:00"
  }
]
```

If a constraint fails, PostgREST returns:

```json
{
  "code": "23505",
  "details": "Key (id)=(...) already exists.",
  "hint": null,
  "message": "duplicate key value violates unique constraint"
}
```

### `found_items`

Operations mirror `lost_items` using the `/rest/v1/found_items` path and the same PostgREST semantics.

### `matches`

- **List for a lost item:** `GET /rest/v1/matches?lost_item_id=eq.<uuid>&select=*`
- **List for a found item:** `GET /rest/v1/matches?found_item_id=eq.<uuid>&select=*`
- **Create:** `POST /rest/v1/matches`
- **Update status:** `PATCH /rest/v1/matches?id=eq.<uuid>`

## Storage

Storage endpoints live under `/storage/v1`.

| Operation | Method & Path | Notes |
| --- | --- | --- |
| Create signed upload URL | `POST /storage/v1/object/upload/sign/<bucket>/<path>` | Returns a tokenized URL that remains valid for two hours. Include `x-upsert: true` to overwrite. |
| Upload with signed URL | `PUT <signed-url>` | Use the URL returned above. Set the `Content-Type` header to match the file. |
| Public asset URL | `GET /storage/v1/object/public/<bucket>/<path>` | Works without auth when the bucket is public. |

Example signed upload response:

```json
{
  "url": "/storage/v1/object/upload/sign/item-images/user-uuid/backpack.jpg?token=Af2g..."
}
```

You can then `PUT` the file directly to `https://<project-ref>.supabase.co/storage/v1/object/upload/sign/item-images/user-uuid/backpack.jpg?token=Af2g...`.

Errors follow the storage REST format:

```json
{
  "error": "Bucket not found",
  "statusCode": "404",
  "message": "The resource could not be located"
}
```

## Common headers

```
apikey: <anon-key>
Authorization: Bearer <access-token>
Content-Type: application/json
Prefer: return=representation
```

Use `Prefer: return=representation` on write operations when the client needs the created/updated row in the response.
