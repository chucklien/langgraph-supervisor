// import "dotenv/config";
// import { HumanMessage } from "@langchain/core/messages";
import { JsonOutputToolsParser } from 'langchain/output_parsers';
import { END } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

export const members = ['determine_stage', 'select_n_response', 'evaluate_response'];

const systemPrompt = `You are the supervisor overseeing a counseling workflow that involves multiple agents. Your task is to coordinate the agents to determine the current counseling stage, select the appropriate skill, generate a suitable response, and evaluate the response for appropriateness. If the evaluation is successful, the workflow concludes. Here is the detailed workflow:
     1. determine_stage: Identify the current counseling stage based on the client's statement.
     2. select_n_response: Once the stage is identified, select an appropriate skill from the stage and generate a response.
     3. evaluate_response: Evaluate the selected skill and generated response for suitability. If the skill and response are appropriate, the workflow ends. If not, provide feedback and request the select_n_response to select a new skill and generate a new response.

  current stage: {stage}
  current skill: {skill}
  current response: {response}
  current evaluation: {evaluation}

  Instructions for Supervisor:
    1. If the current stage is null, ask determine_stage to act.
    2. If the stage has been determined but no response has been generated (current evaluation is null), ask select_n_response to act.
    3. Evaluate Skill and Response
      - Provide the selected skill and generated response to the evaluate_response.
      - evaluate_response checks for \`skill_suitability\` and \`response_suitability\`:
        - If both are appropriate, end the workflow, choose '{END}'.
        - If not, provide feedback and request the select_n_response to generate a new response.
  Your Task:
    Coordinate the agents through this workflow, ensuring each step is completed correctly. Monitor the process and ensure that the final response is appropriate before concluding the workflow.
    Given the stage and evaluation above, who should act next?
    Or should we '{END}'? Select one of: {options}
   `;
const options = [END, ...members];

// Define the routing function
const functionDef = {
  name: 'route',
  description: 'Select the next agent.',
  parameters: {
    title: 'routeSchema',
    type: 'object',
    properties: {
      next: {
        title: 'Next',
        anyOf: [{ enum: options }],
      },
    },
    required: ['next'],
  },
};

const toolDef = {
  type: 'function',
  function: functionDef,
};

const supervisorAgent = async (state, config) => {
  const prompt = ChatPromptTemplate.fromMessages([['system', systemPrompt]]);

  const formattedPrompt = await prompt.partial({
    options: options.join(', '),
    END,
  });

  const llm = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0,
  });

  const supervisorChain = formattedPrompt
    .pipe(
      llm.bindTools([toolDef], {
        tool_choice: { type: 'function', function: { name: 'route' } },
      }),
    )
    .pipe(new JsonOutputToolsParser())
    // select the first one
    .pipe(x => x[0].args);

  const { evaluation, ...restState } = state;
  const result = await supervisorChain.invoke(
    { ...restState, evaluation: evaluation && JSON.stringify(evaluation) },
    config,
  );
  return { ...result, sender: 'supervisor' };
};

export default supervisorAgent;
//
// const res = await supervisorChain.invoke({
//   messages: [new HumanMessage("hi") ],
// })
// console.log('res', res)
