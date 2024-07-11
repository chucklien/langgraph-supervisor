import 'dotenv/config';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { END, START, StateGraph } from '@langchain/langgraph';
import readline from 'readline';

import supervisorChain, { members } from './supervisor.js';
import { determineStageNode } from './counselingStage.js';
import selectAndResponseNode from './selectAndResponse.js';
import evaluateResponse from './evaluateResponse.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
let sessionId = null;

// Define the graph state
const graphState = {
  messages: {
    value: (x = [], y = []) => x.concat(y),
    default: () => [],
  },
  next: {
    value: (x, y) => y ?? x ?? END,
    default: () => END,
  },
  stage: {
    value: (x, y) => y ?? x ?? '',
    default: () => null,
  },
  skill: {
    value: (x, y) => y ?? x ?? '',
    default: () => null,
  },
  response: {
    value: (x, y) => y ?? x ?? '',
    default: () => null,
  },
  sender: {
    value: (x, y) => y ?? x ?? '',
    default: () => null,
  },
  evaluation: {
    value: (x, y) => y ?? x ?? null,
    default: () => null,
  },
};

// Define a new graph
const workflow = new StateGraph({ channels: graphState })
  .addNode('supervisor', supervisorChain)
  .addNode('determine_stage', determineStageNode)
  .addNode('select_n_response', selectAndResponseNode)
  .addNode('evaluate_response', evaluateResponse);

members.forEach(member => {
  workflow.addEdge(member, 'supervisor');
});

workflow.addConditionalEdges('supervisor', x => x.next);

workflow.addEdge(START, 'supervisor');

// Initialize memory to persist state between graph runs
// const checkpointer = new MemorySaver();

// Finally, we compile it!
// This compiles it into a LangChain Runnable.
// Note that we're (optionally) passing the memory when compiling the graph
// const memory = new MemorySaver();
let config = { configurable: { thread_id: 'conversation-num-4' } };
const graph = workflow.compile();
// const res = await graph.invoke({
//   messages: [
//     new HumanMessage({
//       content: '上次我聽你說了要早點說，的確心情有改善許多',
//     }),
//   ],
// });
// console.log('res', res.response);
//
//

// let streamResults = graph.stream(
//   {
//     messages: [
//       new HumanMessage({
//         content: 'Hi',
//       }),
//     ],
//   },
//   { ...config, streamMode: 'values', recursionLimit: 100 },
// );
//
// for await (const output of await streamResults) {
//   console.dir(output, { depth: null });
//   if (!output?.__end__) {
//     console.log(output);
//     console.log('----');
//   } else {
//     console.log(output);
//   }
// }
//import { ChatOpenAI } from '@langchain/openai';
//new ChatOpenAI({
//  modelName: 'gpt-4o',
//  temperature: 0,
//})
//  .invoke([
//    ['ai', 'hi'],
//    ['user', 'hi, im chuck'],
//  ])
//  .then(res => console.log('res', res));

let history = [];
function promptUser() {
  rl.question('You: ', async userInput => {
    if (userInput.toLowerCase() === 'exit') {
      console.log('Ending conversation.');
      rl.close();
      return;
    }

    // const chat_template = ChatPromptTemplate.fromMessages([
    //   ...history
    // ])

    try {
      const response = await graph.invoke(
        {
          messages: [...history, ['human', userInput]],
          evaluation: 'NULL',
          skill: 'NULL',
          response: 'NULL',
        },
        config,
      );
      history.push(['human', userInput]);
      history.push(['ai', response.response]);
      console.log('Therapist: ', response.response);
      console.log(`(stage: ${response.stage}, skill: ${response.skill})`);
    } catch (error) {
      console.error('Error sending message:', error);
    }

    promptUser();
  });
}
async function initConversation() {
  const starter = '今天要聊聊什麼嗎?';
  console.log(`Therapist: ${starter}`);
  history.push(['ai', starter]);
  promptUser();
}

initConversation();

// let streamResults = graph.stream(
//   {
//     messages: [
//       new HumanMessage({
//         content: '上次我聽你說了要早點說，的確心情有改善許多',
//       }),
//       new AIMessage({
//         content: '你說心情有改善許多，聽起來你對早點表達自己的想法感到滿意和開心。',
//       }),
//       new HumanMessage({
//         content: '但還是容易突然陷進情緒裡',
//       }),
//       // new HumanMessage({
//       //   content: 'Hi',
//       // }),
//       // new AIMessage({
//       //   content: 'Hello! How are you feeling today?',
//       // }),
//       // new HumanMessage({
//       //   content: 'Feed Sad',
//       // }),
//     ],
//   },
//   { recursionLimit: 100 },
// );

// for await (const output of await streamResults) {
//   if (!output?.__end__) {
//     console.dir(output, { depth: null });
//     console.log('----');
//   }
// }

// Use the agent
// const finalState = await app.invoke(
//   { messages: [new HumanMessage("what is the weather in sf")] },
//   { configurable: { thread_id: "42" } }
// );
//
// console.log(finalState.messages[finalState.messages.length - 1].content);
//
// const nextState = await app.invoke(
//   { messages: [new HumanMessage("what about ny")] },
//   { configurable: { thread_id: "42" } }
// );
//
// console.log(nextState.messages[nextState.messages.length - 1].content);

// Initialize memory to persist state between graph runs
// const agentCheckpointer = new MemorySaver();
// const agent = createReactAgent({
//   llm: agentModel,
//   tools: agentTools,
//   checkpointSaver: agentCheckpointer,
// });
//
// Now it's time to use!
// const agentFinalState = await agent.invoke(
//   { messages: [new HumanMessage("what is the weather in sf")] },
//   { configurable: { thread_id: "42" } },
// );
//
// console.log(
//   agentFinalState.messages[agentFinalState.messages.length - 1].content,
// );
//
// const agentNextState = await agent.invoke(
//   { messages: [new HumanMessage("what about ny")] },
//   { configurable: { thread_id: "42" } },
// );
//
// console.log(
//   agentNextState.messages[agentNextState.messages.length - 1].content,
// );
