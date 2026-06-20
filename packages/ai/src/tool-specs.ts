import type { ToolSpec } from "./types";

// These tools ARE the Action Registry: the agent calls them now; the workflow
// engine (P6) will invoke the same actions from Trigger→Condition→Action rules.
export const TOOL_SPECS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_product",
      description: "Look up the business's products and prices. Optional name filter.",
      parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Search the business's knowledge base for facts needed to answer the customer.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_checkout_link",
      description: "Create a payment link for a product so the customer can buy it.",
      parameters: { type: "object", properties: { productId: { type: "string" } }, required: ["productId"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "grant_access",
      description: "Grant the customer access (one-time invite link) AFTER payment is confirmed.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "tag_customer",
      description: "Tag the customer for segmentation.",
      parameters: { type: "object", properties: { tag: { type: "string", enum: ["hot", "warm", "cold", "vip"] } }, required: ["tag"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_intent",
      description: "Set the customer's purchase-intent score from 0 to 100.",
      parameters: { type: "object", properties: { intent: { type: "integer", minimum: 0, maximum: 100 } }, required: ["intent"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate",
      description: "Hand the conversation to a human and stop auto-replying.",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "record_lead_answer",
      description: "Record a new lead's answer to an onboarding question, keyed by that question's key.",
      parameters: { type: "object", properties: { key: { type: "string" }, answer: { type: "string" } }, required: ["key", "answer"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_consent",
      description: "Record the customer's explicit consent decision for a purpose. ONLY call this when the customer has clearly agreed or declined in their own words — never assume or infer consent.",
      parameters: { type: "object", properties: { purpose: { type: "string", enum: ["marketing", "ai", "analytics"] }, granted: { type: "boolean" } }, required: ["purpose", "granted"], additionalProperties: false },
    },
  },
];
