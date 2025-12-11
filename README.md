# HTTP Visualizer

A HTTP client for API testing with animated data flow visualization. Built with Vue 3, TypeScript, and PixiJS.

## Features

- **Visual Data Flow**: Watch your HTTP requests flow through animated nodes with Matrix-style effects
- **Multiple Auth Methods**: Basic Auth, Bearer Token, API Key, OAuth2 (Client Credentials, Password, Authorization Code)
- **File Import**: Parse `.http`, `.rest`, and `.bru` (Bruno) files
- **Collections**: Organize requests into collections with folders and auth inheritance
- **Environment Variables**: Manage variables across environments with file-level overrides
- **Theme Support**: 5 built-in themes (Matrix, Cyberpunk, Amber Terminal, Phosphor Green, Midnight Blue)
- **Presentation Mode**: Terminal-style mode for demos and presentations
- **Response Viewer**: JSON tree view, table view, and raw view with syntax highlighting
- **CORS Bypass**: Optional browser extension for bypassing CORS restrictions

## Installation

### Prerequisites

- Node.js 18+
- Yarn (recommended) or npm

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd http-visualizer

# Install dependencies
yarn install

# Start development server
yarn dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
yarn build
yarn preview
```

## Architecture

The project follows SOLID principles with a clean, modular architecture:

```
http-visualizer/
├── src/
│   ├── components/
│   │   ├── auth/                    # Authentication forms
│   │   │   ├── AuthConfigModal.vue  # Main auth configuration modal
│   │   │   ├── BasicAuthForm.vue    # Basic auth form
│   │   │   ├── BearerAuthForm.vue   # Bearer token form
│   │   │   ├── ApiKeyForm.vue       # API key form
│   │   │   ├── OAuth2Form.vue       # OAuth2 configuration
│   │   │   └── HeaderEditor.vue     # Manual headers editor
│   │   │
│   │   ├── builder/                 # Request builder components
│   │   │   ├── RequestEditor.vue    # Main request editor
│   │   │   ├── CollectionSidebar.vue# Collection management sidebar
│   │   │   ├── CollectionItem.vue   # Collection tree item
│   │   │   ├── FolderItem.vue       # Folder tree item
│   │   │   ├── RequestItem.vue      # Request tree item
│   │   │   ├── HeadersEditor.vue    # Request headers editor
│   │   │   ├── BodyEditor.vue       # Request body editor
│   │   │   ├── FormBodyEditor.vue   # Form data editor
│   │   │   ├── AuthTab.vue          # Auth configuration tab
│   │   │   ├── VariablesTab.vue     # Variables configuration
│   │   │   └── VariableUrlInput.vue # URL input with variable highlighting
│   │   │
│   │   ├── canvas/                  # PixiJS visualization
│   │   │   ├── PixiCanvas.vue       # Main canvas component
│   │   │   ├── DataFlowGraph.ts     # Data flow orchestration
│   │   │   ├── TerminalNode.ts      # Request/Response/Auth nodes
│   │   │   ├── ConnectionLine.ts    # Animated connection lines
│   │   │   ├── DataParticle.ts      # Flowing data particles
│   │   │   ├── ResponseBodyCard.ts  # Response body preview
│   │   │   └── MatrixRain.ts        # Matrix rain background effect
│   │   │
│   │   ├── presentation/            # Presentation mode
│   │   │   ├── PresentationCanvas.vue
│   │   │   ├── modes/
│   │   │   │   └── TerminalMode.ts  # Terminal-style presentation
│   │   │   ├── JsonReveal.vue       # Animated JSON reveal
│   │   │   └── TerminalJsonReveal.vue
│   │   │
│   │   ├── viewer/                  # Response viewer
│   │   │   ├── ResponseViewer.vue   # Main response viewer
│   │   │   ├── JsonTreeView.vue     # JSON tree explorer
│   │   │   ├── TableView.vue        # Table view for arrays
│   │   │   └── RawView.vue          # Raw response view
│   │   │
│   │   ├── env/                     # Environment management
│   │   │   ├── EnvironmentSelector.vue
│   │   │   └── EnvironmentEditor.vue
│   │   │
│   │   ├── sidebar/                 # File import sidebar
│   │   │   ├── RequestSidebar.vue
│   │   │   ├── RequestItem.vue
│   │   │   └── FileDropzone.vue
│   │   │
│   │   ├── ui/                      # UI components
│   │   │   ├── ThemeSelector.vue
│   │   │   ├── ExtensionStatus.vue
│   │   │   ├── ExtensionInstallModal.vue
│   │   │   ├── GlitchText.vue
│   │   │   └── NeonButton.vue
│   │   │
│   │   ├── shared/                  # Shared components
│   │   │   ├── BaseModal.vue
│   │   │   ├── ConfirmDialog.vue
│   │   │   ├── DropdownMenu.vue
│   │   │   ├── KeyValueEditor.vue
│   │   │   └── MethodBadge.vue
│   │   │
│   │   └── layout/
│   │       └── AppLayout.vue        # Main app layout
│   │
│   ├── stores/                      # Pinia stores
│   │   ├── requestStore.ts          # Request execution state
│   │   ├── collectionStore.ts       # Collections management
│   │   ├── collections/             # Collection sub-modules
│   │   │   ├── collectionState.ts   # Core state
│   │   │   ├── collectionCrud.ts    # CRUD operations
│   │   │   ├── folderService.ts     # Folder operations
│   │   │   ├── requestService.ts    # Request operations
│   │   │   └── selectionService.ts  # Selection state
│   │   ├── authStore.ts             # Auth configuration
│   │   ├── environmentStore.ts      # Environment variables
│   │   ├── themeStore.ts            # Theme management
│   │   ├── presentationStore.ts     # Presentation mode state
│   │   └── tokenStore.ts            # OAuth token cache
│   │
│   ├── composables/                 # Vue composables
│   │   ├── useRequestExecutor.ts    # HTTP request execution
│   │   ├── useAuthService.ts        # Auth header generation
│   │   ├── useExtensionBridge.ts    # Browser extension bridge
│   │   ├── useFileExport.ts         # Session export/import
│   │   ├── useStoragePersistence.ts # Local storage persistence
│   │   ├── useConfirmDialog.ts      # Confirmation dialogs
│   │   ├── useDropdownMenu.ts       # Dropdown menus
│   │   └── useClickOutside.ts       # Click outside detection
│   │
│   ├── parsers/                     # File parsers
│   │   ├── index.ts                 # Parser entry point
│   │   ├── httpParser.ts            # .http/.rest file parser
│   │   ├── brunoParser.ts           # .bru file parser
│   │   └── types.ts                 # Parser types
│   │
│   ├── services/
│   │   └── storage/
│   │       └── StorageService.ts    # Local storage abstraction
│   │
│   ├── types/                       # TypeScript types
│   │   ├── index.ts                 # Type exports
│   │   ├── auth.ts                  # Auth types
│   │   ├── request.ts               # Request types
│   │   ├── collection.ts            # Collection types
│   │   └── execution.ts             # Execution types
│   │
│   └── utils/                       # Utilities
│       ├── formatters.ts            # Byte/duration formatters
│       ├── variableResolver.ts      # Variable interpolation
│       └── funnyTexts.ts            # Loading messages
│
├── public/                          # Static assets
├── index.html                       # Entry HTML
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript config
├── package.json                     # Dependencies
└── tailwind.config.js               # Tailwind CSS config
```

## How It Works

### Data Flow Visualization

The core visualization uses PixiJS to render animated nodes representing:

1. **AUTH Node** - Shows authentication status and type
2. **REQUEST Node** - Displays method, URL, headers, and body info
3. **RESPONSE Node** - Shows status, size, and timing
4. **Response Body Card** - Previews response content

Animated connection lines with flowing particles show data moving between nodes.

### Request Execution

1. **useRequestExecutor** - Orchestrates request execution
2. **useAuthService** - Generates auth headers based on configuration
3. **useExtensionBridge** - Routes requests through browser extension (CORS bypass)

### Authentication

Supports multiple authentication methods with inheritance:

| Method | Description |
|--------|-------------|
| Basic Auth | Username/password encoded in Authorization header |
| Bearer Token | Token in Authorization header |
| API Key | Key/value in header or query parameter |
| OAuth2 Client Credentials | Client ID/secret for machine-to-machine |
| OAuth2 Password | Username/password grant flow |
| OAuth2 Authorization Code | Browser-based OAuth flow with PKCE |
| Manual Headers | Custom headers for any auth scheme |

Auth can be configured at:
- Request level (highest priority)
- Folder level (inherited by requests in folder)
- File/Collection level (inherited by all requests)

### Collections

Collections provide organized request management:

```
Collection
├── Folder (with optional auth)
│   ├── Request
│   └── Request
├── Folder
│   └── Request
└── Request (root level)
```

Features:
- Drag-and-drop reordering
- Move requests between folders/collections
- Duplicate requests
- Import/export collections

### Environment Variables

Variables use `{{variableName}}` syntax and are resolved from (lowest to highest priority):

1. Request-level variables
2. File/Collection-level variables
3. Active environment variables
4. File-specific overrides

### File Formats

#### .http / .rest Files

Standard HTTP file format:

```http
### Get Users
GET https://api.example.com/users
Authorization: Bearer {{token}}
Content-Type: application/json

