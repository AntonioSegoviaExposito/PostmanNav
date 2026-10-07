# PostmanNav

MCP server to navigate and inspect Postman collections. Exposes a single tool over stdio that any MCP client can use.

## Configuration

In `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "postman-nav": {
      "type": "local",
      "command": ["pnpm", "dlx", "github:AntonioSegoviaExposito/PostmanNav"],
      "enabled": true
    }
  }
}
```

## Tool

### `postman_nav`

Browse a collection like a filesystem: `DIR` = folder, `REQ` = request (file). Every response starts with the type, the canonical index path and a breadcrumb.

- Path to a folder → lists children; each row shows its type and the path to use next. `REQ` rows show method and non-empty sections.
- Path to a request → summary: size of each section, variables it `uses` and `sets`, and `undeclared` ones (not in collection variables).
- `sections` → content of those sections. Empty ones print `(none)`; disabled headers/params/form fields are prefixed `(disabled)`.
- Ambiguous or missing segment → `ERR` with the candidates or the listing of the last valid folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | yes | Absolute path to a `.postman_collection.json` file |
| `path` | string | no | Segments separated by `/`, each an index or a name (exact, else unique substring), e.g. `"0/0/1/2"`, `"REST/v1/Create"`. Names containing `/` need the index. Omit for root. |
| `depth` | number | no | Folders only: levels to expand, like `tree` (default 1). |
| `sections` | string[] | no | `auth`, `headers`, `cookies`, `params`, `body`, `pre-request`, `post-response`, `examples`, `variables` (collection variables, from any path), `all` (every non-empty section except `variables`). Works on folders and root too. |
