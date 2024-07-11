import { JsonOutputToolsParser } from 'langchain/output_parsers';
import { AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

export default async (state, config) => {
  // TODO: do i need to describe the skill usage case again?
  const systemPrompt = `You are an agent that assists in determining the appropriateness of counseling skills and responses within a given stage of counseling. Your task is to evaluate whether the chosen skill and the generated response are suitable for a given client's statement within the specified stage.
    Stages and Skills:
      1. Relationship Building Stage
        - Skills: Structuring, Focusing, Minimal Encouragement, Silence, Approval/Reassurance, Non-verbal Cues, Facilitation, Other, Closed-ended Questions, Open-ended Questions, Restatement, Paraphrasing, Reflection of Feeling, Probing, Normalization, Focusing, Concreteness
      2. Insight Stage
        - Skills: Interpretation, Confrontation, Self-disclosure, Clarification, Immediacy, Advanced Empathy
      3. Action Stage
        - Skills: Providing Information, Direct Guidance, Terminating
    Instructions:
      1. Review the client's statement and the given stage.
      2. Evaluate the selected skill for appropriateness in the context of the client's statement and the stage.
      3. Assess the generated response for its effectiveness and suitability based on the selected skill.
    Current stage: {stage}
    Current skill: {skill}
  `;

  // Define the routing function
  const functionDef = {
    name: 'judge_response',
    description: 'Judge the skill and response',
    parameters: {
      title: 'evaluationScheme',
      type: 'object',
      properties: {
        skill_suitability: {
          title: 'Skill Suitability',
          type: 'boolean',
          description:
            "Indicates whether the selected skill is appropriate for the client's statement and chosen stage.",
        },
        response_suitability: {
          title: 'Response Suitability',
          type: 'boolean',
          description:
            'Indicates whether the generated response is effective and appropriate based on the selected skill.',
        },
        comments: {
          title: 'Comments',
          type: 'string',
          description: 'Detailed explanation of the evaluation.',
        },
      },
      required: ['skill_suitability', 'response_suitability', 'comments'],
    },
  };

  const toolDef = {
    type: 'function',
    function: functionDef,
  };

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    new MessagesPlaceholder('messages'),
    ['system', 'Give the conversation above, evaluate the response it sutitbale'],
  ]);

  const llm = new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    temperature: 0,
  });

  const selectAndResponse = prompt
    .pipe(
      llm.bindTools([toolDef], {
        tool_choice: toolDef,
      }),
    )
    .pipe(new JsonOutputToolsParser())
    .pipe(x => x[0].args);
  const result = await selectAndResponse.invoke(state, config);
  return {
    evaluation: {
      ...result,
    },
    skill: state.skill,
    sender: 'EvaluateResponse',
  };
};
//
// const res = await supervisorChain.invoke({
//   messages: [new HumanMessage("hi") ],
// })
// console.log('res', res)
