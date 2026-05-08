async function translate(text, from, to, options) {
  const { config, utils, setResult } = options;
  const { tauriFetch } = utils;

  const apiKey = (config.apiKey || "").trim();
  const model = (config.model || "").trim();

  const baseUrl = (config.baseUrl || "https://ark.cn-beijing.volces.com/api/v3")
    .trim()
    .replace(/\/+$/, "");

  if (!apiKey) {
    throw "请先在插件配置中填写火山方舟 API Key";
  }

  if (!model) {
    throw "请先在插件配置中填写火山方舟模型 ID";
  }

  const apiUrl = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  const sourceLanguage = from || "自动识别";
  const targetLanguage = to || "简体中文";

  const systemPrompt =
    "你是一个专业的学术文献翻译引擎。你的任务是把原文准确、自然、流畅地翻译成目标语言。" +
    "必须严格遵守以下规则：" +
    "1. 只输出译文，不要解释，不要总结，不要添加标题，不要使用 Markdown。" +
    "2. 保留原文的段落、换行、数字、公式、变量、单位、缩写、引用编号、括号内容、URL、DOI、表格编号、图编号。" +
    "3. 学术术语要准确，中文表达要符合中文学术论文习惯，不要有机器翻译腔。" +
    "4. 人名、机构名、物种拉丁名、基因名、蛋白名、药物名、算法名、数据库名通常保留原文，除非已有通用中文译名。" +
    "5. 对 ambiguous、significant、robust、novel、framework、pipeline、inference、evidence 等学术词，根据上下文选择自然译法，不要机械直译。" +
    "6. 不要擅自省略、扩写、改写原意；不要把不确定内容翻成确定结论。" +
    "7. 如果原文是中文，则翻译成目标语言；如果目标语言和原文相同，则润色为更自然的学术表达。" +
    "8. 保留原文中的专业符号，例如 p < 0.05、95% CI、n = 10、α、β、Δ、±。";

  const userPrompt =
    `请将下面文本从「${sourceLanguage}」翻译成「${targetLanguage}」。\n\n` +
    "要求：忠实、准确、自然，适合学术文献阅读。\n\n" +
    `原文：\n${text}`;

  const body = {
    model: model,
    temperature: 0,
    stream: true,

    // 翻译不需要深度思考，关闭后通常更快
    thinking: {
      type: "disabled"
    },

    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  };

  // 优先使用浏览器 fetch 做真正的流式输出
  if (typeof fetch === "function" && typeof setResult === "function") {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw `Http Request Error\nHttp Status: ${response.status}\n${errorText}`;
    }

    if (!response.body || !response.body.getReader) {
      throw "当前 Pot 环境不支持流式读取 response.body.getReader，请改用非流式版本";
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let translatedText = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line || !line.startsWith("data:")) {
          continue;
        }

        const data = line.replace(/^data:\s*/, "");

        if (data === "[DONE]") {
          continue;
        }

        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content || "";

          if (delta) {
            translatedText += delta;
            setResult(translatedText);
          }
        } catch (_) {
          // 忽略不完整的流式片段
        }
      }
    }

    if (!translatedText) {
      throw "没有收到翻译结果";
    }

    return translatedText.trim();
  }

  // 如果流式不可用，退回普通非流式请求
  body.stream = false;

  const res = await tauriFetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: {
      type: "Json",
      payload: body
    }
  });

  if (!res.ok) {
    throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
  }

  const result = res.data;
  const translatedText = result?.choices?.[0]?.message?.content;

  if (!translatedText) {
    throw `Unexpected Response Format:\n${JSON.stringify(result)}`;
  }

  return translatedText.trim();
}
