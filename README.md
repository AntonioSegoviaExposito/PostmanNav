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

Navigate a Postman collection. Without path shows root. Path to a folder lists its contents. Path to a request shows full details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection` | string | yes | Absolute path to a `.postman_collection.json` file |
| `path` | string | no | Navigation path (e.g. `"0"`, `"0/1/2"`, `"Login"`). Omit for root. |
| `sections` | string[] | no | Filter request sections: `auth`, `headers`, `cookies`, `params`, `body`, `pre-request`, `test`. Omit for all. |
