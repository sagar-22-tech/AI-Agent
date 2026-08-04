import { readdir } from 'fs/promises';
import path from 'path';
import fs from "fs";
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import { exec } from "child_process";
import { promisify } from "util";


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const userInstruction = await rl.question("What should the agent do?\n> ");
rl.close();

const BLOCKED_FILES = [".env", ".env.local", "credentials.json"];
const WORKSPACE = process.cwd();

function isPathSafe(filePath) {
  const resolved = path.resolve(WORKSPACE, filePath);
  if (!resolved.startsWith(WORKSPACE)) return false;

  const fileName = path.basename(resolved);
  if (BLOCKED_FILES.includes(fileName)) return false;

  return true;
}


async function listDir(directoryPath) {
     if (!isPathSafe(directoryPath)) {
        return { path: directoryPath, error: "This path is outside the allowed workspace. Can't show the list." };
    }
    try {
        const content = await readdir(directoryPath);
        return { path: directoryPath, entries: content };
    } catch (error) {
        return { path: directoryPath, error: error.message };
    }
}



async function readFile(filePath) {
    if (!isPathSafe(filePath)) {
        return { path: filePath, error: "This path is outside the allowed workspace. Read refused." };
    }
    try {
        const content = await fs.readFileSync(filePath, "utf-8");
        return { path: filePath, content };
    } catch (err) {
        return { path: filePath, error: err.message };
    }
}


async function writeFile(filePath, content) {
    if (!isPathSafe(filePath)) {
        return { path: filePath, error: "This path is outside the allowed workspace. Write refused." };
    }
    try {
        await fs.writeFileSync(filePath, content, "utf-8");
        return { path: filePath, success: true };
    } catch (error) {
        return { path: filePath, error: error.message };
    }
}

async function webSearch(query) {
    try {
        const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: process.env.TAVILY_API_KEY,
                query,
                max_results: 5,
            }),
        })

        if (!res.ok) {
            return { query, error: `Search API returned status ${res.status}` };
        }

        const data = await res.json();
        const results = (data.results || []).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
        }));

        return { query, results };
    } catch (error) {
        return { query, error: error.message };
    }
}

async function confirmAction(message) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\n${message}\nProceed? [y/N] `);
    rl.close();
    return answer.trim().toLowerCase() === "y";
}

const execAsync = promisify(exec);

async function runCommand(command) {
    const approved = await confirmAction(`Model wants to run:\n  $ ${command}`);
    if (!approved) {
        return { command, error: "User declined to run this command." };
    }

    try {
        const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
        return { command, stdout, stderr };
    } catch (error) {
        return { command, error: error.message };
    }
}

const listDirTool = {
    name: "listDir",
    description: "list all files and folders at a given path",
    parameters: {
        type: "OBJECT",
        properties: {
            path: { type: "STRING" }
        },
        required: ["path"]
    }
}
const readFileTool = {
    name: "readFile",
    description: "Read the contents of a file at a given path",
    parameters: {
        type: "OBJECT",
        properties: {
            path: { type: "STRING" }
        },
        required: ["path"]
    }
}
const writeFileTool = {
    name: "writeFile",
    description: "Write text content to a file at a given path, creating it if it doesn't exist",
    parameters: {
        type: "OBJECT",
        properties: {
            path: { type: "STRING" },
            content: { type: "STRING" },
        },
        required: ["path", "content"],
    },
};
const webSearchTool = {
    name: "webSearch",
    description: "Search the live web for current information, news, or facts you don't already know",
    parameters: {
        type: "OBJECT",
        properties: {
            query: { type: "STRING" },
        },
        required: ["query"],
    },
};
const runCommandTool = {
    name: "runCommand",
    description: "Execute a shell command to take an action, like installing a package or running a script. Ask for user confirmation happens automatically.",
    parameters: {
        type: "OBJECT",
        properties: {
            command: { type: "STRING" },
        },
        required: ["command"],
    },
};

const TOOLS = [listDirTool, readFileTool, writeFileTool, webSearchTool, runCommandTool];
const TOOL_HANDLERS = {
    listDir: async (args) => await listDir(args.path),
    readFile: async (args) => await readFile(args.path),
    writeFile: async (args) => await writeFile(args.path, args.content),
    webSearch: async (args) => await webSearch(args.query),
    runCommand: async (args) => await runCommand(args.command)
}




const MAX_STEPS = 25;
let contents = [
    { role: "user", parts: [{ text: `${userInstruction}` }] },
]
for (let step = 0; step < MAX_STEPS; step++) {
    const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents,
        systemInstruction: "You are a careful agent. Before doing anything destructive or irreversible, explain what you're about to do. If a request is ambiguous, ask the user instead of guessing. Prefer the least destructive way to accomplish a task.",
        config: { tools: [{ functionDeclarations: TOOLS }] },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length == 0) {
        console.log("Final answer:", response.text);
        break;

    }
    console.log(`Step ${step + 1}: model wants to call`, calls.map(c => c.name));
    contents.push(response.candidates[0].content);

    for (const call of calls) {
        const handler = TOOL_HANDLERS[call.name];
        const result = await handler(call.args);
        console.log(`  ran ${call.name}(${JSON.stringify(call.args)}) ->`, result);

        contents.push({
            role: "user",
            parts: [{
                functionResponse: {
                    name: call.name,
                    response: result,
                },
            }],
        });
    }

}
