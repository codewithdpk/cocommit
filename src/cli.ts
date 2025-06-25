#!/usr/bin/env node

import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { experimental_customProvider, generateObject } from "ai";
import chalk from "chalk";
import { exec } from "child_process";
import { Command } from "commander";
import dotenv from "dotenv";
import inquirer from "inquirer";
import ora from "ora";
import { promisify } from "util";
import { z } from "zod";
import {
  AIConfig,
  getConfigFilePath,
  loadAIConfig,
  saveAIConfig,
} from "./ai/config";
import { SYSTEM_PROMPT } from "./ai/utils";

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

interface GitConfig {
  user: {
    name?: string;
    email?: string;
  };
  remote: {
    origin?: string;
  };
  branch: string;
}

interface ChangedFile {
  filename: string;
  status: string;
  content?: string;
  diff?: string;
}

interface CommitMessage {
  type: string;
  scope?: string | null;
  description: string;
  body?: string | null;
  breaking?: boolean;
}

// Zod schema for commit message validation
const CommitMessageSchema = z.object({
  type: z.enum([
    "feat",
    "fix",
    "docs",
    "style",
    "refactor",
    "perf",
    "test",
    "build",
    "ci",
    "chore",
    "revert",
  ]),
  scope: z.string().optional().nullable(),
  description: z.string().min(1).max(200),
  body: z.string().min(1).max(200),
  breaking: z.boolean().optional().default(false),
});

type AIProvider = "openai" | "anthropic" | "google";

class AIGitCommit {
  private program: Command;
  private spinner = ora();

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name("cocommit")
      .description("AI-powered git commit message generator")
      .version("1.0.0");

    this.program
      .command("commit")
      .alias("c")
      .description("Generate AI commit message and commit changes")
      .option(
        "-m, --message <message>",
        "Custom commit message (skips AI generation)"
      )
      .option("-a, --add-all", "Add all changed files before committing")
      .option(
        "--dry-run",
        "Show what would be committed without actually committing"
      )
      .option("--no-verify", "Skip git hooks")
      .action(this.handleCommit.bind(this));

    this.program
      .command("config")
      .description("Configure AI settings")
      .action(this.handleConfig.bind(this));

