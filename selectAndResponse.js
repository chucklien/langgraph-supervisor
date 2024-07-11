import { JsonOutputToolsParser } from 'langchain/output_parsers';
import { AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import * as R from 'ramda';
import { skills, stages } from './skills.js';

const formatSkills = (obj, idx) => {
  return `${idx}. ${obj.name}\n  \ta. definition: ${obj.definition}\n  \tb. usage: ${obj.usage}\n  \tc. example: ${obj.example}\n`;
};

export default async (state, config) => {
  const stage = state.stage;
  const skill_names = R.pluck('name', skills[stage]);
  const systemPrompt =
    `Please act as a counselor during the stage of counseling ({stage_purpose}) You can use the following skills to respond to the client's statements:
  {skills}
  evaluation: 
  ` + (state.evaluation ? '{evaluationComment}' : '');

  // Define the routing function
  const functionDef = {
    name: 'select_skill',
    description: 'Select the skill.',
    parameters: {
      title: 'skillSchema',
      type: 'object',
      properties: {
        skill: {
          title: 'skill',
          anyOf: [{ enum: skill_names }],
        },
        response: {
          title: 'response',
          type: 'string',
          description:
            "The counselor's response based on the conversation and the skill, and must folow the evaluation if exist",
        },
      },
      required: ['skill', 'response'],
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
      `Give the conversation above, and the evaluation (if exist) above, which skill should use? Select one of: {skill_names}.
      1. Generate the response based on the evaluation, if available.
      2. If there is no evaluation, generate the response based on the skill you selected.
      Ensure both responses are based on the context of the conversation and are in the same language as the user input.
      `,
    ],
  ]);
  const formattedPrompt = await prompt.partial({
    skills: R.addIndex(R.reduce)(
      (acc, curr, idx) => {
        return acc + formatSkills(curr, idx + 1);
      },
      '',
      skills[stage],
    ),
    skill_names: R.join(', ', skill_names),
    stage_purpose: stages[stage].purpose,
  });

  const llm = new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    temperature: 0,
  });

  const selectAndResponse = formattedPrompt
    .pipe(
      llm.bindTools([toolDef], {
        tool_choice: toolDef,
      }),
    )
    .pipe(new JsonOutputToolsParser())
    .pipe(x => x[0].args);
  const result = await selectAndResponse.invoke(
    { ...state, evaluationComment: state.evaluation?.comments },
    config,
  );
  return {
    messages: [
      new AIMessage({
        ...result,
        content: result.response || '',
        name: 'SelectNResponse',
      }),
    ],
    ...result,
    evaluation: 'NULL',
    sender: 'SelectNResponse',
  };
};
//
// const res = await supervisorChain.invoke({
//   messages: [new HumanMessage("hi") ],
// })
// console.log('res', res)
