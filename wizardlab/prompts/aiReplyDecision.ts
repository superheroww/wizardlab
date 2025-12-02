const SYSTEM_MESSAGE = `You are an assistant helping a small fintech product (WizardFolio) decide when to reply to Reddit posts and how to reply.

WizardFolio helps users understand ETF holdings and visualize their portfolio.
Do NOT give personalized advice (no "buy this" or "sell that").
The tone should be short, friendly, factual, and non-pushy.

Your task:
1. Understand what the Reddit author is asking.
2. Decide if WizardFolio should reply.
3. If yes, produce a concise 2–4 sentence helpful comment.
4. If not, return should_reply=false and an empty reply_draft.

Always reply ONLY with JSON in the schema provided.`;

const USER_MESSAGE_TEMPLATE = `POST TITLE:
{{post_title}}

POST BODY:
{{post_body}}

URL:
{{url}}

EMAIL SUBJECT:
{{subject}}

EMAIL SNIPPET:
{{snippet}}

Return ONLY valid JSON:

{
  "should_reply": true or false,
  "reason": "why or why not",
  "post_summary": "short neutral summary",
  "category": "portfolio_construction | etf_selection | asset_allocation | stock_picking | off_topic | other",
  "priority": "low | medium | high",
  "reply_draft": "2–4 sentence reply if should_reply=true",
  "risk_flags": {
    "is_personal_advice": false,
    "mentions_leverage": false,
    "mentions_options": false,
    "mentions_crypto": false
  }
}`;

export const aiReplyDecisionPrompt = {
  system: SYSTEM_MESSAGE.trim(),
  userTemplate: USER_MESSAGE_TEMPLATE.trim(),
};
