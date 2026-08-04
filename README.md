# Day 3 AI Agent

A small Node.js-based AI agent that uses the Gemini API to interpret a user request and perform actions inside the local workspace. The agent can inspect files, read and write content, search the web, and execute approved shell commands.

## Overview

This project is a practical example of an AI tool-calling agent. Instead of only responding with text, the agent can take action through a set of built-in tools and operate safely within the current workspace.

The application:

- accepts a user instruction from the terminal
- sends the prompt to the Gemini model
- decides whether a tool call is needed
- executes the relevant tool
- loops until the model produces a final answer

## Features

- Workspace-aware file listing and reading
- Safe file writing inside the allowed project directory
- Live web search using the Tavily API
- Shell command execution with interactive confirmation
- Protection against unsafe paths and sensitive files such as `.env` files
- Simple terminal-based interaction flow

## Tech Stack

- Node.js
- JavaScript (ES modules)
- Google Gemini SDK (`@google/genai`)
- dotenv for environment variables
- Tavily search API for live web lookups

## Project Structure

- `index.js` – main agent workflow and tool definitions
- `package.json` – project dependencies and scripts
- `.gitignore` – ignores local environment and workspace-specific files

## Setup

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   cd "Day 3"
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and add your API keys:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   TAVILY_API_KEY=your_tavily_api_key
   ```

4. Run the project:

   ```bash
   node index.js
   ```

## Usage

When you run the app, it will prompt:

```text
What should the agent do?
> 
```

You can then enter a task such as:

- "List files in the current folder"
- "Read the package.json file"
- "Create a simple note in the workspace"
- "Search for information about Node.js"

If the agent wants to run a shell command, it will ask for confirmation before proceeding.

## Safety Notes

This project includes basic safety controls:

- it only allows access within the current workspace
- it blocks access to sensitive files like `.env`, `.env.local`, and `credentials.json`
- command execution requires user approval before it runs

## Notes

This repository is intended as a lightweight demo of an AI agent with tool use. It is useful for learning how to connect a model to external capabilities such as file access, web search, and command execution.

## License

ISC
