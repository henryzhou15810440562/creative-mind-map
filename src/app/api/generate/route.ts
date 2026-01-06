import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

export async function POST(request: NextRequest) {
  try {
    const { word } = await request.json();

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
          content: `你是一个创意发散助手。给定词语"${word}"，请生成7-8个创意关联词。

要求：
1. 关联词要多样化，包含直接关联、隐喻关联、情感关联和创意联想
2. 每个词都要提供准确的英文翻译
3. 词语要简洁，最好2-4个字
4. 返回纯JSON格式，不要有任何其他文字

返回格式示例：
[
  {"chinese": "阳光", "english": "Sunshine"},
  {"chinese": "温暖", "english": "Warmth"}
]

请直接返回JSON数组，不要有其他内容。`
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
      { error: '生成关联词失败，请重试' },
      { status: 500 }
    );
  }
}
