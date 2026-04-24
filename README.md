# PostmanNav

MCP server to navigate and inspect Postman collections. Exposes 3 tools over stdio that any MCP client (OpenCode, Claude Desktop, Cursor, etc.) can use.

## Install

```bash
git clone https://github.com/AntonioSegoviaExposito/PostmanNav.git
cd PostmanNav
pnpm install
```

## MCP client configuration

### OpenCode

In `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "postman-nav": {
      "type": "local",
      "command": ["node", "/absolute/path/to/PostmanNav/src/server.js"],
      "enabled": true
    }
  }
}
```

### Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "postman-nav": {
      "command": "node",
      "args": ["/absolute/path/to/PostmanNav/src/server.js"]
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
| `sections` | string[] | no | Filter output: `headers`, `params`, `body`, `pre-request`, `test`. Omit for all. |

## Project structure

```
src/
  tools/
    list-folders.js       # postman_folders logic
    list-requests.js      # postman_requests logic
    inspect-request.js    # postman_inspect logic
  utils/
    parser.js             # Collection loader + folder/request finders
  server.js               # MCP entry point (stdio)
```

## License

MIT
