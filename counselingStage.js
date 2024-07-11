import { JsonOutputToolsParser } from 'langchain/output_parsers';
import { FunctionMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import * as R from 'ramda';

import { stages } from './skills.js';

const stage_names = R.keys(stages);

const systemPrompt =
  'You are a professional counselor assistant. Your task is to determine the current counseling stage based on the given input. There are three main stages in the counseling process: {stage_names}. Different stages are defined as follows: {stage_defs}' +
  'Please determine the current conseling stage based on the following input conversation.';

// Define the routing function
const functionDef = {
  name: 'determine_stage',
  description: 'Select current stage.',
  parameters: {
    title: 'stage',
    type: 'object',
    properties: {
      stage: {
        title: 'Current Stage',
        anyOf: [{ enum: stage_names }],
      },
    },
    required: ['stage'],
  },
};

const toolDef = {
  type: 'function',
  function: functionDef,
};

const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  new MessagesPlaceholder('messages'),
  [
    'system',
    'Please determine the current conseling stage based on the following input conversation. Select one of: {stage_names}',
  ],
]);

const formattedPrompt = await prompt.partial({
  stage_names: stage_names.join(', '),
  stage_defs: R.pipe(R.values, R.pluck('purpose'), R.join(', '))(stages),
});

const llm = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
});

const chain = formattedPrompt
  .pipe(
    llm.bindTools([toolDef], {
      tool_choice: { type: 'function', function: { name: 'determine_stage' } },
    }),
  )
  .pipe(new JsonOutputToolsParser())
  // select the first one
  .pipe(x => x[0].args);

export const determineStageNode = async (state, config) => {
  const result = await chain.invoke(state, config);

  return {
    ...result,
    sender: 'Stage',
  };
};

// import { HumanMessage, AIMessage } from "@langchain/core/messages";
//
// const res = await chain.invoke({
//   messages: [
//     new AIMessage({
//       content: "我們已經討論了很多關於你的工作壓力和自我評價的問題。接下來，我們可以一起制定一些具體的行動計劃來幫助你減少壓力和提高自信心。你覺得這樣如何？",
//     }),
//     new HumanMessage({
//       content: "聽起來不錯，但我不太確定從哪裡開始。",
//     }),
//     new AIMessage({
//       content: "沒問題，我們可以先從一些小步驟開始。比如，你可以每天花15分鐘時間來寫下你當天完成的工作和感受到的成就。這樣做可以幫助你逐漸認識到自己的價值。你覺得這個方法怎麼樣？",
//     }),
//     new HumanMessage({
//       content: "我覺得這是個好主意，這樣我可以更清楚地看到自己的進步。",
//     }),
//     new AIMessage({
//       content: "很好，那我們從今天開始實施這個計劃。另外，你還可以嘗試每週安排一次與同事或朋友的討論，分享你的創意和想法，這樣可以逐步增強你的自信心。這樣做可以嗎？",
//     }),
//     new HumanMessage({
//       content: "可以，我會試試看的。",
//     }),
//     new AIMessage({
//       content: "太好了，我們會在下一次諮商時討論你的進展和感受。如果你在過程中遇到任何困難，隨時告訴我，好嗎？",
//     }),
//     new HumanMessage({
//       content: "好的，非常感謝你的幫助。",
//     }),
//   ],
// });
// console.log('res', res)
//
/*
諮商師：我們已經討論了很多關於你的工作壓力和自我評價的問題。接下來，我們可以一起制定一些具體的行動計劃來幫助你減少壓力和提高自信心。你覺得這樣如何？

來訪者：聽起來不錯，但我不太確定從哪裡開始。

諮商師：沒問題，我們可以先從一些小步驟開始。比如，你可以每天花15分鐘時間來寫下你當天完成的工作和感受到的成就。這樣做可以幫助你逐漸認識到自己的價值。你覺得這個方法怎麼樣？

來訪者：我覺得這是個好主意，這樣我可以更清楚地看到自己的進步。

諮商師：很好，那我們從今天開始實施這個計劃。另外，你還可以嘗試每週安排一次與同事或朋友的討論，分享你的創意和想法，這樣可以逐步增強你的自信心。這樣做可以嗎？

來訪者：可以，我會試試看的。

諮商師：太好了，我們會在下一次諮商時討論你的進展和感受。如果你在過程中遇到任何困難，隨時告訴我，好嗎？

來訪者：好的，非常感謝你的幫助。 */