### Create User
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### .bru Files (Bruno)

Bruno collection format:

```bru
meta {
  name: Get Users
  type: http
  seq: 1
}

get {
  url: https://api.example.com/users
}

headers {
  Authorization: Bearer {{token}}
}
```

## Themes

Five built-in themes with full customization:

| Theme | Primary Color | Description |
|-------|---------------|-------------|
| Matrix | `#00ff41` | Classic green terminal |
| Cyberpunk | `#ff00ff` | Neon pink/cyan aesthetic |
| Amber Terminal | `#ffb000` | Vintage amber CRT |
| Phosphor Green | `#33ff33` | Bright phosphor display |
| Midnight Blue | `#6688ff` | Cool blue tones |

## Browser Extension

For CORS bypass, install the companion extension:

See [http-visualizer-extension/README.md](../http-visualizer-extension/README.md) for installation instructions.

The extension:
- Bypasses CORS restrictions for any API
- Tracks request statistics
- Shows request history
- Works on localhost only (security)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Execute request |
| `Escape` | Close modal/panel |
| `Enter` | Advance presentation (in presentation mode) |

## Tech Stack

- **Vue 3** - Composition API with `<script setup>`
- **TypeScript** - Full type safety
- **Pinia** - State management
- **PixiJS** - 2D WebGL rendering
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast development server
- **Lucide** - Icon library

