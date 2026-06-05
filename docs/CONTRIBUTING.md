# ghost-poster — Contribution guide

## Adding a screen

Screens are created in the `app/` folder following Expo Router conventions.

**Naming convention:**
- One file = one screen. The filename determines the route.
- Groups (tabs, modals) use the `(group)/` notation — parentheses are excluded from the URL.
- Layouts are named `_layout.tsx`.

**Example: adding a post detail screen**

Create `app/post/[id].tsx`. Expo Router automatically generates the route `/post/:id`. Read the parameter with `useLocalSearchParams()`.

```typescript
// app/post/[id].tsx
import { useLocalSearchParams } from 'expo-router';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // ...
}
```

**Rules:**
- No calls to `ghostClient` from a screen — go through the store or a hook.
- No business logic in `_layout.tsx` layouts.
- Native Alerts (irreversible confirmation) belong in hooks or screen callbacks, never in stores.

## Adding an action to the store

All actions follow the same pattern in Zustand stores.

**Basic pattern:**

```typescript
// In postStore.ts or instanceStore.ts
async myNewAction(param: string): Promise<void> {
  set({ isLoading: true, error: null });
  try {
    const result = await someApiFunction(param);
    set({ myData: result, isLoading: false });
  } catch (error) {
    console.error('myNewAction error:', error instanceof Error ? error.message : error);
    set({
      isLoading: false,
      error: error instanceof Error ? error.message : 'Unexpected error.',
    });
    throw error;  // Re-throw if the caller needs to react
  }
}
```

**Rules:**
- Always set `isLoading: true` at the start of an async action.
- Always log errors with `console.error` — without sensitive data (never an API key).
- Always store the error message in `state.error` so components can display it.
- Never mutate `state` directly — produce a new object in `set()`.
- Actions in `instanceStore` that modify persisted data must call `persistState()` or the SecureStore setters.

## Adding an API endpoint

All endpoints are defined in `src/api/ghostClient.ts`.

**Steps:**

1. Add the response type in `src/api/ghostTypes.ts` if needed.

```typescript
// In ghostTypes.ts
export interface GhostNewResourceResponse {
  resource: {
    id: string;
    // ...
  };
}
```

2. Add the function in `ghostClient.ts`:

```typescript
// In ghostClient.ts
/**
 * Description of what the endpoint does.
 * @param id - Parameter description
 * @returns Description of the returned value
 * @throws GhostApiError if the API returns an error
 */
export async function getNewResource(id: string): Promise<GhostNewResourceType> {
  const response = await client.get<GhostNewResourceResponse>(
    `/ghost/api/admin/new-resource/${id}/`,
  );
  return response.data.resource;
}
```

3. Call the function from the store (never directly from a screen).

**Rules:**
- Each exported function must have a complete JSDoc (description, `@param`, `@returns`, `@throws`).
- HTTP errors are already normalized by the response interceptor — do not handle 401/409/422/429 in individual functions.
- For an endpoint that bypasses interceptors (like `testGhostConnection`), handle errors explicitly in the function.

## Commit conventions

Commits follow the **Conventional Commits** format in English:

```
type(scope): concise description in imperative present tense
```

**Types:**

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Refactoring without behavior change |
| `docs` | Documentation only |
| `chore` | Maintenance (dependencies, config, scripts) |
| `style` | Formatting, CSS/StyleSheet styles |
| `test` | Adding or modifying tests |

**Examples:**

```
feat(compose): add keyboard-aware scroll on editor screen
fix(ghostClient): handle 503 upstream Ghost errors
docs(GHOST_API): add rate limiting section
chore(deps): upgrade jose to 5.9.6
```

**Rules:**
- No direct commits to `main` — always via a PR/MR on Gitea.
- Description does not exceed 72 characters.
- The commit body (optional, after a blank line) can contain context and rationale.
- No secrets or API key fragments in commit messages.
