# PostmanNav

MCP server to navigate and inspect Postman collections. Exposes 3 tools over stdio that any MCP client can use.

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

## Tools

### `postman_folders`

List top-level folders (flows) in a Postman collection.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | yes | Absolute path to a `.postman_collection.json` file |

### `postman_requests`

List requests inside a folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | yes | Absolute path to a `.postman_collection.json` file |
| `folder` | string | yes | Folder index (e.g. `"0"`) or name substring (case-insensitive) |

### `postman_inspect`

Inspect a specific request showing method, URL, headers, params, body, and scripts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | yes | Absolute path to a `.postman_collection.json` file |
| `folder` | string | yes | Folder index or name substring |
| `request` | string | yes | Request index or name substring |
| `sections` | string[] | no | Filter output: `auth`, `headers`, `cookies`, `params`, `body`, `pre-request`, `test`. Omit for all. |