    this.program
      .command("status")
      .alias("s")
      .description("Show git status with AI insights")
      .action(this.handleStatus.bind(this));
  }

  private async handleCommit(options: any): Promise<void> {
    try {
      this.spinner.start("Checking git repository...");

      // Check if we're in a git repository
      await this.checkGitRepository();

      // Get git config
      const gitConfig = await this.getGitConfig();
      this.spinner.succeed("Git repository validated");

      // Get changed files
      this.spinner.start("Analyzing changed files...");
      const changedFiles = await this.getChangedFiles(options.addAll);

      if (changedFiles.length === 0) {
        this.spinner.warn("No changes detected");
        console.log(
          chalk.yellow("No files to commit. Use -a flag to add all changes.")
        );
        return;
      }

      this.spinner.succeed(`Found ${changedFiles.length} changed file(s)`);

      // Generate commit message
      let commitMessage: string;

      if (options.message) {
        commitMessage = options.message;
        console.log(
          chalk.blue("Using provided commit message:"),
          commitMessage
        );
      } else {
        this.spinner.start("Generating AI commit message...");
        const aiCommitMessage = await this.generateCommitMessage(
          changedFiles,
          gitConfig
        );
        this.spinner.succeed("AI commit message generated");

        commitMessage = this.formatCommitMessage(aiCommitMessage);

        console.log(chalk.green("\nGenerated commit message:"));
        console.log(chalk.cyan(commitMessage));

        // Ask for confirmation
        const { confirmed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmed",
            message: "Do you want to commit with this message?",
            default: true,
          },
        ]);

        if (!confirmed) {
          const { customMessage } = await inquirer.prompt([
            {
              type: "input",
              name: "customMessage",
              message: "Enter your custom commit message:",
              validate: (input) =>
                input.trim().length > 0 || "Commit message cannot be empty",
            },
          ]);
          commitMessage = customMessage;
        }
      }

      // Perform commit
      if (options.dryRun) {
        console.log(chalk.yellow("Dry run - would commit:"));
        console.log(chalk.cyan(commitMessage));
        return;
      }

      await this.performCommit(commitMessage, options);
      console.log(chalk.green("✨ Successfully committed changes!"));
    } catch (error) {
      this.spinner.fail("Failed to commit");
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  private async handleConfig(): Promise<void> {
    console.log(chalk.blue("AI Git Commit Configuration"));

    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select AI provider:",
        choices: [
          { name: "OpenAI (GPT-4o, GPT-4o-mini)", value: "openai" },
          { name: "Anthropic (Claude)", value: "anthropic" },
          { name: "Google (Gemini)", value: "google" },
        ],
        default: "openai",
      },
    ]);

    let model: string;
    let apiKeyPrompt: string;

    switch (provider) {
      case "openai":
        const { openaiModel } = await inquirer.prompt([
          {
            type: "list",
            name: "openaiModel",
            message: "Select OpenAI model:",
            choices: [
              {
                name: "GPT-4o-mini (Recommended - Fast & Cost-effective)",
                value: "gpt-4o-mini",
              },
              { name: "GPT-4o (Most Capable)", value: "gpt-4o" },
              { name: "GPT-3.5 Turbo (Budget)", value: "gpt-3.5-turbo" },
            ],
            default: "gpt-4o-mini",
          },
        ]);
        model = openaiModel;
        apiKeyPrompt = "Enter your OpenAI API key:";
        break;
      case "anthropic":
        const { anthropicModel } = await inquirer.prompt([
          {
            type: "list",
            name: "anthropicModel",
            message: "Select Anthropic model:",
            choices: [
              {
                name: "Claude 3.5 Sonnet (Recommended)",
                value: "claude-3-5-sonnet-20241022",
              },
              {
                name: "Claude 3.5 Haiku (Fast)",
                value: "claude-3-5-haiku-20241022",
              },
              {
                name: "Claude 3 Opus (Most Capable)",
                value: "claude-3-opus-20240229",
              },
            ],
            default: "claude-3-5-sonnet-20241022",
          },
        ]);
        model = anthropicModel;
        apiKeyPrompt = "Enter your Anthropic API key:";
        break;
      case "google":
        const { googleModel } = await inquirer.prompt([
          {
            type: "list",
            name: "googleModel",
            message: "Select Google model:",
            choices: [
              { name: "Gemini 1.5 Pro (Recommended)", value: "gemini-1.5-pro" },
              { name: "Gemini 1.5 Flash (Fast)", value: "gemini-1.5-flash" },
            ],
            default: "gemini-1.5-pro",
          },
        ]);
        model = googleModel;
        apiKeyPrompt = "Enter your Google AI API key:";
        break;
      default:
        throw new Error("Invalid provider selected");
    }

    const { apiKey } = await inquirer.prompt([
      {
        type: "password",
        name: "apiKey",
        message: apiKeyPrompt,
        mask: "*",
        validate: (input) =>
          input.trim().length > 0 || "API key cannot be empty",
      },
    ]);

    // Save configuration to user config file
    const config: AIConfig = { provider, model, apiKey };
    await saveAIConfig(config);
    console.log(
      chalk.green(`✅ Configuration saved to ${getConfigFilePath()}`)
    );
    console.log(chalk.cyan(`Provider: ${provider}`));
    console.log(chalk.cyan(`Model: ${model}`));
  }

  private async getAIConfig(): Promise<AIConfig> {
    const config = await loadAIConfig();
    if (!config) {
      throw new Error(`AI provider not configured. Run: cocommit config`);
    }
    return config;
  }

  private async handleStatus(): Promise<void> {
    try {
      const gitConfig = await this.getGitConfig();
      const changedFiles = await this.getChangedFiles(false);

      console.log(chalk.blue("Git Status with AI Insights"));
      console.log(chalk.gray("─".repeat(50)));

      console.log(chalk.cyan("Branch:"), gitConfig.branch);
      console.log(
        chalk.cyan("User:"),
        `${gitConfig.user.name} <${gitConfig.user.email}>`
      );

      if (gitConfig.remote.origin) {
        console.log(chalk.cyan("Remote:"), gitConfig.remote.origin);
      }

      console.log(chalk.cyan("Changed files:"), changedFiles.length);

      if (changedFiles.length > 0) {
        console.log(chalk.yellow("\nFiles to be committed:"));
        changedFiles.forEach((file) => {
          const statusColor =
            file.status === "A"
              ? chalk.green
              : file.status === "M"
              ? chalk.yellow
              : file.status === "D"
              ? chalk.red
              : chalk.white;
          console.log(`  ${statusColor(file.status)} ${file.filename}`);
        });
      }
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error
      );
    }
  }

  private async checkGitRepository(): Promise<void> {
    try {
      await execAsync("git rev-parse --git-dir");
    } catch (error) {
      throw new Error("Not a git repository");
    }
  }

  private async getGitConfig(): Promise<GitConfig> {
    try {
      const [userName, userEmail, branch, remoteOrigin] = await Promise.all([
        execAsync("git config user.name").catch(() => ({ stdout: "" })),
        execAsync("git config user.email").catch(() => ({ stdout: "" })),
        execAsync("git branch --show-current"),
        execAsync("git config remote.origin.url").catch(() => ({ stdout: "" })),
      ]);

      return {
        user: {
          name: userName.stdout.trim(),
          email: userEmail.stdout.trim(),
        },
        remote: {
          origin: remoteOrigin.stdout.trim(),
        },
        branch: branch.stdout.trim(),
      };
    } catch (error) {
      throw new Error("Failed to get git configuration");
    }
  }

  private async getChangedFiles(
    addAll: boolean = false
  ): Promise<ChangedFile[]> {
    try {
      let statusOutput: string;

      if (addAll) {
        await execAsync("git add .");
        // Get staged files after adding all
        const { stdout } = await execAsync("git diff --name-only --cached");
        statusOutput = stdout;
      } else {
        // Get currently staged files
        const { stdout } = await execAsync("git diff --name-only --cached");
        statusOutput = stdout;
      }

      const files: ChangedFile[] = [];
      const lines = statusOutput
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      for (const filename of lines) {
        let status = "M";
        // Check if file is newly added or deleted
        const { stdout: diffStatus } = await execAsync(
          `git diff --cached --name-status -- "${filename}"`
        );
        if (diffStatus.startsWith("A")) status = "A";
        else if (diffStatus.startsWith("D")) status = "D";

        let diff = "";
        try {
          if (status !== "D") {
            const { stdout: diffOutput } = await execAsync(
              `git diff --cached "${filename}"`
            );
            diff = diffOutput;
          }
        } catch (error) {
          // Ignore diff errors
        }

        files.push({
          filename,
          status,
          diff,
        });
      }

      return files;
    } catch (error) {
      throw new Error("Failed to get changed files");
    }
  }

  private async generateCommitMessage(
    changedFiles: ChangedFile[],
    gitConfig: GitConfig
  ): Promise<CommitMessage> {
    // Create context for AI
    const context = this.createChangeContext(changedFiles, gitConfig);

    // Simulate AI call (replace with actual AI service)
    const aiResponse = await this.callAI(context);

    return aiResponse;
  }

  private createChangeContext(
    changedFiles: ChangedFile[],
    gitConfig: GitConfig
  ): string {
    let context = `Repository: ${gitConfig.remote.origin || "local"}\n`;
    context += `Branch: ${gitConfig.branch}\n`;
    context += `Changed files: ${changedFiles.length}\n\n`;

    context += "File changes:\n";
    changedFiles.forEach((file) => {
      context += `\n${file.status} ${file.filename}\n`;
      if (file.diff) {
        // Truncate diff to avoid too much context
        const diffLines = file.diff.split("\n").slice(0, 20);
        context += diffLines.join("\n") + "\n";
        if (file.diff.split("\n").length > 20) {
          context += "... (truncated)\n";
        }
      }
    });

    return context;
  }

  private getAIProvider(config: AIConfig) {
    const aiProvider = experimental_customProvider({
      languageModels: {
        openai: createOpenAI({ apiKey: config.apiKey }).languageModel(
          config.model
        ),
        anthropic: createAnthropic({ apiKey: config.apiKey }).languageModel(
          config.model
        ),
        google: createGoogleGenerativeAI({
          apiKey: config.apiKey,
        }).languageModel(config.model),
      },
    });

    switch (config.provider) {
      case "openai":
        return aiProvider.languageModel("openai");
      case "anthropic":
        return aiProvider.languageModel("anthropic");
      case "google":
        return aiProvider.languageModel("google");
      default:
        throw new Error("Unsupported AI provider");
    }
  }

  private async callAI(context: string): Promise<CommitMessage> {
    try {
      const config = await this.getAIConfig();
      const model = this.getAIProvider(config);

      const result = await generateObject({
        model,
        schema: CommitMessageSchema,
        system: SYSTEM_PROMPT,
        prompt: `Analyze the following code changes and generate a conventional commit message:\n\n${context}`,
      });

      return result.object;
    } catch (error) {
      console.error(
        chalk.yellow("AI generation failed, falling back to basic analysis...")
      );

      if (error instanceof Error) {
        console.error(chalk.gray(`Error: ${error.message}`));
      }

      // Fallback to basic analysis if AI fails
      return this.generateFallbackCommitMessage(context);
    }
  }

  private generateFallbackCommitMessage(context: string): CommitMessage {
    // Fallback logic when AI fails
    const hasNewFiles = context.includes("\nA ");
    const hasModifiedFiles = context.includes("\nM ");
    const hasDeletedFiles = context.includes("\nD ");
    const hasPackageJson = context.includes("package.json");
    const hasTests = context.includes("test") || context.includes("spec");
    const hasDocumentation =
      context.includes("README") || context.includes(".md");
    const hasConfigFiles =
      context.includes(".env") || context.includes("config");
    const hasCIFiles =
      context.includes(".github") ||
      context.includes(".yml") ||
      context.includes(".yaml");

    let type = "chore";
    let description = "update files";
    let scope: string | null = null;

    if (hasCIFiles) {
      type = "ci";
      description = "update CI configuration";
    } else if (hasTests && hasNewFiles) {
      type = "test";
      description = "add new tests";
    } else if (hasTests) {
      type = "test";
      description = "update tests";
    } else if (hasDocumentation) {
      type = "docs";
      description = "update documentation";
    } else if (hasPackageJson) {
      type = "build";
      description = "update dependencies";
    } else if (hasConfigFiles) {
      type = "chore";
      description = "update configuration";
      scope = "config";
    } else if (hasNewFiles) {
      type = "feat";
      description = "add new functionality";
    } else if (hasDeletedFiles && hasModifiedFiles) {
      type = "refactor";
      description = "refactor code structure";
    } else if (hasDeletedFiles) {
      type = "refactor";
      description = "remove unused code";
    } else if (hasModifiedFiles) {
      type = "fix";
      description = "improve code implementation";
    }

    return {
      type,
      scope,
      description,
      body: null,
      breaking: false,
    };
  }

  private formatCommitMessage(commitMsg: CommitMessage): string {
    let message = `${commitMsg.type}`;

    if (commitMsg.scope) {
      message += `(${commitMsg.scope})`;
    }

    if (commitMsg.breaking) {
      message += "!";
    }

    message += `: ${commitMsg.description}`;

    if (commitMsg.body) {
      message += `\n\n${commitMsg.body}`;
    }

    return message;
  }

  private async performCommit(message: string, options: any): Promise<void> {
    try {
      let commitCommand = `git commit -m "${message}"`;

      if (options.noVerify) {
        commitCommand += " --no-verify";
      }

      await execAsync(commitCommand);
    } catch (error) {
      throw new Error("Failed to commit changes");
    }
  }

  public async run(): Promise<void> {
    // Block all commands except config if config is missing
    const args = process.argv.slice(2);
    if (args[0] !== "config") {
      const aiConfig = await loadAIConfig();
      if (!aiConfig) {
        console.log(
          chalk.red("AI provider not configured. Please run: cocommit config")
        );
        process.exit(1);
      }
    }
    this.program.parse();
  }
}

// Run the CLI
if (require.main === module) {
  const cli = new AIGitCommit();
  cli.run();
}

export default AIGitCommit;
