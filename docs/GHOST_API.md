# ghost-poster — Ghost API reference

## Authentication

The app uses Ghost's **Admin API**, authenticated by a JWT signed with the Admin API key.

### Mechanism

The Admin API key is in `id:secret` format where both parts are hex strings. On every request, the app:

1. Extracts `id` and `secret` from the key stored in SecureStore
2. Decodes `secret` from hex to `Uint8Array`
3. Signs a HS256 JWT with `jose`:
   - Header: `{ alg: "HS256", kid: "<id>" }`
   - Payload: `{ iat: <now>, exp: <now + 300s>, aud: "/admin/" }`
4. Injects the JWT into the HTTP header: `Authorization: Ghost <token>`

The JWT is generated on the fly for every request and is never cached. Its lifetime is 5 minutes maximum, in line with Ghost's recommendations.

### Key format

```
6ba7b810:9dad11d1b0004b00b0000c3f7edcfbadba0efbad
│         │
│         └── secret (hex, 40+ characters)
└────────── id (hex, 8+ characters)
```

The key is validated client-side with the regex `/^[a-f0-9]+:[a-f0-9]+$/i` before any call.

## Endpoints used

| Method | Endpoint | Usage | Key parameters |
|---|---|---|---|
| GET | `/ghost/api/admin/site/` | Connection test + metadata | — |
| GET | `/ghost/api/admin/posts/` | Paginated post list | `page`, `limit=15`, `filter`, `include=tags`, `order=updated_at desc` |
| GET | `/ghost/api/admin/posts/:id/` | Post detail | `include=tags` |
| POST | `/ghost/api/admin/posts/` | Create a post | Body: `{ posts: [{ title, html, status, tags }] }` |
| PUT | `/ghost/api/admin/posts/:id/` | Update a post | Body: `{ posts: [{ title, html, status, tags, updated_at }] }` |
| DELETE | `/ghost/api/admin/posts/:id/` | Delete a post | — |
| POST | `/ghost/api/admin/images/upload/` | Image upload | `multipart/form-data`: `file` and `purpose=image` fields |

### List filters

Ghost uses its own filter syntax via the `filter` parameter:

```
status:draft                 # Drafts only
status:published             # Published only
status:[draft,published]     # All (excludes scheduled)
```

The app uses `status:[draft,published]` for the "All" filter — scheduled posts are included in `published` on the Ghost side and displayed with the "Scheduled" badge in the app.

## Conflict handling (409)

Ghost implements **optimistic locking** based on the `updated_at` field. Every PUT request must include the `updated_at` value of the post as it was read during the last GET.

If the post was modified between the load and the save (by another client or via the Ghost admin panel), the server returns a **409 Conflict** error. The app then displays: *"The post has been modified since you last loaded it. Reload it before saving."*

To get back in sync, the user must reload the post list and reopen the post for editing — which fetches the most recent `updated_at`.

The flow in code:

```typescript
// In postStore.saveCurrentPost()
await updatePost(current.ghostId, {
  posts: [{
    title: current.title,
    html,
    status,
    updated_at: current.originalUpdatedAt,  // REQUIRED
  }]
});
```

## HTML / Lexical content strategy

Ghost 5+ stores content in two fields: `html` (rendered HTML) and `lexical` (Ghost editor's native JSON format). The app only uses `html` for the following reasons:

- The Lexical format is proprietary and not publicly documented
- The Ghost Admin API accepts the `html` field for writes and re-converts it to Lexical server-side
- This approach is documented and supported by the Ghost team

**Read behavior:** if `html` is null (post entirely in Lexical with no HTML render), the app treats the content as empty and starts with a blank editor. The original Lexical content is preserved if the user saves without modifying.

**Write behavior:** Ghost generates the `lexical` field from the provided HTML. Advanced Ghost cards (galleries, embeds) are not reconstructed — content is normalized to standard HTML.

## Handled error codes

| HTTP code | Error class | App behavior |
|---|---|---|
| 401 | `AuthenticationError` | Error snackbar, navigation to Settings to reconfigure the key |
| 409 | `ConflictError` | Snackbar with specific message (stale updated_at) |
| 422 | `ValidationError` | Snackbar with Ghost error message (invalid field, missing title…) |
| 429 | `RateLimitError` | Snackbar with retry prompt |
| Other | `GhostApiError` | Snackbar with raw error message |
| Network (timeout, DNS) | Unwrapped `AxiosError` | "Network error" snackbar |
| No active instance | `NotConfiguredError` | Automatic navigation to Settings |
