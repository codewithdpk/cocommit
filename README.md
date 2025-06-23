# CoCommit

AI-powered CLI tool for generating conventional commit messages based on your code changes.

## Features

- 🤖 **AI-Powered Commit Messages**: Generate meaningful commit messages using OpenAI, Anthropic, or Google models.
- 📝 **Conventional Commit Format**: Follows the conventional commit standard.
- 🔍 **Smart File Analysis**: Analyzes staged files and their diffs for context-aware messages.
- ⚡ **Quick Commands**: Simple CLI commands and aliases for fast workflow, analyse, generate and commit within a single command.
- 🎨 **Beautiful Output**: Colorful, user-friendly CLI interface.
- 🔧 **Easy Configuration**: Interactive setup for AI provider and API key.

## Installation

### Global (Recommended)

```sh
npm install -g cocommit
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

### 3. View status with AI insights

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

[Your Name]