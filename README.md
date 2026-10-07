# PostmanNav

MCP server that lets an agent browse Postman collections like a file system: folders are `DIR`, requests are `REQ`, and request details (headers, body, scripts, saved responses…) are read on demand. Exposes a single tool, `postman_nav`, over stdio. The tool description is a full usage manual, so agents need no extra instructions.

## Configuration

`POSTMAN_API_KEY` is optional. Without it, the agent can only open local exports; with it, it can also browse the workspaces of that Postman account. Create a key in Postman under *Settings → API keys*.

opencode (`~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "postman-nav": {
      "type": "local",
      "command": ["pnpm", "dlx", "github:AntonioSegoviaExposito/PostmanNav"],
      "environment": { "POSTMAN_API_KEY": "PMAK-..." },
      "enabled": true
    }
  }
}
```

Clients using the `mcpServers` format (Claude Desktop, Cursor, …):

```json
{
  "mcpServers": {
    "postman-nav": {
      "command": "pnpm",
      "args": ["dlx", "github:AntonioSegoviaExposito/PostmanNav"],
      "env": { "POSTMAN_API_KEY": "PMAK-..." }
    }
  }
}
```

## Sources

| `collection` | Root of the navigation |
|--------------|------------------------|
| Path to a collection export (`.json`, v2.x) | The collection |
| Path to a directory | Its subdirectories and the collection exports it contains |
| Omitted | The workspaces of the `POSTMAN_API_KEY` account |

Postman account mode mirrors what you open into `<os temp dir>/postman-nav/<key hash>/<workspace>/<collection>.postman_collection.json`:

- Listing the root fetches the workspace list.
- Opening a workspace fetches its collection list and downloads only the collections whose `updatedAt` differs from the local copy.
- The same listing is checked against Postman at most once a minute per server process.
- Workspaces and collections removed in Postman are removed from the mirror.

The Postman API allows 300 requests per minute, and plans have a monthly quota.

## Tool

### `postman_nav`

| Parameter | Type | Description |
|-----------|------|-------------|
| `collection` | string | Collection export or directory of exports. Omit to browse the Postman account. |
| `path` | string | Segments separated by `/`, each a 0-based index or a name (exact, else unique case-insensitive substring), e.g. `"1/0/3"`, `"Auth/Login"`. Names containing `/` need the index. Omit for the root. |
| `depth` | number | Folder levels to expand inside a collection, like `tree` (default 1). Directories, workspaces and collections list one level at a time. |
| `sections` | string[] | Inside a collection: `auth`, `headers`, `cookies`, `params`, `body`, `pre-request`, `post-response`, `examples`, `variables`, `all` (every non-empty section except `variables`). |

Responses:

- The first line is the address: `DIR|REQ <path>  ·  <breadcrumb>`. In listings, the second column is the path of each entry.
- A request without `sections` returns a summary: size of each section, plus the variables it `uses` and `sets`, and `undeclared` ones (not defined in the collection).
- Requested empty sections print `(none)`. Lines prefixed `(disabled)` are not sent by Postman.
- Errors start with `ERR` and include the candidates, or the listing of the last valid level.

```
DIR 0/2  ·  Postman › Team workspace › Orders API  ·  collection  ·  2 dir, 3 req  ·  variables: 4

DIR  0/2/0  Auth  2 items
DIR  0/2/1  Orders  5 items
REQ  0/2/2  GET     Health check  headers
REQ  0/2/3  POST    Create order  headers body post-response
REQ  0/2/4  GET     Get order  headers params examples:2
```
