import { NodeFileStore } from 'langchain/stores/file/node';
import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { TruncatedOpenAIEmbeddings } from './TruncatedOpenAIEmbeddings.js';
import { DynamicTool, ReadFileTool, WriteFileTool } from 'langchain/tools';
import { AutoGPT } from 'langchain/experimental/autogpt';
import { BetterAutoGPTOutputParser } from './BetterAutoGPTOutputParser.js';
import { findInPage, goToLink, interactWithPage } from '../actions/index.js';
import { logPageScreenshot } from '../util/index.js';

/**
 * A custom WriteFileTool that captures the last file content
 * written by the AI so we can return it as the final result.
 */
class CapturingWriteFileTool extends WriteFileTool {
  constructor({ store, onWrite }) {
    super({ store });
    this.onWrite = onWrite; // callback function to store content
  }

  async call(args) {
    // "args" is typically { file_path: string, text: string }
    try {
      // Capture the text (AI's JSON or data) before writing
      if (this.onWrite) {
        this.onWrite(args.text);
      }
      // Now call the real write to the store
      return await super.call(args);
    } catch (err) {
      console.error('Error in CapturingWriteFileTool:', err);
      return `Error: ${err.toString()}`;
    }
  }
}

/**
 * The main function that runs AutoGPT and returns the final scrap data.
 */
export async function doActionWithAutoGPT(page, chatApi, task, options) {
  // 1. Setup tools and memory for AutoGPT
  const store = new NodeFileStore();
  const vectorStore = new HNSWLib(new TruncatedOpenAIEmbeddings(), {
    space: 'cosine',
    numDimensions: 1536,
  });

  // We'll store the last file the AI wrote to in this variable
  let lastWriteFileContent = null;

  // A custom WriteFileTool that intercepts the text
  const writeFileTool = new CapturingWriteFileTool({
    store,
    onWrite: (fileContent) => {
      lastWriteFileContent = fileContent;
    },
  });

  // 2. Construct the toolset for the AI
  const tools = [
    new ReadFileTool({ store }),
    writeFileTool, // <--- Our custom capturing tool
    new DynamicTool({
      name: 'interact with the page',
      description:
        'perform an action on the current page. Returns success or an error message.',
      func: async (instruction) => {
        try {
          await interactWithPage(chatApi, page, instruction, options);
          return 'Success';
        } catch (e) {
          console.log(e);
          return 'Error:' + e.toString();
        } finally {
          if (options.headless) {
            await logPageScreenshot(page);
          }
        }
      },
    }),
    new DynamicTool({
      name: 'find in current page',
      description:
        'find something in the html body content of the current webpage. returns the found text or an error message.',
      func: async (question) => {
        try {
          const found = await findInPage(page, chatApi, question);
          return 'Success: ' + found;
        } catch (e) {
          console.log(e);
          return 'Error:' + e.toString();
        } finally {
          if (options.headless) {
            await logPageScreenshot(page);
          }
        }
      },
    }),
    new DynamicTool({
      name: 'go to url',
      description:
        'go to a specific url. returns success or an error message if the goto failed.',
      func: async (link) => {
        try {
          await goToLink(page, link);
          return 'Success';
        } catch (e) {
          console.log(e);
          return 'Error:' + e.toString();
        } finally {
          if (options.headless) {
            await logPageScreenshot(page);
          }
        }
      },
    }),
  ];

  // 3. Create the AutoGPT instance
  const autogpt = AutoGPT.fromLLMAndTools(chatApi, tools, {
    memory: vectorStore.asRetriever(),
    aiName: 'Developer Digest Assistant',
    aiRole: 'Assistant',
    humanInTheLoop: false,
    outputParser: new BetterAutoGPTOutputParser(),
    // maxIterations: 4,
  });

  // 4. Run AutoGPT
  try {
    const finalOutput = await autogpt.run([task]);
    console.log('=== AutoGPT raw final output ===');
    console.log(finalOutput);

    // If the AI wrote a file at the end, let's use that content as the "result."
    if (lastWriteFileContent) {
      console.log('=== Intercepted final write_file content ===');
      console.log(lastWriteFileContent);

      // Attempt to parse as JSON
      try {
        const parsed = JSON.parse(lastWriteFileContent);
        console.log('Storing final result as JSON from last write_file');
        return parsed;
      } catch (jsonErr) {
        console.log('Last file not valid JSON, returning as plain text.');
        return lastWriteFileContent;
      }
    }

    // Fallback: If no file was written, return the finalOutput from AutoGPT
    console.log('No write_file calls were intercepted, returning finalOutput.');
    return finalOutput;
  } catch (e) {
    console.log('Error running AutoGPT:', e);
    return null;
  }
}