## Development

### Project Setup

```bash
# Install dependencies
yarn install

# Start dev server with hot reload
yarn dev

# Type check
yarn vue-tsc --noEmit

# Build for production
yarn build
```

### Adding New Auth Types

1. Add type to `src/types/auth.ts`
2. Create form component in `src/components/auth/`
3. Update `useAuthService.ts` to generate headers
4. Add to `AuthConfigModal.vue` type selector

### Adding New Themes

Add theme object to `src/stores/themeStore.ts`:

```typescript
{
  id: 'my-theme',
  name: 'My Theme',
  colors: {
    bg: '#0a0a0a',
    bgSecondary: '#111111',
    bgTertiary: '#1a1a1a',
    primary: '#ff0000',
    primaryDim: '#cc0000',
    secondary: '#00ff00',
    error: '#ff0040',
    warning: '#ffb800',
    text: '#ffffff',
    textDim: '#808080',
    border: '#ff000033',
    glow: '#ff000080',
  }
}
```

### Adding New File Parsers

1. Create parser in `src/parsers/`
2. Register in `src/parsers/index.ts`
3. Add file extension to supported types

## Troubleshooting

### Requests failing with CORS errors

1. Install the browser extension (see Browser Extension section)
2. Ensure the extension is enabled
3. Refresh the HTTP Visualizer page
4. Check extension popup for status

### Variables not resolving

1. Check variable syntax: `{{variableName}}`
2. Verify variable is defined in environment or request
3. Check variable precedence (request > collection > environment)

### OAuth2 token not refreshing

1. Check token URL is correct
2. Verify client credentials
3. Clear cached tokens in auth settings
4. Check browser console for errors

### Canvas not rendering

1. Ensure WebGL is enabled in browser
2. Try refreshing the page
3. Check browser console for PixiJS errors

## Version History

- **0.1.0** - Initial release
  - HTTP request visualization
  - Multiple auth methods
  - File import (.http, .rest, .bru)
  - Collections with folders
  - Environment variables
  - 5 built-in themes
  - Presentation mode
  - Browser extension support

## License

MIT License - see LICENSE file for details.
