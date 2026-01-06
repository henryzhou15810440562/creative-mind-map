import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

export async function POST(request: NextRequest) {
  try {
    const { word, action, allNodes } = await request.json();

    if (action === 'summarize') {
      // Generate summary based on all nodes
      const nodesList = allNodes.map((n: { chinese: string; english: string }) =>
        `${n.chinese}${n.english ? ` (${n.english})` : ''}`
      ).join(', ');

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `你是一个专业的知识整理助手。用户通过思维导图探索了以下概念和主题：

${nodesList}

请根据这些概念，生成一个结构化的思路框架和学习/实施步骤。

要求：
1. 首先总结这些概念之间的核心关系
2. 提供一个清晰的知识框架（可以用层级结构表示）
3. 给出具体的学习路径或实施步骤（按顺序）
4. 如果有的话，指出关键的技术栈或工具
5. 给出进一步探索的建议

请用中文回答，格式清晰，使用 Markdown 格式。`
          }
        ],
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      return NextResponse.json({ summary: responseText });
    }

    // Generate related words
    if (!word || typeof word !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的词语' },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `你是一个专业的知识图谱助手。给定概念"${word}"，请生成7-8个**直接相关**的专业概念、术语或组成部分。

重要要求：
1. 必须是与"${word}"在**同一领域**内直接相关的概念
2. 如果是技术术语（如 langchain），生成相关的技术组件、框架、概念
3. 如果是学科概念（如 微积分），生成相关的定理、公式、子领域
4. 如果是具体事物，生成其组成部分、相关工具、应用场景
5. **禁止**生成抽象的、诗意的、情感性的词汇（如：探索、希望、梦想、融合、光芒等）
6. 每个词应该是专业术语或具体概念，2-6个字为宜

示例：
- "langchain" → LLM, RAG, Agents, Embeddings, Vector Store, Chains, Prompts, Memory
- "微积分" → 导数, 积分, 极限, 泰勒展开, 微分方程, 黎曼积分, 牛顿-莱布尼茨公式
- "机器学习" → 神经网络, 梯度下降, 过拟合, 交叉验证, 特征工程, 损失函数, 反向传播
- "React" → 组件, Hooks, JSX, 虚拟DOM, 状态管理, Props, Context, useEffect

请直接返回JSON数组，不要有其他内容：
[{"chinese": "概念", "english": "Concept"}]`
        }
      ],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('无法解析响应');
    }

    const words = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ words });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: '生成失败，请重试' },
      { status: 500 }
    );
  }
}
