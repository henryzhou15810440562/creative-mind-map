import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

// 验证环境变量
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not configured');
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

// 常量配置
const MAX_TOKENS = 2048;
const MAX_TOKENS_DETAIL = 1024; // 详细内容使用较少 token
const MODEL = 'claude-sonnet-4-20250514';
const MAX_RETRIES = 1; // 减少重试次数，避免超时

// 类型定义
interface WordData {
  chinese: string;
  english: string;
  detail?: string; // 详细内容（公式、定义等）
  hasDetail?: boolean; // 是否有详细内容
}

interface GenerateRequest {
  word?: string;
  action?: 'summarize' | 'detail';
  allNodes?: WordData[];
  parentPath?: string[];
}

// 重试逻辑
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证 API Key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'API 配置错误，请联系管理员' },
        { status: 500 }
      );
    }

    const body: GenerateRequest = await request.json();

    // 获取详细内容（公式、定义等）
    if (body.action === 'detail') {
      if (!body.word || typeof body.word !== 'string' || body.word.trim().length === 0) {
        return NextResponse.json(
          { error: '请提供有效的词语' },
          { status: 400 }
        );
      }

      const word = body.word.trim();
      const parentPath = body.parentPath || [];
      const contextStr = parentPath.length > 0 ? `在"${parentPath.join(' → ')}"的上下文中，` : '';

      const message = await withRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS_DETAIL,
          messages: [
            {
              role: 'user',
              content: `你是一个专业的知识助手。${contextStr}用户想了解"${word}"的详细内容。

请判断"${word}"是否是一个需要详细解释的概念（如公式、定理、定义、具体方法等）。

如果是，请提供**简洁**的详细内容（不超过 200 字），包括：
- 数学公式：使用简洁的文本格式
- 定理/定义：核心表述
- 方法/步骤：关键步骤

如果不是（只是一个分类或抽象概念），返回空字符串。

返回 JSON 格式：
{
  "hasDetail": true/false,
  "detail": "详细内容（如果有）"
}

示例1 - 基本导数公式：
{
  "hasDetail": true,
  "detail": "常数: (C)' = 0\\n幂函数: (x^n)' = nx^(n-1)\\n指数: (e^x)' = e^x, (a^x)' = a^x·lna\\n对数: (lnx)' = 1/x, (log_a x)' = 1/(x·lna)\\n三角: (sinx)' = cosx, (cosx)' = -sinx\\n      (tanx)' = sec²x"
}

示例2 - 导数（抽象概念）：
{
  "hasDetail": false,
  "detail": ""
}

请直接返回 JSON，不要其他内容。`
            }
          ],
        })
      );

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 返回格式错误');
      }

      const result = JSON.parse(jsonMatch[0]);
      return NextResponse.json(result);
    }

    if (body.action === 'summarize') {
      if (!body.allNodes || body.allNodes.length === 0) {
        return NextResponse.json(
          { error: '没有可总结的内容' },
          { status: 400 }
        );
      }

      const nodesList = body.allNodes
        .map((n) => `${n.chinese}${n.english ? ` (${n.english})` : ''}`)
        .join(', ');

      const message = await withRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
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
        })
      );

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      return NextResponse.json({ summary: responseText });
    }

    // Generate related words with context
    if (!body.word || typeof body.word !== 'string' || body.word.trim().length === 0) {
      return NextResponse.json(
        { error: '请提供有效的词语' },
        { status: 400 }
      );
    }

    const word = body.word.trim();

    // Build context from parent path
    let contextPrompt = '';
    if (body.parentPath && body.parentPath.length > 0) {
      const pathStr = body.parentPath.join(' → ');
      contextPrompt = `
**重要上下文**：用户正在探索的完整路径是：
${pathStr} → ${word}

你必须在这个上下文下生成关联词。比如：
- 如果路径是"如何购买显示器 → 屏幕尺寸"，应该生成具体的尺寸选项如"24寸"、"27寸"、"32寸"、"曲面屏"等
- 如果路径是"如何购买显示器 → 屏幕尺寸 → 宽高比"，应该生成"16:9"、"21:9"、"4:3"、"32:9超宽屏"等
- 如果路径是"微积分 → 导数"，应该生成"导数定义"、"求导法则"、"链式法则"、"隐函数求导"等
- 如果路径是"langchain → Agents"，应该生成"ReAct Agent"、"Tool Calling"、"Agent Executor"等

生成的内容必须是当前节点"${word}"在"${pathStr}"这个主题下的**具体子分类、参数、选项或组成部分**。`;
    }

    const message = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `你是一个专业的知识图谱助手。给定概念"${word}"，请生成7-8个直接相关的子概念。
${contextPrompt}

核心要求：
1. 生成的必须是"${word}"的**直接子分类、具体选项、组成部分或参数**
2. 如果是问题类（如"如何购买X"），生成需要考虑的具体因素
3. 如果是属性类（如"屏幕尺寸"），生成具体的规格、数值范围或选项
4. 如果是概念类（如"导数"），生成其子概念、公式、定理
5. **严禁**生成与上下文无关的概念
6. **严禁**生成抽象的、诗意的词汇

示例：
- "屏幕尺寸"（在购买显示器上下文）→ 24英寸, 27英寸, 32英寸, 曲面屏, 平面屏, 便携屏
- "宽高比"（在屏幕尺寸上下文）→ 16:9标准, 21:9带鱼屏, 32:9超宽屏, 4:3传统, 16:10办公
- "刷新率"（在购买显示器上下文）→ 60Hz, 144Hz, 165Hz, 240Hz, VRR可变刷新
- "导数"（在微积分上下文）→ 导数定义, 求导法则, 链式法则, 高阶导数, 偏导数

请直接返回JSON数组：
[{"chinese": "概念", "english": "Concept"}]`
          }
        ],
      })
    );

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI 返回格式错误');
    }

    const words: WordData[] = JSON.parse(jsonMatch[0]);

    // 验证返回数据
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error('生成的词语列表为空');
    }

    return NextResponse.json({ words });
  } catch (error) {
    console.error('API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    return NextResponse.json(
      { error: `生成失败: ${errorMessage}，请重试` },
      { status: 500 }
    );
  }
}
