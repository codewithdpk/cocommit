# CoCommit

AI-powered CLI tool for generating conventional commit messages and branch names based on your code changes.

![Demo Video](https://github.com/codewithdpk/cocommit/raw/refs/heads/main/demococo.mp4)

## Features

- 🤖 **AI-Powered Commit Messages**: Generate meaningful commit messages using OpenAI, Anthropic, or Google models.
- 🌿 **AI-Powered Branch Names**: Generate conventional branch names based on your staged changes.
- 📝 **Conventional Commit Format**: Follows the conventional commit standard.
- 🔍 **Smart File Analysis**: Analyzes staged files and their diffs for context-aware messages and branch names.
- ⚡ **Quick Commands**: Simple CLI commands and aliases for fast workflow: analyze, generate, and commit or branch within a single command.
- 🎨 **Beautiful Output**: Colorful, user-friendly CLI interface.
- 🔧 **Easy Configuration**: Interactive setup for AI provider and API key.

## Installation

### Global (Recommended)

```sh
npm install -g @cwdpk/cocommit
```

### Local Development

```sh
git clone <repository-url>
cd cocommit
npm install
npm run build
npm link
```

## Usage

### 1. Configure your AI provider

```sh
cocommit config
```

Follow the prompts to select your provider and enter your API key. This will be saved to `~/.cocommit-config.json`.

### 2. Generate a commit message

Stage your changes, then run:

```sh
cocommit commit
```

Or use the alias:

```sh
cocommit c
```

You can also provide your own message:

```sh
cocommit commit -m "your message"
```

### 3. Generate a branch name (NEW)

Stage your changes, then run:

```sh
cocommit branch new
```

Or use the alias:

```sh
cocommit b n
```

You can also provide your own branch name:

```sh
cocommit branch new -n "your-branch-name"
```

The tool will suggest an AI-generated branch name based on your staged changes, and prompt for confirmation or a custom name before creating and checking out the new branch.

### 4. View status with AI insights

```sh
cocommit status
```

## Supported Providers

- OpenAI (GPT-4o, GPT-4o-mini, GPT-3.5 Turbo)
- Anthropic (Claude 3.5 Sonnet, Haiku, Opus)
- Google (Gemini 1.5 Pro, Flash)

## Configuration File

- Location: `~/.cocommit-config.json`
- Stores: provider, model, and API key

## Requirements

- Node.js v16 or higher
- An API key from your chosen AI provider

## License

MIT

## Author

[Deepak Suthar](https://x.com/0xDSuthar)
