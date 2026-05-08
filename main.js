async function translate(text, from, to, options) {
  const { config, utils } = options;
  const { tauriFetch: fetch } = utils;

  const apiKey = (config.apiKey || "").trim();
  const model = (config.model || "").trim();

  let baseUrl = (config.baseUrl || "https://ark.cn-beijing.volces.com/api/v3")
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

  const body = {
    model: model,
    temperature: 0,
    stream: false,
    messages: [
      {
        role: "system",
        content:
          "你是一个专业翻译引擎。请严格翻译用户输入的文本。只输出译文，不要解释，不要添加注释，不要使用 Markdown。保留原文中的换行、数字、链接、专有名词和代码格式。"
      },
      {
        role: "user",
        content:
          `请将下面文本从「${sourceLanguage}」翻译成「${targetLanguage}」。\n\n` +
          `原文：\n${text}`
      }
    ]
  };

  const res = await fetch(apiUrl, {
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
